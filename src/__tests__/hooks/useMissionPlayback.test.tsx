import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useMissionPlayback } from '../../hooks/useMissionPlayback';
import { GameContext } from '../../context/GameContext';
import { initialGameState } from '../../context/gameReducer';
import { ActiveMission, HeroTask } from '../../types';

const mockHero = {
  id: 'h1', name: 'Alice', hpMax: 100, hpCurrent: 100,
  atk: 10, mp: 5, defense: 5, crit: 5, agility: 5,
  currentTask: HeroTask.IDLE, classId: 'WARRIOR' as const,
};

function makeWrapper(heroes = [mockHero]) {
  const state = { ...initialGameState, heroes: heroes as any };
  return ({ children }: { children: React.ReactNode }) => (
    <GameContext.Provider value={{
      state: state as any,
      dispatch: jest.fn(),
      isLoaded: true,
      setHeroTask: jest.fn(),
      recruitHero: jest.fn(),
      offlineSummary: null,
      clearOfflineSummary: jest.fn(),
      applyOfflineSummary: jest.fn(),
    }}>
      {children}
    </GameContext.Provider>
  );
}

describe('useMissionPlayback', () => {
  test('retorna estado inicial vazio quando mission é null', () => {
    const { result } = renderHook(() => useMissionPlayback(null), { wrapper: makeWrapper() });
    expect(result.current.currentCombatants).toEqual([]);
    expect(result.current.playbackLog).toEqual([]);
    expect(result.current.isFinished).toBe(false);
  });

  test('inicializa combatentes a partir da missão (herói + inimigos)', () => {
    const mission: Partial<ActiveMission> = {
      id: 'test_m',
      heroIds: ['h1'],
      startedAt: Date.now() - 5000,
      scheduledActions: [],
      enemiesState: [{ id: 'e1', hp: 50, maxHp: 50, atk: 10, mp: 0 }],
    };

    const { result } = renderHook(
      () => useMissionPlayback(mission as ActiveMission),
      { wrapper: makeWrapper() }
    );

    expect(result.current.currentCombatants.length).toBe(2); // h1 + e1
    const hero = result.current.currentCombatants.find(c => c.id === 'h1');
    const enemy = result.current.currentCombatants.find(c => c.id === 'e1');
    expect(hero).toBeDefined();
    expect(hero?.maxHp).toBe(100);
    expect(enemy).toBeDefined();
    expect(enemy?.maxHp).toBe(50);
  });

  test('aplica ação "hit" reduzindo HP do alvo', async () => {
    const now = Date.now();
    const mission: Partial<ActiveMission> = {
      id: 'test_hit',
      heroIds: ['h1'],
      startedAt: now - 10000, // 10s atrás
      scheduledActions: [
        {
          atMsFromStart: 500, // já deveria ter acontecido
          action: {
            round: 1, actorType: 'hero', actorId: 'h1', actorName: 'Alice',
            actionType: 'hit', targetId: 'e1', amount: 15,
            text: 'Alice atacou e1 por 15',
          },
          applied: false,
        },
      ],
      enemiesState: [{ id: 'e1', hp: 50, maxHp: 50, atk: 10, mp: 0 }],
    };

    const { result } = renderHook(
      () => useMissionPlayback(mission as ActiveMission),
      { wrapper: makeWrapper() }
    );

    // Aguarda o setInterval (200ms) processar a ação
    await waitFor(() => {
      const enemy = result.current.currentCombatants.find(c => c.id === 'e1');
      expect(enemy?.hp).toBe(35); // 50 - 15
    }, { timeout: 1000 });
  });

  test('aplica ação "defeat" marcando combatente como morto', async () => {
    const now = Date.now();
    const mission: Partial<ActiveMission> = {
      id: 'test_defeat',
      heroIds: ['h1'],
      startedAt: now - 10000,
      scheduledActions: [
        {
          atMsFromStart: 100,
          action: {
            round: 1, actorType: 'hero', actorId: 'h1', actorName: 'Alice',
            actionType: 'defeat', targetId: 'e1',
            text: 'e1 foi derrotado',
          },
          applied: false,
        },
      ],
      enemiesState: [{ id: 'e1', hp: 50, maxHp: 50, atk: 10, mp: 0 }],
    };

    const { result } = renderHook(
      () => useMissionPlayback(mission as ActiveMission),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      const enemy = result.current.currentCombatants.find(c => c.id === 'e1');
      expect(enemy?.alive).toBe(false);
      expect(enemy?.hp).toBe(0);
    }, { timeout: 1000 });
  });
});
