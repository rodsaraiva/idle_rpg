import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

interface Props {
  fraction: number; // 0..1
  color?: string;
  label?: string;
}

export function AttributeProgress({ fraction, color = theme.colors.primary, label }: Props) {
  const pct = Math.max(0, Math.min(1, fraction));
  return (
    <View style={styles.container} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <View style={[styles.track, { backgroundColor: theme.colors.surfaceLight }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
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
  label: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
  },
});

