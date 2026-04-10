import { MissionTemplate } from '../constants/missions';
import { Hero, MissionOutcome, MissionAction } from '../types';
import { calcMissionReward } from './missionMath';
import { BattleEngine, BattleEnemy, BattleState } from './battleEngine';
import { GameMath } from './gameMath';
import { getSynergyMultipliers } from '../constants/synergies';
import { ClassId } from '../types';

import { 
  MAX_BATTLE_ROUNDS, 
  ENEMY_HIT_CHANCE, 
  TANK_MITIGATION_PER_HERO, 
  TANK_MITIGATION_CAP, 
  INCAPACITATED_DURATION_MS,
  BASE_HIT_CHANCE,
  HIT_CHANCE_PER_ATK,
  GRID_COLUMNS,
  GRID_ROWS
} from '../constants/game';

interface BattleOpts {
  healerBuffMultiplier?: number;
  rogueRngBonus?: number;
  ref?: number;
  exponent?: number;
  synergyK?: number;
  scale?: number;
  rng?: () => number;
  heroPositions?: Record<string, number>;
}

export function computeBattleOutcome(
  template: MissionTemplate,
  heroesIn: Hero[],
  opts: BattleOpts = {}
): MissionOutcome {
  const rng = opts.rng ?? Math.random;
  const heroes = heroesIn.map((h) => ({ ...h }));

  // Apply class synergy bonuses
  const classIds = heroes.map(h => h.classId).filter(Boolean) as ClassId[];
  const synergy = getSynergyMultipliers(classIds);
  for (const hero of heroes) {
    hero.atk = Math.floor(hero.atk * synergy.atk);
    hero.defense = Math.floor((hero.defense ?? 5) * synergy.defense);
    if (hero.classId === 'HEALER') {
      hero.mp = Math.floor(hero.mp * synergy.heal);
    }
  }

  const enemies = BattleEngine.createEnemies(template);

  const heroPositions = { ...(opts.heroPositions || {}) };
  const enemyPositions: Record<string, number> = {};
  enemies.forEach(e => { if (e.position !== undefined) enemyPositions[e.id] = e.position; });

  const state: BattleState = {
    heroes,
    enemies,
    heroPositions,
    enemyPositions,
    lastAttacker: {},
    threats: {},
    log: [],
    actions: [],
    rounds: 0,
  };

  const aliveEnemies = () => state.enemies.filter((e) => e.hp > 0);
  const aliveHeroes = () => state.heroes.filter((h) => h.hpCurrent > 0);

  // Mitigation logic
  const tankCount = state.heroes.filter((h) => h.classId === 'TANK' && h.hpCurrent > 0).length;
  const tankMitigation = Math.min(TANK_MITIGATION_CAP, TANK_MITIGATION_PER_HERO * tankCount);

  while (state.rounds < MAX_BATTLE_ROUNDS && aliveEnemies().length > 0 && aliveHeroes().length > 0) {
    state.rounds += 1;
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

  const success = aliveEnemies().length === 0 && aliveHeroes().length > 0;
  
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
  };
}
