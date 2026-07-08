import { afterEach, describe, expect, jest, test } from "@jest/globals";
import {
  buildRateLimitKey,
  consumeTokenBucket,
  createRedisTokenBucketRateLimiter,
} from "./rateLimiter.js";

class FakeRedis {
  constructor(initialBuckets = {}) {
    this.buckets = new Map(Object.entries(initialBuckets));
    this.eval = jest.fn(this.eval.bind(this));
  }

  async eval(
    _script,
    _keyCount,
    key,
    capacity,
    refillRatePerMs,
    nowMs,
    cost,
    ttlMs,
  ) {
    const current = this.buckets.get(key);
    let tokens = current?.tokens;
    let lastRefill = current?.lastRefill;

    if (tokens == null || lastRefill == null) {
      tokens = Number(capacity);
      lastRefill = Number(nowMs);
    }

    const elapsedMs = Math.max(0, Number(nowMs) - Number(lastRefill));
    tokens = Math.min(
      Number(capacity),
      tokens + elapsedMs * Number(refillRatePerMs),
    );

    let allowed = 0;
    let retryAfterMs = 0;
    if (tokens >= Number(cost)) {
      allowed = 1;
      tokens -= Number(cost);
    } else {
      retryAfterMs = Math.ceil(
        (Number(cost) - tokens) / Number(refillRatePerMs),
      );
    }

    this.buckets.set(key, {
      tokens,
      lastRefill: Number(nowMs),
      ttlMs: Number(ttlMs),
    });

    return [allowed, tokens, retryAfterMs];
  }
}

function createMockResponse() {
  const res = {
    headers: {},
    statusCode: null,
    body: null,
  };
  res.set = jest.fn((name, value) => {
    res.headers[name] = value;
    return res;
  });
  res.status = jest.fn((statusCode) => {
    res.statusCode = statusCode;
    return res;
  });
  res.json = jest.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

describe("Redis token bucket rate limiter", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("allows a request when tokens are available", async () => {
    const redis = new FakeRedis();
    const limiter = createRedisTokenBucketRateLimiter({
      redisClient: redis,
      routeName: "auth",
      maxTokens: 5,
      refillRatePerSecond: 5 / 60,
      keyGenerator: () => "ip:127.0.0.1",
      now: () => 1000,
    });
    const next = jest.fn();

    await limiter({ ip: "127.0.0.1", headers: {} }, createMockResponse(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(redis.eval.mock.calls[0][2]).toBe("ratelimit:ip:127_0_0_1:auth");
  });

  test("rejects a request when the bucket is empty", async () => {
    const key = buildRateLimitKey("ip:127.0.0.1", "auth");
    const redis = new FakeRedis({
      [key]: { tokens: 0, lastRefill: 1000 },
    });
    const limiter = createRedisTokenBucketRateLimiter({
      redisClient: redis,
      routeName: "auth",
      maxTokens: 1,
      refillRatePerSecond: 1,
      keyGenerator: () => "ip:127.0.0.1",
      now: () => 1000,
    });
    const res = createMockResponse();
    const next = jest.fn();

    await limiter({ ip: "127.0.0.1", headers: {} }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("1");
    expect(res.body).toEqual({
      error: "Rate limit exceeded",
      retryAfterMs: 1000,
    });
  });

  test("refills tokens after elapsed time", async () => {
    jest.spyOn(Date, "now").mockReturnValue(2000);
    const key = buildRateLimitKey("user:abc", "code-execution");
    const redis = new FakeRedis({
      [key]: { tokens: 0, lastRefill: 1000 },
    });

    const result = await consumeTokenBucket({
      redisClient: redis,
      key,
      maxTokens: 2,
      refillRatePerSecond: 1,
    });

    expect(result.allowed).toBe(true);
    expect(redis.buckets.get(key).tokens).toBe(0);
    expect(redis.buckets.get(key).lastRefill).toBe(2000);
  });

  test("permits only one concurrent request when one token remains", async () => {
    const key = buildRateLimitKey("user:abc", "code-execution");
    const redis = new FakeRedis({
      [key]: { tokens: 1, lastRefill: 1000 },
    });

    const results = await Promise.all([
      consumeTokenBucket({
        redisClient: redis,
        key,
        maxTokens: 1,
        refillRatePerSecond: 1,
        now: () => 1000,
      }),
      consumeTokenBucket({
        redisClient: redis,
        key,
        maxTokens: 1,
        refillRatePerSecond: 1,
        now: () => 1000,
      }),
    ]);

    expect(results.filter((result) => result.allowed)).toHaveLength(1);
    expect(results.filter((result) => !result.allowed)).toHaveLength(1);
    expect(redis.eval).toHaveBeenCalledTimes(2);
  });
});
