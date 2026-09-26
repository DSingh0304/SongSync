// app/src/components/NowPlaying.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { usePlayerStore } from '../stores/playerStore';
import { formatDuration } from '../types';
import { getPlayer } from '../services/trackPlayerService';

export default function NowPlaying() {
  const track = usePlayerStore((s) => s.track);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const p = getPlayer();
      if (p) setPosition(p.currentTime ?? 0);
    }, 250);
    return () => clearInterval(interval);
  }, [track]);

  if (!track) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nothing playing</Text>
      </View>
    );
  }

  const progressPercent = track.durationSec > 0 ? (position / track.durationSec) * 100 : 0;
  const clampedPercent = Math.min(Math.max(0, progressPercent), 100);

  return (
    <View style={styles.container}>
      <Image source={{ uri: track.thumbnailUrl }} style={styles.thumbnail} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
        <Text style={styles.channel} numberOfLines={1}>{track.channelName} • Added by {track.addedBy}</Text>
      </View>
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${clampedPercent}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatDuration(position)}</Text>
          <Text style={styles.timeText}>{formatDuration(track.durationSec)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: { alignItems: 'center', padding: 32 },
  emptyText: { color: '#888', fontSize: 16 },
  container: { alignItems: 'center', width: '100%' },
  thumbnail: { width: 280, height: 280, borderRadius: 12, backgroundColor: '#333', marginBottom: 16 },
  info: { width: '100%', alignItems: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  channel: { color: '#aaa', fontSize: 14, marginTop: 4 },
  progressContainer: { width: '100%' },
  progressBarBg: { height: 4, backgroundColor: '#444', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#fff' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  timeText: { color: '#888', fontSize: 12 },
});
