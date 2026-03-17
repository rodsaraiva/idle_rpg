import { MissionTemplate } from '../constants/missions';
import { Hero, MissionOutcome, MissionAction } from '../types';
import { calcMissionReward } from './missionMath';
import { BattleEngine, BattleEnemy } from './battleEngine';
import { GameMath } from './gameMath';

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
  const enemies = BattleEngine.createEnemies(template);

  const log: string[] = [];
  const actions: MissionAction[] = [];

  const aliveEnemies = () => enemies.filter((e) => e.hp > 0);
  const aliveHeroes = () => heroes.filter((h) => h.hpCurrent > 0);

  const heroPositions = { ...(opts.heroPositions || {}) };
  const enemyPositions: Record<string, number> = {};
  enemies.forEach(e => { if (e.position !== undefined) enemyPositions[e.id] = e.position; });

  const lastAttacker: Record<string, string> = {}; // actorId -> lastAttackerId
  const threats: Record<string, string> = {}; // enemyId -> targetAllyId

  const getOccupied = () => new Set([...Object.values(heroPositions), ...Object.values(enemyPositions)]);
  const getAlliesInDanger = (isHeroTurn: boolean) => {
    const list = isHeroTurn ? heroes : enemies;
    return list.filter(h => (h.hpCurrent || (h as any).hp) / (h.hpMax || (h as any).maxHp) < 0.3).map(h => h.id);
  };

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

      // 1. Move logic
      const currentPos = heroPositions[hero.id] ?? 45;
      const target = BattleEngine.selectTarget(hero, currentPos, currentEnemies, rng, {
        lastAttackerId: lastAttacker[hero.id],
        alliesInDanger: getAlliesInDanger(true),
        threats
      });
      
      if (target) {
        const targetPos = enemyPositions[target.id];
        const dist = GameMath.getHexDistance(currentPos, targetPos);
        const range = hero.range ?? 1;

        if (dist > range) {
          const move = hero.movement ?? 2;
          const nextPos = BattleEngine.findMovePath(currentPos, targetPos, move, getOccupied());
          
          if (nextPos !== currentPos) {
            const moveTxt = `${hero.name} moveu-se para a posição ${nextPos}`;
            log.push(moveTxt);
            actions.push({
              round: rounds,
              actorType: 'hero',
              actorId: hero.id,
              actorName: hero.name,
              actionType: 'move',
              text: moveTxt,
              fromPosition: currentPos,
              toPosition: nextPos,
            });
            heroPositions[hero.id] = nextPos;
          }
        }
      }

      // 2. Attack logic (re-check distance after move)
      const updatedPos = heroPositions[hero.id];
      const finalTarget = BattleEngine.selectTarget(hero, updatedPos, currentEnemies, rng, {
        lastAttackerId: lastAttacker[hero.id],
        alliesInDanger: getAlliesInDanger(true),
        threats
      });
      if (!finalTarget) continue;

      const finalDist = GameMath.getHexDistance(updatedPos, enemyPositions[finalTarget.id]);
      const finalRange = hero.range ?? 1;

      if (finalDist <= finalRange) {
        // Agora calcHitChance retorna apenas a base se não passarmos agility, 
        // mas o BattleEngine.calculateAttack já aplica a esquiva.
        // Para evitar duplicidade, passamos apenas o atk para calcular a base.
        const hitChance = GameMath.calcHitChance(hero.atk); 
        const result = BattleEngine.calculateAttack(hero, finalTarget, hitChance, 'hero', rounds, rng);
        
        if (result) {
          actions.push(result.action);
          log.push(result.action.text);
          finalTarget.hp = Math.max(0, finalTarget.hp - result.dmg);
          
          if (result.dmg > 0) {
            lastAttacker[finalTarget.id] = hero.id;
          }

          if (finalTarget.hp <= 0) {
            finalTarget.alive = false;
            delete enemyPositions[finalTarget.id]; // Remove from grid
            const defeatTxt = `${finalTarget.id} foi derrotado!`;
            log.push(defeatTxt);
            actions.push({
              round: rounds,
              actorType: 'hero',
              actorId: hero.id,
              actorName: hero.name,
              actionType: 'defeat',
              targetId: finalTarget.id,
              text: defeatTxt,
            });
          }
        }
      }
    }

    // --- Enemies Turn ---
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const currentHeroes = aliveHeroes();
      if (currentHeroes.length === 0) break;

      // 1. Enemy Move
      const currentPos = enemyPositions[enemy.id] ?? 0;
      const target = BattleEngine.selectTarget(enemy, currentPos, currentHeroes, rng, {
        lastAttackerId: lastAttacker[enemy.id],
        alliesInDanger: getAlliesInDanger(false)
      });
      
      if (target) {
        const targetPos = heroPositions[target.id] ?? 45;
        const dist = GameMath.getHexDistance(currentPos, targetPos);
        const range = enemy.range ?? 1;

        if (dist > range) {
          const move = enemy.movement ?? 2;
          const nextPos = BattleEngine.findMovePath(currentPos, targetPos, move, getOccupied());
          
          if (nextPos !== currentPos) {
            const moveTxt = `${enemy.id} moveu-se para a posição ${nextPos}`;
            log.push(moveTxt);
            actions.push({
              round: rounds,
              actorType: 'enemy',
              actorId: enemy.id,
              actorName: enemy.id,
              actionType: 'move',
              text: moveTxt,
              fromPosition: currentPos,
              toPosition: nextPos,
            });
            enemyPositions[enemy.id] = nextPos;
          }
        }
      }

      // 2. Enemy Attack
      const updatedPos = enemyPositions[enemy.id];
      const finalTarget = BattleEngine.selectTarget(enemy, updatedPos, currentHeroes, rng, {
        lastAttackerId: lastAttacker[enemy.id],
        alliesInDanger: getAlliesInDanger(false)
      });
      if (!finalTarget) continue;

      const finalDist = GameMath.getHexDistance(updatedPos, heroPositions[finalTarget.id]);
      const finalRange = enemy.range ?? 1;

      if (finalDist <= finalRange) {
        const result = BattleEngine.calculateAttack(enemy, finalTarget, ENEMY_HIT_CHANCE, 'enemy', rounds, rng);
        
        if (result) {
          let finalDmg = result.dmg;
          if (finalTarget.classId !== 'TANK' && tankMitigation > 0) {
            finalDmg = Math.max(1, Math.floor(finalDmg * (1 - tankMitigation)));
            result.action.amount = finalDmg;
            result.action.text = `${enemy.id} causou ${finalDmg} de dano em ${finalTarget.name} (Reduzido por Tank)`;
          }

          actions.push(result.action);
          log.push(result.action.text);
          finalTarget.hpCurrent = Math.max(0, finalTarget.hpCurrent - finalDmg);

          if (result.dmg > 0) {
            lastAttacker[finalTarget.id] = enemy.id;
            threats[enemy.id] = finalTarget.id;
          }

          if (finalTarget.hpCurrent <= 0) {
            delete heroPositions[finalTarget.id]; // Remove from grid
            const incapTxt = `${finalTarget.name} está incapacitado!`;
            log.push(incapTxt);
            actions.push({
              round: rounds,
              actorType: 'enemy',
              actorId: enemy.id,
              actorName: enemy.id,
              actionType: 'defeat',
              targetId: finalTarget.id,
              text: incapTxt,
            });
          }
        }
      }
    }
  }

  const success = aliveEnemies().length === 0 && aliveHeroes().length > 0;
  
  // No hexagonal grid, heróis em posições mais avançadas (linhas menores)
  // podem receber um pequeno bônus de "coragem" no reward, ou os da retaguarda bônus de MP.
  // Por enquanto, mantemos a lógica original mas garantimos que as posições sejam consideradas.
  
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
