import { GameState, OnboardingState } from '../types';

const DEFAULT_ONBOARDING: OnboardingState = {
  version: 1,
  step: 'intro',
  startedAt: 0,
  hintsSeen: {},
};

/**
 * Aplica um patch parcial ao bloco onboarding, criando-o com defaults se ausente.
 * hintsSeen é mesclado (one-shot acumulativo), nunca substituído.
 */
export function handleSetOnboarding(state: GameState, patch: Partial<OnboardingState>): GameState {
  const base = state.onboarding ?? { ...DEFAULT_ONBOARDING, startedAt: Date.now() };
  return {
    ...state,
    onboarding: {
      ...base,
      ...patch,
      hintsSeen: { ...base.hintsSeen, ...(patch.hintsSeen ?? {}) },
    },
  };
}
