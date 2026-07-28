import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { useGame } from '../hooks/useGame';
import { theme } from '../theme';
import { MISSIONS } from '../constants/missions';
import { MissionResultModal } from './MissionResultModal';
import { LoopStopReason } from '../types';

const MOTIVO: Record<LoopStopReason, string> = {
  completed: 'loop concluído',
  recalled: 'heróis recolhidos',
  casualties: 'parou por baixas',
  failed: 'parou após derrota',
  error: 'parou por erro no cálculo do combate',
};

/** Montado na raiz: um loop pode terminar com o jogador em qualquer tela. */
export function LoopSummaryGate(): React.ReactElement | null {
  const { state, dispatch, offlineSummary } = useGame();
  const [vendoCombate, setVendoCombate] = useState(false);
  const resumo = state.completedLoops?.[0];

  // Reseta ao trocar de resumo: senão o combate do resumo anterior fica na tela
  // quando um segundo loop termina enquanto o jogador ainda olha o primeiro.
  useEffect(() => {
    setVendoCombate(false);
  }, [resumo?.missionId]);

  // Não empilha sobre o modal offline: quem fechou o app com o resumo pendente
  // vê o offline primeiro e o loop só depois de dispensá-lo.
  if (!resumo || offlineSummary != null) return null;

  const template = MISSIONS.find((m) => m.id === resumo.templateId);
  const { tally } = resumo;
  const materiais = Object.entries(tally.materials);
  const baixas = tally.casualties;

  if (vendoCombate && tally.lastResult) {
    return <MissionResultModal result={tally.lastResult} onDismiss={() => setVendoCombate(false)} />;
  }

  return (
    <Modal transparent visible animationType="fade">
      <View style={styles.scrim}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {template?.name ?? resumo.templateId} ×{tally.cycles}
          </Text>
          <Text style={styles.subtitle}>
            {resumo.plannedCycles
              ? `${tally.cycles} de ${resumo.plannedCycles} ciclos · ${MOTIVO[resumo.reason]}`
              : `${tally.cycles} ciclos · ${MOTIVO[resumo.reason]}`}
          </Text>

          <Text style={styles.linha}>Ouro ▸ {tally.gold}</Text>
          {materiais.length > 0 ? (
            <Text style={styles.linha}>
              Materiais ▸ {materiais.map(([m, q]) => `${m} ×${q}`).join(', ')}
            </Text>
          ) : null}
          {baixas.length > 0 ? (
            <Text style={styles.linha}>
              Baixas ▸{' '}
              {baixas
                .map((c) => {
                  const hero = state.heroes.find((h) => h.id === c.heroId);
                  const pct = hero?.hpMax ? Math.round((c.hpAfter / hero.hpMax) * 100) : 0;
                  return `${hero?.name ?? c.heroId} (${pct}% HP)`;
                })
                .join(', ')}
            </Text>
          ) : null}

          {tally.lastResult ? (
            <TouchableOpacity onPress={() => setVendoCombate(true)} accessibilityLabel="Ver último combate">
              <Text style={styles.acao}>Ver último combate</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => dispatch({ type: 'DISMISS_LOOP_SUMMARY', missionId: resumo.missionId })}
            accessibilityLabel="Fechar resumo do loop"
          >
            <Text style={styles.acao}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: theme.spacing.lg },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.elevation.e3,
  },
  title: { ...theme.type.h1, color: theme.colors.goldBright },
  subtitle: { ...theme.type.caption, color: theme.colors.textMuted },
  linha: { ...theme.type.body, color: theme.colors.textPrimary },
  acao: { ...theme.type.label, color: theme.colors.goldBright, marginTop: theme.spacing.sm },
});
