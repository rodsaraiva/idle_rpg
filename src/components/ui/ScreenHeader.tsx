import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { theme } from '../../theme';
import { GoldDisplay } from '../GoldDisplay';

interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, right }: Props) {
  return (
    <View style={styles.header}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View>{right ?? <GoldDisplay gold={0} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  title: { fontSize: theme.fontSize.xxl, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary },
  subtitle: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 2 },
});

