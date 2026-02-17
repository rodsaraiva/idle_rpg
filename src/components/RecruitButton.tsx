import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { formatNumber } from '../utils/math';

interface RecruitButtonProps {
  cost: number;
  canAfford: boolean;
  onPress: () => void;
}

export function RecruitButton({ cost, canAfford, onPress }: RecruitButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, !canAfford && styles.buttonDisabled]}
      onPress={onPress}
      disabled={!canAfford}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Text style={styles.label}>⚔️ Recrutar Herói</Text>
        <Text style={[styles.cost, !canAfford && styles.costDisabled]}>
          💰 {formatNumber(cost)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: theme.colors.surfaceLight,
    opacity: 0.6,
  },
  content: {
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
  },
  cost: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.gold,
  },
  costDisabled: {
    color: theme.colors.textMuted,
  },
});
