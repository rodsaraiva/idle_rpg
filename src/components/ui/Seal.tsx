import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ClassId } from '../../types';
import { theme } from '../../theme';
import { ClassSeal } from './icons/ClassSeals';
import { Icon } from './Icon';

interface SealProps {
  kind: ClassId | 'achievement';
  size?: number;
  locked?: boolean;
}

export function Seal({ kind, size = 48, locked = false }: SealProps) {
  const color = locked ? theme.colors.textMuted : theme.colors.gold;
  const inner =
    kind === 'achievement'
      ? <Icon name="trophy" size={size * 0.6} color={color} />
      : <ClassSeal classId={kind} size={size * 0.7} color={color} />;

  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, borderColor: color, opacity: locked ? 0.4 : 1 },
        locked ? undefined : theme.elevation.glowGold,
      ]}
    >
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: theme.colors.surface,
  },
});
