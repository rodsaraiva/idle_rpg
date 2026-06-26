/**
 * PrivacyScreen — Política de Privacidade (placeholder pt-BR).
 * Visual manual-pending. Texto hospedado externamente = débito SPEC 9.
 */
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { Banner } from '../components/ui/Banner';
import { PRIVACY_TEXT } from '../constants/legalContent';
import { theme } from '../theme';

export function PrivacyScreen() {
  return (
    <ScreenContainer
      banner={<Banner title="Privacidade" subtitle="Política de Privacidade" />}
    >
      <Text style={styles.body}>{PRIVACY_TEXT}</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    ...theme.type.body,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginTop: theme.spacing.md,
  },
});
