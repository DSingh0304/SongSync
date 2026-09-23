# SongSync - AI Agent & Developer Guidelines

## Project Architecture
- **Root**: Monorepo containing `app` (Frontend) and `server` (Backend).
- **Frontend (`/app`)**: React Native with Expo (New Architecture enabled). Uses `zustand` for state, `expo-audio` for native playback, and Socket.io client for real-time room sync.
- **Backend (`/server`)**: Node.js, Express, Socket.io. State is stored in-memory (`rooms` Map). Uses `yt-dlp` via child process to extract raw YouTube streams.

## Key Mechanisms
1. **Clock Sync**: WebSockets have latency. The client computes time offset against the server on join, ensuring playhead positions (e.g., `positionSec`) are flawlessly synced regardless of network ping.
2. **Track Audio**: Uses `expo-audio` `createAudioPlayer()`. Always `.pause()` old players before creating new ones to prevent ghost players.
3. **Queue / Playlist**: `RoomState` maintains `queue: TrackMetadata[]` and `queueIndex: number`. Songs are never deleted upon finishing; the `queueIndex` just increments, preserving a full session history.

## Development Rules
- Never use `expo-av` or `react-native-track-player`. They are incompatible with RN 0.86 New Architecture. Stick to `expo-audio`.
- Backend state changes must be broadcasted via `s2c:playback:track_changed` or `s2c:playback:sync`.
- The `yt-dlp` binary is expected in the `/server` directory for audio extraction.
