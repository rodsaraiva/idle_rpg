import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

interface ParchmentProps {
  children?: React.ReactNode;
  tone?: 'leather' | 'parchment';
  elevation?: keyof typeof theme.elevation;
  /** Permite uso como textura de fundo (ex.: StyleSheet.absoluteFill no ScreenContainer). */
  style?: StyleProp<ViewStyle>;
}

export function Parchment({ children, tone = 'leather', elevation = 'e1', style }: ParchmentProps) {
  const colors: readonly [string, string] =
    tone === 'leather'
      ? [theme.colors.surface, theme.colors.surfaceRaised]
      : [theme.colors.surfaceRaised, theme.colors.surface];

  return (
    <LinearGradient colors={colors} style={[styles.base, theme.elevation[elevation], style]}>
      {children != null ? <View>{children}</View> : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
