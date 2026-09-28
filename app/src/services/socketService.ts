// app/src/services/socketService.ts
// Singleton Socket.io client with AppState-aware reconnection.
// Never create io() inside a component — always use this singleton.

import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import { SERVER_URL, EVENTS } from '../utils/constants';

class SocketService {
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private userId: string | null = null;

  init(): Socket {
    if (this.socket?.connected) return this.socket;

    this.socket = io(SERVER_URL, {
      transports: ['websocket'], // Skip HTTP long-polling — causes CORS issues in RN
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20_000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      // If we have a session, attempt to rejoin after reconnect
      if (this.roomId && this.userId) {
        this.socket?.emit(EVENTS.ROOM_REJOIN, {
          roomId: this.roomId,
          userId: this.userId,
        });
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    // Handle app foregrounding — reconnect if socket dropped while backgrounded
    AppState.addEventListener('change', this.handleAppStateChange);

    return this.socket;
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      if (this.socket && !this.socket.connected) {
        console.log('[Socket] App active — reconnecting...');
        this.socket.connect();
      }
    }
  };

  /** Store session info so we can rejoin after reconnect */
  setSession(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
  }

  clearSession() {
    this.roomId = null;
    this.userId = null;
  }

  getSocket(): Socket {
    if (!this.socket) {
      return this.init();
    }
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const socketService = new SocketService();
