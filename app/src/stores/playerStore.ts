// app/src/stores/playerStore.ts
import { create } from 'zustand';
import { PlaybackState, PlaybackStatus, TrackMetadata } from '../types';

interface PlayerStoreState extends PlaybackState {
  // Local computed flag for UI convenience
  isPlaying: boolean;

  // Actions
  setPlaybackState: (state: PlaybackState) => void;
  setLocalPause: (paused: boolean) => void;
  reset: () => void;
}

const initialState = {
  track: null,
  status: 'IDLE' as PlaybackStatus,
  positionSec: 0,
  lastUpdatedAt: 0,
  playbackRate: 1.0,
  epoch: 0,
  isPlaying: false,
};

export const usePlayerStore = create<PlayerStoreState>((set) => ({
  ...initialState,

  setPlaybackState: (state) =>
    set({
      ...state,
      isPlaying: state.status === 'PLAYING',
    }),

  setLocalPause: (paused) =>
    set((state) => {
      if (state.status === 'IDLE') return state;
      return {
        status: paused ? 'PAUSED' : 'PLAYING',
        isPlaying: !paused,
        // We do not increment epoch here because this is local-only (e.g., app backgrounded)
      };
    }),

  reset: () => set(initialState),
}));

