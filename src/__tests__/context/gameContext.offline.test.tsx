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

  // I1 (task 10) — o tick não pode rodar sobre o save cru enquanto o resumo offline está
  // pendente (senão o jogador vê ticks sobre o estado errado, e um autosave nessa janela
  // gravaria por cima dos ganhos offline que ainda não foram aplicados).
  test('I1: com resumo offline pendente, N ticks reais não alteram gold/activeMissions, e o autosave não perde os ganhos', async () => {
    const twoHoursMs = 1000 * 60 * 60 * 2;
    const now = Date.now();
    const savedState: GameState = {
      gold: 0,
      heroes: [makeHero()],
      heroesRecruited: 1,
      lastSavedAt: now - twoHoursMs,
      activeMissions: [makeMission(now - twoHoursMs)],
    };
    await StorageService.save(savedState);
    const raw = JSON.parse((await AsyncStorage.getItem('@idle_rpg_game_state'))!);
    raw.lastSavedAt = now - twoHoursMs;
    await AsyncStorage.setItem('@idle_rpg_game_state', JSON.stringify(raw));

    let latest: any = null;
    function Consumer() {
      latest = require('../../hooks/useGame').useGame();
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

    // Espera o resumo offline aparecer (modal bloqueante pendente)
    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (latest?.offlineSummary) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > 5000) {
          clearInterval(interval);
          reject(new Error('Timed out waiting for offlineSummary'));
        }
      }, 50);
    });

    expect(latest.state.gold).toBe(0); // hidratado com o save cru, ainda não tickado
    expect(latest.state.activeMissions?.length ?? 0).toBe(1);

    // Tempo real: várias janelas de TICK_INTERVAL_MS (500ms) + pelo menos 1 de
    // AUTO_SAVE_INTERVAL_MS (5000ms), pra provar que nem o tick nem o autosave mexem
    // no estado enquanto o resumo está pendente.
    await new Promise((r) => setTimeout(r, 5500));

    expect(latest.state.gold).toBe(0);
    expect(latest.state.activeMissions?.length ?? 0).toBe(1);
    expect(latest.offlineSummary).not.toBeNull();

    // O autosave rodou nessa janela (AUTO_SAVE_INTERVAL_MS=5000 < 5500 esperados) — mas como
    // o tick não avançou o estado, o que foi persistido continua sendo o save cru: os ganhos
    // offline não foram perdidos, só ainda não aplicados.
    const persistedEnquantoPendente = JSON.parse((await AsyncStorage.getItem('@idle_rpg_game_state'))!);
    expect(persistedEnquantoPendente.gold).toBe(0);
    expect(persistedEnquantoPendente.activeMissions?.length ?? 0).toBe(1);

    const goldEsperado = latest.offlineSummary.newState.gold;
    expect(goldEsperado).toBeGreaterThan(0);

    // Dar o ciente: aplica o resumo
    await act(async () => {
      await latest.applyOfflineSummary();
    });

    expect(latest.state.gold).toBe(goldEsperado);
    expect(latest.offlineSummary).toBeNull();

    const persistedDepoisDoCiente = JSON.parse((await AsyncStorage.getItem('@idle_rpg_game_state'))!);
    expect(persistedDepoisDoCiente.gold).toBe(goldEsperado);

    await act(async () => {
      renderer.unmount();
    });
  }, 15000);
});
