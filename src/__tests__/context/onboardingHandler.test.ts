import { handleSetOnboarding } from '../../context/onboardingHandler';
import { GameState } from '../../types';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    gold: 0,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: 0,
    ...overrides,
  };
}

describe('handleSetOnboarding', () => {
  test('cria o bloco com defaults quando o estado não tem onboarding', () => {
    const state = makeState();
    const next = handleSetOnboarding(state, { step: 'recruit' });
    expect(next.onboarding).toBeDefined();
    expect(next.onboarding!.step).toBe('recruit');
    expect(next.onboarding!.version).toBe(1);
    expect(next.onboarding!.hintsSeen).toEqual({});
    expect(typeof next.onboarding!.startedAt).toBe('number');
  });

  test('patch parcial preserva campos não-tocados', () => {
    const state = makeState({
      onboarding: { version: 1, step: 'intro', startedAt: 123, hintsSeen: { forge: true } },
    });
    const next = handleSetOnboarding(state, { step: 'train' });
    expect(next.onboarding!.step).toBe('train');
    expect(next.onboarding!.startedAt).toBe(123);
    expect(next.onboarding!.hintsSeen).toEqual({ forge: true });
  });

  test('hintsSeen faz merge (não substitui)', () => {
    const state = makeState({
      onboarding: { version: 1, step: 'done', startedAt: 0, hintsSeen: { forge: true } },
    });
    const next = handleSetOnboarding(state, { hintsSeen: { fusion: true } });
    expect(next.onboarding!.hintsSeen).toEqual({ forge: true, fusion: true });
  });

  test('não muta o estado de entrada', () => {
    const state = makeState({
      onboarding: { version: 1, step: 'intro', startedAt: 0, hintsSeen: {} },
    });
    handleSetOnboarding(state, { step: 'recruit' });
    expect(state.onboarding!.step).toBe('intro');
  });
});
