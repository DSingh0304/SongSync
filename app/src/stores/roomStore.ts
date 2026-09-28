// app/src/stores/roomStore.ts
import { create } from 'zustand';
import { Participant } from '../types';

interface RoomState {
  roomId: string | null;
  userId: string | null;
  displayName: string | null;
  isHost: boolean;
  queueIndex: number;
  participants: Participant[];

  // Actions
  setRoom: (roomId: string, userId: string, displayName: string, isHost: boolean, queueIndex?: number) => void;
  setQueueIndex: (index: number) => void;
  setParticipants: (participants: Participant[]) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (userId: string, newHostId?: string) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomId: null,
  userId: null,
  displayName: null,
  isHost: false,
  queueIndex: 0,
  participants: [],

  setRoom: (roomId, userId, displayName, isHost, queueIndex = 0) =>
    set({ roomId, userId, displayName, isHost, queueIndex }),
    
  setQueueIndex: (index) => set({ queueIndex: index }),

  setParticipants: (participants) => set({ participants }),

  addParticipant: (participant) =>
    set((state) => {
      // Prevent duplicates
      if (state.participants.some((p) => p.userId === participant.userId)) {
        return state;
      }
      return { participants: [...state.participants, participant] };
    }),

  removeParticipant: (userId, newHostId) =>
    set((state) => {
      const participants = state.participants.filter((p) => p.userId !== userId);
      let isHost = state.isHost;

      if (newHostId) {
        // Update host flag for all participants
        participants.forEach((p) => {
          p.isHost = p.userId === newHostId;
        });
        if (state.userId === newHostId) {
          isHost = true;
        }
      }

      return { participants, isHost };
    }),

  reset: () =>
    set({
      roomId: null,
      userId: null,
      displayName: null,
      isHost: false,
      queueIndex: 0,
      participants: [],
    }),
}));
