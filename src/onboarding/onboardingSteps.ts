import { GameState, OnboardingStep } from '../types';

export type TargetId = 'recruit-button' | 'train-atk' | 'mission-1' | 'active-mission';

/** mission_1 está em andamento. Gatilho do passo `mission` e da métrica de 1ª missão. */
export function firstMissionStarted(state: GameState): boolean {
  return (state.activeMissions ?? []).some(m => m.templateId === 'mission_1');
}

function recruitDone(state: GameState): boolean {
  return state.heroes.length >= 2;
}

function trainDone(state: GameState): boolean {
  return state.heroes.some(h => (h.trainingCount?.atk ?? 0) >= 1);
}

function collectDone(state: GameState): boolean {
  return (state.completedMissionCount ?? 0) >= 1;
}

/**
 * Passo "alvo" derivado do GameState real. Nunca regride.
 * - 'done'/'skipped' são terminais e retornam inalterados.
 * - 'intro' só sai por ação manual; deriveStep não o ultrapassa enquanto o passo salvo for 'intro'.
 * - A partir de 'recruit', retorna o primeiro passo cujo gatilho ainda não foi cumprido (idempotência).
 */
export function deriveStep(state: GameState): OnboardingStep {
  const ob = state.onboarding;
  if (!ob) return 'done';
  if (ob.step === 'skipped' || ob.step === 'done' || ob.step === 'intro') return ob.step;

  if (!recruitDone(state)) return 'recruit';
  if (!trainDone(state)) return 'train';
  if (!firstMissionStarted(state) && !collectDone(state)) return 'mission';
  if (!collectDone(state)) return 'collect';
  return 'done';
}

/** Alvo de spotlight de cada passo guiado (null = sem recorte, modo ponteiro de navegação). */
export function targetForStep(step: OnboardingStep): TargetId | null {
  switch (step) {
    case 'recruit': return 'recruit-button';
    case 'train': return 'train-atk';
    case 'mission': return 'mission-1';
    case 'collect': return 'active-mission';
    default: return null;
  }
}
