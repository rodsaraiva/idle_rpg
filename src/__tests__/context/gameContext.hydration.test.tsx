/**
 * Invariante de segurança: abrir o app NUNCA pode descartar o save.
 *
 * Regressão real (achada em validação no browser): com TICK_INTERVAL_MS = 500ms,
 * qualquer relançamento >0,5s após o último save faz calculateOfflineProgress
 * devolver um resumo. Nesse caminho o LOAD_STATE era adiado até o jogador dar
 * ciência do modal — que só é montado na GuildScreen. Como o app abre na Vila,
 * o ciente nunca acontecia e o autosave gravava o initialGameState por cima do
 * save real: herói semeado novo, onboarding do zero, consentimento LGPD perdido.
 */

import React from 'react';
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameProvider } from '../../context/GameContext';
import { StorageService } from '../../services/storage';
import { GameState, HeroTask, Hero } from '../../types';

const STORAGE_KEY = '@idle_rpg_game_state';

function makeSavedHero(): Hero {
  return {
    id: 'h-salvo', name: 'Herói Salvo', hpMax: 80, hpCurrent: 80, atk: 30, mp: 10,
    defense: 12, crit: 8, agility: 9, currentTask: HeroTask.IDLE,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  };
}

/** Persiste um save com progresso real e lastSavedAt no passado (gera resumo offline). */
async function persistirSaveComProgresso(elapsedMs: number): Promise<void> {
  const savedState: GameState = {
    gold: 4321,
    heroes: [makeSavedHero()],
    heroesRecruited: 7,
    lastSavedAt: Date.now() - elapsedMs,
    activeMissions: [],
    consent: { analytics: true, decided: true, decidedAt: 1 },
  } as GameState;

  await StorageService.save(savedState);
  // save() carimba lastSavedAt = agora; reescrevemos para o passado
  const raw = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!);
  raw.lastSavedAt = Date.now() - elapsedMs;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
}

async function montarProvider(): Promise<{ renderer: any; getState: () => any }> {
  let visto: any = null;
  function Consumer() {
    const { state, isLoaded } = require('../../hooks/useGame').useGame();
    if (isLoaded) visto = state;
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

  return { renderer, getState: () => visto };
}

describe('GameContext — hidratação no boot não pode perder o save', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('estado em memória reflete o save mesmo quando há resumo offline pendente', async () => {
    await persistirSaveComProgresso(1000 * 60 * 60 * 2);

    const { renderer, getState } = await montarProvider();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    const state = getState();
    await act(async () => renderer.unmount());

    expect(state.heroes[0].id).toBe('h-salvo');
    expect(state.gold).toBeGreaterThanOrEqual(4321);
    expect(state.consent?.decided).toBe(true);
  }, 15000);

  test('autosave não grava estado inicial por cima do save antes do ciente do resumo', async () => {
    await persistirSaveComProgresso(1000 * 60 * 60 * 2);

    const { renderer } = await montarProvider();
    // tempo suficiente para vários ticks de autosave (TICK_INTERVAL_MS = 500ms)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1600));
    });
    await act(async () => renderer.unmount());

    const persistido = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!);
    expect(persistido.heroes[0].id).toBe('h-salvo');
    expect(persistido.consent?.decided).toBe(true);
  }, 15000);
});
