// server/src/queueManager.ts
// Handles queue operations: add, remove, reorder.
// On add: server extracts the audio stream URL before confirming.

import { Server, Socket } from 'socket.io';
import { rooms } from './roomManager.js';
import { TrackMetadata } from './types.js';
import { getAudioStreamUrl } from './audioExtractor.js';
import { validate, QueueAddSchema, QueueRemoveSchema } from './validation.js';
import { advanceToNextTrack } from './syncManager.js';

function emitError(socket: Socket, code: string, message: string) {
  socket.emit('s2c:room:error', { code, message });
}

export function registerQueueHandlers(io: Server, socket: Socket) {
  socket.on('c2s:queue:add', async (rawPayload: unknown) => {
    const result = validate(QueueAddSchema, rawPayload);
    if (!result.success) return emitError(socket, 'INVALID_PAYLOAD', result.error);

    const { roomId, videoId, title, channelName, durationSec, thumbnailUrl } = result.data;
    const room = rooms.get(roomId);
    if (!room) return emitError(socket, 'ROOM_NOT_FOUND', 'Room not found');

    // Prevent duplicate in queue (same videoId already queued)
    if (room.queue.some((t) => t.videoId === videoId)) {
      return emitError(socket, 'DUPLICATE_TRACK', 'This song is already in the queue');
    }

    // Notify the sender that extraction is in progress
    socket.emit('s2c:queue:extracting', { videoId });

    // Extract audio stream URL (may take 1-3 seconds)
    let streamInfo;
    try {
      streamInfo = await getAudioStreamUrl(videoId);
    } catch (err) {
      console.error(`[Queue] Failed to extract stream for ${videoId}:`, err);
      return emitError(socket, 'STREAM_UNAVAILABLE', `Could not get audio for "${title}". Is it age-restricted or private?`);
    }

    const participant = room.participants.get(socket.data.userId);
    const addedBy = participant?.displayName ?? 'Unknown';

    const track: TrackMetadata = {
      videoId,
      title: streamInfo.title || title,
      channelName: streamInfo.channelName || channelName,
      durationSec: streamInfo.durationSec || durationSec,
      thumbnailUrl: streamInfo.thumbnailUrl || thumbnailUrl,
      addedBy,
      streamUrl: streamInfo.streamUrl,
      streamExpiresAt: streamInfo.expiresAt,
    };

    room.queue.push(track);

    // Broadcast updated queue to all participants
    io.to(roomId).emit('s2c:queue:updated', { queue: room.queue });

    console.log(`[Room ${roomId}] "${addedBy}" queued "${track.title}"`);

    // If nothing is currently playing, start this track immediately
    if (room.playback.status === 'IDLE') {
      console.log(`[Room ${roomId}] Nothing playing — auto-starting queued track`);
      advanceToNextTrack(io, roomId, 0, room.queue.length - 1);
    }
  });

  socket.on('c2s:queue:remove', (rawPayload: unknown) => {
    const result = validate(QueueRemoveSchema, rawPayload);
    if (!result.success) return emitError(socket, 'INVALID_PAYLOAD', result.error);

    const { roomId, videoId, userId } = result.data;
    const room = rooms.get(roomId);
    if (!room) return emitError(socket, 'ROOM_NOT_FOUND', 'Room not found');

    const isHost = socket.data.userId === room.hostId;
    const isOwner = socket.data.userId === userId;

    if (!isHost && !isOwner) {
      return emitError(socket, 'UNAUTHORIZED', 'You can only remove your own songs');
    }

    const index = room.queue.findIndex((t) => t.videoId === videoId);
    if (index === -1) {
      return emitError(socket, 'NOT_FOUND', 'Track not found in queue');
    }

    const removed = room.queue.splice(index, 1)[0];
    io.to(roomId).emit('s2c:queue:updated', { queue: room.queue });

    console.log(`[Room ${roomId}] "${removed.title}" removed from queue`);
  });
}
