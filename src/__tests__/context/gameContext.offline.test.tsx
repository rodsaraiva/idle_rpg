import React from 'react';
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameProvider } from '../../context/GameContext';
import { StorageService } from '../../services/storage';
import { GameState, HeroTask, Hero, ActiveMission } from '../../types';
function makeHero(): Hero {
  return {
    id: 'h1', name: 'OfflineHero', hpMax: 50, hpCurrent: 50, atk: 10, mp: 5,
    defense: 5, crit: 10, agility: 5, currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  };
}

function makeMission(startedAt: number): ActiveMission {
  return {
    id: 'm1', templateId: 'mission_1', heroIds: ['h1'], startedAt, loop: { mode: 'endless' },
    scheduledActions: [], enemiesState: [],
    precomputedOutcome: {
      reward: 100, rounds: 1, actions: [], log: [], success: true, casualties: [], enemyCasualties: 0,
    },
  };
}

describe('GameContext — integração save → offline → reload', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('save do motor novo (sem remainingMs) credita gold de missão offline ao recarregar', async () => {
    const twoHoursMs = 1000 * 60 * 60 * 2;
    const now = Date.now();
    const savedState: GameState = {
      gold: 0,
      heroes: [makeHero()],
      heroesRecruited: 1,
      lastSavedAt: now - twoHoursMs,
      // missão iniciada 2h atrás, loop de 10s → muitos ciclos offline
      activeMissions: [makeMission(now - twoHoursMs)],
    };
    // persiste no AsyncStorage real (sem mock de retorno fixo)
    await StorageService.save(savedState);
    // StorageService.save sobrescreve lastSavedAt com Date.now(); reescrevemos para o passado:
    const raw = JSON.parse((await AsyncStorage.getItem('@idle_rpg_game_state'))!);
    raw.lastSavedAt = now - twoHoursMs;
    await AsyncStorage.setItem('@idle_rpg_game_state', JSON.stringify(raw));

    let captured: any = null;
    function Consumer() {
      const { offlineSummary: s, isLoaded } = require('../../hooks/useGame').useGame();
      if (isLoaded && s) captured = s;
      return null;
    }

    let renderer: any;
    await act(async () => {
      renderer = create(
        <GameProvider>
          <Consumer />
        </GameProvider>
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (captured) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > 5000) {
          clearInterval(interval);
          reject(new Error('Timed out waiting for offlineSummary'));
        }
      }, 50);
    });

    await act(async () => {
      renderer.unmount();
    });

    // 2h / 10s = 720 ciclos * 100 reward
    expect(captured.goldGained).toBeGreaterThan(0);
    expect(captured.newState.gold).toBeGreaterThan(0);
    expect(captured.newState.gold).toBe(captured.goldGained);
  }, 10000);
});
