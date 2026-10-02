// server/src/validation.ts
// Zod schemas for all incoming socket event payloads.
// Every c2s:* event should be validated before processing.

import { z } from 'zod';

export const RoomCreateSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name required').max(32, 'Name too long'),
  avatar: z.string().optional(),
});

export const RoomJoinSchema = z.object({
  roomId: z.string().trim().length(6, 'Room code must be 6 characters').toUpperCase(),
  displayName: z.string().trim().min(1, 'Display name required').max(32, 'Name too long'),
  avatar: z.string().optional(),
});

export const RoomLeaveSchema = z.object({
  roomId: z.string().trim().min(1),
});

export const RoomRejoinSchema = z.object({
  roomId: z.string().trim().min(1),
  userId: z.string().uuid('Invalid userId'),
});

export const TimePingSchema = z.object({
  t1: z.number(),
});

export const PlaybackPlaySchema = z.object({
  roomId: z.string().trim().min(1),
});

export const PlaybackPauseSchema = z.object({
  roomId: z.string().trim().min(1),
});

export const PlaybackSeekSchema = z.object({
  roomId: z.string().trim().min(1),
  targetSec: z.number().nonnegative('Seek position cannot be negative'),
  clientEpoch: z.number().int().nonnegative(),
});

export const PlaybackSkipSchema = z.object({
  roomId: z.string().trim().min(1),
});

export const PlaybackReadySchema = z.object({
  roomId: z.string().trim().min(1),
});

export const PlaybackTrackEndedSchema = z.object({
  roomId: z.string().trim().min(1),
});

export const QueueAddSchema = z.object({
  roomId: z.string().trim().min(1),
  videoId: z.string().trim().length(11, 'YouTube video ID must be 11 characters'),
  title: z.string().trim().min(1).max(200),
  channelName: z.string().trim().min(1).max(100),
  durationSec: z.number().min(0),
  thumbnailUrl: z.string().url('Invalid thumbnail URL'),
});

export const QueueRemoveSchema = z.object({
  roomId: z.string().trim().min(1),
  videoId: z.string().trim().length(11),
  userId: z.string().uuid('Invalid userId'),
});

export const ChatMessageSchema = z.object({
  roomId: z.string().trim().min(1),
  text: z.string().trim().min(1, 'Message cannot be empty').max(500, 'Message too long'),
});

/**
 * Validate a socket payload against a Zod schema.
 * Returns { success: true, data } or { success: false, error: string }
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  payload: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const error = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return { success: false, error };
}

export const RoomTransferHostSchema = z.object({
  roomId: z.string().trim().min(1),
  targetUserId: z.string().trim().min(1),
});

export const RoomReactionSchema = z.object({
  roomId: z.string().trim().min(1),
  emoji: z.string().trim().min(1),
});
