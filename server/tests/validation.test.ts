// serv../src/s../src/tes../src/validation.test.ts
import { describe, it, expect } from 'vitest';
import {
  validate,
  RoomCreateSchema,
  RoomJoinSchema,
  PlaybackSeekSchema,
  QueueAddSchema,
  ChatMessageSchema,
} from '../src/validation.js';

describe('RoomCreateSchema', () => {
  it('accepts valid display name', () => {
    const result = validate(RoomCreateSchema, { displayName: 'Alice' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.displayName).toBe('Alice');
  });

  it('rejects empty display name', () => {
    const result = validate(RoomCreateSchema, { displayName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name over 32 chars', () => {
    const result = validate(RoomCreateSchema, { displayName: 'A'.repeat(33) });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = validate(RoomCreateSchema, {});
    expect(result.success).toBe(false);
  });
});

describe('RoomJoinSchema', () => {
  it('upcases room code', () => {
    const result = validate(RoomJoinSchema, { roomId: 'abc123', displayName: 'Bob' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.roomId).toBe('ABC123');
  });

  it('rejects room codes not 6 chars', () => {
    const result = validate(RoomJoinSchema, { roomId: 'ABC12', displayName: 'Bob' });
    expect(result.success).toBe(false);
  });
});

describe('PlaybackSeekSchema', () => {
  it('accepts valid seek', () => {
    const result = validate(PlaybackSeekSchema, { roomId: 'ABC123', targetSec: 45.5, clientEpoch: 3 });
    expect(result.success).toBe(true);
  });

  it('rejects negative targetSec', () => {
    const result = validate(PlaybackSeekSchema, { roomId: 'ABC123', targetSec: -1, clientEpoch: 3 });
    expect(result.success).toBe(false);
  });
});

describe('QueueAddSchema', () => {
  it('rejects video ID not 11 chars', () => {
    const result = validate(QueueAddSchema, {
      roomId: 'ABC123',
      videoId: 'short',
      title: 'Test',
      channelName: 'Ch',
      durationSec: 200,
      thumbnailUrl: 'http../src//example.c../src/thumb.jpg',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid queue add', () => {
    const result = validate(QueueAddSchema, {
      roomId: 'ABC123',
      videoId: 'dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up',
      channelName: 'Rick Astley',
      durationSec: 213,
      thumbnailUrl: 'http../src//i.ytimg.c../src/../src/dQw4w9WgX../src/hqdefault.jpg',
    });
    expect(result.success).toBe(true);
  });
});

describe('ChatMessageSchema', () => {
  it('rejects empty message', () => {
    const result = validate(ChatMessageSchema, { roomId: 'ABC123', text: '' });
    expect(result.success).toBe(false);
  });

  it('rejects message over 500 chars', () => {
    const result = validate(ChatMessageSchema, { roomId: 'ABC123', text: 'A'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('accepts valid message', () => {
    const result = validate(ChatMessageSchema, { roomId: 'ABC123', text: 'Hello world!' });
    expect(result.success).toBe(true);
  });
});
