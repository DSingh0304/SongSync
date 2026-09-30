// server/src/chatManager.ts
// Handles live chat: relays messages, enforces rate limits, maintains ring buffer.

import { Server, Socket } from 'socket.io';
import { rooms } from './roomManager.js';
import { ChatMessage } from './types.js';
import { validate, ChatMessageSchema } from './validation.js';
import { generateMessageId } from './utils.js';

const MAX_CHAT_HISTORY = 100;
const RATE_LIMIT_COUNT = 5;
const RATE_LIMIT_WINDOW_MS = 10_000; // 10 seconds

// Simple in-memory rate limiter: userId → timestamps of recent messages
const rateLimiter = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimiter.get(userId) ?? [];

  // Keep only timestamps within the window
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_COUNT) return true;

  recent.push(now);
  rateLimiter.set(userId, recent);
  return false;
}

export function registerChatHandlers(io: Server, socket: Socket) {
  socket.on('c2s:chat:message', (rawPayload: unknown) => {
    const result = validate(ChatMessageSchema, rawPayload);
    if (!result.success) {
      socket.emit('s2c:room:error', { code: 'INVALID_PAYLOAD', message: result.error });
      return;
    }

    const { roomId, text } = result.data;
    const userId = socket.data.userId as string;
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('s2c:room:error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
      return;
    }

    if (isRateLimited(userId)) {
      socket.emit('s2c:room:error', {
        code: 'RATE_LIMITED',
        message: 'You are sending messages too fast. Please slow down.',
      });
      return;
    }

    const participant = room.participants.get(userId);
    const displayName = participant?.displayName ?? 'Unknown';

    const message: ChatMessage = {
      id: generateMessageId(),
      userId,
      displayName,
      text: text.trim(),
      timestamp: Date.now(),
    };

    // Add to ring buffer
    room.chat.push(message);
    if (room.chat.length > MAX_CHAT_HISTORY) {
      room.chat.shift();
    }

    // Broadcast to all in room
    io.to(roomId).emit('s2c:chat:message', message);
  });
}
