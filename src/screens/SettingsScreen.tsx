/**
 * SettingsScreen — Preferências de Notificação
 *
 * DÉBITO (device-bound, SPEC 9): agendamento real de push via expo-notifications,
 * quiet-hours no SO, cap de ≤2 notif/dia, cancelamento ao fechar app.
 * Esta tela só gerencia as prefs no estado local do jogo.
 * Nenhuma chamada a expo-notifications ocorre aqui.
 */
import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useGame } from '../hooks/useGame';
import { theme } from '../theme';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { Banner } from '../components/ui/Banner';
import { Card } from '../components/ui/Card';
import { NotificationPrefs } from '../types';

type CategoryKey = keyof NotificationPrefs['categories'];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  missionReady: 'Missão pronta para coletar',
  bossReady: 'Chefe semanal disponível',
  dailyReset: 'Reset diário (quests/streak)',
  idle: 'Herói ocioso por mais de 1h',
};

export function SettingsScreen() {
  const { state, dispatch } = useGame();

  const prefs: NotificationPrefs = state.notificationPrefs ?? {
    optedIn: false,
    categories: { missionReady: false, bossReady: false, dailyReset: false, idle: false },
    quietHours: { start: 22, end: 9 },
  };

  function setOptIn(value: boolean) {
    dispatch({ type: 'SET_NOTIFICATION_PREFS', prefs: { optedIn: value } });
  }

  function setCategory(key: CategoryKey, value: boolean) {
    dispatch({
      type: 'SET_NOTIFICATION_PREFS',
      prefs: { categories: { ...prefs.categories, [key]: value } },
    });
  }

  const masterEnabled = prefs.optedIn;

  return (
    <ScreenContainer
      banner={<Banner title="Configurações" subtitle="Preferências de Notificação" />}
    >
      <Card elevation="e1" padding="md">
        <View style={styles.row}>
          <View style={styles.labelBlock}>
            <Text style={styles.title}>Notificações</Text>
            <Text style={styles.subtitle}>
              Receba alertas quando houver algo aguardando.
            </Text>
          </View>
          <Switch
            value={masterEnabled}
            onValueChange={setOptIn}
            trackColor={{ false: theme.colors.border, true: theme.colors.gold }}
            thumbColor={masterEnabled ? theme.colors.goldBright : theme.colors.textMuted}
          />
        </View>
      </Card>

      {(Object.entries(CATEGORY_LABELS) as [CategoryKey, string][]).map(([key, label]) => (
        <Card key={key} elevation="e1" padding="md">
          <View style={styles.row}>
            <Text style={[styles.categoryLabel, !masterEnabled && styles.dimmed]}>{label}</Text>
            <Switch
              value={masterEnabled && prefs.categories[key]}
              onValueChange={(v) => setCategory(key, v)}
              disabled={!masterEnabled}
              trackColor={{ false: theme.colors.border, true: theme.colors.gold }}
              thumbColor={
                masterEnabled && prefs.categories[key]
                  ? theme.colors.goldBright
                  : theme.colors.textMuted
              }
            />
          </View>
        </Card>
      ))}

      <Text style={styles.disclaimer}>
        Horário silencioso: {prefs.quietHours.start}h – {prefs.quietHours.end}h
        {'\n'}O envio real de notificações push será implementado na SPEC 9 (device-bound).
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  labelBlock: { flex: 1 },
  title: { ...theme.type.body, color: theme.colors.textPrimary, fontWeight: 'bold' },
  subtitle: { ...theme.type.caption, color: theme.colors.textSecondary },
  categoryLabel: { ...theme.type.body, color: theme.colors.textPrimary, flex: 1 },
  dimmed: { color: theme.colors.textMuted },
  disclaimer: {
    ...theme.type.caption,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
    textAlign: 'center',
  },
});
