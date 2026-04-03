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

app.post('/api/ai-hint', aiLimiter, async (req, res) => {
  try {
    const { prompt, suffix } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    if (!process.env.MISTRAL_API_KEY) {
      return res.status(503).json({ error: 'AI service is not configured' });
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

    const hint = response.data.choices?.[0]?.message?.content || '';
    return res.json({ hint });
  } catch (error) {
    return res.status(500).json({
      error: error.response?.data?.error || 'Failed to fetch AI hint',
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
      return res.status(503).json({ error: 'AI service is not configured', hints: [] });
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

      const hint = response.data.choices?.[0]?.message?.content || '';
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

    const hint = response.data.choices?.[0]?.message?.content || '';
    if (hint.trim()) {
      suggestions.push(hint.trim());
    }

    return res.json({ hints: [...new Set(suggestions)].slice(0, 5) });
  } catch (error) {
    return res.status(500).json({
      error: error.response?.data?.error || 'Failed to fetch AI hints',
      hints: [],
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
  const { code, stdin = '', languageId = 54 } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Missing code' });
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
        username: userSocketMap[socketId],
        isOnline: true
      };
    }
    );
}

io.on('connection', (socket) => {
  // console.log('socket connected', socket.id); // remove in prod

  socket.on('join', ({ roomId, username }) => {

    userSocketMap[socket.id] = username;
    socket.join(roomId);


    const users = getUsersInRoom(roomId);
    // console.log(users);  // remove in prod

    users.forEach(({ socketId }) => {
      io.to(socketId).emit('joined', {
        users,
        username,
        socketId: socket.id,
      });
    });
  });

socket.on('code-change', ({roomId, code}) => {
  socket.in(roomId).emit('code-change', { code });
});

  socket.on('disconnecting', () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit('left',{
        socketId: socket.id,
        username: userSocketMap[socket.id],
      })
    })
    delete userSocketMap[socket.id];
    socket.leave();
  })
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Socket origins: ${allowedOrigins.join(', ')}`);
});

