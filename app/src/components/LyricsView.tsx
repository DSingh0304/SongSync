import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { SERVER_URL } from '../utils/constants';
import { usePlayerStore } from '../stores/playerStore';
import { getPlayer } from '../services/trackPlayerService';

interface LyricLine {
  timeSec: number;
  text: string;
}

export default function LyricsView() {
  const track = usePlayerStore((s) => s.track);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const scrollViewRef = useRef<ScrollView>(null);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    if (!track) {
      setLyrics([]);
      return;
    }
    
    let isMounted = true;
    const fetchLyrics = async () => {
      setLoading(true);
      setLyrics([]);
      setPlainLyrics(null);
      try {
        let titleClean = track.title.replace(/ *\([^)]*\) */g, '').replace(/ *\[[^\]]*\] */g, '');
        titleClean = titleClean.split('|')[0].split('-')[0].trim();
        const artistClean = track.channelName.replace(' - Topic', '');
        
        const url = `${SERVER_URL}/api/lyrics/search?track_name=${encodeURIComponent(titleClean)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        
        if (isMounted) {
          if (data.syncedLyrics) {
            setLyrics(parseLrc(data.syncedLyrics));
          } else if (data.plainLyrics) {
            setPlainLyrics(data.plainLyrics);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch lyrics (Network Issue)');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchLyrics();
    return () => { isMounted = false; };
  }, [track?.videoId]);

  // Sync position
  useEffect(() => {
    if (lyrics.length === 0) return;
    
    const interval = setInterval(() => {
      const p = getPlayer();
      if (p && p.currentTime !== undefined) {
        const curSec = p.currentTime;
        setPosition(curSec);
        
        // Find active line
        let nextActive = lyrics.length - 1;
        for (let i = 0; i < lyrics.length; i++) {
          if (lyrics[i].timeSec > curSec) {
            nextActive = i - 1;
            break;
          }
        }
        nextActive = Math.max(0, nextActive);
        
        if (nextActive !== activeLineIndex) {
          setActiveLineIndex(nextActive);
          scrollViewRef.current?.scrollTo({ y: nextActive * 36 - 100, animated: true });
        }
      }
    }, 250);
    
    return () => clearInterval(interval);
  }, [lyrics, activeLineIndex]);

  if (!track) return null;
  
  if (loading) {
    return <View style={styles.container}><Text style={styles.empty}>Loading lyrics...</Text></View>;
  }
  
  if (lyrics.length === 0 && !plainLyrics) {
    return <View style={styles.container}><Text style={styles.empty}>No synced lyrics found.</Text></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {plainLyrics ? (
          <Text style={styles.plainLyricsText}>{plainLyrics}</Text>
        ) : lyrics.map((line, idx) => (
          <Text 
            key={idx} 
            style={[
              styles.line, 
              idx === activeLineIndex ? styles.activeLine : null
            ]}
          >
            {line.text}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

function parseLrc(lrc: string): LyricLine[] {
  const lines = lrc.split('\n');
  const result: LyricLine[] = [];
  const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
  
  for (const line of lines) {
    const match = timeReg.exec(line);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = parseInt(match[3], 10) * (match[3].length === 2 ? 10 : 1);
      const text = line.replace(timeReg, '').trim();
      if (text) {
        result.push({ timeSec: min * 60 + sec + ms / 1000, text });
      }
    }
  }
  return result;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 16,
  },
  scrollContent: {
    paddingVertical: 100,
  },
  empty: {
    color: '#888',
    textAlign: 'center',
    marginTop: 40,
  },
  line: {
    color: '#666',
    fontSize: 20,
    lineHeight: 36,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeLine: {
    color: '#fff',
    fontSize: 24,
  },
  plainLyricsText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 32,
    textAlign: 'center',
    paddingHorizontal: 16,
  }
});
