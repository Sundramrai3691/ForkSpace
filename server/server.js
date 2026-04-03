import express from 'express';
import http from 'http';
import process from 'process';
import { config as loadEnv } from 'dotenv';
import { Server } from 'socket.io';
import axios from 'axios';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Buffer } from 'buffer';
import cors from 'cors';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

loadEnv({ path: new URL('./.env', import.meta.url) });

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  process.env.CLIENT_URL || process.env.CORS_ORIGIN,
].filter(Boolean);

const app = express();
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
}));
app.use(express.json());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['polling', 'websocket'],
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
});

const SUPPORTED_LANGUAGES = {
  cpp: {
    id: 54,
    label: 'C++',
    starterCode: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    cout << "Hello, ForkSpace!";\n    return 0;\n}\n',
  },
  javascript: {
    id: 63,
    label: 'JavaScript',
    starterCode: 'function main() {\n  console.log("Hello, ForkSpace!");\n}\n\nmain();\n',
  },
  python: {
    id: 71,
    label: 'Python',
    starterCode: 'def main():\n    print("Hello, ForkSpace!")\n\n\nif __name__ == "__main__":\n    main()\n',
  },
};

const DEFAULT_LANGUAGE = 'cpp';
const roomStateMap = new Map();
const dataDirectory = path.join(process.cwd(), 'server', 'data');
const roomStateFile = path.join(dataDirectory, 'room-state.json');
let persistTimer = null;

function getLanguageConfig(language) {
  return SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
}

function createDefaultProblemState() {
  return {
    platform: 'custom',
    problemCode: '',
    sourceUrl: '',
    title: 'Untitled Practice Problem',
    prompt: '',
    sampleInput: '',
    sampleOutput: '',
  };
}

function createDefaultRoomState() {
  const defaultConfig = getLanguageConfig(DEFAULT_LANGUAGE);

  return {
    language: DEFAULT_LANGUAGE,
    code: defaultConfig.starterCode,
    problem: createDefaultProblemState(),
  };
}

async function loadPersistedRoomStates() {
  try {
    await mkdir(dataDirectory, { recursive: true });
    const fileContent = await readFile(roomStateFile, 'utf8');
    const parsed = JSON.parse(fileContent);

    Object.entries(parsed).forEach(([roomId, roomState]) => {
      const nextLanguage = SUPPORTED_LANGUAGES[roomState?.language] ? roomState.language : DEFAULT_LANGUAGE;
      const defaultConfig = getLanguageConfig(nextLanguage);

      roomStateMap.set(roomId, {
        language: nextLanguage,
        code: typeof roomState?.code === 'string' ? roomState.code : defaultConfig.starterCode,
        problem: {
          ...createDefaultProblemState(),
          ...(roomState?.problem || {}),
        },
      });
    });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to load room state persistence:', error.message);
    }
  }
}

async function persistRoomStates() {
  await mkdir(dataDirectory, { recursive: true });
  const serializableState = Object.fromEntries(roomStateMap.entries());
  await writeFile(roomStateFile, JSON.stringify(serializableState, null, 2), 'utf8');
}

function scheduleRoomStatePersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistRoomStates().catch((error) => {
      console.error('Failed to persist room state:', error.message);
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
    console.error('Failed to flush room state persistence:', error.message);
  }
}

function getOrCreateRoomState(roomId) {
  if (!roomStateMap.has(roomId)) {
    roomStateMap.set(roomId, createDefaultRoomState());
    scheduleRoomStatePersist();
  }

  return roomStateMap.get(roomId);
}

function extractAiText(responseData) {
  const firstChoice = responseData?.choices?.[0];

  return (
    firstChoice?.message?.content ||
    firstChoice?.delta?.content ||
    firstChoice?.text ||
    firstChoice?.completion ||
    ''
  );
}

function inferLanguageFromCode(code = '') {
  if (code.includes('#include') || code.includes('using namespace std') || code.includes('int main(')) {
    return 'cpp';
  }

  if (code.includes('def ') || code.includes('print(') || code.includes('__name__')) {
    return 'python';
  }

  if (code.includes('function ') || code.includes('console.log') || code.includes('const ') || code.includes('let ')) {
    return 'javascript';
  }

  return DEFAULT_LANGUAGE;
}

function buildFallbackHint(prompt = '', suffix = '') {
  const combined = `${prompt}\n${suffix}`;
  const language = inferLanguageFromCode(combined);

  if (language === 'cpp') {
    if (prompt.includes('int main(') && !prompt.includes('return 0;') && suffix.includes('}')) {
      return '\n    return 0;';
    }

    if (prompt.trim().endsWith('cout << "Hello, ForkSpace!"')) {
      return ' << endl;';
    }
  }

  if (language === 'javascript') {
    if (prompt.trim().endsWith('console.log("Hello, ForkSpace!")')) {
      return ';';
    }

    if (prompt.includes('function main()') && !prompt.includes('main();')) {
      return '\n\nmain();';
    }
  }

  if (language === 'python') {
    if (prompt.trim().endsWith('if __name__ == "__main__":')) {
      return '\n    main()';
    }
  }

  return '';
}

function buildFallbackHints(code = '', beforeCursor = '', afterCursor = '') {
  const language = inferLanguageFromCode(code || `${beforeCursor}\n${afterCursor}`);
  const suggestions = [];

  if (language === 'cpp') {
    if (!code.includes('return 0;') && code.includes('int main(')) {
      suggestions.push('Add `return 0;` before the closing brace of `main` to make the program exit explicitly.');
    }
    if (!code.includes('#include <bits/stdc++.h>') && !code.includes('#include <iostream>')) {
      suggestions.push('Add the required include directives before using `cout`, containers, or algorithms.');
    }
    suggestions.push('For competitive programming, keep input/output fast and move the core logic into a helper function for easier debugging.');
  }

  if (language === 'javascript') {
    if (!code.includes('main();') && code.includes('function main()')) {
      suggestions.push('Call `main();` after defining the function so the program actually runs.');
    }
    suggestions.push('Prefer small functions for parsing input, solving the task, and printing output separately.');
  }

  if (language === 'python') {
    if (!code.includes('if __name__ == "__main__":')) {
      suggestions.push('Add an `if __name__ == "__main__":` guard to keep the entry point clear.');
    }
    suggestions.push('Keep parsing, solving, and printing in separate functions so the solution is easier to test.');
  }

  suggestions.push('Test one edge case and one normal case after every small change to catch regressions early.');

  return [...new Set(suggestions)].slice(0, 5);
}

function decodeHtmlEntities(value = '') {
  const entityMap = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': '\'',
    '&nbsp;': ' ',
  };

  return value
    .replace(/&(lt|gt|amp|quot|#39|nbsp);/g, (match) => entityMap[match] || match)
    .replace(/&#(\d+);/g, (_match, codePoint) => String.fromCharCode(Number(codePoint)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, codePoint) => String.fromCharCode(parseInt(codePoint, 16)));
}

function stripHtml(value = '') {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|article|li|ul|ol|pre|h1|h2|h3|h4|h5|h6|tr|td)>/gi, '\n')
      .replace(/<li>/gi, '- ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractPreformattedText(value = '') {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<div>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\r/g, '')
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeCodeforcesProblemCode(problemCode = '') {
  const normalized = problemCode.replace(/\s+/g, '').replace(/[-_/]/g, '');
  const match = normalized.match(/^(\d+)([A-Za-z][A-Za-z0-9]*)$/);

  if (!match) {
    return null;
  }

  return {
    contestId: match[1],
    index: match[2].toUpperCase(),
  };
}

function extractLeetCodeExampleOutputs(content = '') {
  const textContent = stripHtml(content);
  const outputMatches = [...textContent.matchAll(/Output:\s*([\s\S]*?)(?=\n(?:Explanation|Example \d+:|Constraints:|Follow-up:|$))/g)];

  return outputMatches
    .map((match) => match[1].trim())
    .filter(Boolean)
    .join('\n\n');
}

function extractCodeforcesPrompt(html = '') {
  const titleRegex = /<div class="title">[\s\S]*?<\/div>/i;
  const titleMatch = titleRegex.exec(html);

  if (!titleMatch) {
    return '';
  }

  const promptStart = titleMatch.index + titleMatch[0].length;
  const sampleIndex = html.indexOf('<div class="sample-test">', promptStart);
  const promptEnd = sampleIndex >= 0 ? sampleIndex : html.indexOf('<div class="note">', promptStart);

  if (promptEnd < 0) {
    return '';
  }

  return stripHtml(html.slice(promptStart, promptEnd));
}

function extractCodeforcesSamples(html = '') {
  const sampleInputs = [...html.matchAll(/<div class="input">[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/gi)]
    .map((match) => extractPreformattedText(match[1]))
    .filter(Boolean);
  const sampleOutputs = [...html.matchAll(/<div class="output">[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/gi)]
    .map((match) => extractPreformattedText(match[1]))
    .filter(Boolean);

  return {
    sampleInput: sampleInputs.join('\n\n'),
    sampleOutput: sampleOutputs.join('\n\n'),
  };
}

async function importCodeforcesProblem(problemCode, sourceUrl = '') {
  const normalized = normalizeCodeforcesProblemCode(problemCode);

  if (!normalized) {
    throw new Error('Use a Codeforces code like 1885A or 1941B.');
  }

  const nextSourceUrl = sourceUrl || `https://codeforces.com/problemset/problem/${normalized.contestId}/${normalized.index}`;
  const response = await axios.get(nextSourceUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 ForkSpace Problem Importer',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const html = response.data;
  const titleMatch = html.match(/<div class="title">([\s\S]*?)<\/div>/i) || html.match(/<title>[\s\S]*?-\s*([^<]+?)\s*-\s*Codeforces<\/title>/i);
  const prompt = extractCodeforcesPrompt(html);
  const { sampleInput, sampleOutput } = extractCodeforcesSamples(html);

  if (!sampleInput && !sampleOutput) {
    throw new Error('Codeforces samples could not be extracted from this page yet.');
  }

  return {
    platform: 'codeforces',
    problemCode: `${normalized.contestId}${normalized.index}`,
    sourceUrl: nextSourceUrl,
    title: stripHtml(titleMatch?.[1] || '') || `Codeforces ${normalized.contestId}${normalized.index}`,
    prompt,
    sampleInput,
    sampleOutput,
  };
}

async function resolveLeetCodeSlug(problemCode = '') {
  const trimmed = problemCode.trim();

  if (!trimmed) {
    throw new Error('Add a LeetCode problem id like 1235 or a slug like two-sum.');
  }

  if (/^[a-z0-9-]+$/i.test(trimmed) && /[a-z]/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error('Use a numeric LeetCode id like 1235 or a problem slug.');
  }

  const response = await axios.get('https://leetcode.com/api/problems/all/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 ForkSpace Problem Importer',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const matchingProblem = response.data?.stat_status_pairs?.find((item) => {
    const frontendId = String(item?.stat?.frontend_question_id || '');
    const questionId = String(item?.stat?.question_id || '');
    return frontendId === trimmed || questionId === trimmed;
  });

  if (!matchingProblem?.stat?.question__title_slug) {
    throw new Error(`LeetCode problem ${trimmed} was not found.`);
  }

  return matchingProblem.stat.question__title_slug;
}

async function importLeetCodeProblem(problemCode, sourceUrl = '') {
  const slug = await resolveLeetCodeSlug(problemCode);
  const nextSourceUrl = sourceUrl || `https://leetcode.com/problems/${slug}/`;
  const response = await axios.post(
    'https://leetcode.com/graphql/',
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
        'Content-Type': 'application/json',
        Referer: nextSourceUrl,
        'User-Agent': 'Mozilla/5.0 ForkSpace Problem Importer',
      },
    }
  );

  const question = response.data?.data?.question;

  if (!question) {
    throw new Error('Failed to fetch the LeetCode problem details.');
  }

  return {
    platform: 'leetcode',
    problemCode: problemCode.trim(),
    sourceUrl: nextSourceUrl,
    title: question.title || `LeetCode ${problemCode.trim()}`,
    prompt: stripHtml(question.content || ''),
    sampleInput: (question.exampleTestcases || '').replace(/\r/g, '').trim(),
    sampleOutput: extractLeetCodeExampleOutputs(question.content || ''),
  };
}

app.post('/api/ai-hint', aiLimiter, async (req, res) => {
  try {
    const { prompt, suffix } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    if (!process.env.MISTRAL_API_KEY) {
      return res.json({ hint: buildFallbackHint(prompt, suffix), source: 'fallback' });
    }

    const response = await axios.post(
      'https://codestral.mistral.ai/v1/fim/completions',
      {
        model: 'codestral-latest',
        prompt,
        suffix: suffix || '',
        max_tokens: 128,
        temperature: 0.2,
        stop: ['\n\n'],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    const hint = extractAiText(response.data);
    return res.json({ hint: hint || buildFallbackHint(prompt, suffix), source: hint ? 'mistral' : 'fallback' });
  } catch (error) {
    return res.json({
      hint: buildFallbackHint(req.body?.prompt, req.body?.suffix),
      source: 'fallback',
      error: error.response?.data?.error || error.response?.data?.message || 'Failed to fetch AI hint',
    });
  }
});

app.post('/api/ai-hints', aiLimiter, async (req, res) => {
  try {
    const { code, beforeCursor, afterCursor } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Missing code', hints: [] });
    }

    if (!process.env.MISTRAL_API_KEY) {
      return res.json({
        hints: buildFallbackHints(code, beforeCursor, afterCursor),
        source: 'fallback',
      });
    }

    const suggestions = [];

    if (beforeCursor && afterCursor) {
      const response = await axios.post(
        'https://codestral.mistral.ai/v1/fim/completions',
        {
          model: 'codestral-latest',
          prompt: beforeCursor,
          suffix: afterCursor,
          max_tokens: 64,
          temperature: 0.3,
          stop: ['\n\n'],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const hint = extractAiText(response.data);
      if (hint.trim()) {
        suggestions.push(hint.trim());
      }
    }

    const response = await axios.post(
      'https://codestral.mistral.ai/v1/fim/completions',
      {
        model: 'codestral-latest',
        prompt: code,
        suffix: '',
        max_tokens: 64,
        temperature: 0.4,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const hint = extractAiText(response.data);
    if (hint.trim()) {
      suggestions.push(hint.trim());
    }

    const uniqueSuggestions = [...new Set(suggestions)].slice(0, 5);

    return res.json({
      hints: uniqueSuggestions.length > 0 ? uniqueSuggestions : buildFallbackHints(code, beforeCursor, afterCursor),
      source: uniqueSuggestions.length > 0 ? 'mistral' : 'fallback',
    });
  } catch (error) {
    return res.json({
      error: error.response?.data?.error || error.response?.data?.message || 'Failed to fetch AI hints',
      hints: buildFallbackHints(req.body?.code, req.body?.beforeCursor, req.body?.afterCursor),
      source: 'fallback',
    });
  }
});

app.post('/api/problem-import', async (req, res) => {
  try {
    const { platform = 'custom', problemCode = '', sourceUrl = '' } = req.body || {};

    if (!problemCode.trim()) {
      return res.status(400).json({ error: 'Add a problem code before importing.' });
    }

    let importedProblem = null;

    if (platform === 'codeforces') {
      importedProblem = await importCodeforcesProblem(problemCode, sourceUrl);
    } else if (platform === 'leetcode') {
      importedProblem = await importLeetCodeProblem(problemCode, sourceUrl);
    } else {
      return res.status(400).json({
        error: 'Automatic import is supported for Codeforces and LeetCode right now.',
      });
    }

    return res.json({ problem: importedProblem });
  } catch (error) {
    return res.status(502).json({
      error: error.message || 'Failed to import the problem details.',
    });
  }
});

function encodeBase64Utf8(value) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function decodeBase64Utf8(value) {
  return Buffer.from(value, 'base64').toString('utf8');
}

app.post('/api/run-code', async (req, res) => {
  const { code, stdin = '', languageId = getLanguageConfig(DEFAULT_LANGUAGE).id } = req.body;
  const supportedLanguageIds = new Set(Object.values(SUPPORTED_LANGUAGES).map(({ id }) => id));

  if (!code) {
    return res.status(400).json({ error: 'Missing code' });
  }

  if (!supportedLanguageIds.has(languageId)) {
    return res.status(400).json({ error: 'Unsupported language' });
  }

  if (!process.env.JUDGE0_API_URL || !process.env.JUDGE0_API_KEY) {
    return res.status(503).json({ error: 'Judge0 is not configured' });
  }

  const createOptions = (useBase64 = false) => ({
    method: 'POST',
    url: `${process.env.JUDGE0_API_URL}/submissions`,
    params: {
      ...(useBase64 ? { base64_encoded: 'true' } : {}),
      wait: 'true',
      fields: '*',
    },
    headers: {
      'x-rapidapi-key': process.env.JUDGE0_API_KEY,
      'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
      'Content-Type': 'application/json',
    },
    data: {
      language_id: languageId,
      source_code: useBase64 ? encodeBase64Utf8(code) : code,
      stdin: useBase64 ? encodeBase64Utf8(stdin) : stdin,
    },
  });

  try {
    let response;

    try {
      response = await axios.request(createOptions(false));
    } catch (error) {
      const apiError = error.response?.data?.error;
      const shouldRetryWithBase64 =
        typeof apiError === 'string' && apiError.includes('use base64_encoded=true');

      if (!shouldRetryWithBase64) {
        throw error;
      }

      response = await axios.request(createOptions(true));
    }

    const usedBase64 = response.config?.params?.base64_encoded === 'true';
    const payload = response.data;

    return res.json({
      ...payload,
      stdout: usedBase64 && payload.stdout ? decodeBase64Utf8(payload.stdout) : payload.stdout,
      stderr: usedBase64 && payload.stderr ? decodeBase64Utf8(payload.stderr) : payload.stderr,
      compile_output: usedBase64 && payload.compile_output ? decodeBase64Utf8(payload.compile_output) : payload.compile_output,
      message: usedBase64 && payload.message ? decodeBase64Utf8(payload.message) : payload.message,
    });
  } catch (error) {
    return res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.response?.data?.message || 'Error running code',
    });
  }
});


// Socket.io connection handlers

const userSocketMap = {};

function getUsersInRoom(roomId) {

  return Array.from(io.sockets.adapter.rooms.get(roomId) ||
    []).map(socketId => {
      return {
        socketId,
        username: userSocketMap[socketId]?.username,
        role: userSocketMap[socketId]?.role || 'Peer',
        isOnline: true
      };
    }
    );
}

io.on('connection', (socket) => {
  // console.log('socket connected', socket.id); // remove in prod

  socket.on('join', ({ roomId, username, role }) => {
    const roomState = getOrCreateRoomState(roomId);

    userSocketMap[socket.id] = {
      username,
      role: role || 'Peer',
    };
    socket.join(roomId);


    const users = getUsersInRoom(roomId);
    // console.log(users);  // remove in prod

    users.forEach(({ socketId }) => {
      io.to(socketId).emit('joined', {
        users,
        username,
        role: userSocketMap[socket.id].role,
        socketId: socket.id,
      });
    });

    socket.emit('room-state', roomState);
  });

socket.on('code-change', ({roomId, code}) => {
  const roomState = getOrCreateRoomState(roomId);
  roomState.code = code;
  scheduleRoomStatePersist();
  socket.in(roomId).emit('code-change', { code });
});

socket.on('language-change', ({ roomId, language }) => {
  const roomState = getOrCreateRoomState(roomId);
  const nextLanguage = SUPPORTED_LANGUAGES[language] ? language : DEFAULT_LANGUAGE;

  roomState.language = nextLanguage;
  scheduleRoomStatePersist();

  io.to(roomId).emit('language-change', {
    language: nextLanguage,
  });
});

socket.on('problem-update', ({ roomId, problem }) => {
  const roomState = getOrCreateRoomState(roomId);
  roomState.problem = {
    ...createDefaultProblemState(),
    ...roomState.problem,
    ...(problem || {}),
  };
  scheduleRoomStatePersist();

  io.to(roomId).emit('problem-update', {
    problem: roomState.problem,
  });
});

  socket.on('disconnecting', () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit('left',{
        socketId: socket.id,
        username: userSocketMap[socket.id]?.username,
      })
    })
    delete userSocketMap[socket.id];
    socket.leave();
  });

});

const PORT = process.env.PORT || 5000;

await loadPersistedRoomStates();

process.on('SIGINT', async () => {
  await flushRoomStatePersist();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await flushRoomStatePersist();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Socket origins: ${allowedOrigins.join(', ')}`);
});

