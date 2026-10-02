// server/src/utils.ts
import { customAlphabet } from 'nanoid';
import { randomUUID } from 'crypto';

// 6-char alphanumeric room codes (uppercase, no ambiguous chars like 0/O, 1/I/l)
const nanoid = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);

export function generateRoomCode(): string {
  return nanoid();
}

export function generateUserId(): string {
  return randomUUID();
}

export function generateMessageId(): string {
  return randomUUID();
}
