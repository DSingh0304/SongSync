// app/src/screens/RoomScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';

import { useSocket, clockSyncRef } from '../hooks/useSocket';
import { useRoomStore } from '../stores/roomStore';
import { socketService } from '../services/socketService';
import { EVENTS } from '../utils/constants';
import { setupAudio, stopAudio } from '../services/trackPlayerService';
import { ClockSynchronizer } from '../services/clockSync';

import Player from '../components/Player';
import Queue from '../components/Queue';
import Chat from '../components/Chat';
import ParticipantList from '../components/ParticipantList';
import { useChatStore } from '../stores/chatStore';
import { usePlayerStore } from '../stores/playerStore';
import { useQueueStore } from '../stores/queueStore';
import ReactionLayer from '../components/ReactionLayer';
import ReactionButtons from '../components/ReactionButtons';

type RootStackParamList = { Home: undefined; Room: undefined; Search: undefined; };
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Room'>;

export default function RoomScreen() {
  const navigation = useNavigation<NavigationProp>();
  const roomId = useRoomStore((s) => s.roomId);
  const resetRoom = useRoomStore((s) => s.reset);
  const messages = useChatStore((s) => s.messages);
  const insets = useSafeAreaInsets();
  
  const [chatVisible, setChatVisible] = useState(false);

  useKeepAwake();
  useSocket();

  useEffect(() => {
    if (!roomId) {
      navigation.replace('Home');
      return;
    }
    setupAudio().catch((err) => console.error('[RoomScreen] setupAudio error:', err));
    
    if (!clockSyncRef.current) {
      clockSyncRef.current = new ClockSynchronizer(socketService.getSocket());
      clockSyncRef.current.initialSync();
    }

    return () => { stopAudio().catch((err) => console.error('[RoomScreen] stopAudio error:', err)); };
  }, [roomId, navigation]);

  const handleLeave = () => {
    Alert.alert('Leave Room', 'Are you sure you want to leave?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          const socket = socketService.getSocket();
          socket.emit(EVENTS.ROOM_LEAVE, { roomId });
          socketService.clearSession();
          resetRoom();
          usePlayerStore.getState().reset();
          useQueueStore.getState().reset();
          useChatStore.getState().reset();
          if (clockSyncRef.current) clockSyncRef.current = null;
          await stopAudio().catch(() => {});
          navigation.replace('Home');
        }
      }
    ]);
  };

  if (!roomId) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <ReactionLayer />
        <View style={styles.header}>
          <View>
            <Text style={styles.roomCodeLabel}>Room Code</Text>
            <Text style={styles.roomCode}>{roomId}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('Search')}>
              <Ionicons name="search" size={20} color="#000" />
              <Text style={styles.addBtnText}>Search Song</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
              <Ionicons name="exit-outline" size={24} color="#ff4444" />
            </TouchableOpacity>
          </View>
        </View>

        <ParticipantList />
        <Player />
        
        {/* The Queue gets all remaining space and is scrollable */}
        <View style={styles.queueContainer}>
          <Queue />
        </View>

        {/* Reaction Buttons */}
        <View style={[styles.reactionButtonsContainer, { bottom: 24 }]}>
          <ReactionButtons />
        </View>

        {/* Floating Chat Button */}
        <TouchableOpacity 
          style={[styles.floatingChatBtn, { bottom: 24 }]} 
          onPress={() => setChatVisible(true)}
        >
          <Ionicons name="chatbubbles" size={24} color="#fff" />
          <Text style={styles.chatBadgeText}>{messages.length}</Text>
        </TouchableOpacity>

        {/* Chat Modal */}
        <Modal visible={chatVisible} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={[styles.chatModalContent, { paddingBottom: insets.bottom || 24 }]}>
              <View style={styles.chatModalHeader}>
                <Text style={styles.chatModalTitle}>Live Chat</Text>
                <TouchableOpacity onPress={() => setChatVisible(false)}>
                  <Ionicons name="close-circle" size={28} color="#888" />
                </TouchableOpacity>
              </View>
              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                style={{ flex: 1 }}
              >
                <Chat />
              </KeyboardAvoidingView>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222', backgroundColor: '#111' },
  roomCodeLabel: { color: '#888', fontSize: 12 },
  roomCode: { color: '#fff', fontSize: 24, fontWeight: 'bold', letterSpacing: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 4 },
  addBtnText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  leaveBtn: { padding: 4 },
  queueContainer: { flex: 1 },
  reactionButtonsContainer: {
    position: 'absolute',
    left: 24,
    zIndex: 100,
  },
  floatingChatBtn: {
    position: 'absolute',
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  chatBadgeText: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ff4444',
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  chatModalContent: {
    height: '75%',
    backgroundColor: '#121212',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 0, // Chat component has its own padding
    paddingTop: 16,
  },
  chatModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  chatModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
