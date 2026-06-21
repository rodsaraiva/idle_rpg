import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';
import { Icon, IconName } from './Icon';

interface ComingSoonProps {
  title: string;
  icon: IconName;
  description: string;
}

export function ComingSoon({ title, icon, description }: ComingSoonProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name={icon} size={48} color={theme.colors.goldBright} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>EM DESENVOLVIMENTO</Text>
      </View>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: theme.colors.bgBase,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: theme.colors.borderGold,
  },
  title: { ...theme.type.h1, color: theme.colors.textPrimary, marginBottom: 12, textAlign: 'center' },
  badge: {
    backgroundColor: theme.colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    marginBottom: 16,
  },
  badgeText: { ...theme.type.label, color: theme.colors.bgDeep },
  description: { ...theme.type.body, color: theme.colors.textSecondary, textAlign: 'center' },
});
