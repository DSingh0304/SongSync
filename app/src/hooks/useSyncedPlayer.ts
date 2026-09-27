// app/src/hooks/useSyncedPlayer.ts
import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { calculateCurrentPosition } from '../types';
import { clockSyncRef } from './useSocket';
import { SYNC, EVENTS } from '../utils/constants';
import { loadAndPlayTrack, playAudio, pauseAudio, seekTo, getPosition, getPlayer, stopAudio } from '../services/trackPlayerService';
import { socketService } from '../services/socketService';
import { useRoomStore } from '../stores/roomStore';

export function useSyncedPlayer() {
  const playback = usePlayerStore();
  const roomId = useRoomStore((s) => s.roomId);
  const [isBuffering, setIsBuffering] = useState(false);
  const currentTrackId = useRef<string | null>(null);
  const playTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeekTime = useRef<number>(0);

  const stateRef = useRef({ playback, roomId });
  useEffect(() => {
    stateRef.current = { playback, roomId };
  }, [playback, roomId]);

  useEffect(() => {
    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }

    const applyServerState = async () => {
      const clockSync = clockSyncRef.current;
      if (!clockSync) return;

      const { track, status, positionSec } = playback;

      if (status === 'IDLE' || !track) {
        await stopAudio().catch(() => {});
        currentTrackId.current = null;
        setIsBuffering(false);
        return;
      }

      // New track - load it
      if (currentTrackId.current !== track.videoId) {
        currentTrackId.current = track.videoId;
        setIsBuffering(true);
        try {
          const expectedPos = calculateCurrentPosition(playback, clockSync.now());
          await loadAndPlayTrack(track.streamUrl, {
            title: track.title,
            artist: track.channelName,
            artworkUrl: track.thumbnailUrl,
          });
          lastSeekTime.current = Date.now();
          await seekTo(expectedPos);
          if (status !== 'PLAYING') await pauseAudio();

          if (roomId) {
            socketService.getSocket().emit(EVENTS.PLAYBACK_READY, { roomId });
          }
        } catch (err) {
          console.error('[Player] Failed to load track:', err);
        }
        setIsBuffering(false);
        return;
      }

      if (status === 'PAUSED') {
        await pauseAudio();
        await seekTo(positionSec);
        return;
      }

      if (status === 'PLAYING') {
        const expectedPos = calculateCurrentPosition(playback, clockSync.now());
        const startAt = (playback as any).scheduledServerTime;
        
        if (startAt && startAt > clockSync.now()) {
          const delayMs = startAt - clockSync.now();
          lastSeekTime.current = Date.now();
          await seekTo(expectedPos);
          playTimeoutRef.current = setTimeout(async () => {
            await playAudio();
            setTimeout(checkDriftAndCorrect, 1000);
          }, delayMs);
        } else {
          const currentPos = await getPosition();
          if (Math.abs(currentPos - expectedPos) > 0.5) {
            lastSeekTime.current = Date.now();
          await seekTo(expectedPos);
          }
          await playAudio();
        }
      }
    };

    applyServerState();
    
    return () => {
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    };
  }, [playback.epoch]);

  useEffect(() => {
    const interval = setInterval(checkDriftAndCorrect, SYNC.DRIFT_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);


  const checkDriftAndCorrect = async () => {
    const { playback: currentState } = stateRef.current;
    const clockSync = clockSyncRef.current;
    if (Date.now() - lastSeekTime.current < 5000) return;

    if (!clockSync || currentState.status !== 'PLAYING' || !currentState.track) return;

    const expectedPos = calculateCurrentPosition(currentState, clockSync.now());
    const actualPos = await getPosition();
    const driftMs = (actualPos - expectedPos) * 1000;

    if (Math.abs(driftMs) <= SYNC.DRIFT_DEADBAND_MS) return;

    console.log(`[Sync] Correcting ${driftMs.toFixed(0)}ms drift`);
    lastSeekTime.current = Date.now();
          await seekTo(expectedPos);
  };

  return { isBuffering };
}
