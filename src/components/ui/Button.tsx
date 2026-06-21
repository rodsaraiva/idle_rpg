import React from 'react';
import { Pressable, Text, ActivityIndicator, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';
import { Icon, IconName } from './Icon';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'gold' | 'wood' | 'danger' | 'ghost';
  icon?: IconName;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
}

const GRADIENTS: Record<'gold' | 'wood' | 'danger', [string, string]> = {
  gold: [theme.colors.gold, theme.colors.goldDark],
  wood: [theme.colors.surfaceRaised, theme.colors.surface],
  danger: [theme.colors.ember, theme.colors.blood],
};

const PADDING: Record<NonNullable<ButtonProps['size']>, number> = {
  sm: theme.spacing.xs,
  md: theme.spacing.sm,
  lg: theme.spacing.md,
};

export function Button({ label, onPress, variant = 'gold', icon, size = 'md', disabled = false, loading = false }: ButtonProps) {
  const pad = PADDING[size];
  const content = (
    <View style={styles.row}>
      {loading ? <ActivityIndicator color={theme.colors.textPrimary} /> : null}
      {icon && !loading ? <Icon name={icon} size={16} color={theme.colors.textPrimary} /> : null}
      <Text style={styles.label}>{label}</Text>
    </View>
  );

  if (variant === 'ghost') {
    return (
      <Pressable onPress={onPress} disabled={disabled || loading} style={[styles.ghost, { padding: pad, opacity: disabled ? 0.5 : 1 }]}>
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={{ opacity: disabled ? 0.5 : 1 }}>
      <LinearGradient colors={GRADIENTS[variant]} style={[styles.gradient, { padding: pad }, theme.elevation.e1]}>
        {content}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs },
  gradient: { borderRadius: theme.borderRadius.md, alignItems: 'center' },
  ghost: { borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.borderGold, alignItems: 'center' },
  label: { ...theme.type.label, color: theme.colors.textPrimary },
});
