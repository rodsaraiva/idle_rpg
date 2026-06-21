import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { theme } from '../../theme';
import { Icon, IconName } from './Icon';
import { LOTTIE_ASSETS } from '../../constants/assets';

interface Props {
  icon?: IconName;
  title: string;
  subtitle?: string;
  lottie?: keyof typeof LOTTIE_ASSETS;
}

export function EmptyState({ icon = 'castle', title, subtitle, lottie }: Props) {
  return (
    <View style={styles.emptyState}>
      {lottie ? (
        <LottieView source={LOTTIE_ASSETS[lottie]} autoPlay loop style={styles.lottie} />
      ) : (
        <Icon name={icon} size={64} color={theme.colors.textMuted} />
      )}
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  lottie: { width: 96, height: 96, marginBottom: theme.spacing.md },
  emptyTitle: { ...theme.type.h2, color: theme.colors.textPrimary, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
  emptySubtitle: { ...theme.type.body, color: theme.colors.textSecondary, textAlign: 'center', paddingHorizontal: theme.spacing.xl },
});
