// app/src/screens/HomeScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { socketService } from '../services/socketService';
import { EVENTS } from '../utils/constants';
import { useRoomStore } from '../stores/roomStore';
import { usePlayerStore } from '../stores/playerStore';
import { useQueueStore } from '../stores/queueStore';
import { useChatStore } from '../stores/chatStore';

type RootStackParamList = { Home: undefined; Room: undefined; };
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [displayName, setDisplayName] = useState('');
  const AVATARS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🦄'];
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = () => {
    if (!displayName.trim()) { setError('Please enter your name'); return; }
    setError(''); setIsLoading(true);

    const socket = socketService.getSocket();
    
    socket.once(EVENTS.ROOM_CREATED, (payload) => {
      try {
        const { roomId, userId, roomState } = payload;
        socketService.setSession(roomId, userId);
        useRoomStore.getState().setRoom(roomId, userId, roomState.participants[0].displayName, true, roomState.queueIndex);
        useRoomStore.getState().setParticipants(roomState.participants);
        usePlayerStore.getState().reset();
        useQueueStore.getState().reset();
        useChatStore.getState().reset();
        setIsLoading(false);
        navigation.replace('Room');
      } catch (err: any) {
        setError('Error creating room: ' + err.message);
        setIsLoading(false);
      }
    });

    socket.once(EVENTS.ROOM_ERROR, (payload) => {
      setIsLoading(false);
      setError(payload?.message || 'Unknown error');
    });

    socket.emit(EVENTS.ROOM_CREATE, { displayName: displayName.trim(), avatar });
  };

  const handleJoinRoom = () => {
    if (!displayName.trim()) { setError('Please enter your name'); return; }
    if (roomCode.trim().length !== 6) { setError('Room code must be 6 characters'); return; }
    setError(''); setIsLoading(true);

    const socket = socketService.getSocket();
    
    socket.once(EVENTS.ROOM_STATE, (payload) => {
      try {
        const { roomState } = payload;
        const me = roomState.participants.find((p: any) => p.displayName === displayName.trim());
        const currentUserId = me ? me.userId : roomState.participants[roomState.participants.length - 1].userId;

        socketService.setSession(roomState.roomId, currentUserId);
        useRoomStore.getState().setRoom(roomState.roomId, currentUserId, me?.displayName || displayName.trim(), me?.isHost || false, roomState.queueIndex);
        useRoomStore.getState().setParticipants(roomState.participants);
        usePlayerStore.getState().reset();
        useQueueStore.getState().reset();
        useChatStore.getState().reset();
        usePlayerStore.getState().setPlaybackState(roomState.playback);
        useQueueStore.getState().setQueue(roomState.queue);
        useChatStore.getState().setMessages(roomState.chat);

        setIsLoading(false);
        navigation.replace('Room');
      } catch (err: any) {
        setError('Error joining room: ' + err.message);
        setIsLoading(false);
      }
    });

    socket.once(EVENTS.ROOM_ERROR, (payload) => {
      setIsLoading(false);
      setError(payload?.message || 'Unknown error');
    });

    socket.emit(EVENTS.ROOM_JOIN, {
      roomId: roomCode.trim().toUpperCase(),
      displayName: displayName.trim(),
      avatar
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.card}>
          <Text style={styles.title}>SyncRoom</Text>
          <Text style={styles.subtitle}>Listen to YouTube together.</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Your Name</Text>
            <TextInput style={styles.input} value={displayName} onChangeText={(text) => { setDisplayName(text); setError(''); }} placeholder="e.g. Alex" placeholderTextColor="#94A3B8" maxLength={32} />
          </View>

          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Avatar</Text>
            <View style={styles.avatarRow}>
              {AVATARS.map(a => (
                <TouchableOpacity 
                  key={a} 
                  style={[styles.avatarBtn, avatar === a && styles.avatarBtnSelected]}
                  onPress={() => setAvatar(a)}
                >
                  <Text style={styles.avatarText}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={[styles.primaryBtn, isLoading && styles.disabledBtn]} onPress={handleCreateRoom} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.primaryBtnText}>Create New Room</Text>}
          </TouchableOpacity>

          <View style={styles.orRow}>
            <View style={styles.line} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.line} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Room Code</Text>
            <TextInput style={[styles.input, styles.codeInput]} value={roomCode} onChangeText={(text) => { setRoomCode(text.toUpperCase()); setError(''); }} placeholder="6-CHAR CODE" placeholderTextColor="#94A3B8" maxLength={6} autoCapitalize="characters" />
          </View>

          <TouchableOpacity style={[styles.secondaryBtn, isLoading && styles.disabledBtn]} onPress={handleJoinRoom} disabled={isLoading}>
            <Text style={styles.secondaryBtnText}>Join Room</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#1E293B', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#475569' },
  title: { color: '#F8FAFC', fontSize: 32, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: '#CBD5E1', fontSize: 16, textAlign: 'center', marginBottom: 32 },
  inputGroup: { marginBottom: 16 },
  label: { color: '#94A3B8', fontSize: 14, marginBottom: 8 },
  input: { backgroundColor: '#334155', color: '#F8FAFC', height: 48, borderRadius: 8, paddingHorizontal: 16, fontSize: 16 },
  codeInput: { letterSpacing: 2, textAlign: 'center' },
  primaryBtn: { backgroundColor: '#F8FAFC', height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#0F172A', fontSize: 16, fontWeight: 'bold' },
  secondaryBtn: { backgroundColor: '#475569', height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { color: '#F8FAFC', fontSize: 16, fontWeight: 'bold' },
  disabledBtn: { opacity: 0.5 },
  errorText: { color: '#EF4444', textAlign: 'center', marginBottom: 16 },
  divider: { height: 16 },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  line: { flex: 1, height: 1, backgroundColor: '#475569' },
  orText: { color: '#94A3B8', marginHorizontal: 16 },
  avatarRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  avatarBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  avatarBtnSelected: { borderWidth: 2, borderColor: '#10B981', backgroundColor: '#475569' },
  avatarText: { fontSize: 24 },
});
