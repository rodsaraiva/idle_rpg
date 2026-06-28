import { MissionTemplate } from '../constants/missions';
import { Hero, MissionOutcome } from '../types';
import { getDropsForEnemy } from '../constants/materials';
import { calcMissionReward } from './missionMath';
import { BattleEngine } from './battleEngine';
import { processDoTBuffs } from './skillEffects';
import { processEnemyRegenBuffs } from './enemySkillEffects';

import {
  MAX_BATTLE_ROUNDS,
  ENEMY_HIT_CHANCE,
  TANK_MITIGATION_PER_HERO,
  TANK_MITIGATION_CAP,
} from '../constants/game';
import { makeRng } from './math';

interface BattleOpts {
  healerBuffMultiplier?: number;
  rogueRngBonus?: number;
  ref?: number;
  exponent?: number;
  synergyK?: number;
  scale?: number;
  rng?: () => number;
  seed?: number;
  heroPositions?: Record<string, number>;
}

export function computeBattleOutcome(
  template: MissionTemplate,
  heroesIn: Hero[],
  opts: BattleOpts = {}
): MissionOutcome {
  // Precedência: rng explícito > seed > Math.random (produção inalterada)
  const rng = opts.rng ?? (opts.seed != null ? makeRng(opts.seed) : Math.random);
  const heroes = heroesIn.map((h) => ({ ...h }));

  const state = BattleEngine.initializeBattle(heroes, template, {
    heroPositions: opts.heroPositions,
    rng,
  });

  const aliveEnemies = () => state.enemies.filter((e) => e.hp > 0);
  const aliveHeroes = () => state.heroes.filter((h) => h.hpCurrent > 0);

  // Mitigation logic
  const tankCount = state.heroes.filter((h) => h.classId === 'TANK' && h.hpCurrent > 0).length;
  const tankMitigation = Math.min(TANK_MITIGATION_CAP, TANK_MITIGATION_PER_HERO * tankCount);

  while (state.rounds < MAX_BATTLE_ROUNDS && aliveEnemies().length > 0 && aliveHeroes().length > 0) {
    state.rounds += 1;
    BattleEngine.cleanExpiredBuffs(state);
    processDoTBuffs(state);
    processEnemyRegenBuffs(state);
    state.log.push(`-- Round ${state.rounds} --`);

    // --- Initiative-based turn order ---
    const combatants: { type: 'hero' | 'enemy'; id: string; agility: number }[] = [];
    for (const h of state.heroes) {
      if (h.hpCurrent > 0) combatants.push({ type: 'hero', id: h.id, agility: h.agility ?? 10 });
    }
    for (const e of state.enemies) {
      if (e.hp > 0) combatants.push({ type: 'enemy', id: e.id, agility: e.agility ?? 5 });
    }
    // Sort by agility descending with small random tiebreaker
    combatants.sort((a, b) => (b.agility + rng() * 2) - (a.agility + rng() * 2));

    for (const c of combatants) {
      if (aliveEnemies().length === 0 || aliveHeroes().length === 0) break;
      if (c.type === 'hero') {
        const hero = state.heroes.find(h => h.id === c.id);
        if (hero && hero.hpCurrent > 0) BattleEngine.processHeroTurn(hero, state, rng);
      } else {
        const enemy = state.enemies.find(e => e.id === c.id);
        if (enemy && enemy.hp > 0) BattleEngine.processEnemyTurn(enemy, state, rng, tankMitigation, ENEMY_HIT_CHANCE);
      }
    }
  }

  const materialDrops: Record<string, number> = {};
  const difficulty = template.difficulty ?? 1;
  for (const enemy of state.enemies.filter(e => e.hp <= 0)) {
    const drops = getDropsForEnemy(enemy, difficulty, rng);
    for (const drop of drops) {
      materialDrops[drop.materialId] = (materialDrops[drop.materialId] ?? 0) + drop.quantity;
    }
  }

  const success = aliveEnemies().length === 0 && aliveHeroes().length > 0;

  // On defeat, keep only 25%
  if (!success) {
    for (const key of Object.keys(materialDrops)) {
      materialDrops[key] = Math.floor(materialDrops[key] * 0.25);
      if (materialDrops[key] <= 0) delete materialDrops[key];
    }
  }

  const reward = success
    ? calcMissionReward(template, heroesIn, {
        healerBuffMultiplier: opts.healerBuffMultiplier,
        rogueRngBonus: opts.rogueRngBonus,
        ref: opts.ref,
        exponent: opts.exponent,
        synergyK: opts.synergyK,
        scale: opts.scale,
        rng,
      })
    : Math.max(template.rewardMin, Math.floor(template.rewardMin * 0.1));

  const casualties = state.heroes.map((h) => {
    const original = heroesIn.find((oh) => oh.id === h.id);
    const hpLost = Math.max(0, (original?.hpCurrent ?? 0) - h.hpCurrent);
    return {
      heroId: h.id,
      hpLost,
      hpAfter: h.hpCurrent,
    };
  });

  return {
    success,
    reward,
    casualties,
    enemyCasualties: state.enemies.filter((e) => e.hp <= 0).length,
    rounds: state.rounds,
    log: state.log,
    actions: state.actions,
    materialDrops,
  };
}
