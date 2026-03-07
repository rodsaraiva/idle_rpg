import { MissionTemplate } from '../constants/missions';
import { Hero, MissionOutcome, MissionAction } from '../types';
import { calcMissionReward } from './missionMath';
import { BattleEngine, BattleEnemy } from './battleEngine';

import { 
  MAX_BATTLE_ROUNDS, 
  ENEMY_HIT_CHANCE, 
  TANK_MITIGATION_PER_HERO, 
  TANK_MITIGATION_CAP, 
  INCAPACITATED_DURATION_MS,
  BASE_HIT_CHANCE,
  HIT_CHANCE_PER_ATK
} from '../constants/game';

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
): MissionOutcome {
  const rng = opts.rng ?? Math.random;
  const heroes = heroesIn.map((h) => ({ ...h }));
  const enemies = BattleEngine.createEnemies(template);

  const log: string[] = [];
  const actions: MissionAction[] = [];

  const aliveEnemies = () => enemies.filter((e) => e.hp > 0);
  const aliveHeroes = () => heroes.filter((h) => h.hpCurrent > 0);

  // Mitigation logic
  const tankCount = heroes.filter((h) => h.classId === 'TANK' && h.hpCurrent > 0).length;
  const tankMitigation = Math.min(TANK_MITIGATION_CAP, TANK_MITIGATION_PER_HERO * tankCount);

  let rounds = 0;
  while (rounds < MAX_BATTLE_ROUNDS && aliveEnemies().length > 0 && aliveHeroes().length > 0) {
    rounds += 1;
    log.push(`-- Round ${rounds} --`);

    // --- Heroes Turn ---
    for (const hero of heroes) {
      if (hero.hpCurrent <= 0) continue;
      const currentEnemies = aliveEnemies();
      if (currentEnemies.length === 0) break;

      // Healer behavior
      if (hero.classId === 'HEALER') {
        const mostInjured = [...heroes]
          .filter(h => h.hpCurrent > 0 && h.hpCurrent < h.hpMax)
          .sort((a, b) => (a.hpCurrent / a.hpMax) - (b.hpCurrent / b.hpMax))[0];

        if (mostInjured && (mostInjured.hpCurrent / mostInjured.hpMax) < 0.7) {
          const healAmount = Math.max(1, Math.floor(hero.atk * 0.5));
          const prevHp = mostInjured.hpCurrent;
          mostInjured.hpCurrent = Math.min(mostInjured.hpMax, mostInjured.hpCurrent + healAmount);
          const actualHeal = mostInjured.hpCurrent - prevHp;
          
          const healTxt = `${hero.name} curou ${mostInjured.name} em ${actualHeal} HP`;
          log.push(healTxt);
          actions.push({
            round: rounds,
            actorType: 'hero',
            actorId: hero.id,
            actorName: hero.name,
            actionType: 'heal',
            targetId: mostInjured.id,
            amount: actualHeal,
            text: healTxt,
          });
          continue;
        }
      }

      // Attack
      const target = BattleEngine.selectTarget(hero.attackType ?? 'MELEE', currentEnemies, rng);
      if (!target) continue;

      const hitChance = Math.min(0.98, BASE_HIT_CHANCE + hero.atk * HIT_CHANCE_PER_ATK);
      const result = BattleEngine.calculateAttack(hero, target, hitChance, 'hero', rounds, rng);
      
      if (result) {
        actions.push(result.action);
        log.push(result.action.text);
        target.hp = Math.max(0, target.hp - result.dmg);
        
        if (target.hp <= 0) {
          target.alive = false;
          const defeatTxt = `${target.id} foi derrotado!`;
          log.push(defeatTxt);
          actions.push({
            round: rounds,
            actorType: 'hero',
            actorId: hero.id,
            actorName: hero.name,
            actionType: 'defeat',
            targetId: target.id,
            text: defeatTxt,
          });
        }
      }
    }

    // --- Enemies Turn ---
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const currentHeroes = aliveHeroes();
      if (currentHeroes.length === 0) break;

      const target = BattleEngine.selectTarget(enemy.attackType ?? 'MELEE', currentHeroes, rng);
      if (!target) continue;

      const result = BattleEngine.calculateAttack(enemy, target, ENEMY_HIT_CHANCE, 'enemy', rounds, rng);
      
      if (result) {
        let finalDmg = result.dmg;
        if (target.classId !== 'TANK' && tankMitigation > 0) {
          finalDmg = Math.max(1, Math.floor(finalDmg * (1 - tankMitigation)));
          result.action.amount = finalDmg;
          result.action.text = `${enemy.id} causou ${finalDmg} de dano em ${target.name} (Reduzido por Tank)`;
        }

        actions.push(result.action);
        log.push(result.action.text);
        target.hpCurrent = Math.max(0, target.hpCurrent - finalDmg);

        if (target.hpCurrent <= 0) {
          const incapTxt = `${target.name} está incapacitado!`;
          log.push(incapTxt);
          actions.push({
            round: rounds,
            actorType: 'enemy',
            actorId: enemy.id,
            actorName: enemy.id,
            actionType: 'defeat',
            targetId: target.id,
            text: incapTxt,
          });
        }
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

  const casualties = heroes.map((h) => {
    const original = heroesIn.find((oh) => oh.id === h.id);
    const hpLost = Math.max(0, (original?.hpCurrent ?? 0) - h.hpCurrent);
    return {
      heroId: h.id,
      hpLost,
      hpAfter: h.hpCurrent,
      incapacitatedUntilMs: h.hpCurrent <= 0 ? Date.now() + INCAPACITATED_DURATION_MS : undefined,
    };
  });

  return {
    success,
    reward,
    casualties,
    enemyCasualties: enemies.filter((e) => e.hp <= 0).length,
    rounds,
    log,
    actions,
  };
}
