import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Animated } from 'react-native';
import { theme } from '../theme';

interface Props {
  fraction: number; // 0..1
  color?: string;
  label?: string;
  timeRemainingMs?: number; // optional, show human readable
}

function formatMs(ms: number) {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

export function AttributeProgress({ fraction, color = theme.colors.primary, label, timeRemainingMs }: Props) {
  const pct = Math.max(0, Math.min(1, fraction));
  const anim = useRef(new Animated.Value(pct)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [pct, anim]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <View style={[styles.track, { backgroundColor: theme.colors.surfaceLight }]}>
        <Animated.View style={[styles.fill, { width, backgroundColor: color }]} />
      </View>
      <View style={styles.row}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        {typeof timeRemainingMs === 'number' ? <Text style={styles.time}>{formatMs(timeRemainingMs)}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: theme.spacing.xs,
  },
  track: {
    height: 8,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceLight,
  },
  fill: {
    height: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
  },
  time: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
  },
});

