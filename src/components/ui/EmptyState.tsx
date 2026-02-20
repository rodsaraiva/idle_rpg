import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';

interface Props {
  icon?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = '🏰', title, subtitle }: Props) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyIcon: { fontSize: 64, marginBottom: theme.spacing.md },
  emptyTitle: { fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, marginBottom: theme.spacing.sm },
  emptySubtitle: { fontSize: theme.fontSize.md, color: theme.colors.textSecondary, textAlign: 'center', paddingHorizontal: theme.spacing.xl },
});

