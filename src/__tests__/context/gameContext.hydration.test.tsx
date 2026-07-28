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
import { GameState, HeroTask, Hero, ActiveMission } from '../../types';

const STORAGE_KEY = '@idle_rpg_game_state';

function makeSavedHero(): Hero {
  return {
    id: 'h-salvo', name: 'Herói Salvo', hpMax: 80, hpCurrent: 80, atk: 30, mp: 10,
    defense: 12, crit: 8, agility: 9, currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  };
}

/** Missão em loop já em andamento há bastante tempo — garante goldGained > 0 no resumo
 * offline (heroesAffected sozinho, com hero IDLE, não bastava: caía no ramo silencioso
 * `else if (summary?.newState)`, que TAMBÉM hidrata — o teste passava sem exercitar o
 * caminho do modal pendente, que é exatamente o que ele promete cobrir). */
function makeSavedMission(startedAt: number): ActiveMission {
  return {
    id: 'm-salva', templateId: 'mission_1', heroIds: ['h-salvo'], startedAt,
    loop: { mode: 'endless' }, scheduledActions: [], enemiesState: [],
    precomputedOutcome: {
      reward: 100, rounds: 1, actions: [], log: [], success: true, casualties: [], enemyCasualties: 0,
    },
  };
}

/** Persiste um save com progresso real e lastSavedAt no passado (gera resumo offline
 * REPORTÁVEL — hasReportableGains precisa ser true, senão cai no ramo silencioso). */
async function persistirSaveComProgresso(elapsedMs: number): Promise<void> {
  const savedState: GameState = {
    gold: 4321,
    heroes: [makeSavedHero()],
    heroesRecruited: 7,
    lastSavedAt: Date.now() - elapsedMs,
    activeMissions: [makeSavedMission(Date.now() - elapsedMs)],
    consent: { analytics: true, decided: true, decidedAt: 1 },
  } as GameState;

  await StorageService.save(savedState);
  // save() carimba lastSavedAt = agora; reescrevemos para o passado
  const raw = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!);
  raw.lastSavedAt = Date.now() - elapsedMs;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
}

async function montarProvider(): Promise<{ renderer: any; getState: () => any; getOfflineSummary: () => any }> {
  let visto: any = null;
  let resumo: any = null;
  function Consumer() {
    const { state, isLoaded, offlineSummary } = require('../../hooks/useGame').useGame();
    if (isLoaded) visto = state;
    if (offlineSummary) resumo = offlineSummary;
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

  return { renderer, getState: () => visto, getOfflineSummary: () => resumo };
}

describe('GameContext — hidratação no boot não pode perder o save', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('estado em memória reflete o save mesmo quando há resumo offline pendente', async () => {
    await persistirSaveComProgresso(1000 * 60 * 60 * 2);

    const { renderer, getState, getOfflineSummary } = await montarProvider();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    const state = getState();
    const resumo = getOfflineSummary();
    await act(async () => renderer.unmount());

    // Prova que o cenário realmente passou pelo modal pendente (ramo reportável), não pelo
    // atalho silencioso — senão este teste não cobriria o que o nome promete.
    expect(resumo).not.toBeNull();
    expect(resumo.goldGained).toBeGreaterThan(0);

    expect(state.heroes[0].id).toBe('h-salvo');
    expect(state.gold).toBeGreaterThanOrEqual(4321);
    expect(state.consent?.decided).toBe(true);
  }, 15000);

  test('autosave não grava estado inicial por cima do save antes do ciente do resumo', async () => {
    await persistirSaveComProgresso(1000 * 60 * 60 * 2);

    const { renderer } = await montarProvider();
    // > AUTO_SAVE_INTERVAL_MS (5000ms): precisa passar de pelo menos 1 disparo real do
    // autosave, senão a asserção abaixo vale mesmo se o autosave gravasse besteira — ele
    // nunca teria rodado dentro da janela (achado ao verificar por mutação, task 10 Important 2).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5500));
    });
    await act(async () => renderer.unmount());

    const persistido = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!);
    expect(persistido.heroes[0].id).toBe('h-salvo');
    expect(persistido.consent?.decided).toBe(true);
  }, 15000);
});
