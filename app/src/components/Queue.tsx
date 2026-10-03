// app/src/components/Queue.tsx
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueueStore } from '../stores/queueStore';
import { useRoomStore } from '../stores/roomStore';
import { socketService } from '../services/socketService';
import { EVENTS } from '../utils/constants';

export default function Queue() {
  const queue = useQueueStore((s) => s.queue);
  const extracting = useQueueStore((s) => s.extractingVideoId);
  const isHost = useRoomStore((s) => s.isHost);
  const roomId = useRoomStore((s) => s.roomId);
  const myUserId = useRoomStore((s) => s.userId);
  const queueIndex = useRoomStore((s) => s.queueIndex);

  const handleRemove = (videoId: string) => {
    if (!roomId) return;
    socketService.getSocket().emit(EVENTS.QUEUE_REMOVE, { roomId, videoId, userId: myUserId });
  };

  const handleJump = (index: number) => {
    if (!roomId || !isHost) return;
    socketService.getSocket().emit('c2s:playback:jump', { roomId, index });
  };

  const renderItem = ({ item, index }: { item: any, index: number }) => {
    const isPlaying = index === queueIndex;
    const isPast = index < queueIndex;
    const canRemove = isHost || item.addedBy === useRoomStore.getState().displayName;

    return (
      <TouchableOpacity 
        style={[
          styles.item, 
          isPlaying && styles.itemPlaying,
          isPast && styles.itemPast
        ]} 
        onPress={() => handleJump(index)}
        disabled={!isHost}
      >
        <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
        <View style={styles.info}>
          <Text style={[styles.title, isPlaying && styles.titlePlaying]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {item.channelName} • Added by {item.addedBy}
          </Text>
        </View>
        {canRemove && (
          <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item.videoId)}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Playlist ({queue.length})</Text>
        {extracting && (
          <View style={styles.extractingBadge}>
            <ActivityIndicator size="small" color="#F8FAFC" />
            <Text style={styles.extractingText}>Extracting audio...</Text>
          </View>
        )}
      </View>

      {queue.length === 0 ? (
        <Text style={styles.emptyText}>Queue is empty. Search to add songs!</Text>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(item) => item.videoId}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: 'bold' },
  extractingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#475569', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 6 },
  extractingText: { color: '#94A3B8', fontSize: 12 },
  emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 20 },
  item: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#1E293B', padding: 8, borderRadius: 8 },
  itemPlaying: { backgroundColor: '#334155', borderColor: '#6366F1', borderWidth: 1 },
  itemPast: { opacity: 0.5 },
  thumbnail: { width: 60, height: 45, borderRadius: 4, backgroundColor: '#475569' },
  info: { flex: 1, marginLeft: 12 },
  title: { color: '#F8FAFC', fontSize: 14, fontWeight: '500' },
  titlePlaying: { color: '#6366F1', fontWeight: 'bold' },
  subtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  removeBtn: { padding: 8 },
});
