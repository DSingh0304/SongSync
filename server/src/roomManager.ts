// server/src/roomManager.ts
// Manages in-memory room state, participant lifecycle, and host migration.

import { Server, Socket } from 'socket.io';
import {
  RoomState,
  Participant,
  PlaybackState,
  serializeRoom,
} from './types.js';
import {
  generateRoomCode,
  generateUserId,
} from './utils.js';
import {
  validate,
  RoomCreateSchema,
  RoomJoinSchema, RoomTransferHostSchema, RoomReactionSchema,
  RoomLeaveSchema,
  RoomRejoinSchema,
} from './validation.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_PARTICIPANTS = 8;
const HOST_RECONNECT_GRACE_MS = 25_000; // 25 seconds
const EMPTY_ROOM_CLEANUP_MS = 5 * 60_000; // 5 minutes
const MAX_CHAT_HISTORY = 100;

// ─── In-memory store ──────────────────────────────────────────────────────────
export const rooms = new Map<string, RoomState>();

// Maps socketId → { roomId, userId } for disconnect handling
const socketToSession = new Map<string, { roomId: string; userId: string }>();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function createInitialPlayback(): PlaybackState {
  return {
    track: null,
    status: 'IDLE',
    positionSec: 0,
    lastUpdatedAt: Date.now(),
    playbackRate: 1.0,
    epoch: 0,
  };
}

function emitError(socket: Socket, code: string, message: string) {
  socket.emit('s2c:room:error', { code, message });
}

/**
 * Migrate host to the participant with the earliest joinedAt timestamp.
 * Called when host's grace timer expires.
 */
function migrateHost(io: Server, room: RoomState) {
  const eligible = Array.from(room.participants.values())
    .filter((p) => p.userId !== room.hostId)
    .sort((a, b) => a.joinedAt - b.joinedAt);

  if (eligible.length === 0) {
    // No participants left — schedule room cleanup
    scheduleRoomCleanup(room);
    return;
  }

  const newHost = eligible[0];
  // Update old host's isHost flag if they're still a participant
  const oldHost = room.participants.get(room.hostId);
  if (oldHost) oldHost.isHost = false;

  newHost.isHost = true;
  room.hostId = newHost.userId;
  room.hostDisconnectTimer = null;

  io.to(room.roomId).emit('s2c:room:host_transferred', {
    newHostId: newHost.userId,
    newHostName: newHost.displayName,
  });

  console.log(`[Room ${room.roomId}] Host migrated to ${newHost.displayName}`);
}

function scheduleRoomCleanup(room: RoomState) {
  // Clear existing cleanup timer if any
  if (room.emptyRoomTimer) clearTimeout(room.emptyRoomTimer);

  room.emptyRoomTimer = setTimeout(() => {
    // Final check: still empty?
    if (room.participants.size === 0) {
      // Cancel any running timers
      if (room.trackEndTimer) clearTimeout(room.trackEndTimer);
      if (room.hostDisconnectTimer) clearTimeout(room.hostDisconnectTimer);
      rooms.delete(room.roomId);
      console.log(`[Room ${room.roomId}] Cleaned up (empty for 5 min)`);
    }
  }, EMPTY_ROOM_CLEANUP_MS);
}

// ─── Event Handlers ───────────────────────────────────────────────────────────
export function registerRoomHandlers(io: Server, socket: Socket) {
  // ── Create Room ──────────────────────────────────────────────────────────────
  socket.on('c2s:room:create', (rawPayload: unknown) => {
    const result = validate(RoomCreateSchema, rawPayload);
    if (!result.success) return emitError(socket, 'INVALID_PAYLOAD', result.error);

    const { displayName, avatar } = result.data;
    const roomId = generateRoomCode();
    const userId = generateUserId();

    // Ensure unique room code (extremely unlikely collision but guarded)
    if (rooms.has(roomId)) {
      return emitError(socket, 'ROOM_CREATE_FAILED', 'Please try again');
    }

    const host: Participant = {
      userId,
      socketId: socket.id,
      displayName,
      isHost: true,
      avatar,
      joinedAt: Date.now(),
    };

    const room: RoomState = {
      roomId,
      hostId: userId,
      queueIndex: 0,
      playback: createInitialPlayback(),
      queue: [],
      participants: new Map([[userId, host]]),
      chat: [],
      hostDisconnectTimer: null,
      trackEndTimer: null,
      emptyRoomTimer: null,
    };

    rooms.set(roomId, room);
    socketToSession.set(socket.id, { roomId, userId });
    socket.join(roomId);

    socket.emit('s2c:room:created', {
      roomId,
      userId,
      roomState: serializeRoom(room),
    });

    // Attach session metadata to socket for disconnect handling
    socket.data.roomId = roomId;
    socket.data.userId = userId;

    console.log(`[Room ${roomId}] Created by "${displayName}" (${userId})`);
  });

  // ── Join Room ─────────────────────────────────────────────────────────────────
  socket.on('c2s:room:join', (rawPayload: unknown) => {
    const result = validate(RoomJoinSchema, rawPayload);
    if (!result.success) return emitError(socket, 'INVALID_PAYLOAD', result.error);

    const { roomId, displayName, avatar } = result.data;
    const room = rooms.get(roomId);

    if (!room) return emitError(socket, 'ROOM_NOT_FOUND', `Room "${roomId}" does not exist`);
    if (room.participants.size >= MAX_PARTICIPANTS) {
      return emitError(socket, 'ROOM_FULL', `Room is full (max ${MAX_PARTICIPANTS} participants)`);
    }

    const userId = generateUserId();

    // Cancel empty-room cleanup if it was scheduled
    if (room.emptyRoomTimer) {
      clearTimeout(room.emptyRoomTimer);
      room.emptyRoomTimer = null;
    }

    const participant: Participant = {
      userId,
      socketId: socket.id,
      displayName,
      isHost: false,
      avatar,
      joinedAt: Date.now(),
    };

    room.participants.set(userId, participant);
    socketToSession.set(socket.id, { roomId, userId });
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.userId = userId;

    // Send full room state to the new joiner
    socket.emit('s2c:room:state', { roomState: serializeRoom(room) });

    // Notify everyone else
    socket.to(roomId).emit('s2c:room:participant_joined', { participant });

    console.log(`[Room ${roomId}] "${displayName}" joined (${userId})`);
  });

  // ── Leave Room ────────────────────────────────────────────────────────────────
  socket.on('c2s:room:leave', (rawPayload: unknown) => {
    const result = validate(RoomLeaveSchema, rawPayload);
    if (!result.success) return emitError(socket, 'INVALID_PAYLOAD', result.error);

    handleParticipantLeave(io, socket, result.data.roomId, socket.data.userId, 'voluntary');
  });

  // ── Rejoin Room (reconnect after socket drop) ─────────────────────────────────
  socket.on('c2s:room:rejoin', (rawPayload: unknown) => {
    const result = validate(RoomRejoinSchema, rawPayload);
    if (!result.success) return emitError(socket, 'INVALID_PAYLOAD', result.error);

    const { roomId, userId } = result.data;
    const room = rooms.get(roomId);

    if (!room) return emitError(socket, 'ROOM_NOT_FOUND', `Room "${roomId}" does not exist`);

    const participant = room.participants.get(userId);
    if (!participant) {
      // Participant was removed (e.g., host migration, cleanup) — treat as fresh join
      return emitError(socket, 'SESSION_EXPIRED', 'Your session expired, please rejoin');
    }

    // Cancel host disconnect timer if they're reconnecting as host
    if (room.hostId === userId && room.hostDisconnectTimer) {
      clearTimeout(room.hostDisconnectTimer);
      room.hostDisconnectTimer = null;
      console.log(`[Room ${roomId}] Host "${participant.displayName}" reconnected`);
    }

    // Cancel participant disconnect timer if they're reconnecting
    if (participant.disconnectTimer) {
      clearTimeout(participant.disconnectTimer);
      participant.disconnectTimer = undefined;
    }

    // Cancel empty-room cleanup if needed
    if (room.emptyRoomTimer) {
      clearTimeout(room.emptyRoomTimer);
      room.emptyRoomTimer = null;
    }

    // Re-bind socket
    participant.socketId = socket.id;
    socketToSession.set(socket.id, { roomId, userId });
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.userId = userId;

    // Send fresh room state
    socket.emit('s2c:room:state', { roomState: serializeRoom(room) });
    socket.to(roomId).emit('s2c:room:participant_joined', { participant });

    console.log(`[Room ${roomId}] "${participant.displayName}" rejoined`);
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const session = socketToSession.get(socket.id);
    if (!session) return;
    socketToSession.delete(socket.id);

    handleParticipantLeave(io, socket, session.roomId, session.userId, 'disconnect');
  });


  socket.on('c2s:room:transfer_host', (rawPayload: unknown) => {
    const result = validate(RoomTransferHostSchema, rawPayload);
    if (!result.success) return emitError(socket, 'INVALID_PAYLOAD', result.error);

    const { roomId, targetUserId } = result.data;
    const room = rooms.get(roomId);
    if (!room) return emitError(socket, 'ROOM_NOT_FOUND', 'Room not found');

    if (socket.data.userId !== room.hostId) {
      return emitError(socket, 'UNAUTHORIZED', 'Only the host can transfer leadership');
    }

    const targetParticipant = room.participants.get(targetUserId);
    if (!targetParticipant) {
      return emitError(socket, 'USER_NOT_FOUND', 'Target user is not in the room');
    }

    const currentHost = room.participants.get(room.hostId);
    if (currentHost) currentHost.isHost = false;

    targetParticipant.isHost = true;
    room.hostId = targetUserId;

    io.to(roomId).emit('s2c:room:host_transferred', {
      newHostId: targetUserId,
      newHostName: targetParticipant.displayName,
    });

    console.log(`[Room ${roomId}] Host transferred manually to ${targetParticipant.displayName}`);
  });

  socket.on('c2s:room:reaction', (rawPayload: unknown) => {
    const result = validate(RoomReactionSchema, rawPayload);
    if (!result.success) return emitError(socket, 'INVALID_PAYLOAD', result.error);

    const { roomId, emoji } = result.data;
    const room = rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(socket.data.userId);
    if (!participant) return;

    io.to(roomId).emit('s2c:room:reaction', {
      userId: socket.data.userId,
      displayName: participant.displayName,
      emoji,
      id: Math.random().toString(36).substr(2, 9),
    });
  });
}



// ─── Core leave logic (shared by voluntary leave + disconnect) ─────────────────
function handleParticipantLeave(
  io: Server,
  socket: Socket,
  roomId: string,
  userId: string,
  reason: 'voluntary' | 'disconnect'
) {
  const room = rooms.get(roomId);
  if (!room) return;

  const participant = room.participants.get(userId);
  if (!participant) return;

  const wasHost = room.hostId === userId;

  if (reason === 'voluntary') {
    // Fully remove from room
    room.participants.delete(userId);
    socket.leave(roomId);
    socket.data.roomId = undefined;
    socket.data.userId = undefined;
  }
  // For disconnect, keep participant record — they may reconnect within grace window

  io.to(roomId).emit('s2c:room:participant_left', { userId, displayName: participant.displayName });

  console.log(`[Room ${roomId}] "${participant.displayName}" ${reason === 'voluntary' ? 'left' : 'disconnected'}`);

  // Handle room becoming empty
  const activeCount = reason === 'voluntary' ? room.participants.size : room.participants.size;
  if (activeCount === 0 || (reason === 'voluntary' && room.participants.size === 0)) {
    scheduleRoomCleanup(room);
    return;
  }

  // Handle host leaving
  if (wasHost) {
    if (reason === 'voluntary') {
      // Immediate host migration for voluntary leave
      migrateHost(io, room);
    } else {
      // Grace period for disconnect — they might reconnect
      room.hostDisconnectTimer = setTimeout(() => {
        // Remove disconnected host's record
        room.participants.delete(userId);
        if (room.participants.size === 0) {
          scheduleRoomCleanup(room);
        } else {
          migrateHost(io, room);
        }
      }, HOST_RECONNECT_GRACE_MS);

      console.log(`[Room ${roomId}] Host disconnected — ${HOST_RECONNECT_GRACE_MS / 1000}s grace window started`);
    }
  } else if (reason === 'disconnect') {
    // Non-host disconnect: remove their record after grace window
    participant.disconnectTimer = setTimeout(() => {
      room.participants.delete(userId);
      if (room.participants.size === 0) {
        scheduleRoomCleanup(room);
      }
    }, HOST_RECONNECT_GRACE_MS);
  }
}
