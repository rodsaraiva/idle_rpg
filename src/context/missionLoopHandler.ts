import { GameState } from '../types';

/**
 * Marca um loop para parar ao fim do ciclo atual. Não interrompe nada em voo —
 * herói não volta no meio da missão.
 */
export function handleRecallMissionLoop(state: GameState, missionId: string): GameState {
  const missoes = state.activeMissions ?? [];
  const alvo = missoes.find((m) => m.id === missionId);
  if (!alvo?.loop || alvo.loopRecalled) return state;

  return {
    ...state,
    activeMissions: missoes.map((m) => (m.id === missionId ? { ...m, loopRecalled: true } : m)),
  };
}
