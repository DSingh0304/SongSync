// app/src/components/ParticipantList.tsx
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { socketService } from '../services/socketService';
import { EVENTS } from '../utils/constants';
import { Ionicons } from '@expo/vector-icons';
import { useRoomStore } from '../stores/roomStore';

export default function ParticipantList() {
  const participants = useRoomStore((s) => s.participants);
  const myUserId = useRoomStore((s) => s.userId);
  const isHost = useRoomStore((s) => s.isHost);
  const roomId = useRoomStore((s) => s.roomId);

  const handlePress = (targetUser: any) => {
    if (!isHost || targetUser.userId === myUserId) return;
    
    Alert.alert(
      'Make Room Leader',
      `Do you want to make ${targetUser.displayName} the new room leader?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Make Leader', 
          onPress: () => {
            socketService.getSocket().emit(EVENTS.ROOM_TRANSFER_HOST, { 
              roomId, 
              targetUserId: targetUser.userId 
            });
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="people" size={18} color="#aaa" />
        <Text style={styles.headerText}>{participants.length} / 8</Text>
      </View>
      
      <FlatList
        data={participants}
        keyExtractor={(item) => item.userId}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity 
            activeOpacity={isHost && item.userId !== myUserId ? 0.7 : 1}
            onPress={() => handlePress(item)}
            style={[styles.avatar, item.userId === myUserId && styles.myAvatar]}
          >
            {item.avatar ? (
              <Text style={styles.avatarEmoji}>{item.avatar}</Text>
            ) : (
              <Text style={styles.avatarInitial}>
                {item.displayName.charAt(0).toUpperCase()}
              </Text>
            )}
            {item.isHost && (
              <View style={styles.hostBadge}>
                <Ionicons name="star" size={8} color="#000" />
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#121212', borderBottomWidth: 1, borderBottomColor: '#222' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  headerText: { color: '#aaa', fontSize: 12, fontWeight: 'bold' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  myAvatar: { borderWidth: 2, borderColor: '#4caf50' },
  avatarInitial: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  avatarEmoji: { fontSize: 22 },
  hostBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#ffc107', width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
});
