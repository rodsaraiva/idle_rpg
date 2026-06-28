import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatNumber } from '../utils/math';

interface StatBarProps {
  label: string;
  value: number;
  color: string;
}

export function StatBar({ label, value, color }: StatBarProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color }]}>{label}</Text>
      <Text style={[styles.value, { color }]}>{formatNumber(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
  },
});
