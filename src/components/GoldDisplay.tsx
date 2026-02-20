import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { formatNumber } from '../utils/math';

interface GoldDisplayProps {
  gold: number;
}

export function GoldDisplay({ gold }: GoldDisplayProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>💰</Text>
      <Text
        style={styles.value}
        accessibilityLabel={`Ouro da guilda: ${formatNumber(gold)}`}
        accessible
      >
        {formatNumber(gold)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.goldDark,
    alignSelf: 'flex-end',
    maxWidth: 220,
    minWidth: 80,
  },
  icon: {
    fontSize: theme.fontSize.xl,
    marginRight: theme.spacing.sm,
  },
  value: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.gold,
    textAlign: 'right',
  },
});
