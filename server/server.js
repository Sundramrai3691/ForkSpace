import express from 'express';
import http from 'http';
import process from 'process';
import { config as loadEnv } from 'dotenv';
import { Server } from 'socket.io';

loadEnv({ path: new URL('./.env', import.meta.url) });

const app = express();
app.use(express.json());
const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  process.env.CLIENT_URL || process.env.CORS_ORIGIN,
].filter(Boolean);

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

