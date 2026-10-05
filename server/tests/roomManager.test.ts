// server/src/tests/roomManager.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateCurrentPosition, serializeRoom } from '../src/types.js';


describe('calculateCurrentPosition', () => {
  it('returns positionSec when status is PAUSED', () => {
    const playback = {
      track: { videoId: 'test', title: 'Test', channelName: 'C', durationSec: 200,
               thumbnailUrl: '', addedBy: 'X', streamUrl: '', streamExpiresAt: 0 },
      status: 'PAUSED' as const,
      positionSec: 42,
      lastUpdatedAt: Date.now() - 5000,
      playbackRate: 1.0,
      epoch: 0,
    };
    expect(calculateCurrentPosition(playback, Date.now())).toBe(42);
  });

  it('returns positionSec when status is IDLE', () => {
    const playback = {
      track: null,
      status: 'IDLE' as const,
      positionSec: 0,
      lastUpdatedAt: Date.now() - 5000,
      playbackRate: 1.0,
      epoch: 0,
    };
    expect(calculateCurrentPosition(playback, Date.now())).toBe(0);
  });

  it('advances position when status is PLAYING', () => {
    const now = Date.now();
    const playback = {
      track: { videoId: 'test', title: 'Test', channelName: 'C', durationSec: 200,
               thumbnailUrl: '', addedBy: 'X', streamUrl: '', streamExpiresAt: 0 },
      status: 'PLAYING' as const,
      positionSec: 10,
      lastUpdatedAt: now - 5000, // 5 seconds ago
      playbackRate: 1.0,
      epoch: 0,
    };
    const result = calculateCurrentPosition(playback, now);
    expect(result).toBeCloseTo(15, 0); // 10 + 5 ≈ 15
  });

  it('clamps to track duration', () => {
    const now = Date.now();
    const playback = {
      track: { videoId: 'test', title: 'Test', channelName: 'C', durationSec: 12,
               thumbnailUrl: '', addedBy: 'X', streamUrl: '', streamExpiresAt: 0 },
      status: 'PLAYING' as const,
      positionSec: 10,
      lastUpdatedAt: now - 10_000, // 10 seconds ago → would be 20s, but clamped to 12
      playbackRate: 1.0,
      epoch: 0,
    };
    expect(calculateCurrentPosition(playback, now)).toBe(12);
  });

  it('respects playbackRate', () => {
    const now = Date.now();
    const playback = {
      track: { videoId: 'test', title: 'Test', channelName: 'C', durationSec: 200,
               thumbnailUrl: '', addedBy: 'X', streamUrl: '', streamExpiresAt: 0 },
      status: 'PLAYING' as const,
      positionSec: 0,
      lastUpdatedAt: now - 10_000, // 10 seconds ago
      playbackRate: 1.5,
      epoch: 0,
    };
    const result = calculateCurrentPosition(playback, now);
    expect(result).toBeCloseTo(15, 0); // 0 + (10 * 1.5) = 15
  });

  it('does not return negative positions', () => {
    const playback = {
      track: { videoId: 'test', title: 'Test', channelName: 'C', durationSec: 200,
               thumbnailUrl: '', addedBy: 'X', streamUrl: '', streamExpiresAt: 0 },
      status: 'PLAYING' as const,
      positionSec: 0,
      lastUpdatedAt: Date.now() + 5000, // Future timestamp edge case
      playbackRate: 1.0,
      epoch: 0,
    };
    expect(calculateCurrentPosition(playback, Date.now())).toBeGreaterThanOrEqual(0);
  });
});


import { generateRoomCode, generateUserId } from '../src/utils.js';

describe('generateRoomCode', () => {
  it('generates a 6-character code', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 1000 }, generateRoomCode));
    expect(codes.size).toBeGreaterThan(990); // Extremely unlikely to have >10 collisions in 1000
  });

  it('only contains safe characters (no 0/O/I/l ambiguity)', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/);
  });
});

describe('generateUserId', () => {
  it('generates a valid UUID v4', () => {
    const id = generateUserId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});
