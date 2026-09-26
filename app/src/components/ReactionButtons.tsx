import React, { useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { socketService } from '../services/socketService';
import { EVENTS } from '../utils/constants';
import { useRoomStore } from '../stores/roomStore';

const EMOJIS = ['❤️', '🔥', '🎉', '😂'];

export default function ReactionButtons() {
  const roomId = useRoomStore((s) => s.roomId);

  const handlePress = (emoji: string) => {
    if (!roomId) return;
    socketService.getSocket().emit(EVENTS.ROOM_REACTION_SEND, { roomId, emoji });
  };

  return (
    <View style={styles.container}>
      {EMOJIS.map((emoji) => (
        <ReactionButton key={emoji} emoji={emoji} onPress={() => handlePress(emoji)} />
      ))}
    </View>
  );
}

const ReactionButton = ({ emoji, onPress }: { emoji: string, onPress: () => void }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.button, { transform: [{ scale }] }]}>
        <Text style={styles.emojiText}>{emoji}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  emojiText: {
    fontSize: 20,
  },
});
