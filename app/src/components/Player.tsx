import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SafeAreaView } from 'react-native-safe-area-context';
import { usePlayerStore } from '../stores/playerStore';
import { useRoomStore } from '../stores/roomStore';
import { socketService } from '../services/socketService';
import { EVENTS } from '../utils/constants';
import { getPlayer } from '../services/trackPlayerService';
import { useSyncedPlayer } from '../hooks/useSyncedPlayer';
import LyricsView from './LyricsView';

export default function Player() {
  const track = usePlayerStore((s) => s.track);
  const status = usePlayerStore((s) => s.status);
  const epoch = usePlayerStore((s) => s.epoch);
  const roomId = useRoomStore((s) => s.roomId);
  const isHost = useRoomStore((s) => s.isHost);
  
  const { isBuffering } = useSyncedPlayer();
  
  const [position, setPosition] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);


  useEffect(() => {
    const interval = setInterval(() => {
      const p = getPlayer();
      if (p && p.currentTime !== undefined) {
        setPosition(p.currentTime);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [track]);

  if (!track) return null;

  const handlePlayPause = () => {
    if (!isHost || !roomId) return;
    const event = status === 'PLAYING' ? EVENTS.PLAYBACK_PAUSE : EVENTS.PLAYBACK_PLAY;
    socketService.getSocket().emit(event, { roomId });
  };

  const handleSkip = () => {
    if (!isHost || !roomId) return;
    socketService.getSocket().emit(EVENTS.PLAYBACK_SKIP, { roomId });
  };
  
  const handlePrevious = () => {
    if (!isHost || !roomId) return;
    socketService.getSocket().emit('c2s:playback:previous', { roomId });
  };

  const handleSeek = (e: any) => {
    if (!isHost || !roomId) return;
    const barWidth = Dimensions.get('window').width - (isExpanded ? 64 : 0); // padding adjustments
    const clickX = e.nativeEvent.locationX;
    const percent = Math.min(Math.max(0, clickX / barWidth), 1);
    const targetSec = percent * track.durationSec;
    
    socketService.getSocket().emit(EVENTS.PLAYBACK_SEEK, { roomId, targetSec, clientEpoch: epoch });
    setPosition(targetSec);
    const p = getPlayer();
    if (p) p.seekTo(targetSec);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = track.durationSec > 0 ? (position / track.durationSec) * 100 : 0;
  const isPlaying = status === 'PLAYING';

  return (
    <>
      <TouchableOpacity activeOpacity={0.9} onPress={() => setIsExpanded(true)}>
        <View style={styles.miniContainer}>
          {/* Progress Bar (Mini) */}
          <View style={styles.miniProgressBarBg}>
            <View style={[styles.miniProgressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          
          <View style={styles.miniInner}>
            <Image source={{ uri: track.thumbnailUrl }} style={styles.miniThumbnail} />
            <View style={styles.miniInfo}>
              <Text style={styles.miniTitle} numberOfLines={1}>{track.title}</Text>
              <Text style={styles.miniArtist} numberOfLines={1}>{track.channelName}</Text>
            </View>
            <View style={styles.miniControls}>
              <TouchableOpacity onPress={handlePlayPause} disabled={!isHost || isBuffering} style={styles.controlBtn}>
                <Ionicons name={isPlaying ? "pause" : "play"} size={28} color={isHost ? "#F8FAFC" : "#94A3B8"} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <Modal visible={isExpanded} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsExpanded(false)}>
        <SafeAreaView style={styles.fullContainer}>
          <View style={styles.fullHeader}>
            <TouchableOpacity onPress={() => setIsExpanded(false)} style={styles.closeBtn}>
              <Ionicons name="chevron-down" size={32} color="#F8FAFC" />
            </TouchableOpacity>
            <Text style={styles.fullHeaderTitle}>Now Playing</Text>
            <TouchableOpacity onPress={() => setShowLyrics(!showLyrics)} style={styles.lyricsToggle}>
              <Ionicons name="text" size={24} color={showLyrics ? "#10B981" : "#94A3B8"} />
            </TouchableOpacity>
          </View>

          {showLyrics ? (
            <View style={{ flex: 1 }}><LyricsView /></View>
          ) : (
            <View style={styles.fullArtContainer}>
              <Image source={{ uri: track.thumbnailUrl }} style={styles.fullThumbnail} />
            </View>
          )}

          <View style={styles.fullBottom}>
            <View style={styles.fullInfoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fullTitle} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.fullArtist} numberOfLines={1}>{track.channelName}</Text>
              </View>
            </View>

            {/* Scrubbing Bar */}
            <View style={styles.scrubberContainer}>
              <TouchableOpacity activeOpacity={1} onPress={handleSeek} style={styles.scrubberHitbox}>
                <View style={styles.scrubberBg}>
                  <View style={[styles.scrubberFill, { width: `${progressPercent}%` }]} />
                </View>
              </TouchableOpacity>
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(position)}</Text>
                <Text style={styles.timeText}>-{formatTime(track.durationSec - position)}</Text>
              </View>
            </View>

            {/* Full Controls */}
            <View style={styles.fullControls}>
              <TouchableOpacity onPress={handlePrevious} disabled={!isHost}>
                <Ionicons name="play-skip-back" size={40} color={isHost ? "#F8FAFC" : "#94A3B8"} />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handlePlayPause} disabled={!isHost || isBuffering} style={styles.playPauseBtnBig}>
                <Ionicons name={isPlaying ? "pause" : "play"} size={48} color="#0F172A" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleSkip} disabled={!isHost}>
                <Ionicons name="play-skip-forward" size={40} color={isHost ? "#F8FAFC" : "#94A3B8"} />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  miniContainer: { backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#475569' },
  miniProgressBarBg: { height: 2, backgroundColor: '#475569', width: '100%' },
  miniProgressBarFill: { height: 2, backgroundColor: '#F8FAFC' },
  miniInner: { flexDirection: 'row', alignItems: 'center', padding: 8, paddingHorizontal: 16 },
  miniThumbnail: { width: 48, height: 48, borderRadius: 4, marginRight: 12 },
  miniInfo: { flex: 1 },
  miniTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: 'bold' },
  miniArtist: { color: '#CBD5E1', fontSize: 12, marginTop: 2 },
  miniControls: { flexDirection: 'row', alignItems: 'center' },
  controlBtn: { padding: 8 },

  fullContainer: { flex: 1, backgroundColor: '#1E293B' },
  fullHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  closeBtn: { padding: 4 },
  fullHeaderTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: 'bold' },
  lyricsToggle: { padding: 4 },
  
  fullArtContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  fullThumbnail: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#475569' },
  visualizerOverlay: { position: 'absolute', width: '100%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8 },
  
  fullBottom: { paddingHorizontal: 32, paddingBottom: 48 },
  fullInfoRow: { marginBottom: 24 },
  fullTitle: { color: '#F8FAFC', fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  fullArtist: { color: '#CBD5E1', fontSize: 16 },
  
  scrubberContainer: { marginBottom: 24 },
  scrubberHitbox: { height: 32, justifyContent: 'center' },
  scrubberBg: { height: 4, backgroundColor: '#64748B', borderRadius: 2, overflow: 'hidden' },
  scrubberFill: { height: '100%', backgroundColor: '#F8FAFC' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  timeText: { color: '#94A3B8', fontSize: 12 },
  
  fullControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32 },
  playPauseBtnBig: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
});
