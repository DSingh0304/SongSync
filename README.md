# VibeSync

VibeSync is a real-time, synchronized YouTube audio streaming application. It allows multiple users to join a shared room and listen to YouTube tracks with synchronized playback across all client devices. 

The project is structured as a monorepo containing a React Native frontend and a Node.js backend.

## Architecture

* **Frontend:** React Native with Expo (New Architecture enabled). State management is handled via Zustand. Native audio playback is powered by `expo-audio`.
* **Backend:** Node.js and Express, utilizing Socket.io for bidirectional real-time communication.
* **Audio Extraction:** The server leverages `yt-dlp` as a child process to securely extract raw YouTube audio streams.
* **Synchronization:** Implements a custom NTP-style clock synchronization protocol over WebSockets. Clients calculate network latency and time offsets against the server to ensure exact playback alignment, regardless of individual network ping.

## Key Features

* **Synchronized Playback:** Server-authoritative state ensures all clients in a room hear the exact same audio at the exact same millisecond.
* **Synchronized Lyrics:** Integration with the lrclib API fetches and displays scrolling, time-synced lyrics based on the current track's metadata.
* **Queue Management:** Persistent room queues with automated play-next functionality.
* **Autoplay:** Automatically fetches and queues recommended tracks based on the last played artist when the queue is exhausted.
* **Real-time Interactions:** Live chat system and floating visual reactions utilizing React Native Reanimated.

## Prerequisites

* Node.js (v18 or higher recommended)
* `yt-dlp` binary installed and accessible in the backend directory
* Java 17 (required for Android APK compilation)

## Installation

Clone the repository and install dependencies for both the frontend and backend environments.

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../app
npm install
```

## Environment Configuration

Create a `.env` file in the `app` directory to define the backend connection URL.

```ini
# app/.env
EXPO_PUBLIC_SERVER_URL=http://<YOUR_LOCAL_IP>:3000
```

By default, the backend runs on port 3000. If you are deploying the backend to a cloud provider, replace the local IP address with your production URL.

## Running the Application

### 1. Start the Backend Server

```bash
cd server
npm run dev
```

### 2. Run the Frontend

To start the Expo development server:

```bash
cd app
npx expo start -c
```

To build a standalone Android APK (requires Android SDK and Java 17):

```bash
cd app
npx expo prebuild --clean
cd android
./gradlew assembleRelease
```
The compiled APK will be output to `app/android/app/build/outputs/apk/release/app-release.apk`.

## Testing

The backend includes a Vitest test suite that validates core room management logic and strict Socket.io payload validation (via Zod).

```bash
cd server
npm run test
```

## Security

* **Event Validation:** All incoming WebSocket payloads are strictly validated against predefined Zod schemas before being processed by the server.
* **Cleartext Traffic:** Android Release builds block HTTP traffic by default. The `app.json` has been explicitly configured to allow cleartext traffic for local development testing without HTTPS certificates. Ensure this is reverted if deploying to a production environment utilizing HTTPS.

## License

This project is open-source and available under the MIT License.
