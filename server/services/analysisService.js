const DEFAULT_ANALYSIS_SUMMARY =
  "Analysis generated. Review bugs and optimization suggestions below.";

export function buildAnalysisPrompt({
  code,
  language = "cpp",
  prompt = "",
}) {
  return `You are reviewing a DSA solution pasted into ForkSpace.
Language: ${language}
Optional problem context: ${prompt || "Not provided"}

Return ONLY valid JSON in this exact shape:
{
  "bugs": ["specific edge case or bug 1", "specific edge case or bug 2", "specific edge case or bug 3"],
  "time_complexity": "O(n)",
  "space_complexity": "O(1)",
  "complexity_reasoning": "one or two sentences explaining why those complexities apply to this exact solution",
  "style_issues": ["optional readability issue"],
  "optimization_suggestion": {
    "before": "a short before snippet or description from the current code",
    "after": "a short after snippet or concrete change",
    "benefit": "why the change improves complexity, clarity, or robustness"
  },
  "summary": "one sentence describing how good this solution currently is"
}

Rules:
- Be specific to the pasted code.
- Do not invent a different algorithm unless needed for the optimization suggestion.
- Keep bug findings concrete and interview-relevant.
- If the code is already good, say what remains risky.

Code:
\`\`\`${language}
${code}
\`\`\``;
}

function toStr(value) {
  return value == null ? "" : String(value).trim();
}

function stripCodeFences(text) {
  return text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/^\s*json\s*/i, "")
    .trim();
}

function dedupeStrings(values = [], limit = 6) {
  return [...new Set(values.map((value) => toStr(value)).filter(Boolean))].slice(
    0,
    limit,
  );
}

function tryParseJson(candidate) {
  if (!candidate) return null;

  const attempts = [
    candidate,
    candidate.replace(/,\s*([}\]])/g, "$1"),
    candidate
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, "$1"),
  ];

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (typeof parsed === "string") {
        try {
          const nested = JSON.parse(parsed);
          if (nested && typeof nested === "object") return nested;
        } catch {
          // Keep trying remaining candidates.
        }
      }
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function extractListFromSection(text, headingPattern) {
  const match = text.match(
    new RegExp(
      `${headingPattern}\\s*[:\\-]?\\s*([\\s\\S]*?)(?=\\n\\s*[A-Za-z][A-Za-z _]{2,40}\\s*[:\\-]|$)`,
      "i",
    ),
  );

  if (!match?.[1]) return [];

  return dedupeStrings(
    match[1]
      .split("\n")
      .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
      .filter(Boolean),
    6,
  );
}

function extractSingleLineValue(text, label) {
  const match = text.match(new RegExp(`${label}\\s*[:\\-]\\s*([^\\n]+)`, "i"));
  return toStr(match?.[1]);
}

function extractOptimizationSuggestion(text) {
  return {
    before: extractSingleLineValue(text, "before"),
    after: extractSingleLineValue(text, "after"),
    benefit: extractSingleLineValue(text, "benefit"),
  };
}

function inferStructuredAnalysis(rawReview = "") {
  const text = stripCodeFences(String(rawReview || ""));
  if (!text) return null;

  const bugs = extractListFromSection(
    text,
    "(?:bugs|edge cases|missed edge cases|risks|issues)",
  );
  const styleIssues = extractListFromSection(text, "(?:style issues|readability)");
  const timeComplexity = extractSingleLineValue(
    text,
    "(?:time complexity|time)",
  );
  const spaceComplexity = extractSingleLineValue(
    text,
    "(?:space complexity|space)",
  );
  const complexityReasoning = extractSingleLineValue(
    text,
    "(?:complexity reasoning|reasoning|why)",
  );
  const summary =
    extractSingleLineValue(text, "summary") ||
    text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("{") && !line.startsWith('"'));
  const optimizationSuggestion = extractOptimizationSuggestion(text);

  const hasUsefulSignal =
    bugs.length > 0 ||
    styleIssues.length > 0 ||
    timeComplexity ||
    spaceComplexity ||
    complexityReasoning ||
    summary ||
    optimizationSuggestion.before ||
    optimizationSuggestion.after ||
    optimizationSuggestion.benefit;

  if (!hasUsefulSignal) return null;

  return {
    bugs,
    time_complexity: timeComplexity,
    space_complexity: spaceComplexity,
    complexity_reasoning: complexityReasoning,
    style_issues: styleIssues,
    optimization_suggestion: optimizationSuggestion,
    summary,
  };
}

export function sanitizeAnalysisPayload(payload, rawText = "") {
  const obj = payload && typeof payload === "object" ? payload : {};
  const optimizationObj =
    obj.optimization_suggestion && typeof obj.optimization_suggestion === "object"
      ? obj.optimization_suggestion
      : {};

  return {
    bugs: dedupeStrings(obj.bugs, 6),
    time_complexity: toStr(obj.time_complexity) || "N/A",
    space_complexity: toStr(obj.space_complexity) || "N/A",
    complexity_reasoning: toStr(obj.complexity_reasoning),
    style_issues: dedupeStrings(obj.style_issues, 6),
    optimization_suggestion: {
      before: toStr(optimizationObj.before),
      after: toStr(optimizationObj.after),
      benefit: toStr(optimizationObj.benefit),
    },
    summary: toStr(obj.summary) || DEFAULT_ANALYSIS_SUMMARY,
    raw_text: toStr(rawText).slice(0, 2400),
  };
}

export function parseAnalysisReview(rawReview = "") {
  const text = String(rawReview || "").trim();
  if (!text) return null;

  const candidates = [text, stripCodeFences(text)];
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1).trim());
  }

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate);
    if (parsed) return parsed;
  }

  return inferStructuredAnalysis(text);
}

export function buildFallbackAnalysis(rawReview = "") {
  return sanitizeAnalysisPayload(
    {
      bugs: [],
      time_complexity: "N/A",
      space_complexity: "N/A",
      complexity_reasoning: "",
      style_issues: [],
      optimization_suggestion: null,
      summary:
        "AI response format was invalid. Showing the raw output below so the analysis page still stays useful.",
    },
    rawReview,
  );
}
