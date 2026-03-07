import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { Hero } from '../types';

interface MissionHeroRowProps {
  hero: Hero;
  perHeroGold?: Record<string, number>;
}

export function MissionHeroRow({ hero, perHeroGold }: MissionHeroRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.mainInfo}>
        <Text style={styles.name}>{hero.name}</Text>
        <Text style={styles.stats}>
          HP {Math.floor(hero.hpCurrent)}/{Math.floor(hero.hpMax)} • ATK {Math.floor(hero.atk)}
        </Text>
      </View>
      <View style={styles.extraInfo}>
        <Text style={styles.gold}>
          💰 {Math.floor(perHeroGold?.[hero.id] ?? 0)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceLight,
  },
  mainInfo: {
    flex: 1,
  },
  name: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  stats: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  extraInfo: {
    alignItems: 'flex-end',
  },
  gold: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
});
