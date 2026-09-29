// app/src/types/index.ts
// Shared types mirroring the server — kept in sync manually for MVP.

export type PlaybackStatus = 'PLAYING' | 'PAUSED' | 'IDLE';

export interface TrackMetadata {
  videoId: string;
  title: string;
  channelName: string;
  durationSec: number;
  thumbnailUrl: string;
  addedBy: string;
  streamUrl: string;
  streamExpiresAt: number;
}

export interface PlaybackState {
  track: TrackMetadata | null;
  status: PlaybackStatus;
  positionSec: number;
  lastUpdatedAt: number;
  playbackRate: number;
  epoch: number;
}

export interface Participant {
  userId: string;
  socketId: string;
  displayName: string;
  avatar?: string;
  isHost: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  avatar?: string;
  text: string;
  timestamp: number;
}

export interface RoomState {
  roomId: string;
  hostId: string;
  playback: PlaybackState;
  queue: TrackMetadata[];
  participants: Participant[];
  chat: ChatMessage[];
}

// YouTube search result from backend proxy
export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  durationSec?: number; // Only available from /video/:id lookup
}

/**
 * Calculate current track position (mirrors server logic).
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
 * Format seconds as MM:SS
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Extract YouTube video ID from a URL or return null.
 */
export function extractVideoId(input: string): string | null {
  const pattern =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(pattern);
  return match ? match[1] : null;
}
