// app/src/stores/queueStore.ts
import { create } from 'zustand';
import { TrackMetadata } from '../types';

interface QueueState {
  queue: TrackMetadata[];
  isExtracting: boolean; // True when server is extracting stream URL for an added track
  extractingVideoId: string | null;

  setQueue: (queue: TrackMetadata[]) => void;
  setExtracting: (videoId: string | null) => void;
  reset: () => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  queue: [],
  isExtracting: false,
  extractingVideoId: null,

  setQueue: (queue) => set({ queue, isExtracting: false, extractingVideoId: null }),
  setExtracting: (videoId) => set({ isExtracting: !!videoId, extractingVideoId: videoId }),
  reset: () => set({ queue: [], isExtracting: false, extractingVideoId: null }),
}));

