import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Hero } from '../types';
import { theme } from '../theme';

interface Props {
  hero: Hero;
  selected: boolean;
  disabled?: boolean;
  onToggle: (id: string) => void;
}

export const HeroSelectableRow = memo(function HeroSelectableRow({
  hero,
  selected,
  disabled,
  onToggle,
}: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => !disabled && onToggle(hero.id)}
      style={[styles.row, disabled ? styles.disabled : null]}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
    >
      <View style={[styles.checkbox, selected ? styles.checked : null]}>
        {selected ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{hero.name}</Text>
        <Text style={styles.stats}>ATK {Math.floor(hero.atk)} • HP {Math.floor(hero.hp)}</Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    marginBottom: 6,
  },
  disabled: {
    opacity: 0.6,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkMark: {
    color: '#fff',
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    color: theme.colors.textPrimary,
    fontWeight: theme.fontWeight.semibold,
  },
  stats: {
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontSize: 12,
  },
});

