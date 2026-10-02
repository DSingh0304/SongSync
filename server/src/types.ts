// server/src/types.ts
// Shared type definitions for the SyncRoom server

export type PlaybackStatus = 'PLAYING' | 'PAUSED' | 'IDLE';

export interface TrackMetadata {
  videoId: string;         // YouTube video ID (11 chars)
  title: string;
  channelName: string;
  durationSec: number;
  thumbnailUrl: string;
  addedBy: string;         // display name of who queued it
  streamUrl: string;       // Direct audio stream URL extracted by server
  streamExpiresAt: number; // Server ms timestamp when stream URL expires
}

export interface PlaybackState {
  track: TrackMetadata | null;
  status: PlaybackStatus;
  positionSec: number;     // Track position at `lastUpdatedAt`
  lastUpdatedAt: number;   // Server timestamp (ms) when position was recorded
  playbackRate: number;    // 1.0 = normal
  epoch: number;           // Monotonic counter — increments on every state change
}

export interface Participant {
  userId: string;          // Generated UUID on join
  socketId: string;
  displayName: string;
  avatar?: string;
  isHost: boolean;
  joinedAt: number;        // Server timestamp (ms)
  disconnectTimer?: NodeJS.Timeout;
}

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  timestamp: number;
}

export interface RoomState {
  roomId: string;          // 6-char alphanumeric code
  hostId: string;
  queueIndex: number;          // userId of current host
  playback: PlaybackState;
  queue: TrackMetadata[];
  participants: Map<string, Participant>;
  chat: ChatMessage[];     // Ring buffer — last 100 messages

  // Internal timers (not serialized to clients)
  hostDisconnectTimer: ReturnType<typeof setTimeout> | null;
  trackEndTimer: ReturnType<typeof setTimeout> | null;
  emptyRoomTimer: ReturnType<typeof setTimeout> | null;
}

// Serializable version of RoomState (Maps → arrays) for wire transport
export interface SerializableRoomState {
  roomId: string;
  hostId: string;
  queueIndex: number;
  playback: PlaybackState;
  queue: TrackMetadata[];
  participants: Participant[];
  chat: ChatMessage[];
}

// Socket event payloads — Client → Server
export interface C2SRoomCreate { displayName: string }
export interface C2SRoomJoin { roomId: string; displayName: string }
export interface C2SRoomLeave { roomId: string }
export interface C2SRoomRejoin { roomId: string; userId: string }
export interface C2STimePing { t1: number }
export interface C2SPlaybackPlay { roomId: string }
export interface C2SPlaybackPause { roomId: string }
export interface C2SPlaybackSeek { roomId: string; targetSec: number; clientEpoch: number }
export interface C2SPlaybackSkip { roomId: string }
export interface C2SPlaybackReady { roomId: string }
export interface C2SPlaybackTrackEnded { roomId: string }
export interface C2SQueueAdd {
  roomId: string;
  videoId: string;
  title: string;
  channelName: string;
  durationSec: number;
  thumbnailUrl: string;
}
export interface C2SQueueRemove { roomId: string; videoId: string; userId: string }
export interface C2SChatMessage { roomId: string; text: string }

// Socket event payloads — Server → Client
export interface S2CTimePong { t1: number; t2: number; t3: number }
export interface S2CPlaybackStartAt extends PlaybackState {
  scheduledServerTime: number;
}

/**
 * Calculate the current track position based on last known state.
 * Deterministic — given the same inputs, every machine gets the same result.
 */
export function calculateCurrentPosition(
  playback: PlaybackState,
  currentServerTime: number
): number {
  if (playback.status !== 'PLAYING' || !playback.track) {
    return playback.positionSec;
  }
  const elapsedSec =
    ((currentServerTime - playback.lastUpdatedAt) / 1000) * playback.playbackRate;
  const currentPos = playback.positionSec + elapsedSec;
  return Math.min(Math.max(0, currentPos), playback.track.durationSec);
}

/**
 * Serialize RoomState for wire transport (Maps → arrays, strip internal timers)
 */
export function serializeRoom(room: RoomState): SerializableRoomState {
  return {
    roomId: room.roomId,
    hostId: room.hostId,
    queueIndex: room.queueIndex,
    playback: room.playback,
    queue: room.queue,
    participants: Array.from(room.participants.values()),
    chat: room.chat,
  };
}
