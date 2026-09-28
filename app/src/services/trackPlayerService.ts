// app/src/services/trackPlayerService.ts
import { setAudioModeAsync, createAudioPlayer, AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;

export async function setupAudio() {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
    allowsRecording: false,
  });
}

export function getPlayer() {
  return player;
}

export async function loadAndPlayTrack(url: string, metadata?: { title?: string, artist?: string, artworkUrl?: string }) {
  if (player) {
    player.pause();
    if (typeof (player as any).release === 'function') {
      (player as any).release();
    }
    player = null;
  }
  
  player = createAudioPlayer(url);
  
  
  player.play();
  return player;
}

export async function playAudio() {
  if (player) player.play();
}

export async function pauseAudio() {
  if (player) player.pause();
}

export async function stopAudio() {
  if (player) {
    player.pause();
    if (typeof (player as any).release === 'function') {
      (player as any).release();
    }
    player = null;
  }
}

export async function seekTo(positionSec: number) {
  if (player) {
    player.seekTo(positionSec);
  }
}

export async function getPosition(): Promise<number> {
  if (!player) return 0;
  return player.currentTime ?? 0;
}
