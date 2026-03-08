import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { theme } from '../../theme';
import { GoldDisplay } from '../GoldDisplay';

interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  showGold?: boolean;
}

export function ScreenHeader({ title, subtitle, right, showGold = true }: Props) {
  return (
    <View style={styles.header}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View>{right}</View>
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
  titleContainer: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  title: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: { 
    fontSize: 12, 
    color: theme.colors.textSecondary, 
    marginTop: 2,
    fontWeight: '600',
  },
});

