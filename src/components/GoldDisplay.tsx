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
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>💰</Text>
      </View>
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
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingRight: 12,
    paddingLeft: 4,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.goldDark,
    alignSelf: 'flex-end',
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  icon: {
    fontSize: 14,
  },
  value: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.gold,
    textAlign: 'right',
  },
});
