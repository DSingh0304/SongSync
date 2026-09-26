// app/src/components/SearchResult.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { YouTubeSearchResult } from '../types';

interface SearchResultProps {
  item: YouTubeSearchResult;
  onAdd: (item: YouTubeSearchResult) => void;
}

export default function SearchResult({ item, onAdd }: SearchResultProps) {
  return (
    <View style={styles.container}>
      <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
      
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{item.channelName}</Text>
      </View>

      <TouchableOpacity style={styles.addBtn} onPress={() => onAdd(item)}>
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  thumbnail: { width: 100, height: 56, borderRadius: 6, backgroundColor: '#333' },
  info: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 14, fontWeight: '500', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 12 },
  addBtn: { padding: 12, backgroundColor: '#333', borderRadius: 24, marginLeft: 8 },
});
