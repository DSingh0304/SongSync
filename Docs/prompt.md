I want to build a mobile app called SyncRoom — a real-time music listening party app where friends can join a shared room, queue songs from YouTube, and hear them in sync while chatting together. The app should be completely free to build and host.

My background:
I am a backend engineer comfortable with Node.js, Express, PostgreSQL, Redis, WebSockets (Socket.io), Docker, and React. I have not built a React Native app before but I am learning Kotlin/Android in parallel. This is my first React Native project so I need guidance on React Native-specific patterns alongside the backend architecture.

Tech stack (non-negotiable):

Frontend: React Native (Expo managed workflow for simplicity)
Backend: Node.js + Express + Socket.io
Music source: YouTube IFrame API / YouTube Data API v3 (free tier)
Real-time: Socket.io for room sync, chat, and playback state
State management: Zustand or Redux Toolkit (recommend which)
Hosting: Railway or Render free tier (backend), no paid services anywhere
No database required for MVP — room state in memory is fine

Core features I want:

Create a room → get a shareable 6-character room code
Join room via code — no login required, just a display name
YouTube search inside the app → queue songs
Playback controls (play, pause, skip) — host or anyone (decide)
Real-time sync — everyone in the room hears the same song at the same timestamp accounting for join latency
Live chat alongside the music
Queue management — see upcoming songs, remove songs

The sync problem I want solved properly:
When a user joins mid-song, they must jump to the correct timestamp. When the host pauses or seeks, all clients must update within 200ms. Explain how to handle this with Socket.io events and what the server-side room state object should look like.

What I need from you:

Full project architecture — folder structure for both frontend and backend
The exact Socket.io event schema — every event name, payload shape, and who emits vs who listens
Server-side room state design — what the in-memory room object looks like
Step-by-step build phases — what to build first, what to build second, in what order so I always have something working
React Native specific guidance — how to embed YouTube playback in React Native (react-native-youtube-iframe or WebView), how to handle background audio
The latency compensation logic — exactly how to sync timestamps when a user joins mid-playback
Free deployment guide — how to deploy backend on Railway and serve the React Native app

Give me a production-quality plan, not a tutorial. I want to understand the architecture decisions and tradeoffs, not just copy code. Point out where the hard problems are and how to solve them.