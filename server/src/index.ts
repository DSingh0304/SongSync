import "dotenv/config";
// server/src/index.ts
// Server entry point — Express + Socket.io bootstrap.

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerRoomHandlers } from './roomManager.js';
import { registerSyncHandlers } from './syncManager.js';
import { registerQueueHandlers } from './queueManager.js';
import { registerChatHandlers } from './chatManager.js';
import youtubeRouter from './youtubeProxy.js';
import spotifyRouter from './spotifyProxy.js';
import lyricsRouter from './lyricsProxy.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

// ─── Express setup ─────────────────────────────────────────────────────────────
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check — used by Render free tier keepalive ping
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// External API proxy routes
app.use('/api/youtube', youtubeRouter);
app.use('/api/spotify', spotifyRouter);
app.use('/api/lyrics', lyricsRouter);

// ─── HTTP + Socket.io setup ────────────────────────────────────────────────────
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket'], // Skip long-polling — React Native handles WS directly
  pingInterval: 25_000,     // Heartbeat every 25s
  pingTimeout: 20_000,      // Disconnect if no pong within 20s
});

// ─── Socket.io connection handler ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Register all domain handlers
  registerRoomHandlers(io, socket);
  registerSyncHandlers(io, socket);
  registerQueueHandlers(io, socket);
  registerChatHandlers(io, socket);

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
  });
});

// ─── Start server ──────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   SyncRoom Server                    ║
║   http://localhost:${PORT}              ║
╚══════════════════════════════════════╝
  `);
});

export { io };

// ─── Global Error Hardening ───────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});
