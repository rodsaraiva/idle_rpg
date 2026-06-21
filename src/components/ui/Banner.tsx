import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

interface BannerProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function Banner({ title, subtitle, right }: BannerProps) {
  return (
    <LinearGradient
      colors={[theme.colors.surface, theme.colors.surfaceRaised]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.container}
    >
      <View style={styles.titles}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View>{right}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGold,
  },
  titles: { flex: 1, marginRight: theme.spacing.md },
  title: { ...theme.type.h1, color: theme.colors.textPrimary },
  subtitle: { ...theme.type.caption, color: theme.colors.textSecondary, marginTop: 2 },
});
