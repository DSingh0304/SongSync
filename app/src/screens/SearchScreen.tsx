// app/src/screens/SearchScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { searchYouTube, getVideoDetails, ApiError } from '../services/api';
import { YouTubeSearchResult, extractVideoId } from '../types';
import SearchResult from '../components/SearchResult';
import { socketService } from '../services/socketService';
import { SERVER_URL } from '../utils/constants';
import { useRoomStore } from '../stores/roomStore';
import { EVENTS } from '../utils/constants';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function SearchScreen() {
  const navigation = useNavigation();
  const roomId = useRoomStore((s) => s.roomId);
  
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 700);
  
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchResults = useCallback(async (q: string) => {
    if (!q || q.length < 3) { setResults([]); return; }
    setIsLoading(true); setError('');

    try {
      const videoId = extractVideoId(q);
      if (videoId) {
        const details = await getVideoDetails(videoId);
        setResults([details]);
      } else {
        const searchRes = await searchYouTube(q);
        setResults(searchRes);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to search YouTube');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchResults(debouncedQuery); }, [debouncedQuery, fetchResults]);

  
  const handleSpotifyImport = async () => {
    if (!query.includes('spotify.com/playlist/')) {
      setError('Please paste a valid Spotify playlist URL in the search box');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${SERVER_URL}/api/spotify/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: query })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to import playlist');
      
      const tracks = data.tracks;
      if (!tracks || tracks.length === 0) throw new Error('No tracks found in playlist');
      
      // Batch add tracks
      for (const track of tracks) {
        // We do a YouTube search on the backend for each
        const searchRes = await searchYouTube(`${track.name} ${track.artist}`);
        if (searchRes && searchRes.length > 0) {
          const item = searchRes[0];
          socketService.getSocket().emit(EVENTS.QUEUE_ADD, {
            roomId,
            videoId: item.videoId,
            title: item.title, // Keep YT title or Spotify title? Let's use YT to match thumbnail
            channelName: item.channelName,
            durationSec: item.durationSec || 0,
            thumbnailUrl: item.thumbnailUrl,
          });
        }
      }
      
      navigation.goBack();
    } catch (err: any) {
      setError(err.message || 'Error importing Spotify playlist');
      setIsLoading(false);
    }
  };

  const handleAdd = (item: YouTubeSearchResult) => {
    if (!roomId) return;
    
    socketService.getSocket().emit(EVENTS.QUEUE_ADD, {
      roomId,
      videoId: item.videoId,
      title: item.title,
      channelName: item.channelName,
      durationSec: item.durationSec || 0, 
      thumbnailUrl: item.thumbnailUrl,
    });
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={28} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search YouTube</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
        <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Song name or YouTube URL..." placeholderTextColor="#94A3B8" autoFocus clearButtonMode="while-editing" autoCorrect={false} />
      </View>

      {query.includes('spotify.com') && (
        <TouchableOpacity style={styles.spotifyBtn} onPress={handleSpotifyImport}>
          <Ionicons name="logo-nodejs" size={20} color="#10B981" />
          <Text style={styles.spotifyBtnText}>Import Spotify Playlist (Max 20)</Text>
        </TouchableOpacity>
      )}

      {error ? (
        <View style={styles.centerBox}><Text style={styles.errorText}>{error}</Text></View>
      ) : isLoading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color="#F8FAFC" /></View>
      ) : results.length === 0 && debouncedQuery.length >= 3 ? (
        <View style={styles.centerBox}><Text style={styles.emptyText}>No results found</Text></View>
      ) : (
        <FlatList data={results} keyExtractor={(item, idx) => item.videoId + '-' + idx} renderItem={({ item }) => <SearchResult item={item} onAdd={handleAdd} />} keyboardShouldPersistTaps="handled" />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  backBtn: { padding: 4 },
  headerTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: 'bold' },
  placeholder: { width: 36 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', margin: 16, borderRadius: 8, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 48, color: '#F8FAFC', fontSize: 16 },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { color: '#EF4444', textAlign: 'center' },
  emptyText: { color: '#94A3B8', textAlign: 'center' },
  spotifyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B98122', marginHorizontal: 16, marginBottom: 16, padding: 12, borderRadius: 8, justifyContent: 'center', gap: 8 },
  spotifyBtnText: { color: '#10B981', fontWeight: 'bold' },
});
