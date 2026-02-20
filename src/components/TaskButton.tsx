import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface TaskButtonProps {
  label: string;
  onPress: () => void;
  isActive: boolean;
  color?: string;
  disabled?: boolean;
}

export function TaskButton({
  label,
  onPress,
  isActive,
  color = theme.colors.primary,
  disabled = false,
}: TaskButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        disabled
          ? { opacity: 0.5, backgroundColor: 'transparent', borderColor: theme.colors.border }
          : isActive
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: 'transparent', borderColor: theme.colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <Text
        style={[
          styles.label,
          { color: isActive ? theme.colors.textPrimary : theme.colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
