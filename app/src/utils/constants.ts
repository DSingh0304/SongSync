console.log("[CONFIG] SERVER_URL is:", process.env.EXPO_PUBLIC_SERVER_URL ?? "http://10.0.2.2:3000");
// app/src/utils/constants.ts

// ── Server ─────────────────────────────────────────────────────────────────────
// Development: use LAN IP for physical devices, 10.0.2.2 for Android emulator
// Production: replace with your Render URL
export const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://10.0.2.2:3000';

// ── Socket.io Event Names ──────────────────────────────────────────────────────
export const EVENTS = {
  // Room lifecycle
  ROOM_CREATE: 'c2s:room:create',
  ROOM_CREATED: 's2c:room:created',
  ROOM_JOIN: 'c2s:room:join',
  ROOM_STATE: 's2c:room:state',
  ROOM_PARTICIPANT_JOINED: 's2c:room:participant_joined',
  ROOM_LEAVE: 'c2s:room:leave',
  ROOM_TRANSFER_HOST: 'c2s:room:transfer_host',
  ROOM_REACTION_SEND: 'c2s:room:reaction',
  ROOM_REACTION_RECV: 's2c:room:reaction',
  ROOM_PARTICIPANT_LEFT: 's2c:room:participant_left',
  ROOM_REJOIN: 'c2s:room:rejoin',
  ROOM_HOST_TRANSFERRED: 's2c:room:host_transferred',
  ROOM_ERROR: 's2c:room:error',

  // Clock sync
  TIME_PING: 'c2s:time:ping',
  TIME_PONG: 's2c:time:pong',

  // Playback
  PLAYBACK_PLAY: 'c2s:playback:play',
  PLAYBACK_PAUSE: 'c2s:playback:pause',
  PLAYBACK_SEEK: 'c2s:playback:seek',
  PLAYBACK_SKIP: 'c2s:playback:skip',
  PLAYBACK_READY: 'c2s:playback:ready',
  PLAYBACK_TRACK_ENDED: 'c2s:playback:track_ended',
  PLAYBACK_SYNC: 's2c:playback:sync',
  PLAYBACK_START_AT: 's2c:playback:start_at',
  PLAYBACK_TRACK_CHANGED: 's2c:playback:track_changed',

  // Queue
  QUEUE_ADD: 'c2s:queue:add',
  QUEUE_REMOVE: 'c2s:queue:remove',
  QUEUE_UPDATED: 's2c:queue:updated',
  QUEUE_EXTRACTING: 's2c:queue:extracting',

  // Chat
  CHAT_MESSAGE_SEND: 'c2s:chat:message',
  CHAT_MESSAGE_RECV: 's2c:chat:message',
} as const;

// ── Sync Config ────────────────────────────────────────────────────────────────
export const SYNC = {
  DRIFT_DEADBAND_MS: 150,       // Ignore drift below this (imperceptible)
  DRIFT_SLEW_THRESHOLD_MS: 800, // Above this — hard seek instead of rate slew
  SLEW_RATE: 0.03,              // 3% speed adjustment for soft correction
  DRIFT_CHECK_INTERVAL_MS: 2500,// How often to check drift during playback
  CLOCK_SYNC_SAMPLES: 8,        // NTP ping burst count on connect
  CLOCK_RESYNC_INTERVAL_MS: 45_000, // Background re-sync interval
  CLOCK_EWMA_ALPHA: 0.2,        // EWMA weight for clock offset updates
  COORDINATED_PLAY_LEAD_MS: 300,// Lead time for coordinated play events
} as const;
