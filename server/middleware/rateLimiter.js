/*
 * ForkSpace uses token buckets instead of fixed-window counters because fixed
 * windows can double-burst at boundaries: a client can send the full limit at
 * the end of one window and another full limit at the start of the next. Token
 * buckets smooth that traffic while still allowing a controlled burst up to
 * the bucket capacity.
 *
 * Redis is the backing store because ForkSpace may run multiple Node instances
 * behind a load balancer. An in-memory limiter would give each instance its own
 * bucket, so limits would be inconsistent across the fleet.
 */

export const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRatePerMs = tonumber(ARGV[2])
local nowMs = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local ttlMs = tonumber(ARGV[5])

local bucket = redis.call("HMGET", key, "tokens", "lastRefill")
local tokens = tonumber(bucket[1])
local lastRefill = tonumber(bucket[2])

if tokens == nil or lastRefill == nil then
  tokens = capacity
  lastRefill = nowMs
end

local elapsedMs = math.max(0, nowMs - lastRefill)
tokens = math.min(capacity, tokens + (elapsedMs * refillRatePerMs))

local allowed = 0
local retryAfterMs = 0

if tokens >= cost then
  allowed = 1
  tokens = tokens - cost
else
  retryAfterMs = math.ceil((cost - tokens) / refillRatePerMs)
end

redis.call("HSET", key, "tokens", tokens, "lastRefill", nowMs)
redis.call("PEXPIRE", key, ttlMs)

return { allowed, tokens, retryAfterMs }
`;

let loggedMissingRedisClient = false;

function sanitizeKeyPart(value) {
  return String(value || "anonymous").replace(/[^a-zA-Z0-9:_-]/g, "_");
}

export function buildRateLimitKey(identifier, routeName) {
  return `ratelimit:${sanitizeKeyPart(identifier)}:${sanitizeKeyPart(routeName)}`;
}

function getBucketTtlMs(maxTokens, refillRatePerSecond) {
  const fullRefillMs = (maxTokens / refillRatePerSecond) * 1000;
  return Math.ceil(Math.max(fullRefillMs * 2, 60 * 1000));
}

export async function consumeTokenBucket({
  redisClient,
  key,
  maxTokens,
  refillRatePerSecond,
  cost = 1,
  now = Date.now,
}) {
  if (!redisClient) {
    if (!loggedMissingRedisClient) {
      console.warn(
        "Redis rate limiter disabled: no Redis client available; allowing requests without rate limiting.",
      );
      loggedMissingRedisClient = true;
    }
    return { allowed: true, retryAfterMs: 0, disabled: true };
  }

  const refillRatePerMs = refillRatePerSecond / 1000;
  const ttlMs = getBucketTtlMs(maxTokens, refillRatePerSecond);

  const result = await redisClient.eval(
    TOKEN_BUCKET_SCRIPT,
    1,
    key,
    maxTokens,
    refillRatePerMs,
    now(),
    cost,
    ttlMs,
  );

  return {
    allowed: Number(result?.[0]) === 1,
    tokens: Number(result?.[1] || 0),
    retryAfterMs: Math.max(0, Number(result?.[2] || 0)),
  };
}

export function createRedisTokenBucketRateLimiter({
  redisClient,
  routeName,
  maxTokens,
  refillRatePerSecond,
  keyGenerator = (req) => req.ip || req.socket?.remoteAddress || "unknown",
  now = Date.now,
}) {
  return async function redisTokenBucketRateLimiter(req, res, next) {
    try {
      const identifier = await keyGenerator(req);
      const key = buildRateLimitKey(identifier, routeName);

      // The Lua script makes refill/check/deduct atomic. Without atomicity, two
      // simultaneous requests could both read "1 token left" and both pass.
      const result = await consumeTokenBucket({
        redisClient,
        key,
        maxTokens,
        refillRatePerSecond,
        now,
      });

      if (result.allowed) {
        return next();
      }

      res.set("Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
      return res.status(429).json({
        error: "Rate limit exceeded",
        retryAfterMs: result.retryAfterMs,
      });
    } catch (error) {
      console.error("Redis rate limiter failed:", error.message);
      return next();
    }
  };
}
