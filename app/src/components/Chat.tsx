// app/src/components/Chat.tsx
import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '../stores/chatStore';
import { useRoomStore } from '../stores/roomStore';
import { socketService } from '../services/socketService';
import { EVENTS } from '../utils/constants';

export default function Chat() {
  const [text, setText] = useState('');
  const messages = useChatStore((s) => s.messages);
  const roomId = useRoomStore((s) => s.roomId);
  const myUserId = useRoomStore((s) => s.userId);
  const flatListRef = useRef<FlatList>(null);

  const handleSend = () => {
    if (!text.trim() || !roomId) return;
    
    socketService.getSocket().emit(EVENTS.CHAT_MESSAGE_SEND, {
      roomId,
      text: text.trim(),
    });
    
    setText('');
  };

  const renderItem = ({ item }: { item: any }) => {
    const isMe = item.userId === myUserId;
    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
        {!isMe && <Text style={styles.senderName}>{item.displayName}</Text>}
        <Text style={styles.messageText}>{item.text}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Live Chat</Text>
      
      <View style={styles.chatArea}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Say something..."
          placeholderTextColor="#888"
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={!text.trim()}>
          <Ionicons name="send" size={20} color={text.trim() ? '#fff' : '#555'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#121212' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  chatArea: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 8, marginBottom: 8 },
  listContent: { padding: 8 },
  messageBubble: { maxWidth: '80%', padding: 10, borderRadius: 12, marginBottom: 8 },
  myMessage: { alignSelf: 'flex-end', backgroundColor: '#2a5a2a', borderBottomRightRadius: 4 },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: '#333', borderBottomLeftRadius: 4 },
  senderName: { color: '#aaa', fontSize: 11, marginBottom: 4, fontWeight: 'bold' },
  messageText: { color: '#fff', fontSize: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, height: 44, backgroundColor: '#222', borderRadius: 22, paddingHorizontal: 16, color: '#fff' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
});
