import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { socketService } from '../services/socketService';
import { EVENTS } from '../utils/constants';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface Reaction {
  id: string;
  emoji: string;
  startX: number;
}

export default function ReactionLayer() {
  const [reactions, setReactions] = useState<Reaction[]>([]);

  useEffect(() => {
    const socket = socketService.getSocket();
    
    const handleReaction = ({ emoji, id }: { emoji: string, id: string }) => {
      const startX = Math.random() * (SCREEN_WIDTH - 60) + 10;
      setReactions((prev) => [...prev, { id, emoji, startX }]);
    };

    socket.on(EVENTS.ROOM_REACTION_RECV, handleReaction);
    return () => {
      socket.off(EVENTS.ROOM_REACTION_RECV, handleReaction);
    };
  }, []);

  const removeReaction = (id: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <View style={styles.container} pointerEvents="none">
      {reactions.map((r) => (
        <FloatingEmoji key={r.id} reaction={r} onComplete={() => removeReaction(r.id)} />
      ))}
    </View>
  );
}

const FloatingEmoji = ({ reaction, onComplete }: { reaction: Reaction, onComplete: () => void }) => {
  const positionY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const positionX = useRef(new Animated.Value(reaction.startX)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(positionY, {
        toValue: SCREEN_HEIGHT * 0.2, // Float up to 20% from top
        duration: 2500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 2500,
        delay: 500, // Start fading after 500ms
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1.5,
        friction: 4,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(positionX, {
          toValue: reaction.startX - 30,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(positionX, {
          toValue: reaction.startX + 30,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onComplete();
    });
  }, []);

  return (
    <Animated.Text
      style={[
        styles.emoji,
        {
          transform: [
            { translateY: positionY },
            { translateX: positionX },
            { scale: scale },
          ],
          opacity,
        },
      ]}
    >
      {reaction.emoji}
    </Animated.Text>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9999, // Above everything
    elevation: 9999,
  },
  emoji: {
    position: 'absolute',
    fontSize: 40,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
