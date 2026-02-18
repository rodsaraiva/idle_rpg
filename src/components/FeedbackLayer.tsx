import React, { useEffect, useState } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { on, off, emit, FEEDBACK_EVENTS } from '../services/feedback';

interface FloatItem {
  id: string;
  text: string;
  color?: string;
}

interface ToastItem {
  id: string;
  text: string;
}

export function FeedbackLayer() {
  const [floats, setFloats] = useState<FloatItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubFloat = on(FEEDBACK_EVENTS.FLOAT, (payload) => {
      const id = `${Date.now()}-${Math.random()}`;
      setFloats((s) => [...s, { id, text: payload.text, color: payload.color }]);
      // remove after 900ms
      setTimeout(() => setFloats((s) => s.filter((f) => f.id !== id)), 900);
    });

    const unsubToast = on(FEEDBACK_EVENTS.TOAST, (payload) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((s) => [...s, { id, text: payload.text }]);
      setTimeout(() => setToasts((s) => s.filter((t) => t.id !== id)), 3000);
    });

    return () => {
      unsubFloat();
      unsubToast();
    };
  }, []);

  return (
    <View pointerEvents="none" style={styles.container}>
      {/* floating numbers stack */}
      <View style={styles.floats}>
        {floats.map((f, i) => (
          <FloatingNumber key={f.id} text={f.text} color={f.color} index={i} />
        ))}
      </View>

      {/* toasts */}
      <View style={styles.toasts}>
        {toasts.map((t) => (
          <View key={t.id} style={styles.toast}>
            <Text style={styles.toastText}>{t.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function FloatingNumber({ text, color, index }: { text: string; color?: string; index: number }) {
  const anim = new Animated.Value(0);
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -30 - index * 6],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0, 1, 0],
  });

  return (
    <Animated.View style={[styles.floatItem, { transform: [{ translateY }], opacity }]}>
      <Text style={[styles.floatText, color ? { color } : null]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  floats: {
    marginTop: 80,
    alignItems: 'center',
  },
  floatItem: {
    backgroundColor: 'transparent',
    paddingHorizontal: 6,
  },
  floatText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffd34d',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  toasts: {
    position: 'absolute',
    top: 30,
    width: '90%',
    alignItems: 'center',
  },
  toast: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  toastText: {
    color: '#fff',
    fontWeight: '600',
  },
});

