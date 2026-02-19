import { MissionTemplate } from '../constants/missions';
import { Hero } from '../types';
import { calcMissionReward } from './missionMath';

export interface BattleOutcome {
  success: boolean;
  reward: number;
  casualties: { heroId: string; hpLost: number; hpAfter: number; incapacitatedUntilMs?: number }[];
  enemyCasualties: number;
  rounds: number;
  log?: string[];
}

interface BattleOpts {
  healerBuffMultiplier?: number;
  rogueRngBonus?: number;
  ref?: number;
  exponent?: number;
  synergyK?: number;
  scale?: number;
  rng?: () => number;
}

export function computeBattleOutcome(
  template: MissionTemplate,
  heroesIn: Hero[],
  opts: BattleOpts = {}
): BattleOutcome {
  const rng = opts.rng ?? Math.random;
  // clone heroes to working copies
  const heroes = heroesIn.map((h) => ({ ...h }));

  // create enemies from template.enemies if provided, otherwise fallback to simple orc count
  const enemies: { id: string; hp: number; atk: number; mp: number; alive?: boolean }[] = [];
  if (template.enemies && template.enemies.length > 0) {
    let idx = 0;
    template.enemies.forEach((edef, gi) => {
      const cnt = edef.count ?? 1;
      for (let i = 0; i < cnt; i++) {
        enemies.push({
          id: `enemy_${gi}_${i}`,
          hp: edef.hp,
          atk: edef.atk,
          mp: edef.mp,
          alive: true,
        });
        idx++;
      }
    });
  } else {
    const enemyCount = template.minHeroes;
    for (let i = 0; i < enemyCount; i++) {
      enemies.push({ id: `orc_${i}`, hp: 5, atk: 2, mp: 1, alive: true });
    }
  }

  const maxRounds = 12;
  const log: string[] = [];
  const critBase = 0.05;
  const critMult = 1.5;
  const baseHit = 0.75;
  const hitPerAtk = 0.02;

  // helper to check alive lists
  const aliveEnemies = () => enemies.filter((e) => e.hp > 0);
  const aliveHeroes = () => heroes.filter((h) => h.hp > 0);

  // count tanks for mitigation
  const tankCount = heroes.filter((h) => h.classId === 'TANK' && h.hp > 0).length;
  const tankMitigation = Math.min(0.5, 0.15 * tankCount); // % damage reduced to non-tanks

  let rounds = 0;
  while (rounds < maxRounds && aliveEnemies().length > 0 && aliveHeroes().length > 0) {
    rounds += 1;
    log.push(`-- Round ${rounds} start --`);

    // Heroes act first
    for (const hero of heroes) {
      if (hero.hp <= 0) continue;
      if (aliveEnemies().length === 0) break;

      // simple healing behavior for HEALER
      if (hero.classId === 'HEALER') {
        // heal ally if someone below 50% hp
        const ally = heroes
          .filter((a) => a.hp > 0)
          .sort((a, b) => a.hp - b.hp)[0];
        if (ally && ally.hp < Math.max(1, Math.floor(ally.hp + 0))) {
          // minimal heuristic: if any ally below current average, heal
        }
        // choose to heal only if someone below 50% of their starting hp estimate
        const targetToHeal = heroes.find((h) => h.hp > 0 && h.hp < 6); // heuristic
        if (targetToHeal) {
          const healAmount = Math.max(1, Math.floor(1 + hero.atk * 0.2));
          targetToHeal.hp += healAmount;
          log.push(`${hero.name} heals ${targetToHeal.name} for ${healAmount} HP`);
          continue;
        }
      }

      // otherwise attack: pick lowest HP enemy
      const target = aliveEnemies().sort((a, b) => a.hp - b.hp)[0];
      if (!target) continue;

      const hitChance = Math.min(0.98, baseHit + hero.atk * hitPerAtk);
      if (rng() <= hitChance) {
        const critChance = critBase + (hero.classId === 'ROGUE' ? 0.05 : 0);
        const isCrit = rng() < critChance;
        const dmg = Math.max(1, Math.floor(hero.atk * (isCrit ? critMult : 1)));
        target.hp -= dmg;
        log.push(`${hero.name} hits ${target.id} for ${dmg}${isCrit ? ' (crit)' : ''}`);
        if (target.hp <= 0) {
          target.hp = 0;
          log.push(`${target.id} is defeated`);
        }
      } else {
        log.push(`${hero.name} misses ${target.id}`);
      }
    }

    // Enemies act
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const alive = aliveHeroes();
      if (alive.length === 0) break;
      // choose target: lowest hp non-tank preferred
      let target = alive.filter((h) => h.classId !== 'TANK')[0] ?? alive[0];
      if (!target) target = alive[0];

      // enemy attack
      const hitChance = 0.8;
      if (rng() <= hitChance) {
        let dmg = Math.max(1, Math.floor(enemy.atk));
        if (target.classId !== 'TANK' && tankMitigation > 0) {
          dmg = Math.max(1, Math.floor(dmg * (1 - tankMitigation)));
        }
        target.hp -= dmg;
        log.push(`${enemy.id} hits ${target.name} for ${dmg}`);
        if (target.hp <= 0) {
          target.hp = 0;
          log.push(`${target.name} is incapacitated`);
        }
      } else {
        log.push(`${enemy.id} misses ${target.name}`);
      }
    }
  }

  const success = aliveEnemies().length === 0 && aliveHeroes().length > 0;

  // compute reward: if success use calcMissionReward, otherwise fallback small reward
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

  // prepare casualties
  const casualties = heroes.map((h) => {
    const original = heroesIn.find((oh) => oh.id === h.id);
    const hpBefore = original ? original.hp : h.hp;
    const hpLost = Math.max(0, (original ? original.hp : 0) - h.hp);
    const res: { heroId: string; hpLost: number; hpAfter: number; incapacitatedUntilMs?: number } = {
      heroId: h.id,
      hpLost,
      hpAfter: h.hp,
    };
    if (h.hp <= 0) {
      res.incapacitatedUntilMs = Date.now() + 30 * 60 * 1000; // 30 minutes
    }
    return res;
  });

  return {
    success,
    reward,
    casualties,
    enemyCasualties: enemies.filter((e) => e.hp <= 0).length,
    rounds,
    log,
  };
}

