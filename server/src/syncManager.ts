import { Server, Socket } from 'socket.io';
import { rooms } from './roomManager.js';
import { PlaybackState } from './types.js';
import { validate, PlaybackSeekSchema, PlaybackReadySchema, PlaybackTrackEndedSchema, PlaybackSkipSchema } from './validation.js';

const COORDINATED_START_LEAD_MS = 500;
const TRACK_END_BUFFER_MS = 500;

export function calculateCurrentPosition(playback: PlaybackState, serverNowMs: number): number {
  if (playback.status !== 'PLAYING') return playback.positionSec;
  const elapsedSec = (serverNowMs - playback.lastUpdatedAt) / 1000;
  const currentPos = playback.positionSec + elapsedSec * playback.playbackRate;
  if (!playback.track) return currentPos;
  return Math.min(Math.max(0, currentPos), playback.track.durationSec);
}

export async function advanceToNextTrack(io: Server, roomId: string, indexOffset: number = 1, forceIndex?: number) {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.trackEndTimer) {
    clearTimeout(room.trackEndTimer);
    room.trackEndTimer = null;
  }

  if (forceIndex !== undefined) {
    room.queueIndex = forceIndex;
  } else {
    // If we are currently IDLE and starting the first track, don't increment
    if (room.playback.status === 'IDLE' && indexOffset === 1 && room.queueIndex === room.queue.length - 1) {
      // Starting the newly added track, so we just stay at the current index which points to it
    } else {
      room.queueIndex += indexOffset;
    }
  }

  if (room.queueIndex < 0) room.queueIndex = 0;

  
  if (room.queueIndex >= room.queue.length || room.queue.length === 0) {
    // Autoplay Recommendation Logic
    if (room.queue.length > 0) {
      const lastTrack = room.queue[room.queue.length - 1];
      console.log(`[Room ${roomId}] Queue ended, attempting autoplay based on ${lastTrack.channelName}...`);
      
      try {
        const query = encodeURIComponent(`${lastTrack.channelName} music`);
        const searchRes = await fetch(`http://localhost:${process.env.PORT || 3000}/api/youtube/search?q=${query}`);
        if (searchRes.ok) {
          const { results } = await searchRes.json();
          const existingIds = new Set(room.queue.map(t => t.videoId));
          const newTracks = results.filter((t: any) => !existingIds.has(t.videoId));
          
          if (newTracks.length > 0) {
            const recommendation = newTracks[0];
            const { getAudioStreamUrl } = await import('./audioExtractor.js');
            const streamInfo = await getAudioStreamUrl(recommendation.videoId);
            
            const track = {
              videoId: recommendation.videoId,
              title: streamInfo.title || recommendation.title,
              channelName: streamInfo.channelName || recommendation.channelName,
              durationSec: streamInfo.durationSec || 0,
              thumbnailUrl: streamInfo.thumbnailUrl || recommendation.thumbnailUrl,
              addedBy: 'AutoPlay',
              streamUrl: streamInfo.streamUrl,
              streamExpiresAt: streamInfo.expiresAt,
            };
            
            room.queue.push(track);
            io.to(roomId).emit('s2c:queue:updated', { queue: room.queue });
            console.log(`[Room ${roomId}] Autoplay added: ${track.title}`);
          }
        }
      } catch (err) {
        console.error(`[Room ${roomId}] Autoplay failed:`, err);
      }
    }

    if (room.queueIndex >= room.queue.length) {

    // Ensure we cap it so adding future songs puts it in right place
    room.queueIndex = room.queue.length;
    room.playback = {
      track: null,
      status: 'IDLE',
      positionSec: 0,
      lastUpdatedAt: Date.now(),
      playbackRate: 1.0,
      epoch: room.playback.epoch + 1,
    };
    io.to(roomId).emit('s2c:playback:sync', room.playback);
    console.log(`[Room ${roomId}] Queue ended — IDLE`);
    return;
  }
  }

  const nextTrack = room.queue[room.queueIndex];

  let track = nextTrack;
  if (nextTrack.streamExpiresAt - Date.now() < 10 * 60_000) {
    try {
      const { getAudioStreamUrl } = await import('./audioExtractor.js');
      const fresh = await getAudioStreamUrl(nextTrack.videoId);
      track = { ...nextTrack, streamUrl: fresh.streamUrl, streamExpiresAt: fresh.expiresAt };
    } catch (err) {
      console.error(`[Room ${roomId}] Failed to refresh stream for ${nextTrack.videoId}:`, err);
      io.to(roomId).emit('s2c:room:error', { code: 'STREAM_UNAVAILABLE', message: `Could not load "${nextTrack.title}". Skipping.` });
      return advanceToNextTrack(io, roomId, 1);
    }
  }

  const now = Date.now();
  const scheduledServerTime = now + COORDINATED_START_LEAD_MS;

  room.playback = {
    track,
    status: 'PLAYING',
    positionSec: 0,
    lastUpdatedAt: now,
    playbackRate: 1.0,
    epoch: room.playback.epoch + 1,
  };

  io.to(roomId).emit('s2c:playback:track_changed', {
    playback: room.playback,
    queue: room.queue,
    queueIndex: room.queueIndex,
    scheduledServerTime,
  });

  console.log(`[Room ${roomId}] Now playing: "${track.title}" (${track.durationSec}s)`);
  scheduleTrackEnd(io, roomId, track.durationSec, 0);
}

export function scheduleTrackEnd(io: Server, roomId: string, durationSec: number, currentPositionSec: number) {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.trackEndTimer) clearTimeout(room.trackEndTimer);

  const remainingMs = (durationSec - currentPositionSec) * 1000 + TRACK_END_BUFFER_MS;
  room.trackEndTimer = setTimeout(() => {
    console.log(`[Room ${roomId}] Server track-end timer fired`);
    advanceToNextTrack(io, roomId, 1);
  }, remainingMs);
}

export function registerSyncHandlers(io: Server, socket: Socket) {
  function emitError(code: string, message: string) {
    socket.emit('s2c:room:error', { code, message });
  }

  socket.on('c2s:playback:play', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    if (socket.data.userId !== room.hostId) return emitError('UNAUTHORIZED', 'Only the host can control playback');
    if (room.playback.status === 'PLAYING') return;

    if (!room.playback.track) {
      if (room.queue.length > 0) advanceToNextTrack(io, roomId, 0, room.queueIndex >= room.queue.length ? 0 : room.queueIndex);
      return;
    }

    const now = Date.now();
    room.playback.status = 'PLAYING';
    room.playback.lastUpdatedAt = now;
    room.playback.epoch += 1;

    const scheduledServerTime = now + COORDINATED_START_LEAD_MS;
    io.to(roomId).emit('s2c:playback:start_at', { ...room.playback, scheduledServerTime });
    scheduleTrackEnd(io, roomId, room.playback.track.durationSec, room.playback.positionSec);
  });

  socket.on('c2s:playback:pause', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    if (socket.data.userId !== room.hostId) return emitError('UNAUTHORIZED', 'Only the host can control playback');
    if (room.playback.status !== 'PLAYING') return;

    room.playback.positionSec = calculateCurrentPosition(room.playback, Date.now());
    room.playback.status = 'PAUSED';
    room.playback.lastUpdatedAt = Date.now();
    room.playback.epoch += 1;

    if (room.trackEndTimer) { clearTimeout(room.trackEndTimer); room.trackEndTimer = null; }
    io.to(roomId).emit('s2c:playback:sync', room.playback);
  });

  socket.on('c2s:playback:seek', (rawPayload: unknown) => {
    const result = validate(PlaybackSeekSchema, rawPayload);
    if (!result.success) return emitError('INVALID_PAYLOAD', result.error);
    const { roomId, targetSec } = result.data;
    const room = rooms.get(roomId);
    if (!room || !room.playback.track) return;
    if (socket.data.userId !== room.hostId) return emitError('UNAUTHORIZED', 'Only the host can seek');

    const track = room.playback.track;
    const clampedTarget = Math.min(Math.max(0, targetSec), track.durationSec);

    room.playback.positionSec = clampedTarget;
    room.playback.lastUpdatedAt = Date.now();
    room.playback.epoch += 1;

    io.to(roomId).emit('s2c:playback:sync', room.playback);
    if (room.playback.status === 'PLAYING') scheduleTrackEnd(io, roomId, track.durationSec, clampedTarget);
  });

  socket.on('c2s:playback:skip', (rawPayload: unknown) => {
    const result = validate(PlaybackSkipSchema, rawPayload);
    if (!result.success) return emitError('INVALID_PAYLOAD', result.error);
    const room = rooms.get(result.data.roomId);
    if (!room) return emitError('ROOM_NOT_FOUND', 'Room not found');
    if (socket.data.userId !== room.hostId) return emitError('UNAUTHORIZED', 'Only the host can skip');

    advanceToNextTrack(io, room.roomId, 1);
  });

  socket.on('c2s:playback:previous', (rawPayload: unknown) => {
    const result = validate(PlaybackSkipSchema, rawPayload);
    if (!result.success) return emitError('INVALID_PAYLOAD', result.error);
    const room = rooms.get(result.data.roomId);
    if (!room) return emitError('ROOM_NOT_FOUND', 'Room not found');
    if (socket.data.userId !== room.hostId) return emitError('UNAUTHORIZED', 'Only the host can skip');

    advanceToNextTrack(io, room.roomId, -1);
  });

  socket.on('c2s:playback:jump', (rawPayload: unknown) => {
    // We can use same schema as skip but with index
    const room = rooms.get((rawPayload as any).roomId);
    if (!room) return;
    if (socket.data.userId !== room.hostId) return;
    const index = (rawPayload as any).index;
    if (typeof index === 'number') {
      advanceToNextTrack(io, room.roomId, 0, index);
    }
  });

  socket.on('c2s:playback:track_ended', (rawPayload: unknown) => {
    const result = validate(PlaybackTrackEndedSchema, rawPayload);
    if (!result.success) return;
    const room = rooms.get(result.data.roomId);
    if (!room || !room.playback.track) return;

    const expectedPosition = calculateCurrentPosition(room.playback, Date.now());
    if (expectedPosition >= room.playback.track.durationSec - 3) {
      advanceToNextTrack(io, room.roomId, 1);
    }
  });
}
