import axios from "axios";
import process from "process";
import Analysis from "../server/models/Analysis.js";
import { connectDb } from "./_lib/db.js";
import {
  buildAnalysisPrompt,
  buildFallbackAnalysis,
  parseAnalysisReview,
  sanitizeAnalysisPayload,
} from "../server/services/analysisService.js";

const DEFAULT_LANGUAGE = "cpp";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const PREFERRED_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
];

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim();
}

function getGroqApiKey() {
  return process.env.GROQ_API_KEY?.trim();
}

function getMistralApiKey() {
  return process.env.MISTRAL_API_KEY?.trim();
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

async function listGeminiGenerateContentModels(apiKey) {
  try {
    const response = await axios.get(`${GEMINI_API_BASE_URL}/models`, {
      headers: { "x-goog-api-key": apiKey },
      params: { pageSize: 1000 },
      timeout: 10000,
    });

    return (response.data?.models || [])
      .filter((entry) =>
        entry?.supportedGenerationMethods?.includes("generateContent"),
      )
      .map((entry) => entry?.name?.replace(/^models\//, ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function buildGeminiModelCandidates(discoveredModels = []) {
  const discoveredPreferred = discoveredModels.filter(
    (modelName) =>
      modelName.includes("flash") &&
      !modelName.includes("image") &&
      !modelName.includes("live") &&
      !modelName.includes("tts"),
  );

  return [...new Set([...PREFERRED_GEMINI_MODELS, ...discoveredPreferred])];
}

async function generateWithGemini(prompt, apiKey, generationConfig = {}) {
  const discoveredModels = await listGeminiGenerateContentModels(apiKey);
  const models = buildGeminiModelCandidates(discoveredModels);
  let lastError;

  for (const modelName of models) {
    try {
      const response = await axios.post(
        `${GEMINI_API_BASE_URL}/models/${modelName}:generateContent`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig,
        },
        {
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        },
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return { text, modelName };
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("All Gemini generateContent models failed");
}

async function getAiReview(prompt, apiKey, model = "mistral") {
  if (model === "gemini") {
    const { text } = await generateWithGemini(prompt, apiKey, {
      temperature: 0.2,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    });
    return text;
  }

  if (model === "groq") {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
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

    return response.data?.choices?.[0]?.message?.content || "";
  }

  const response = await axios.post(
    "https://api.mistral.ai/v1/chat/completions",
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
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, language = DEFAULT_LANGUAGE, prompt = "" } = req.body || {};
  const geminiKey = getGeminiApiKey();
  const groqKey = getGroqApiKey();
  const mistralKey = getMistralApiKey();

  if (!code?.trim()) {
    return res.status(400).json({ error: "Missing code" });
  }

  if (!geminiKey && !groqKey && !mistralKey) {
    return res.status(503).json({
      error:
        "AI services are not configured. Add GEMINI_API_KEY, GROQ_API_KEY, or MISTRAL_API_KEY to the deployment environment.",
    });
  }

  try {
    await connectDb();
    const analysisPrompt = buildAnalysisPrompt({ code, language, prompt });
    let review = "";

    if (geminiKey) {
      try {
        review = await getAiReview(analysisPrompt, geminiKey, "gemini");
      } catch {
        // Fall through to the next provider.
      }
    }

    if (!review && groqKey) {
      try {
        review = await getAiReview(analysisPrompt, groqKey, "groq");
      } catch {
        // Fall through to the next provider.
      }
    }

    if (!review && mistralKey) {
      review = await getAiReview(analysisPrompt, mistralKey, "mistral");
    }

    if (!review) {
      return res.status(500).json({
        error: "All configured AI providers failed or returned an empty response.",
      });
    }

    const parsedRaw = parseAnalysisReview(review);
    const parsed = parsedRaw
      ? sanitizeAnalysisPayload(parsedRaw, review)
      : buildFallbackAnalysis(review);

    const analysis = await Analysis.create({
      code,
      language,
      prompt,
      result: parsed,
    });

    return res.status(201).json({
      analysisId: analysis._id.toString(),
      analysis: parsed,
    });
  } catch (error) {
    const errorMsg =
      error.response?.data?.error?.message || error.message || "Unknown error";
    return res.status(500).json({ error: `Analysis failed: ${errorMsg}` });
  }
}
