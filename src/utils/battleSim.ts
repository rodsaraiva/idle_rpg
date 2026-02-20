import { MissionTemplate } from '../constants/missions';
import { Hero, /*AttackType*/ } from '../types';
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
  type Enemy = { id: string; hp: number; atk: number; mp: number; alive?: boolean; attackType?: 'MELEE' | 'RANGED' };
  const enemies: Enemy[] = [];
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
          attackType: Math.random() < 0.5 ? 'MELEE' : 'RANGED',
        });
        idx++;
      }
    });
  } else {
    const enemyCount = template.minHeroes;
    for (let i = 0; i < enemyCount; i++) {
      enemies.push({
        id: `orc_${i}`,
        hp: 5,
        atk: 2,
        mp: 1,
        alive: true,
        attackType: i % 2 === 0 ? 'MELEE' : 'RANGED',
      });
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
  const aliveHeroes = () => heroes.filter((h) => h.hpCurrent > 0);

  // choose target helper based on attacker attackType
  function chooseTarget<T extends Record<string, any>>(
    attackerType: 'MELEE' | 'RANGED',
    candidates: T[],
    rngLocal: () => number
  ): T | undefined {
    if (!candidates || candidates.length === 0) return undefined;
    // helper to read hp (supports enemy.hp or hero.hpCurrent)
    const hpOf = (c: T) => {
      const maybeHp = (c as any).hp;
      if (typeof maybeHp === 'number') return maybeHp;
      const maybeHpCur = (c as any).hpCurrent;
      if (typeof maybeHpCur === 'number') return maybeHpCur;
      return 0;
    };

    const sorted = [...candidates].sort((a, b) => hpOf(a) - hpOf(b));
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const roll = Math.floor(rngLocal() * 100); // 0..99

    const randomCandidate = () => candidates[Math.floor(rngLocal() * candidates.length)];

    const chooseAmongEquals = (value: number, list: T[]) => {
      const group = list.filter((x) => hpOf(x) === value);
      if (group.length <= 1) return group[0];
      return group[Math.floor(rngLocal() * group.length)];
    };

    if (attackerType === 'MELEE') {
      if (roll < 70) return chooseAmongEquals(hpOf(max), sorted);
      if (roll < 90) return chooseAmongEquals(hpOf(min), sorted);
      return randomCandidate();
    } else {
      // RANGED
      if (roll < 60) return chooseAmongEquals(hpOf(min), sorted);
      if (roll < 90) return chooseAmongEquals(hpOf(max), sorted);
      return randomCandidate();
    }
  }

  // count tanks for mitigation
  const tankCount = heroes.filter((h) => h.classId === 'TANK' && h.hpCurrent > 0).length;
  const tankMitigation = Math.min(0.5, 0.15 * tankCount); // % damage reduced to non-tanks

  let rounds = 0;
  while (rounds < maxRounds && aliveEnemies().length > 0 && aliveHeroes().length > 0) {
    rounds += 1;
    log.push(`-- Round ${rounds} start --`);

    // Heroes act first
    for (const hero of heroes) {
      if (hero.hpCurrent <= 0) continue;
      if (aliveEnemies().length === 0) break;

      // simple healing behavior for HEALER
      if (hero.classId === 'HEALER') {
        // heal ally if someone below 50% hp (use current HP)
        const ally = heroes
          .filter((a) => a.hpCurrent > 0)
          .sort((a, b) => a.hpCurrent - b.hpCurrent)[0];
        if (ally && ally.hpCurrent < Math.max(1, Math.floor(ally.hpCurrent + 0))) {
          // minimal heuristic: if any ally below current average, heal
        }
        // choose to heal only if someone below 50% of their starting hp estimate
        const targetToHeal = heroes.find((h) => h.hpCurrent > 0 && h.hpCurrent < 6); // heuristic
        if (targetToHeal) {
          const healAmount = Math.max(1, Math.floor(1 + hero.atk * 0.2));
          targetToHeal.hpCurrent += healAmount;
          log.push(`${hero.name} heals ${targetToHeal.name} for ${healAmount} HP`);
          continue;
        }
      }

      // choose target based on attackType
      const attackerType = (hero as any).attackType ?? 'MELEE';
      const target = chooseTarget(attackerType, aliveEnemies(), rng);
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
      // choose target based on enemy.attackType
      const enemyType = (enemy as any).attackType ?? 'MELEE';
      // pass hero objects directly; chooseTarget will read hpCurrent internally
      const heroTarget = chooseTarget(enemyType, alive, rng) as any;
      let target = heroTarget ?? alive[0];

      // enemy attack
      const hitChance = 0.8;
      if (rng() <= hitChance) {
        let dmg = Math.max(1, Math.floor(enemy.atk));
        if (target.classId !== 'TANK' && tankMitigation > 0) {
          dmg = Math.max(1, Math.floor(dmg * (1 - tankMitigation)));
        }
        target.hpCurrent -= dmg;
        log.push(`${enemy.id} hits ${target.name} for ${dmg}`);
        if (target.hpCurrent <= 0) {
          target.hpCurrent = 0;
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
    const hpBefore = original ? original.hpCurrent : h.hpCurrent;
    const hpLost = Math.max(0, (original ? original.hpCurrent : 0) - h.hpCurrent);
    const res: { heroId: string; hpLost: number; hpAfter: number; incapacitatedUntilMs?: number } = {
      heroId: h.id,
      hpLost,
      hpAfter: h.hpCurrent,
    };
    if (h.hpCurrent <= 0) {
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

