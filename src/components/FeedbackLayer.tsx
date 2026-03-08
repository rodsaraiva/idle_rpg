import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing, Platform, Dimensions } from 'react-native';
import { on, FEEDBACK_EVENTS } from '../services/feedback';
import { theme } from '../theme';

const { width } = Dimensions.get('window');

interface FloatItem {
  id: string;
  text: string;
  color?: string;
}

interface ToastItem {
  id: string;
  text: string;
  type?: 'success' | 'error' | 'info';
}

export function FeedbackLayer() {
  const [floats, setFloats] = useState<FloatItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubFloat = on(FEEDBACK_EVENTS.FLOAT, (payload) => {
      const id = `${Date.now()}-${Math.random()}`;
      setFloats((s) => [...s, { id, text: payload.text, color: payload.color as string }]);
      setTimeout(() => setFloats((s) => s.filter((f) => f.id !== id)), 1000);
    });

    const unsubToast = on(FEEDBACK_EVENTS.TOAST, (payload) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((s) => [...s, { id, text: payload.text, type: payload.type }]);
      setTimeout(() => setToasts((s) => s.filter((t) => t.id !== id)), 3500);
    });

    return () => {
      unsubFloat();
      unsubToast();
    };
  }, []);

  return (
    <View style={[styles.container, { pointerEvents: 'none' as any }]}>
      {/* floating numbers stack */}
      <View style={styles.floats}>
        {floats.map((f, i) => (
          <FloatingNumber key={f.id} text={f.text} color={f.color} index={i} />
        ))}
      </View>

      {/* toasts */}
      <View style={styles.toasts}>
        {toasts.map((t) => (
          <ToastNotification key={t.id} text={t.text} type={t.type} />
        ))}
      </View>
    </View>
  );
}

function FloatingNumber({ text, color, index }: { text: string; color?: string; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const isWeb = Platform.OS === 'web';
    Animated.timing(anim, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: !isWeb,
    }).start();
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, -50 - index * 8],
  });
  
  const scale = anim.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0.5, 1.2, 1],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.1, 0.7, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View style={[styles.floatItem, { transform: [{ translateY }, { scale }], opacity }]}>
      <Text style={[styles.floatText, color ? { color } : null]}>{text}</Text>
    </Animated.View>
  );
}

function ToastNotification({ text, type = 'info' }: { text: string; type?: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const isWeb = Platform.OS === 'web';
    Animated.sequence([
      Animated.spring(anim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: !isWeb,
      }),
      Animated.delay(2500),
      Animated.timing(anim, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.ease),
        useNativeDriver: !isWeb,
      }),
    ]).start();
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 0],
  });

  const getBackgroundColor = () => {
    switch (type) {
      case 'success': return '#2ECC71';
      case 'error': return '#E74C3C';
      default: return 'rgba(0,0,0,0.85)';
    }
  };

  return (
    <Animated.View style={[
      styles.toast, 
      { backgroundColor: getBackgroundColor(), transform: [{ translateY }], opacity: anim }
    ]}>
      <Text style={styles.toastText}>{text}</Text>
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
    zIndex: 9999,
  },
  floats: {
    marginTop: 120,
    alignItems: 'center',
  },
  floatItem: {
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
  },
  floatText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffd34d',
    ...Platform.select({
      web: {
        textShadow: '0px 2px 4px rgba(0,0,0,0.5)',
      },
      default: {
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
      },
    }),
  },
  toasts: {
    position: 'absolute',
    top: 50,
    width: width * 0.9,
    alignItems: 'center',
  },
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 10,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  toastText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
});
