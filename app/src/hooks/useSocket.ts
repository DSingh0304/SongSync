// app/src/hooks/useSocket.ts
import { useEffect, useRef } from 'react';
import { socketService } from '../services/socketService';
import { ClockSynchronizer } from '../services/clockSync';
import { useRoomStore } from '../stores/roomStore';
import { usePlayerStore } from '../stores/playerStore';
import { useQueueStore } from '../stores/queueStore';
import { useChatStore } from '../stores/chatStore';
import { EVENTS } from '../utils/constants';

// We share one clock synchronizer instance app-wide while in a room
export const clockSyncRef = { current: null as ClockSynchronizer | null };

export function useSocket() {
  const socket = socketService.getSocket();
  const setRoom = useRoomStore((s) => s.setRoom);
  const setParticipants = useRoomStore((s) => s.setParticipants);
  const addParticipant = useRoomStore((s) => s.addParticipant);
  const removeParticipant = useRoomStore((s) => s.removeParticipant);
  const setPlaybackState = usePlayerStore((s) => s.setPlaybackState);
  const setQueue = useQueueStore((s) => s.setQueue);
  const setExtracting = useQueueStore((s) => s.setExtracting);
  const setMessages = useChatStore((s) => s.setMessages);
  const addMessage = useChatStore((s) => s.addMessage);

  useEffect(() => {
    // ── Room Events ────────────────────────────────────────────────────────────
    socket.on(EVENTS.ROOM_CREATED, async ({ roomId, userId, roomState }) => {
      socketService.setSession(roomId, userId);
      setRoom(roomId, userId, roomState.participants[0].displayName, true, roomState.queueIndex);
      setParticipants(roomState.participants);
      setPlaybackState(roomState.playback);
      setQueue(roomState.queue);
      setMessages(roomState.chat);
      
      if (!clockSyncRef.current) {
        clockSyncRef.current = new ClockSynchronizer(socket);
        await clockSyncRef.current.initialSync();
      }
    });

    socket.on(EVENTS.ROOM_STATE, async ({ roomState }) => {
      const currentUserId = useRoomStore.getState().userId;
      if (!currentUserId) return; // Should have been set before joining

      const me = roomState.participants.find((p: any) => p.userId === currentUserId);
      setRoom(roomState.roomId, currentUserId, me?.displayName || 'Unknown', me?.isHost || false, roomState.queueIndex);
      setParticipants(roomState.participants);
      setPlaybackState(roomState.playback);
      setQueue(roomState.queue);
      setMessages(roomState.chat);

      if (!clockSyncRef.current) {
        clockSyncRef.current = new ClockSynchronizer(socket);
        await clockSyncRef.current.initialSync();
      }
    });

    socket.on(EVENTS.ROOM_PARTICIPANT_JOINED, ({ participant }) => {
      addParticipant(participant);
    });

    socket.on(EVENTS.ROOM_PARTICIPANT_LEFT, ({ userId }) => {
      removeParticipant(userId);
    });

    socket.on(EVENTS.ROOM_HOST_TRANSFERRED, ({ newHostId }) => {
      removeParticipant('', newHostId); // empty userId means just update host flag
    });

    socket.on(EVENTS.ROOM_ERROR, ({ message }) => {
      console.warn('[Server Error]', message);
      // In a real app, you'd show a toast here
      alert(message);
    });

    // ── Playback Events ────────────────────────────────────────────────────────
    socket.on(EVENTS.PLAYBACK_SYNC, (playback) => {
      setPlaybackState(playback);
    });

    socket.on(EVENTS.PLAYBACK_START_AT, (payload) => {
      // payload includes playback + scheduledServerTime
      setPlaybackState(payload);
      // The actual coordinated play logic is handled in useSyncedPlayer
    });

    socket.on(EVENTS.PLAYBACK_TRACK_CHANGED, ({ playback, queue, queueIndex, scheduledServerTime }) => {
      useRoomStore.getState().setQueueIndex(queueIndex);
      setPlaybackState({ ...playback, scheduledServerTime });
      setQueue(queue);
    });

    // ── Queue Events ───────────────────────────────────────────────────────────
    socket.on(EVENTS.QUEUE_UPDATED, ({ queue }) => {
      setQueue(queue);
      setExtracting(null);
    });

    socket.on(EVENTS.QUEUE_EXTRACTING, ({ videoId }) => {
      setExtracting(videoId);
    });

    // ── Chat Events ────────────────────────────────────────────────────────────
    socket.on(EVENTS.CHAT_MESSAGE_RECV, (message) => {
      addMessage(message);
    });

    return () => {
      socket.off(EVENTS.ROOM_CREATED);
      socket.off(EVENTS.ROOM_STATE);
      socket.off(EVENTS.ROOM_PARTICIPANT_JOINED);
      socket.off(EVENTS.ROOM_PARTICIPANT_LEFT);
      socket.off(EVENTS.ROOM_HOST_TRANSFERRED);
      socket.off(EVENTS.ROOM_ERROR);
      socket.off(EVENTS.PLAYBACK_SYNC);
      socket.off(EVENTS.PLAYBACK_START_AT);
      socket.off(EVENTS.PLAYBACK_TRACK_CHANGED);
      socket.off(EVENTS.QUEUE_UPDATED);
      socket.off(EVENTS.QUEUE_EXTRACTING);
      socket.off(EVENTS.CHAT_MESSAGE_RECV);
    };
  }, [socket, setRoom, setParticipants, addParticipant, removeParticipant, setPlaybackState, setQueue, setExtracting, setMessages, addMessage]);
}

