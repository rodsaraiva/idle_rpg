import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../../theme';
import { Rarity } from '../../theme/tokens/rarity';

interface CardProps {
  children: React.ReactNode;
  rarity?: Rarity;
  elevation?: keyof typeof theme.elevation;
  onPress?: () => void;
  padding?: keyof typeof theme.spacing;
}

export function Card({ children, rarity, elevation = 'e1', onPress, padding = 'md' }: CardProps) {
  const rarityStyle: ViewStyle = rarity
    ? { borderColor: theme.rarity[rarity].color, borderWidth: 1, ...theme.elevation[theme.rarity[rarity].glow] }
    : theme.elevation[elevation];

  const style = [styles.base, { padding: theme.spacing[padding] }, rarityStyle];

  if (onPress) {
    return <Pressable style={style} onPress={onPress}>{children}</Pressable>;
  }
  return <View style={style}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
  },
});
