import { GameState } from '../types';
import { SEASONAL_EVENTS, getEventSeed, pickEvent } from '../constants/events';

/**
 * Atualiza o evento ativo com base na janela mensal (YYYYMM).
 * Idempotente: se o seed do evento ativo já corresponde à janela atual, retorna state sem modificação
 * (mesma referência de objeto — garantia de no-op para renderizações React).
 */
export function refreshActiveEvent(state: GameState, now: number = Date.now()): GameState {
  const currentSeed = getEventSeed(now);

  // No-op se já está na janela correta
  if (state.activeEvent?.seed === currentSeed) return state;

  const event = pickEvent(currentSeed);

  // fim do mês corrente (início do próximo mês − 1 ms)
  const d = new Date(now);
  const endsAt = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() - 1;

  return {
    ...state,
    activeEvent: {
      id: event.id,
      startedAt: now,
      endsAt,
      seed: currentSeed,
    },
  };
}

/**
 * Multiplicador de recompensa de missão do evento ativo.
 * Retorna 1.0 quando não há evento ou evento expirou.
 * Invariante: nunca credita gold diretamente — é aplicado sobre a recompensa de atividade.
 */
export function activeEventRewardMultiplier(state: GameState, now: number = Date.now()): number {
  if (!state.activeEvent) return 1;

  const currentSeed = getEventSeed(now);
  if (state.activeEvent.seed !== currentSeed) return 1;

  const event = SEASONAL_EVENTS.find(e => e.id === state.activeEvent!.id);
  if (!event) return 1;

  return 1 + (event.modifier.missionRewardPct ?? 0);
}
