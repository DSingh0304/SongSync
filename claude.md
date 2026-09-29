# SongSync - AI Agent & Developer Guidelines

## Project Architecture
- **Root**: Monorepo containing `app` (Frontend) and `server` (Backend).
- **Frontend (`/app`)**: React Native with Expo (New Architecture enabled). Uses `zustand` for state, `expo-audio` for native playback, and Socket.io client for real-time room sync.
- **Backend (`/server`)**: Node.js, Express, Socket.io. State is stored in-memory (`rooms` Map). Uses `yt-dlp` via child process to extract raw YouTube streams.

## Key Features & Implementations
1. **Clock Sync**: WebSockets have latency. The client computes time offset against the server on join, ensuring playhead positions (e.g., `positionSec`) are flawlessly synced regardless of network ping.
2. **Track Audio**: Uses `expo-audio` `createAudioPlayer()`. Always `.pause()` old players before creating new ones to prevent ghost players.
3. **Queue / Playlist**: `RoomState` maintains `queue: TrackMetadata[]` and `queueIndex: number`. Songs are never deleted upon finishing; the `queueIndex` just increments, preserving a full session history.
4. **Lyrics Sync**: Uses `lrclib.net` to fetch synced lyrics based on YouTube song titles/duration, rendering them in a scrolling `<LyricsView>`.
5. **Reactions**: Participants can tap emojis which visually float up the screen using React Native Reanimated.
6. **Autoplay**: When the queue finishes, the server automatically uses the last played track's artist to fetch a YouTube recommendation and queues it seamlessly.

## Development Rules
- **No Background Playback**: Lock-screen controls and background playback (`enableBackgroundPlayback: true` in `app.json`) are currently **DISABLED** due to requiring native builds which are unsupported in Expo Go.
- **Tools / Libraries**: Never use `expo-av` or `react-native-track-player`. They are incompatible with RN 0.86 New Architecture. Stick to `expo-audio`.
- **Backend Flow**: Backend state changes must be broadcasted via `s2c:playback:track_changed` or `s2c:playback:sync`.
- **Validation**: All incoming Socket.io events on the server MUST be strictly validated via Zod schemas in `server/src/validation.ts`.
- **Tests**: Vitest tests are located in `server/tests/`. Run them via `npm run test` in the `server` directory.
