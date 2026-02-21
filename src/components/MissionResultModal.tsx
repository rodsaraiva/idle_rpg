import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Button, ScrollView } from 'react-native';
import { useGame } from '../hooks/useGame';
import { theme } from '../theme';
import { BattleRunner } from '../services/battleRunner';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';
import { playSound } from '../services/sound';
import { lightTap, successNotification } from '../services/haptics';

export function MissionResultModal() {
  const { state, dispatch } = useGame();
  const results = state.recentMissionResults ?? [];

  // Hooks must be declared unconditionally and in the same order on every render.
  const [displayedLog, setDisplayedLog] = useState<string[]>([]);
  const runnerRef = useRef<BattleRunner | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // derive current result (may be null)
  const r = results[0] ?? null;

  useEffect(() => {
    if (!r) return;
    setDisplayedLog([]);
    if (r.actions && r.actions.length > 0) {
      // create runner with 1s delay between actions
      runnerRef.current = new BattleRunner(r.actions as any, 1000);

      const handleAction = (action: any) => {
        // append to displayed log
        setDisplayedLog((s) => [...s, action.text]);
        // feedback floats and highlight
        if (action.actionType === 'hit' && action.amount) {
          emit(FEEDBACK_EVENTS.FLOAT, { text: `-${action.amount}`, color: '#ff7a7a' });
          playSound('chest_reveal').catch(() => {});
          lightTap();
        } else if (action.actionType === 'miss') {
          emit(FEEDBACK_EVENTS.FLOAT, { text: 'Miss', color: '#cccccc' });
          playSound('chest_open').catch(() => {});
          lightTap();
        } else if (action.actionType === 'defeat') {
          successNotification();
        }
        // highlight target for UI components
        if (action.targetId) {
          emit('BATTLE_HIGHLIGHT', { id: action.targetId, duration: 800 });
        }
      };

      const handleComplete = () => {
        // on complete, ensure full log is visible
        setDisplayedLog((s) => {
          if (!r.log) return s;
          const remaining = r.log.slice(s.length);
          return [...s, ...remaining];
        });
      };

      // respect reduced motion preference: start immediately if set
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        (window as any).matchMedia &&
        (window as any).matchMedia('(prefers-reduced-motion: reduce)').matches;

      // start after 2s delay unless reduced motion preferred
      if (prefersReducedMotion) {
        runnerRef.current.start(handleAction, handleComplete);
      } else {
        // schedule start after 2 seconds
        startTimerRef.current = setTimeout(() => {
          startTimerRef.current = null;
          runnerRef.current?.start(handleAction, handleComplete);
        }, 2000);
      }
    } else {
      // no actions, show full log immediately
      setDisplayedLog(r.log ?? []);
    }
    return () => {
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
      runnerRef.current?.stop();
      runnerRef.current = null;
    };
  }, [r]);
  if (!r) return null;
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
            {displayedLog && displayedLog.length > 0 ? (
              displayedLog.map((line, i) => (
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
              title="Pular animação"
              onPress={() => {
                runnerRef.current?.skip((a) => {
                  setDisplayedLog((s) => [...s, a.text]);
                }, () => {
                  // complete
                });
              }}
            />
            <Button
              title="Fechar"
              onPress={() => {
                runnerRef.current?.stop();
                dispatch({ type: 'DISMISS_MISSION_RESULT', missionId: r.missionId });
              }}
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

