import express from "express";
import http from "http";
import process from "process";
import { config as loadEnv } from "dotenv";
import { Server } from "socket.io";
import axios from "axios";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Buffer } from "buffer";
import cors from "cors";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import Room from "./models/Room.js";

loadEnv({ path: new URL("./.env", import.meta.url) });

const redisUrl = process.env.REDIS_URL;
let pubClient, subClient;

if (redisUrl) {
  pubClient = new Redis(redisUrl);
  subClient = pubClient.duplicate();
}

// Connect to MongoDB
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/forkspace";
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  process.env.CLIENT_URL || process.env.CORS_ORIGIN,
].filter(Boolean);

const app = express();
app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  }),
);

app.use(express.json());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
});

if (pubClient && subClient) {
  io.adapter(createAdapter(pubClient, subClient));
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", async (req, res) => {
  const { name = "", email = "", password = "" } = req.body || {};
  const normalizedEmail = email.trim().toLowerCase();

  try {
    let user = await User.findOne({ email: normalizedEmail });
    if (user) {
      return res
        .status(409)
        .json({ error: "An account with this email already exists." });
    }

    user = new User({ name, email: normalizedEmail, password });
    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" },
    );

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to register user" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email = "", password = "" } = req.body || {};
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" },
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to login" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    res.json({
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }
});

app.get("/api/auth/history", async (req, res) => {
  const user = await getUserFromAuthHeader(req);

  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.json({
    rooms: user.roomHistory || [],
    runs: user.runHistory || [],
  });
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
});

const SUPPORTED_LANGUAGES = {
  cpp: {
    id: 54,
    label: "C++",
    starterCode:
      '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    cout << "Hello, ForkSpace!";\n    return 0;\n}\n',
  },
  javascript: {
    id: 63,
    label: "JavaScript",
    starterCode:
      'function main() {\n  console.log("Hello, ForkSpace!");\n}\n\nmain();\n',
  },
  python: {
    id: 71,
    label: "Python",
    starterCode:
      'def main():\n    print("Hello, ForkSpace!")\n\n\nif __name__ == "__main__":\n    main()\n',
  },
};

const DEFAULT_LANGUAGE = "cpp";
const roomStateMap = new Map();
const dataDirectory = path.join(process.cwd(), "server", "data");
const roomStateFile = path.join(dataDirectory, "room-state.json");
const userStateFile = path.join(dataDirectory, "user-state.json");
let persistTimer = null;
let userPersistTimer = null;
let userState = {
  users: [],
  roomHistoryByUser: {},
  runHistoryByUser: {},
};

function getLanguageConfig(language) {
  return SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
}

function createDefaultProblemState() {
  return {
    platform: "custom",
    problemCode: "",
    problemUrl: "",
    sourceUrl: "",
    title: "Untitled Practice Problem",
    prompt: "",
    pastedStatement: "",
    sampleInput: "",
    sampleOutput: "",
    samples: [],
  };
}

function createDefaultSessionState() {
  return {
    mode: "peer_practice",
    driverSocketId: "",
    navigatorSocketId: "",
    approachNotes: "",
    edgeCaseChecklist: [
      { id: "empty", label: "Empty input", checked: false },
      { id: "single", label: "Single element", checked: false },
      { id: "duplicates", label: "Duplicates", checked: false },
      { id: "limits", label: "Limits (min/max)", checked: false },
      { id: "overflow", label: "Potential overflow", checked: false },
    ],
    runHistory: [],
    mentorNotes: "",
  };
}

function attachNormalizedSession(session = {}) {
  const defaults = createDefaultSessionState();
  return {
    ...defaults,
    ...(session || {}),
    mode:
      typeof session?.mode === "string" && session.mode.trim()
        ? session.mode
        : defaults.mode,
    driverSocketId:
      typeof session?.driverSocketId === "string"
        ? session.driverSocketId
        : defaults.driverSocketId,
    navigatorSocketId:
      typeof session?.navigatorSocketId === "string"
        ? session.navigatorSocketId
        : defaults.navigatorSocketId,
    approachNotes:
      typeof session?.approachNotes === "string"
        ? session.approachNotes
        : defaults.approachNotes,
    edgeCaseChecklist: Array.isArray(session?.edgeCaseChecklist)
      ? session.edgeCaseChecklist
      : defaults.edgeCaseChecklist,
    runHistory: Array.isArray(session?.runHistory)
      ? session.runHistory
      : defaults.runHistory,
    mentorNotes:
      typeof session?.mentorNotes === "string"
        ? session.mentorNotes
        : defaults.mentorNotes,
  };
}

function createDefaultRoomState() {
  const defaultConfig = getLanguageConfig(DEFAULT_LANGUAGE);

  return {
    language: DEFAULT_LANGUAGE,
    code: defaultConfig.starterCode,
    session: createDefaultSessionState(),
    problem: createDefaultProblemState(),
  };
}

async function loadPersistedRoomStates() {
  try {
    await mkdir(dataDirectory, { recursive: true });
    const fileContent = await readFile(roomStateFile, "utf8");
    const parsed = JSON.parse(fileContent);

    Object.entries(parsed).forEach(([roomId, roomState]) => {
      const nextLanguage = SUPPORTED_LANGUAGES[roomState?.language]
        ? roomState.language
        : DEFAULT_LANGUAGE;
      const defaultConfig = getLanguageConfig(nextLanguage);

      roomStateMap.set(roomId, {
        language: nextLanguage,
        code:
          typeof roomState?.code === "string"
            ? roomState.code
            : defaultConfig.starterCode,
        session: attachNormalizedSession(roomState?.session || {}),
        problem: attachNormalizedSamples(roomState?.problem || {}),
      });
    });
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to load room state persistence:", error.message);
    }
  }
}

async function persistRoomStates() {
  await mkdir(dataDirectory, { recursive: true });
  const serializableState = Object.fromEntries(roomStateMap.entries());
  await writeFile(
    roomStateFile,
    JSON.stringify(serializableState, null, 2),
    "utf8",
  );
}

async function loadPersistedUserState() {
  try {
    await mkdir(dataDirectory, { recursive: true });
    const fileContent = await readFile(userStateFile, "utf8");
    const parsed = JSON.parse(fileContent);

    userState = {
      users: Array.isArray(parsed?.users) ? parsed.users : [],
      roomHistoryByUser: parsed?.roomHistoryByUser || {},
      runHistoryByUser: parsed?.runHistoryByUser || {},
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to load user state persistence:", error.message);
    }
  }
}

async function persistUserState() {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(userStateFile, JSON.stringify(userState, null, 2), "utf8");
}

function scheduleRoomStatePersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistRoomStates().catch((error) => {
      console.error("Failed to persist room state:", error.message);
    });
  }, 250);
}

function scheduleUserStatePersist() {
  if (userPersistTimer) {
    clearTimeout(userPersistTimer);
  }

  userPersistTimer = setTimeout(() => {
    userPersistTimer = null;
    persistUserState().catch((error) => {
      console.error("Failed to persist user state:", error.message);
    });
  }, 250);
}

async function flushRoomStatePersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  try {
    await persistRoomStates();
  } catch (error) {
    console.error("Failed to flush room state persistence:", error.message);
  }
}

async function flushUserStatePersist() {
  if (userPersistTimer) {
    clearTimeout(userPersistTimer);
    userPersistTimer = null;
  }

  try {
    await persistUserState();
  } catch (error) {
    console.error("Failed to flush user state persistence:", error.message);
  }
}

function getOrCreateRoomState(roomId) {
  if (!roomStateMap.has(roomId)) {
    roomStateMap.set(roomId, createDefaultRoomState());
    scheduleRoomStatePersist();
  }

  return roomStateMap.get(roomId);
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, originalHash] = String(storedHash || "").split(":");

  if (!salt || !originalHash) {
    return false;
  }

  const derivedHash = crypto.scryptSync(password, salt, 64);
  const originalBuffer = Buffer.from(originalHash, "hex");

  return (
    derivedHash.length === originalBuffer.length &&
    crypto.timingSafeEqual(derivedHash, originalBuffer)
  );
}

function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded =
    normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function signAuthToken(payload) {
  const secret = process.env.JWT_SECRET || "forkspace-dev-secret";
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const body = encodeBase64Url(JSON.stringify({ ...payload, exp: expiresAt }));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${header}.${body}.${signature}`;
}

function verifyAuthToken(token) {
  try {
    const secret = process.env.JWT_SECRET || "forkspace-dev-secret";
    const [header, body, signature] = token.split(".");

    if (!header || !body || !signature) {
      return null;
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${body}`)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    if (signature !== expectedSignature) {
      return null;
    }

    const payload = JSON.parse(decodeBase64Url(body));

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function getUserFromAuthHeader(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    return await User.findById(decoded.userId);
  } catch (err) {
    return null;
  }
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function extractAiText(responseData) {
  const firstChoice = responseData?.choices?.[0];

  return (
    firstChoice?.message?.content ||
    firstChoice?.delta?.content ||
    firstChoice?.text ||
    firstChoice?.completion ||
    ""
  );
}

function inferLanguageFromCode(code = "") {
  if (
    code.includes("#include") ||
    code.includes("using namespace std") ||
    code.includes("int main(")
  ) {
    return "cpp";
  }

  if (
    code.includes("def ") ||
    code.includes("print(") ||
    code.includes("__name__")
  ) {
    return "python";
  }

  if (
    code.includes("function ") ||
    code.includes("console.log") ||
    code.includes("const ") ||
    code.includes("let ")
  ) {
    return "javascript";
  }

  return DEFAULT_LANGUAGE;
}

function buildFallbackHint(prompt = "", suffix = "") {
  const combined = `${prompt}\n${suffix}`;
  const language = inferLanguageFromCode(combined);

  if (language === "cpp") {
    if (
      prompt.includes("int main(") &&
      !prompt.includes("return 0;") &&
      suffix.includes("}")
    ) {
      return "\n    return 0;";
    }

    if (prompt.trim().endsWith('cout << "Hello, ForkSpace!"')) {
      return " << endl;";
    }
  }

  if (language === "javascript") {
    if (prompt.trim().endsWith('console.log("Hello, ForkSpace!")')) {
      return ";";
    }

    if (prompt.includes("function main()") && !prompt.includes("main();")) {
      return "\n\nmain();";
    }
  }

  if (language === "python") {
    if (prompt.trim().endsWith('if __name__ == "__main__":')) {
      return "\n    main()";
    }
  }

  return "";
}

function buildFallbackHints(code = "", beforeCursor = "", afterCursor = "") {
  const language = inferLanguageFromCode(
    code || `${beforeCursor}\n${afterCursor}`,
  );
  const suggestions = [];

  if (language === "cpp") {
    if (!code.includes("return 0;") && code.includes("int main(")) {
      suggestions.push(
        "Add `return 0;` before the closing brace of `main` to make the program exit explicitly.",
      );
    }
    if (
      !code.includes("#include <bits/stdc++.h>") &&
      !code.includes("#include <iostream>")
    ) {
      suggestions.push(
        "Add the required include directives before using `cout`, containers, or algorithms.",
      );
    }
    suggestions.push(
      "For competitive programming, keep input/output fast and move the core logic into a helper function for easier debugging.",
    );
  }

  if (language === "javascript") {
    if (!code.includes("main();") && code.includes("function main()")) {
      suggestions.push(
        "Call `main();` after defining the function so the program actually runs.",
      );
    }
    suggestions.push(
      "Prefer small functions for parsing input, solving the task, and printing output separately.",
    );
  }

  if (language === "python") {
    if (!code.includes('if __name__ == "__main__":')) {
      suggestions.push(
        'Add an `if __name__ == "__main__":` guard to keep the entry point clear.',
      );
    }
    suggestions.push(
      "Keep parsing, solving, and printing in separate functions so the solution is easier to test.",
    );
  }

  suggestions.push(
    "Test one edge case and one normal case after every small change to catch regressions early.",
  );

  return [...new Set(suggestions)].slice(0, 5);
}

function getMistralApiKey() {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey || apiKey.toLowerCase().includes("your_")) return "";
  return apiKey;
}

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey.toLowerCase().includes("your_")) return "";
  return apiKey;
}

async function getAiReview(prompt, apiKey, model = "mistral") {
  if (model === "gemini") {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    try {
      const response = await axios.post(
        geminiUrl,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
            topP: 0.95,
            topK: 40,
          },
        },
        { timeout: 15000 },
      );

      if (
        !response.data ||
        !response.data.candidates ||
        response.data.candidates.length === 0
      ) {
        console.error("Gemini API: No candidates in response", response.data);
        return "The AI provider returned an empty response. Please try again.";
      }

      const candidate = response.data.candidates[0];
      if (
        candidate.finishReason === "SAFETY" ||
        candidate.finishReason === "OTHER"
      ) {
        return "The AI response was filtered or blocked by the provider's safety policies.";
      }

      const text = candidate.content?.parts?.[0]?.text;
      if (!text) {
        console.error("Gemini API: No text in candidate content", candidate);
        return "The AI provider returned a response without text content.";
      }

      return text;
    } catch (error) {
      const errorData = error.response?.data;
      const errorMessage = error.message;
      console.error(
        "Gemini API error detail:",
        JSON.stringify(errorData || errorMessage),
      );
      throw new Error(
        errorData?.error?.message || errorMessage || "Gemini API call failed",
      );
    }
  }

  // Default to Mistral
  try {
    const response = await axios.post(
      "https://codestral.mistral.ai/v1/chat/completions",
      {
        model: "codestral-latest",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      },
    );
    return extractAiText(response.data);
  } catch (error) {
    console.error(
      "Mistral API error detail:",
      error.response?.data || error.message,
    );
    throw error;
  }
}

async function upsertRecentRoom(userId, roomEntry) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const nextHistory = [
      {
        ...roomEntry,
        updatedAt: new Date(),
      },
      ...(user.roomHistory || []).filter(
        (entry) => entry.roomId !== roomEntry.roomId,
      ),
    ].slice(0, 12);

    user.roomHistory = nextHistory;
    await user.save();
  } catch (err) {
    console.error("Error updating room history:", err);
  }
}

async function appendRunHistory(userId, runEntry) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    user.runHistory = [
      {
        ...runEntry,
        createdAt: new Date(),
      },
      ...(user.runHistory || []),
    ].slice(0, 30);

    await user.save();
  } catch (err) {
    console.error("Error updating run history:", err);
  }
}

function decodeHtmlEntities(value = "") {
  const entityMap = {
    "&lt;": "<",
    "&gt;": ">",
    "&amp;": "&",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
  };

  return value
    .replace(
      /&(lt|gt|amp|quot|#39|nbsp);/g,
      (match) => entityMap[match] || match,
    )
    .replace(/&#(\d+);/g, (_match, codePoint) =>
      String.fromCharCode(Number(codePoint)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, codePoint) =>
      String.fromCharCode(parseInt(codePoint, 16)),
    );
}

function stripHtml(value = "") {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(
        /<\/(p|div|section|article|li|ul|ol|pre|h1|h2|h3|h4|h5|h6|tr|td)>/gi,
        "\n",
      )
      .replace(/<li>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractPreformattedText(value = "") {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<div>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\r/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeWhitespace(value = "") {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function normalizeForComparison(value = "") {
  return normalizeWhitespace(value)
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

function buildSamplesFromJoinedText(sampleInput = "", sampleOutput = "") {
  const inputs = normalizeWhitespace(sampleInput)
    .split(/\n\s*\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const outputs = normalizeWhitespace(sampleOutput)
    .split(/\n\s*\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const length = Math.max(inputs.length, outputs.length);

  return Array.from({ length }, (_, index) => ({
    id: `sample-${index + 1}`,
    input: inputs[index] || "",
    output: outputs[index] || "",
  })).filter((sample) => sample.input || sample.output);
}

function attachNormalizedSamples(problem = {}) {
  const normalizedProblem = {
    ...createDefaultProblemState(),
    ...problem,
  };
  const samples =
    Array.isArray(problem?.samples) && problem.samples.length > 0
      ? problem.samples
          .map((sample, index) => ({
            id: sample.id || `sample-${index + 1}`,
            input: normalizeWhitespace(sample.input || ""),
            output: normalizeWhitespace(sample.output || ""),
          }))
          .filter((sample) => sample.input || sample.output)
      : buildSamplesFromJoinedText(
          normalizedProblem.sampleInput,
          normalizedProblem.sampleOutput,
        );

  return {
    ...normalizedProblem,
    problemUrl:
      normalizedProblem.problemUrl || normalizedProblem.sourceUrl || "",
    pastedStatement: normalizedProblem.pastedStatement || "",
    sampleInput: normalizeWhitespace(normalizedProblem.sampleInput),
    sampleOutput: normalizeWhitespace(normalizedProblem.sampleOutput),
    samples,
  };
}

function normalizeCodeforcesProblemCode(problemCode = "") {
  const normalized = problemCode.replace(/\s+/g, "").replace(/[-_/]/g, "");
  const match = normalized.match(/^(\d+)([A-Za-z][A-Za-z0-9]*)$/);

  if (!match) {
    return null;
  }

  return {
    contestId: match[1],
    index: match[2].toUpperCase(),
  };
}

function buildCodeforcesCandidateUrls(normalizedProblem, sourceUrl = "") {
  const urls = [];

  if (sourceUrl?.trim()) {
    try {
      const parsedUrl = new URL(sourceUrl.trim());
      const normalizedHost = parsedUrl.hostname.replace(/^m1\./i, "");
      const sourceMatch = parsedUrl.pathname.match(
        /\/(?:problemset\/problem|contest)\/(\d+)\/(?:problem\/)?([A-Za-z][A-Za-z0-9]*)/i,
      );

      if (
        normalizedHost === "codeforces.com" &&
        sourceMatch?.[1] === normalizedProblem.contestId &&
        sourceMatch?.[2]?.toUpperCase() === normalizedProblem.index
      ) {
        parsedUrl.hostname = "codeforces.com";
        urls.push(parsedUrl.toString());
      }
    } catch {
      // Ignore malformed source URLs and fall back to canonical Codeforces pages.
    }
  }

  urls.push(
    `https://codeforces.com/problemset/problem/${normalizedProblem.contestId}/${normalizedProblem.index}`,
  );
  urls.push(
    `https://codeforces.com/contest/${normalizedProblem.contestId}/problem/${normalizedProblem.index}`,
  );

  return [...new Set(urls)];
}

function extractLeetCodeExampleOutputs(content = "") {
  const textContent = stripHtml(content);
  const outputMatches = [
    ...textContent.matchAll(
      /Output:\s*([\s\S]*?)(?=\n(?:Explanation|Example \d+:|Constraints:|Follow-up:|$))/g,
    ),
  ];

  return outputMatches
    .map((match) => match[1].trim())
    .filter(Boolean)
    .join("\n\n");
}

function extractCodeforcesPrompt(html = "") {
  const titleRegex = /<div class="title">[\s\S]*?<\/div>/i;
  const titleMatch = titleRegex.exec(html);

  if (!titleMatch) {
    return "";
  }

  const promptStart = titleMatch.index + titleMatch[0].length;
  const sampleIndex = html.indexOf('<div class="sample-test">', promptStart);
  const promptEnd =
    sampleIndex >= 0
      ? sampleIndex
      : html.indexOf('<div class="note">', promptStart);

  if (promptEnd < 0) {
    return "";
  }

  return stripHtml(html.slice(promptStart, promptEnd));
}

function extractCodeforcesSamples(html = "") {
  const sampleInputs = [
    ...html.matchAll(
      /<div class="input">[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/gi,
    ),
  ]
    .map((match) => extractPreformattedText(match[1]))
    .filter(Boolean);
  const sampleOutputs = [
    ...html.matchAll(
      /<div class="output">[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/gi,
    ),
  ]
    .map((match) => extractPreformattedText(match[1]))
    .filter(Boolean);

  return {
    sampleInput: sampleInputs.join("\n\n"),
    sampleOutput: sampleOutputs.join("\n\n"),
  };
}

function extractCodeforcesSamplesFromText(html = "") {
  const text = stripHtml(html);
  const normalizedText = text.replace(/\n[ \t]+/g, "\n").trim();
  const pairs = [];
  const examplesAnchor = normalizedText.search(
    /(?:^|\n)(?:Examples?|Sample(?:s| Test)?)\s*\n/i,
  );
  const scanText =
    examplesAnchor >= 0 ? normalizedText.slice(examplesAnchor) : normalizedText;
  const lines = scanText.split("\n").map((line) => line.trimEnd());

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^Input$/i.test(lines[index].trim())) {
      continue;
    }

    const inputLines = [];
    const outputLines = [];
    let cursor = index + 1;

    while (cursor < lines.length && !/^Output$/i.test(lines[cursor].trim())) {
      inputLines.push(lines[cursor]);
      cursor += 1;
    }

    if (cursor >= lines.length) {
      break;
    }

    cursor += 1;

    while (
      cursor < lines.length &&
      !/^Input$/i.test(lines[cursor].trim()) &&
      !/^(Note|Notes|Scoring|Tutorial|Explanation|Codeforces)$/i.test(
        lines[cursor].trim(),
      )
    ) {
      outputLines.push(lines[cursor]);
      cursor += 1;
    }

    pairs.push({
      input: inputLines.join("\n").trim(),
      output: outputLines.join("\n").trim(),
    });

    index = cursor - 1;
  }

  return {
    sampleInput: pairs
      .map((pair) => pair.input)
      .filter(Boolean)
      .join("\n\n"),
    sampleOutput: pairs
      .map((pair) => pair.output)
      .filter(Boolean)
      .join("\n\n"),
  };
}

function parseExamplesFromText(statement = "") {
  const lines = normalizeWhitespace(statement).split("\n");
  const samples = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^Input:?$/i.test(lines[index].trim())) {
      continue;
    }

    const inputLines = [];
    const outputLines = [];
    let cursor = index + 1;

    while (cursor < lines.length && !/^Output:?$/i.test(lines[cursor].trim())) {
      inputLines.push(lines[cursor]);
      cursor += 1;
    }

    if (cursor >= lines.length) {
      break;
    }

    cursor += 1;

    while (
      cursor < lines.length &&
      !/^Input:?$/i.test(lines[cursor].trim()) &&
      !/^(Explanation|Note|Notes|Constraints|Follow-up|Scoring|Tutorial):?$/i.test(
        lines[cursor].trim(),
      )
    ) {
      outputLines.push(lines[cursor]);
      cursor += 1;
    }

    samples.push({
      id: `sample-${samples.length + 1}`,
      input: normalizeWhitespace(inputLines.join("\n")),
      output: normalizeWhitespace(outputLines.join("\n")),
    });

    index = cursor - 1;
  }

  return samples.filter((sample) => sample.input || sample.output);
}

function inferTitleFromStatement(statement = "") {
  const [firstLine = "Imported Practice Problem"] =
    normalizeWhitespace(statement).split("\n");
  return firstLine.length > 0 && firstLine.length < 120
    ? firstLine
    : "Imported Practice Problem";
}

function deriveProblemMetadataFromUrl(problemUrl = "") {
  const parsedUrl = new URL(problemUrl.trim());
  const hostname = parsedUrl.hostname.replace(/^m1\./i, "");

  if (hostname === "codeforces.com") {
    const match = parsedUrl.pathname.match(
      /\/(?:problemset\/problem|contest)\/(\d+)\/(?:problem\/)?([A-Za-z][A-Za-z0-9]*)/i,
    );

    if (!match) {
      throw new Error("That Codeforces URL does not look like a problem page.");
    }

    const problemCode = `${match[1]}${match[2].toUpperCase()}`;

    return {
      platform: "codeforces",
      problemCode,
      problemUrl: parsedUrl.toString(),
      sourceUrl: parsedUrl.toString(),
      title: `Codeforces ${problemCode}`,
    };
  }

  if (hostname === "leetcode.com") {
    const match = parsedUrl.pathname.match(/\/problems\/([a-z0-9-]+)\//i);

    if (!match) {
      throw new Error("That LeetCode URL does not look like a problem page.");
    }

    return {
      platform: "leetcode",
      problemCode: match[1],
      problemUrl: parsedUrl.toString(),
      sourceUrl: parsedUrl.toString(),
      title: `LeetCode ${match[1]}`,
    };
  }

  throw new Error(
    "URL import currently supports Codeforces and LeetCode only.",
  );
}

async function importCodeforcesProblem(problemCode, sourceUrl = "") {
  const normalized = normalizeCodeforcesProblemCode(problemCode);

  if (!normalized) {
    throw new Error("Use a Codeforces code like 1885A or 1941B.");
  }

  const candidateUrls = buildCodeforcesCandidateUrls(normalized, sourceUrl);
  let lastErrorMessage = "Codeforces import failed.";

  for (const candidateUrl of candidateUrls) {
    try {
      const response = await axios.get(candidateUrl, {
        timeout: 12000,
        headers: {
          "User-Agent": "Mozilla/5.0 ForkSpace Problem Importer",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      const html = response.data;
      if (/Please wait\. Your browser is being checked/i.test(html)) {
        lastErrorMessage = `Codeforces temporarily blocked automated access for ${candidateUrl}.`;
        continue;
      }
      const titleMatch =
        html.match(/<div class="title">([\s\S]*?)<\/div>/i) ||
        html.match(/<title>[\s\S]*?-\s*([^<]+?)\s*-\s*Codeforces<\/title>/i);
      const prompt = extractCodeforcesPrompt(html);
      const htmlSamples = extractCodeforcesSamples(html);
      const textSamples =
        !htmlSamples.sampleInput && !htmlSamples.sampleOutput
          ? extractCodeforcesSamplesFromText(html)
          : { sampleInput: "", sampleOutput: "" };
      const sampleInput = htmlSamples.sampleInput || textSamples.sampleInput;
      const sampleOutput = htmlSamples.sampleOutput || textSamples.sampleOutput;

      if (!sampleInput && !sampleOutput) {
        lastErrorMessage = `Fetched ${candidateUrl} but could not extract sample tests.`;
        continue;
      }

      return {
        platform: "codeforces",
        problemCode: `${normalized.contestId}${normalized.index}`,
        problemUrl: candidateUrl,
        sourceUrl: candidateUrl,
        title:
          stripHtml(titleMatch?.[1] || "") ||
          `Codeforces ${normalized.contestId}${normalized.index}`,
        prompt,
        sampleInput,
        sampleOutput,
        samples: buildSamplesFromJoinedText(sampleInput, sampleOutput),
      };
    } catch (error) {
      const upstreamStatus = error.response?.status;
      lastErrorMessage = upstreamStatus
        ? `Codeforces responded with status ${upstreamStatus} for ${candidateUrl}.`
        : `Could not reach ${candidateUrl}.`;
    }
  }

  throw new Error(lastErrorMessage);
}

async function resolveLeetCodeSlug(problemCode = "") {
  const trimmed = problemCode.trim();

  if (!trimmed) {
    throw new Error(
      "Add a LeetCode problem id like 1235 or a slug like two-sum.",
    );
  }

  if (/^[a-z0-9-]+$/i.test(trimmed) && /[a-z]/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error("Use a numeric LeetCode id like 1235 or a problem slug.");
  }

  const response = await axios.get("https://leetcode.com/api/problems/all/", {
    headers: {
      "User-Agent": "Mozilla/5.0 ForkSpace Problem Importer",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const matchingProblem = response.data?.stat_status_pairs?.find((item) => {
    const frontendId = String(item?.stat?.frontend_question_id || "");
    const questionId = String(item?.stat?.question_id || "");
    return frontendId === trimmed || questionId === trimmed;
  });

  if (!matchingProblem?.stat?.question__title_slug) {
    throw new Error(`LeetCode problem ${trimmed} was not found.`);
  }

  return matchingProblem.stat.question__title_slug;
}

async function importLeetCodeProblem(problemCode, sourceUrl = "") {
  const slug = await resolveLeetCodeSlug(problemCode);
  const nextSourceUrl = sourceUrl || `https://leetcode.com/problems/${slug}/`;
  const response = await axios.post(
    "https://leetcode.com/graphql/",
    {
      query: `
        query problemImport($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            title
            content
            exampleTestcases
          }
        }
      `,
      variables: {
        titleSlug: slug,
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        Referer: nextSourceUrl,
        "User-Agent": "Mozilla/5.0 ForkSpace Problem Importer",
      },
    },
  );

  const question = response.data?.data?.question;

  if (!question) {
    throw new Error("Failed to fetch the LeetCode problem details.");
  }

  return {
    platform: "leetcode",
    problemCode: problemCode.trim(),
    problemUrl: nextSourceUrl,
    sourceUrl: nextSourceUrl,
    title: question.title || `LeetCode ${problemCode.trim()}`,
    prompt: stripHtml(question.content || ""),
    sampleInput: (question.exampleTestcases || "").replace(/\r/g, "").trim(),
    sampleOutput: extractLeetCodeExampleOutputs(question.content || ""),
    samples: buildSamplesFromJoinedText(
      question.exampleTestcases || "",
      extractLeetCodeExampleOutputs(question.content || ""),
    ),
  };
}

async function importProblemFromUrl(problemUrl) {
  let metadata;

  try {
    metadata = deriveProblemMetadataFromUrl(problemUrl);
  } catch {
    throw new Error("Enter a valid Codeforces or LeetCode problem URL.");
  }

  if (metadata.platform === "codeforces") {
    return importCodeforcesProblem(metadata.problemCode, metadata.problemUrl);
  }

  return importLeetCodeProblem(metadata.problemCode, metadata.problemUrl);
}

function importProblemFromText(statement = "") {
  const normalizedStatement = normalizeWhitespace(statement);

  if (!normalizedStatement) {
    throw new Error("Paste a problem statement before parsing.");
  }

  const samples = parseExamplesFromText(normalizedStatement);

  return attachNormalizedSamples({
    title: inferTitleFromStatement(normalizedStatement),
    prompt: normalizedStatement,
    pastedStatement: normalizedStatement,
    sampleInput: samples.map((sample) => sample.input).join("\n\n"),
    sampleOutput: samples.map((sample) => sample.output).join("\n\n"),
    samples,
  });
}

app.post("/api/ai-hint", aiLimiter, async (req, res) => {
  try {
    const { prompt, suffix } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const mistralApiKey = getMistralApiKey();
    const geminiApiKey = getGeminiApiKey();

    if (!mistralApiKey && !geminiApiKey) {
      return res.json({
        hint: buildFallbackHint(prompt, suffix),
        source: "fallback",
      });
    }

    let hint;
    if (geminiApiKey) {
      const fullPrompt = `Based on this code context, provide a single, very short code completion (just the next few characters or line).
Code before cursor:
${prompt}
Code after cursor:
${suffix}
Return ONLY the completion text, no explanation.`;
      hint = await getAiReview(fullPrompt, geminiApiKey, "gemini");
    } else {
      const response = await axios.post(
        "https://codestral.mistral.ai/v1/fim/completions",
        {
          model: "codestral-latest",
          prompt,
          suffix: suffix || "",
          max_tokens: 128,
          temperature: 0.2,
          stop: ["\n\n"],
        },
        {
          headers: {
            Authorization: `Bearer ${mistralApiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 8000,
        },
      );
      hint = extractAiText(response.data);
    }

    return res.json({
      hint: hint || buildFallbackHint(prompt, suffix),
      source: hint ? (geminiApiKey ? "gemini" : "mistral") : "fallback",
    });
  } catch (error) {
    return res.json({
      hint: buildFallbackHint(req.body?.prompt, req.body?.suffix),
      source: "fallback",
      warning:
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Failed to fetch AI hint",
    });
  }
});

app.post("/api/ai-hints", aiLimiter, async (req, res) => {
  try {
    const { code, beforeCursor, afterCursor } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Missing code", hints: [] });
    }

    const mistralApiKey = getMistralApiKey();
    const geminiApiKey = getGeminiApiKey();

    if (!mistralApiKey && !geminiApiKey) {
      return res.json({
        hints: buildFallbackHints(code, beforeCursor, afterCursor),
        source: "fallback",
      });
    }

    const suggestions = [];

    if (geminiApiKey) {
      const prompt = `Code:\n${code}\n\nBefore cursor:\n${beforeCursor}\n\nAfter cursor:\n${afterCursor}\n\nBased on the current code and cursor position, provide 3-5 short, helpful DSA-oriented code completion suggestions or hints. Keep them very brief and in a plain JSON array format like ["hint1", "hint2"]. Do not include markdown or explanations.`;
      const review = await getAiReview(prompt, geminiApiKey, "gemini");
      try {
        // More robust JSON extraction for AI responses that might include markdown
        const jsonStart = review.indexOf("[");
        const jsonEnd = review.lastIndexOf("]") + 1;
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonText = review.substring(jsonStart, jsonEnd);
          const parsed = JSON.parse(jsonText);
          if (Array.isArray(parsed)) {
            suggestions.push(
              ...parsed.filter((s) => typeof s === "string" && s.trim()),
            );
          }
        } else if (review.trim()) {
          // Fallback: treat the whole response as one hint if no array found
          suggestions.push(review.trim().split("\n")[0]);
        }
      } catch (err) {
        console.error("AI hints parse error:", err.message);
        if (review && review.length < 200) suggestions.push(review.trim());
      }
    } else if (mistralApiKey) {
      if (beforeCursor && afterCursor) {
        const response = await axios.post(
          "https://codestral.mistral.ai/v1/fim/completions",
          {
            model: "codestral-latest",
            prompt: beforeCursor,
            suffix: afterCursor,
            max_tokens: 64,
            temperature: 0.3,
            stop: ["\n\n"],
          },
          {
            headers: {
              Authorization: `Bearer ${mistralApiKey}`,
              "Content-Type": "application/json",
            },
            timeout: 8000,
          },
        );

        const hint = extractAiText(response.data);
        if (hint.trim()) {
          suggestions.push(hint.trim());
        }
      }

      const response = await axios.post(
        "https://codestral.mistral.ai/v1/fim/completions",
        {
          model: "codestral-latest",
          prompt: code,
          suffix: "",
          max_tokens: 64,
          temperature: 0.4,
        },
        {
          headers: {
            Authorization: `Bearer ${mistralApiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 8000,
        },
      );

      const hint = extractAiText(response.data);
      if (hint.trim()) {
        suggestions.push(hint.trim());
      }
    }

    const uniqueSuggestions = [...new Set(suggestions)].slice(0, 5);

    return res.json({
      hints:
        uniqueSuggestions.length > 0
          ? uniqueSuggestions
          : buildFallbackHints(code, beforeCursor, afterCursor),
      source:
        uniqueSuggestions.length > 0
          ? geminiApiKey
            ? "gemini"
            : "mistral"
          : "fallback",
    });
  } catch (error) {
    const errorMsg =
      error.response?.data?.error?.message || error.message || "Unknown error";
    console.error("AI hints error:", errorMsg);
    return res.json({
      warning: errorMsg,
      hints: buildFallbackHints(
        req.body?.code,
        req.body?.beforeCursor,
        req.body?.afterCursor,
      ),
      source: "fallback",
    });
  }
});

app.post("/api/ai/review", aiLimiter, async (req, res) => {
  const { code, problem, language } = req.body || {};
  const mistralKey = getMistralApiKey();
  const geminiKey = getGeminiApiKey();

  if (!code) return res.status(400).json({ error: "Missing code" });
  if (!mistralKey && !geminiKey) {
    return res.status(503).json({
      error:
        "AI services are not configured. Please add MISTRAL_API_KEY or GEMINI_API_KEY to your .env file.",
    });
  }

  const prompt = `Review this solution for the problem: "${problem?.title || "Untitled"}".
Problem Description: ${problem?.prompt || problem?.pastedStatement || "No description provided."}
Language: ${language}

Return ONLY valid JSON with this exact shape:
{
  "bugs": ["bug description 1", "bug description 2"],
  "time_complexity": "O(n)",
  "space_complexity": "O(1)",
  "style_issues": ["issue 1"],
  "summary": "one sentence overall assessment"
}

Code to review:
\`\`\`${language}
${code}
\`\`\``;

  try {
    let review;
    if (geminiKey) {
      review = await getAiReview(prompt, geminiKey, "gemini");
    } else {
      review = await getAiReview(prompt, mistralKey, "mistral");
    }

    if (!review) {
      return res.status(500).json({
        error:
          "The AI provider returned an empty response. This might be due to safety filters or a temporary service issue.",
      });
    }

    // Try to extract JSON if AI wrapped it in markdown
    let jsonResponse;
    try {
      const jsonStart = review.indexOf("{");
      const jsonEnd = review.lastIndexOf("}") + 1;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonResponse = JSON.parse(review.substring(jsonStart, jsonEnd));
      } else {
        jsonResponse = JSON.parse(review);
      }
    } catch (e) {
      // Fallback if not JSON
      jsonResponse = {
        bugs: [],
        time_complexity: "N/A",
        space_complexity: "N/A",
        style_issues: [],
        summary: review,
      };
    }

    res.json(jsonResponse);
  } catch (error) {
    const errorMsg =
      error.response?.data?.error?.message || error.message || "Unknown error";
    console.error("AI review error:", errorMsg);
    res.status(500).json({
      error: `AI Review failed: ${errorMsg}. Please check your API key and connection.`,
    });
  }
});

app.post("/api/problem-import", async (req, res) => {
  try {
    const {
      platform = "custom",
      problemCode = "",
      sourceUrl = "",
    } = req.body || {};

    if (!problemCode.trim()) {
      return res
        .status(400)
        .json({ error: "Add a problem code before importing." });
    }

    let importedProblem = null;

    if (platform === "codeforces") {
      importedProblem = await importCodeforcesProblem(problemCode, sourceUrl);
    } else if (platform === "leetcode") {
      importedProblem = await importLeetCodeProblem(problemCode, sourceUrl);
    } else {
      return res.status(400).json({
        error:
          "Automatic import is supported for Codeforces and LeetCode right now.",
      });
    }

    return res.json({ problem: importedProblem });
  } catch (error) {
    return res.status(502).json({
      error: error.message || "Failed to import the problem details.",
    });
  }
});

app.post("/api/problem-import-url", async (req, res) => {
  try {
    const { problemUrl = "" } = req.body || {};

    if (!problemUrl.trim()) {
      return res
        .status(400)
        .json({ error: "Add a problem URL before importing." });
    }

    const problem = attachNormalizedSamples(
      await importProblemFromUrl(problemUrl),
    );
    return res.json({ problem });
  } catch (error) {
    try {
      const metadata = attachNormalizedSamples(
        deriveProblemMetadataFromUrl(req.body?.problemUrl || ""),
      );
      const warning = error.message || "Automatic import failed for this URL.";

      return res.json({
        problem: metadata,
        warning: `${warning} We saved the platform and problem code. Paste the statement below and use "Parse pasted statement" to extract the examples.`,
      });
    } catch {
      return res.status(400).json({
        error: error.message || "Failed to import the problem from URL.",
      });
    }
  }
});

app.post("/api/problem-import-text", async (req, res) => {
  try {
    const { statement = "" } = req.body || {};
    const problem = importProblemFromText(statement);

    return res.json({ problem });
  } catch (error) {
    return res.status(400).json({
      error: error.message || "Failed to parse the pasted statement.",
    });
  }
});

function encodeBase64Utf8(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

function decodeBase64Utf8(value) {
  return Buffer.from(value, "base64").toString("utf8");
}

async function executeSubmission({
  code,
  stdin = "",
  languageId = getLanguageConfig(DEFAULT_LANGUAGE).id,
}) {
  const createOptions = (useBase64 = false) => ({
    method: "POST",
    url: `${process.env.JUDGE0_API_URL}/submissions`,
    params: {
      ...(useBase64 ? { base64_encoded: "true" } : {}),
      wait: "true",
      fields: "*",
    },
    headers: {
      "x-rapidapi-key": process.env.JUDGE0_API_KEY,
      "x-rapidapi-host": "judge0-ce.p.rapidapi.com",
      "Content-Type": "application/json",
    },
    data: {
      language_id: languageId,
      source_code: useBase64 ? encodeBase64Utf8(code) : code,
      stdin: useBase64 ? encodeBase64Utf8(stdin) : stdin,
    },
  });

  let response;

  try {
    response = await axios.request(createOptions(false));
  } catch (error) {
    const apiError = error.response?.data?.error;
    const shouldRetryWithBase64 =
      typeof apiError === "string" &&
      apiError.includes("use base64_encoded=true");

    if (!shouldRetryWithBase64) {
      throw error;
    }

    response = await axios.request(createOptions(true));
  }

  const usedBase64 = response.config?.params?.base64_encoded === "true";
  const payload = response.data;

  return {
    ...payload,
    stdout:
      usedBase64 && payload.stdout
        ? decodeBase64Utf8(payload.stdout)
        : payload.stdout,
    stderr:
      usedBase64 && payload.stderr
        ? decodeBase64Utf8(payload.stderr)
        : payload.stderr,
    compile_output:
      usedBase64 && payload.compile_output
        ? decodeBase64Utf8(payload.compile_output)
        : payload.compile_output,
    message:
      usedBase64 && payload.message
        ? decodeBase64Utf8(payload.message)
        : payload.message,
  };
}

app.post("/api/run-code", async (req, res) => {
  const {
    code,
    stdin = "",
    languageId = getLanguageConfig(DEFAULT_LANGUAGE).id,
    roomId = "",
  } = req.body;
  const supportedLanguageIds = new Set(
    Object.values(SUPPORTED_LANGUAGES).map(({ id }) => id),
  );
  const authenticatedUser = await getUserFromAuthHeader(req);

  if (!code) {
    return res.status(400).json({ error: "Missing code" });
  }

  if (!supportedLanguageIds.has(languageId)) {
    return res.status(400).json({ error: "Unsupported language" });
  }

  if (!process.env.JUDGE0_API_URL || !process.env.JUDGE0_API_KEY) {
    return res.status(503).json({ error: "Judge0 is not configured" });
  }

  try {
    const execution = await executeSubmission({ code, stdin, languageId });

    if (authenticatedUser) {
      const roomState = roomId ? getOrCreateRoomState(roomId) : null;
      await appendRunHistory(authenticatedUser._id, {
        roomId: roomId || null,
        languageId,
        languageLabel:
          Object.values(SUPPORTED_LANGUAGES).find(
            (language) => language.id === languageId,
          )?.label || "Unknown",
        problemTitle: roomState?.problem?.title || "Untitled Practice Problem",
        problemCode: roomState?.problem?.problemCode || "",
        status: execution.compile_output
          ? "compile_error"
          : execution.stderr
            ? "runtime_error"
            : "completed",
      });
    }

    return res.json(execution);
  } catch (error) {
    return res.status(error.response?.status || 500).json({
      error:
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Error running code",
    });
  }
});

app.post("/api/run-sample-suite", async (req, res) => {
  const {
    code,
    languageId = getLanguageConfig(DEFAULT_LANGUAGE).id,
    samples = [],
  } = req.body || {};
  const supportedLanguageIds = new Set(
    Object.values(SUPPORTED_LANGUAGES).map(({ id }) => id),
  );
  const authenticatedUser = await getUserFromAuthHeader(req);
  const roomId = req.body?.roomId || "";

  if (!code) {
    return res.status(400).json({ error: "Missing code" });
  }

  if (!supportedLanguageIds.has(languageId)) {
    return res.status(400).json({ error: "Unsupported language" });
  }

  if (!Array.isArray(samples) || samples.length === 0) {
    return res
      .status(400)
      .json({ error: "No sample tests are available for this problem yet." });
  }

  if (!process.env.JUDGE0_API_URL || !process.env.JUDGE0_API_KEY) {
    return res.status(503).json({ error: "Judge0 is not configured" });
  }

  try {
    const results = [];

    for (const [index, sample] of samples.entries()) {
      const execution = await executeSubmission({
        code,
        stdin: sample.input || "",
        languageId,
      });

      results.push({
        id: sample.id || `sample-${index + 1}`,
        index: index + 1,
        input: sample.input || "",
        expectedOutput: sample.output || "",
        actualOutput: execution.stdout || "",
        passed:
          !execution.compile_output &&
          !execution.stderr &&
          normalizeForComparison(execution.stdout || "") ===
            normalizeForComparison(sample.output || ""),
        time: execution.time || null,
        memory: execution.memory || null,
        compile_output: execution.compile_output || "",
        stderr: execution.stderr || "",
        message: execution.message || "",
      });

      if (execution.compile_output) {
        break;
      }
    }

    if (authenticatedUser) {
      const roomState = roomId ? getOrCreateRoomState(roomId) : null;
      await appendRunHistory(authenticatedUser._id, {
        roomId: roomId || null,
        languageId,
        languageLabel:
          Object.values(SUPPORTED_LANGUAGES).find(
            (language) => language.id === languageId,
          )?.label || "Unknown",
        problemTitle: roomState?.problem?.title || "Untitled Practice Problem",
        problemCode: roomState?.problem?.problemCode || "",
        status: results.every((result) => result.passed)
          ? "samples_passed"
          : "samples_failed",
      });
    }

    return res.json({
      results,
      summary: {
        total: results.length,
        passed: results.filter((result) => result.passed).length,
        failed: results.filter((result) => !result.passed).length,
      },
    });
  } catch (error) {
    return res.status(error.response?.status || 500).json({
      error:
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Error running the sample suite",
    });
  }
});

// Socket.io connection handlers

const userSocketMap = {};

function getUsersInRoom(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId]?.username,
        role: userSocketMap[socketId]?.role || "Peer",
        isOnline: true,
      };
    },
  );
}

io.on("connection", (socket) => {
  // console.log('socket connected', socket.id); // remove in prod

  socket.on(
    "join",
    async ({ roomId, username, role, authToken, sessionMode }) => {
      let roomState = roomStateMap.get(roomId);

      if (!roomState) {
        try {
          const savedRoom = await Room.findOne({ roomId });
          if (savedRoom) {
            roomState = {
              ...createDefaultRoomState(),
              code: savedRoom.code,
              language: savedRoom.language,
            };
            roomStateMap.set(roomId, roomState);
          } else {
            roomState = getOrCreateRoomState(roomId);
          }
        } catch (err) {
          console.error("Error fetching room from MongoDB:", err);
          roomState = getOrCreateRoomState(roomId);
        }
      }

      const authPayload = authToken
        ? jwt.verify(authToken, process.env.JWT_SECRET || "secret")
        : null;
      let authenticatedUser = null;
      if (authPayload?.userId) {
        authenticatedUser = await User.findById(authPayload.userId);
      }
      const resolvedUsername = authenticatedUser?.name || username;

      userSocketMap[socket.id] = {
        username: resolvedUsername,
        role: role || "Peer",
        userId: authenticatedUser?._id || null,
      };
      socket.join(roomId);

      if (sessionMode && roomState.session.mode !== sessionMode) {
        roomState.session = attachNormalizedSession({
          ...roomState.session,
          mode: sessionMode,
        });
        scheduleRoomStatePersist();
      }

      const users = getUsersInRoom(roomId);

      users.forEach(({ socketId }) => {
        io.to(socketId).emit("joined", {
          users,
          username: resolvedUsername,
          role: userSocketMap[socket.id].role,
          socketId: socket.id,
        });
      });

      if (authenticatedUser) {
        upsertRecentRoom(authenticatedUser._id, {
          roomId,
          role: role || "Peer",
          username: resolvedUsername,
          problemTitle: roomState.problem?.title || "Untitled Practice Problem",
          problemCode: roomState.problem?.problemCode || "",
        });
      }

      socket.emit("room-state", roomState);
    },
  );

  socket.on("code-change", ({ roomId, code }) => {
    const roomState = getOrCreateRoomState(roomId);
    roomState.code = code;
    scheduleRoomStatePersist();
    socket.in(roomId).emit("code-change", { code });
  });

  socket.on("language-change", ({ roomId, language }) => {
    const roomState = getOrCreateRoomState(roomId);
    const nextLanguage = SUPPORTED_LANGUAGES[language]
      ? language
      : DEFAULT_LANGUAGE;

    roomState.language = nextLanguage;
    scheduleRoomStatePersist();

    io.to(roomId).emit("language-change", {
      language: nextLanguage,
    });
  });

  socket.on("problem-update", ({ roomId, problem }) => {
    const roomState = getOrCreateRoomState(roomId);
    roomState.problem = attachNormalizedSamples({
      ...roomState.problem,
      ...(problem || {}),
    });
    scheduleRoomStatePersist();

    const authenticatedUsers = getUsersInRoom(roomId)
      .map((user) => userSocketMap[user.socketId]?.userId)
      .filter(Boolean);

    authenticatedUsers.forEach((userId) => {
      upsertRecentRoom(userId, {
        roomId,
        role: userSocketMap[socket.id]?.role || "Peer",
        username: userSocketMap[socket.id]?.username || "Anonymous",
        problemTitle: roomState.problem?.title || "Untitled Practice Problem",
        problemCode: roomState.problem?.problemCode || "",
      });
    });

    io.to(roomId).emit("problem-update", {
      problem: roomState.problem,
    });
  });

  socket.on("session-update", ({ roomId, session }) => {
    const roomState = getOrCreateRoomState(roomId);
    roomState.session = attachNormalizedSession({
      ...roomState.session,
      ...(session || {}),
    });
    scheduleRoomStatePersist();

    io.to(roomId).emit("session-update", {
      session: roomState.session,
    });
  });

  socket.on("swap-roles", ({ roomId }) => {
    const roomState = getOrCreateRoomState(roomId);
    const { driverSocketId, navigatorSocketId } = roomState.session;

    roomState.session = attachNormalizedSession({
      ...roomState.session,
      driverSocketId: navigatorSocketId,
      navigatorSocketId: driverSocketId,
    });
    scheduleRoomStatePersist();

    io.to(roomId).emit("session-update", {
      session: roomState.session,
    });
  });

  socket.on("run-history-update", ({ roomId, run }) => {
    const roomState = getOrCreateRoomState(roomId);
    const nextRun = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...(run || {}),
    };

    roomState.session.runHistory = [
      nextRun,
      ...roomState.session.runHistory,
    ].slice(0, 10);
    scheduleRoomStatePersist();

    io.to(roomId).emit("session-update", {
      session: roomState.session,
    });
  });

  socket.on("disconnecting", async () => {
    const rooms = [...socket.rooms];
    for (const roomId of rooms) {
      const roomState = roomStateMap.get(roomId);

      if (roomState) {
        // Save to MongoDB on disconnect
        try {
          await Room.findOneAndUpdate(
            { roomId },
            {
              code: roomState.code,
              language: roomState.language,
              updatedAt: new Date(),
            },
            { upsert: true },
          );
        } catch (err) {
          console.error("Error saving room to MongoDB:", err);
        }

        if (roomState.session) {
          const nextSession = attachNormalizedSession({
            ...roomState.session,
            driverSocketId:
              roomState.session.driverSocketId === socket.id
                ? ""
                : roomState.session.driverSocketId,
            navigatorSocketId:
              roomState.session.navigatorSocketId === socket.id
                ? ""
                : roomState.session.navigatorSocketId,
          });

          const sessionChanged =
            nextSession.driverSocketId !== roomState.session.driverSocketId ||
            nextSession.navigatorSocketId !==
              roomState.session.navigatorSocketId;

          if (sessionChanged) {
            roomState.session = nextSession;
            scheduleRoomStatePersist();
            socket.in(roomId).emit("session-update", {
              session: roomState.session,
            });
          }
        }

        socket.in(roomId).emit("left", {
          socketId: socket.id,
          username: userSocketMap[socket.id]?.username,
        });
      }
    }
    delete userSocketMap[socket.id];
    socket.leave();
  });
});

const PORT = process.env.PORT || 5000;

await loadPersistedRoomStates();
await loadPersistedUserState();

process.on("SIGINT", async () => {
  await flushRoomStatePersist();
  await flushUserStatePersist();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await flushRoomStatePersist();
  await flushUserStatePersist();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Socket origins: ${allowedOrigins.join(", ")}`);
});
