import { renderHook } from '@testing-library/react-native';
import { useGameFeedback } from '../../hooks/useGameFeedback';
import { initialGameState } from '../../context/gameReducer';
import { emit, FEEDBACK_EVENTS } from '../../services/feedback';
import {
  FEEDBACK_DEF_GAIN_COLOR,
  FEEDBACK_CRIT_GAIN_COLOR,
  FEEDBACK_AGI_GAIN_COLOR,
} from '../../constants/game';
import { ACHIEVEMENTS } from '../../constants/achievements';

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

  test('emits FLOAT when defense increases with DEF color', () => {
    const heroPrev = { id: 'h1', hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, defense: 5, crit: 5, agility: 10 } as any;
    const heroNext = { id: 'h1', hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, defense: 8, crit: 5, agility: 10 } as any;

    const { rerender } = renderHook(({ state }) => useGameFeedback(state), {
      initialProps: { state: { ...initialGameState, heroes: [heroPrev] } },
    });

    rerender({ state: { ...initialGameState, heroes: [heroNext] } });

    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.FLOAT, {
      text: '+3 DEF',
      color: FEEDBACK_DEF_GAIN_COLOR,
    });
  });

  test('emits FLOAT when crit increases with CRIT color', () => {
    const heroPrev = { id: 'h1', hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, defense: 5, crit: 5, agility: 10 } as any;
    const heroNext = { id: 'h1', hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, defense: 5, crit: 9, agility: 10 } as any;

    const { rerender } = renderHook(({ state }) => useGameFeedback(state), {
      initialProps: { state: { ...initialGameState, heroes: [heroPrev] } },
    });

    rerender({ state: { ...initialGameState, heroes: [heroNext] } });

    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.FLOAT, {
      text: '+4 CRIT',
      color: FEEDBACK_CRIT_GAIN_COLOR,
    });
  });

  test('emits FLOAT when agility increases with AGI color', () => {
    const heroPrev = { id: 'h1', hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, defense: 5, crit: 5, agility: 10 } as any;
    const heroNext = { id: 'h1', hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, defense: 5, crit: 5, agility: 15 } as any;

    const { rerender } = renderHook(({ state }) => useGameFeedback(state), {
      initialProps: { state: { ...initialGameState, heroes: [heroPrev] } },
    });

    rerender({ state: { ...initialGameState, heroes: [heroNext] } });

    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.FLOAT, {
      text: '+5 AGI',
      color: FEEDBACK_AGI_GAIN_COLOR,
    });
  });

  test('emits TOAST when a new achievement is unlocked', () => {
    const achievement = ACHIEVEMENTS[0];
    const { rerender } = renderHook(({ state }) => useGameFeedback(state), {
      initialProps: { state: { ...initialGameState, unlockedAchievements: [] as string[] } },
    });

    rerender({ state: { ...initialGameState, unlockedAchievements: [achievement.id] as string[] } });

    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.TOAST, {
      text: `${achievement.icon} Conquista: ${achievement.name}!`,
      type: 'success',
    });
  });

  test('emits success TOAST when a mission completes successfully', () => {
    const activeMission = { id: 'm1', templateId: 't1', heroIds: [], startedAt: 0 } as any;
    const { rerender } = renderHook(({ state }) => useGameFeedback(state), {
      initialProps: {
        state: {
          ...initialGameState,
          activeMissions: [activeMission],
          recentMissionResults: [],
        } as any,
      },
    });

    rerender({
      state: {
        ...initialGameState,
        activeMissions: [],
        recentMissionResults: [
          { missionId: 'm1', templateId: 't1', success: true, reward: 42, rounds: 1, actions: [], log: [], casualties: [], enemyCasualties: 0 },
        ],
      } as any,
    });

    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.TOAST, {
      text: 'Missão concluída! +42 ouro',
      type: 'success',
    });
  });

  test('emits error TOAST when a mission fails', () => {
    const activeMission = { id: 'm1', templateId: 't1', heroIds: [], startedAt: 0 } as any;
    const { rerender } = renderHook(({ state }) => useGameFeedback(state), {
      initialProps: {
        state: {
          ...initialGameState,
          activeMissions: [activeMission],
          recentMissionResults: [],
        } as any,
      },
    });

    rerender({
      state: {
        ...initialGameState,
        activeMissions: [],
        recentMissionResults: [
          { missionId: 'm1', templateId: 't1', success: false, reward: 0, rounds: 1, actions: [], log: [], casualties: [], enemyCasualties: 0 },
        ],
      } as any,
    });

    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.TOAST, {
      text: 'Missão falhou...',
      type: 'error',
    });
  });

  test('emits BATTLE_HIT when enemy hp decreases in active mission', () => {
    const prevMission = {
      id: 'm1',
      templateId: 't1',
      heroIds: [],
      startedAt: 0,
      enemiesState: [{ id: 'e1', hp: 10, atk: 1, mp: 0, alive: true }],
    } as any;
    const nextMission = {
      id: 'm1',
      templateId: 't1',
      heroIds: [],
      startedAt: 0,
      enemiesState: [{ id: 'e1', hp: 6, atk: 1, mp: 0, alive: true }],
    } as any;

    const { rerender } = renderHook(({ state }) => useGameFeedback(state), {
      initialProps: { state: { ...initialGameState, activeMissions: [prevMission] } as any },
    });

    rerender({ state: { ...initialGameState, activeMissions: [nextMission] } as any });

    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.BATTLE_HIT, { id: 'e1', amount: 4 });
    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.BATTLE_TARGET, expect.objectContaining({ id: 'e1' }));
  });

  test('não dispara toast com resultado errado quando o ciclo final de um loop some de activeMissions sem entrada correspondente em recentMissionResults', () => {
    // Ciclo final de loop: sai de activeMissions, mas seu resultado foi filtrado
    // de recentMissionResults (fromLoop). O array não ganha entrada nova — só
    // sobra a entrada "stale" que já estava lá de um tick anterior, de outra missão.
    const activeLoopMission = {
      id: 'loop-m1', templateId: 't-loop', heroIds: [], startedAt: 0,
      loop: { mode: 'times', remaining: 1, total: 1 },
    } as any;
    const staleResult = {
      missionId: 'other-m', templateId: 't2', success: true, reward: 999,
      rounds: 1, actions: [], log: [], casualties: [], enemyCasualties: 0,
    };

    const { rerender } = renderHook(({ state }) => useGameFeedback(state), {
      initialProps: {
        state: {
          ...initialGameState,
          activeMissions: [activeLoopMission],
          recentMissionResults: [staleResult],
        } as any,
      },
    });

    rerender({
      state: {
        ...initialGameState,
        activeMissions: [],
        recentMissionResults: [staleResult],
      } as any,
    });

    expect(emit).not.toHaveBeenCalledWith(
      FEEDBACK_EVENTS.TOAST,
      expect.objectContaining({ text: expect.stringContaining('Missão') }),
    );
  });

  test('emits BATTLE_DEATH when enemy goes from alive to dead in active mission', () => {
    const prevMission = {
      id: 'm1',
      templateId: 't1',
      heroIds: [],
      startedAt: 0,
      enemiesState: [{ id: 'e1', hp: 5, atk: 1, mp: 0, alive: true }],
    } as any;
    const nextMission = {
      id: 'm1',
      templateId: 't1',
      heroIds: [],
      startedAt: 0,
      enemiesState: [{ id: 'e1', hp: 0, atk: 1, mp: 0, alive: false }],
    } as any;

    const { rerender } = renderHook(({ state }) => useGameFeedback(state), {
      initialProps: { state: { ...initialGameState, activeMissions: [prevMission] } as any },
    });

    rerender({ state: { ...initialGameState, activeMissions: [nextMission] } as any });

    expect(emit).toHaveBeenCalledWith(FEEDBACK_EVENTS.BATTLE_DEATH, { id: 'e1' });
  });
});
