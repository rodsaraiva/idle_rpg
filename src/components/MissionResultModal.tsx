import React from 'react';
import { View, Text, StyleSheet, Modal, Button, ScrollView } from 'react-native';
import { useGame } from '../hooks/useGame';
import { theme } from '../theme';

export function MissionResultModal() {
  const { state, dispatch } = useGame();
  const results = state.recentMissionResults ?? [];
  if (results.length === 0) return null;
  const r = results[0];

  return (
    <Modal visible={true} animationType="slide" transparent={true}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <Text style={styles.title}>{r.success ? 'Missão concluída' : 'Missão falhou'}</Text>
          <Text style={styles.subtitle}>
            {r.success ? 'Recompensa' : 'Penalidade'}: 💰 {Math.floor(r.reward)}
          </Text>
          <Text style={styles.small}>Rounds: {r.rounds} • Inimigos derrotados: {r.enemyCasualties}</Text>

          <ScrollView style={styles.log}>
            {r.log && r.log.length > 0 ? (
              r.log.map((line, i) => (
                <Text key={i} style={styles.logLine}>
                  {line}
                </Text>
              ))
            ) : (
              <Text style={styles.logLine}>Resumo indisponível</Text>
            )}
          </ScrollView>

          <View style={styles.casualties}>
            <Text style={styles.sectionTitle}>Heróis</Text>
            {r.casualties.map((c) => (
              <Text key={c.heroId} style={styles.logLine}>
                {c.heroId} — HP perdido: {c.hpLost} • HP final: {c.hpAfter}{' '}
                {c.incapacitatedUntilMs ? ' (Incapacitado)' : ''}
              </Text>
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              title="Fechar"
              onPress={() => dispatch({ type: 'DISMISS_MISSION_RESULT', missionId: r.missionId })}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  title: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary },
  subtitle: { color: theme.colors.textSecondary, marginTop: 6 },
  small: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 },
  log: { marginTop: 8, maxHeight: 160, borderTopWidth: 1, borderTopColor: theme.colors.surfaceLight, paddingTop: 8 },
  logLine: { color: theme.colors.textSecondary, fontSize: 12, marginBottom: 4 },
  casualties: { marginTop: 8 },
  sectionTitle: { fontWeight: theme.fontWeight.semibold, color: theme.colors.textPrimary, marginBottom: 6 },
  actions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' },
});

