import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GameState } from '../types';
import { SEASONAL_EVENTS, SeasonalEvent } from '../constants/events';
import { theme } from '../theme';

// ── Dados puros (testável sem React) ─────────────────────────────────────────

export interface EventBannerData {
  id: string;
  name: string;
  icon: string;
  missionRewardPct?: number;
  forgeHastePct?: number;
}

/**
 * Retorna os dados do evento ativo para exibição no banner,
 * ou null se não houver evento ou o id for desconhecido.
 * Função pura — sem efeitos colaterais.
 */
export function getEventBannerProps(state: GameState): EventBannerData | null {
  if (!state.activeEvent) return null;
  const event: SeasonalEvent | undefined = SEASONAL_EVENTS.find(
    e => e.id === state.activeEvent!.id,
  );
  if (!event) return null;
  return {
    id: event.id,
    name: event.name,
    icon: event.icon,
    missionRewardPct: event.modifier.missionRewardPct,
    forgeHastePct: event.modifier.forgeHastePct,
  };
}

// ── Componente React ──────────────────────────────────────────────────────────

interface EventBannerProps {
  state: GameState;
}

/**
 * Banner compacto do evento sazonal ativo.
 * Renderiza nada quando não há evento.
 */
export function EventBanner({ state }: EventBannerProps) {
  const data = getEventBannerProps(state);
  if (!data) return null;

  const bonusLines: string[] = [];
  if (data.missionRewardPct) {
    bonusLines.push(`+${Math.round(data.missionRewardPct * 100)}% Recompensa de Missão`);
  }
  if (data.forgeHastePct) {
    bonusLines.push(`+${Math.round(data.forgeHastePct * 100)}% Velocidade de Forja`);
  }

  return (
    <View style={styles.container} testID="event-banner">
      <Text style={styles.icon}>{data.icon}</Text>
      <View style={styles.textBlock}>
        <Text style={styles.name}>{data.name}</Text>
        {bonusLines.map(line => (
          <Text key={line} style={styles.bonus}>{line}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.goldDark,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  icon: {
    fontSize: 28,
  },
  textBlock: {
    flex: 1,
  },
  name: {
    ...theme.type.h2,
    color: theme.colors.goldBright,
  },
  bonus: {
    ...theme.type.caption,
    color: theme.colors.textSecondary,
  },
});
