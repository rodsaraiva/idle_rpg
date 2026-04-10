import { renderHook } from '@testing-library/react-native';
import { useGameFeedback } from '../../hooks/useGameFeedback';
import { initialGameState } from '../../context/gameReducer';
import { emit, FEEDBACK_EVENTS } from '../../services/feedback';

jest.mock('../../services/feedback', () => ({
  emit: jest.fn(),
  FEEDBACK_EVENTS: {
    FLOAT: 'FEEDBACK_FLOAT',
    TOAST: 'FEEDBACK_TOAST',
    BATTLE_HIGHLIGHT: 'BATTLE_HIGHLIGHT',
    BATTLE_HIT: 'BATTLE_HIT',
    BATTLE_TARGET: 'BATTLE_TARGET',
    BATTLE_DEATH: 'BATTLE_DEATH',
  },
}));

describe('useGameFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('emits FLOAT when gold increases', () => {
    const { rerender } = renderHook(({ state }) => useGameFeedback(state), {
      initialProps: { state: { ...initialGameState, gold: 10 } },
    });

    rerender({ state: { ...initialGameState, gold: 20 } });

    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.FLOAT, expect.objectContaining({
      text: '+10💰'
    }));
  });

  test('emits TOAST when hero is recruited', () => {
    const hero1 = { id: 'h1', hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, defense: 5, crit: 5, agility: 10 } as any;
    const hero2 = { id: 'h2', hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, defense: 5, crit: 5, agility: 10 } as any;

    const { rerender } = renderHook(({ state }) => useGameFeedback(state), {
      initialProps: { state: { ...initialGameState, heroes: [hero1] } },
    });

    rerender({ state: { ...initialGameState, heroes: [hero1, hero2] } });

    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.TOAST, expect.objectContaining({
      text: 'Recrutado +1 herói(s)'
    }));
  });

  test('emits feedback when hero stats increase or decrease', () => {
    const heroPrev = { id: 'h1', hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, defense: 5, crit: 5, agility: 10 } as any;
    const heroNext = { id: 'h1', hpMax: 12, hpCurrent: 8, atk: 6, mp: 1, defense: 5, crit: 5, agility: 10 } as any;

    const { rerender } = renderHook(({ state }) => useGameFeedback(state), {
      initialProps: { state: { ...initialGameState, heroes: [heroPrev] } },
    });

    rerender({ state: { ...initialGameState, heroes: [heroNext] } });

    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.FLOAT, expect.objectContaining({ text: '+2 HP Máx' }));
    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.FLOAT, expect.objectContaining({ text: '-2 HP' }));
    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.FLOAT, expect.objectContaining({ text: '+1 ATK' }));
    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.FLOAT, expect.objectContaining({ text: '+1 MP' }));
    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.BATTLE_HIT, expect.objectContaining({ id: 'h1', amount: 2 }));
  });

  test('emits DEATH feedback when hero dies', () => {
    const heroPrev = { id: 'h1', hpMax: 10, hpCurrent: 5, atk: 5, mp: 0, defense: 5, crit: 5, agility: 10 } as any;
    const heroNext = { id: 'h1', hpMax: 10, hpCurrent: 0, atk: 5, mp: 0, defense: 5, crit: 5, agility: 10 } as any;

    const { rerender } = renderHook(({ state }) => useGameFeedback(state), {
      initialProps: { state: { ...initialGameState, heroes: [heroPrev] } },
    });

    rerender({ state: { ...initialGameState, heroes: [heroNext] } });

    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.BATTLE_DEATH, { id: 'h1' });
  });
});
