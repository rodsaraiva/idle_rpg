import { BattleEngine, BattleState } from '../../src/utils/battleEngine';
import { MISSIONS, MissionTemplate } from '../../src/constants/missions';
import { MAX_BATTLE_ROUNDS, HERO_ROWS, GRID_COLUMNS } from '../../src/constants/game';
import { Hero } from '../../src/types/index';
import { processDoTBuffs } from '../../src/utils/skillEffects';
import { processEnemyRegenBuffs } from '../../src/utils/enemySkillEffects';

export interface SimulationParams {
  heroes: Hero[];
  missionId: string;
  iterations: number;
}

export interface SimulationResult {
  winRate: string;
  lossRate: string;
  timeoutRate: string;
  avgRoundsWin: string;
  avgHpLostWin: string;
  incapacitatedRate: string;
}

/**
 * Roda N iterações de uma missão com um grupo específico de heróis.
 */
export function runMissionSimulation(params: SimulationParams): SimulationResult {
  const { heroes, missionId, iterations } = params;

  const mission = MISSIONS.find(m => m.id === missionId);
  if (!mission) throw new Error(`Missão ${missionId} não encontrada.`);

  let wins = 0;
  let losses = 0;
  let timeouts = 0;
  let totalRoundsWon = 0;
  let totalHpLostWon = 0;
  let incapacitatedCount = 0;

  // Calcula o HP total inicial do grupo para saber quanto perderam na vitória
  const groupInitialHp = heroes.reduce((sum, h) => sum + h.hpMax, 0);

  // Posicionamento base dos heróis (linha de baixo)
  const baseHeroPositions = HERO_ROWS.flatMap(r =>
    Array.from({ length: GRID_COLUMNS }, (_, c) => r * GRID_COLUMNS + c)
  );

  for (let i = 0; i < iterations; i++) {
    // 1. Clona os heróis para não sujar o estado entre iterações
    // e garante que comecem de vida cheia
    const activeHeroes = heroes.map(h => ({ ...h, hpCurrent: h.hpMax }));

    // 2. Inicializa estado via BattleEngine.initializeBattle
    const state = BattleEngine.initializeBattle(activeHeroes, mission as MissionTemplate);

    // Override hero positions to the simulator's preferred bottom-row layout
    activeHeroes.forEach((h, idx) => {
      state.heroPositions[h.id] = baseHeroPositions[baseHeroPositions.length - 1 - idx] ?? 45;
    });

    let battleOver = false;
    let groupWon = false;
    let isTimeout = false;

    // 3. Loop da Batalha
    while (!battleOver) {
      if (state.rounds > MAX_BATTLE_ROUNDS) {
        isTimeout = true;
        battleOver = true;
        break;
      }

      BattleEngine.cleanExpiredBuffs(state);
      processDoTBuffs(state);
      processEnemyRegenBuffs(state);

      // Cálculo de mitigação do Tanque para este turno
      const countTanks = activeHeroes.filter(h => h.classId === 'TANK' && h.hpCurrent > 0).length;
      const tankMitigation = Math.min(0.5, countTanks * 0.15); // Constantes do jogo

      // --- Initiative-based turn order ---
      const combatants: { type: 'hero' | 'enemy'; id: string; agility: number }[] = [];
      for (const h of activeHeroes) {
        if (h.hpCurrent > 0) combatants.push({ type: 'hero', id: h.id, agility: h.agility ?? 10 });
      }
      for (const e of state.enemies) {
        if (e.hp > 0) combatants.push({ type: 'enemy', id: e.id, agility: e.agility ?? 5 });
      }
      // Sort by agility descending with small random tiebreaker
      combatants.sort((a, b) => (b.agility + Math.random() * 2) - (a.agility + Math.random() * 2));

      for (const c of combatants) {
        if (battleOver) break;
        if (state.enemies.every(e => !e.alive || e.hp <= 0)) {
          groupWon = true;
          battleOver = true;
          break;
        }
        if (activeHeroes.every(h => h.hpCurrent <= 0)) {
          groupWon = false;
          battleOver = true;
          break;
        }
        if (c.type === 'hero') {
          const hero = activeHeroes.find(h => h.id === c.id);
          if (hero && hero.hpCurrent > 0) BattleEngine.processHeroTurn(hero, state, Math.random);
        } else {
          const enemy = state.enemies.find(e => e.id === c.id);
          if (enemy && enemy.alive && enemy.hp > 0) BattleEngine.processEnemyTurn(enemy, state, Math.random, tankMitigation);
        }
      }
      // Check end conditions after all turns
      if (state.enemies.every(e => !e.alive || e.hp <= 0)) {
        groupWon = true;
        battleOver = true;
      }
      if (activeHeroes.every(h => h.hpCurrent <= 0)) {
        groupWon = false;
        battleOver = true;
      }

      if (battleOver) break;

      state.rounds++;
    }

    // 4. Coleta de Métricas da Iteração
    if (groupWon) {
      wins++;
      totalRoundsWon += state.rounds;
      const groupEndHp = activeHeroes.reduce((sum, h) => sum + Math.max(0, h.hpCurrent), 0);
      totalHpLostWon += (groupInitialHp - groupEndHp);
    } else if (isTimeout) {
      timeouts++;
    } else {
      losses++;
    }

    // Conta quantos terminaram incapacitados (mesmo ganhando/empatando)
    const incapInThisBattle = activeHeroes.filter(h => h.hpCurrent < 3).length;
    incapacitatedCount += incapInThisBattle;
  }

  // 5. Formata e retorna os resultados
  const totalHeroesSimulated = iterations * heroes.length;

  return {
    winRate: ((wins / iterations) * 100).toFixed(1) + '%',
    lossRate: ((losses / iterations) * 100).toFixed(1) + '%',
    timeoutRate: ((timeouts / iterations) * 100).toFixed(1) + '%',
    avgRoundsWin: wins > 0 ? (totalRoundsWon / wins).toFixed(1) : '-',
    avgHpLostWin: wins > 0 ? (totalHpLostWon / wins).toFixed(1) : '-',
    incapacitatedRate: ((incapacitatedCount / totalHeroesSimulated) * 100).toFixed(1) + '%',
  };
}
