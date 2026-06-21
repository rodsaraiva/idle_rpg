import { Hero } from '../types';
import { MissionTemplate } from '../constants/missions';
import { GameMath } from './gameMath';
import { getActiveSynergies } from '../constants/synergies';
import { createSynergyHandlers } from './synergyEffects';
import { ClassId } from '../types';
import { executePreAttackSkills, onHeroDamagedSkills, onHeroDeathSkills, onRogueHitSkills, processDoTBuffs, getShieldReduction } from './skillEffects';
import { applyPersonalityOnHit, applyProtectorShield } from './personalityEffects';
import { applyEnemyPassiveSkills, executeEnemyPreAttackSkills, onEnemyHitSkills, onEnemyDamagedSkills, processEnemyRegenBuffs } from './enemySkillEffects';

import { createEnemies, findMovePath } from './battle/grid';
import { calculateAttack, cleanExpiredBuffs } from './battle/resolution';
import { selectTarget } from './battle/targeting';

export type {
  SynergyId,
  BuffType,
  Buff,
  BattleEnemy,
  SynergyHandlers,
  BattleState,
} from './battle/types';
import type { BattleState, BattleEnemy } from './battle/types';

export const BattleEngine = {
  createEnemies,

  /**
   * Constructs a fresh BattleState with synergy handlers wired up and
   * positions initialized.
   * @param opts.rng PRNG a usar — default Math.random para retrocompatibilidade.
   */
  initializeBattle(
    heroes: Hero[],
    template: MissionTemplate,
    opts: { heroPositions?: Record<string, number>; rng?: () => number } = {}
  ): BattleState {
    const rng = opts.rng ?? Math.random;
    const enemies = createEnemies(template, rng);
    const enemyPositions: Record<string, number> = {};
    enemies.forEach(e => { if (e.position !== undefined) enemyPositions[e.id] = e.position; });

    const classIds = heroes.map(h => h.classId).filter(Boolean) as ClassId[];
    const activeSynergyDefs = getActiveSynergies(classIds);
    const activeSynergies = activeSynergyDefs.map(s => s.id);
    const handlers = createSynergyHandlers(activeSynergies);

    const state: BattleState = {
      heroes,
      enemies,
      heroPositions: { ...(opts.heroPositions || {}) },
      enemyPositions,
      lastAttacker: {},
      threats: {},
      log: [],
      actions: [],
      rounds: 0,
      activeSynergies,
      buffs: {},
      flags: {},
      handlers,
      skillCooldowns: {},
      skillOnceUsed: {},
      rng,
    };

    handlers.onBattleStart(state);
    return state;
  },

  cleanExpiredBuffs,

  findMovePath,

  selectTarget,

  calculateAttack,

  /**
   * Executa uma habilidade de classe específica antes do turno normal, se aplicável.
   * Retorna true se a habilidade consumiu o turno.
   */
  executeClassAbility(hero: Hero, state: BattleState): boolean {
    if (hero.classId === 'HEALER') {
      const mostInjured = [...state.heroes]
        .filter(h => h.id !== hero.id && h.hpCurrent > 0 && h.hpCurrent < h.hpMax)
        .sort((a, b) => (a.hpCurrent / a.hpMax) - (b.hpCurrent / b.hpMax))[0];

      if (mostInjured && (mostInjured.hpCurrent / mostInjured.hpMax) < 0.7) {
        const healAmount = Math.max(1, Math.floor(hero.mp * 0.8));
        const prevHp = mostInjured.hpCurrent;
        mostInjured.hpCurrent = Math.min(mostInjured.hpMax, mostInjured.hpCurrent + healAmount);
        const actualHeal = mostInjured.hpCurrent - prevHp;

        const healTxt = `${hero.name} curou ${mostInjured.name} em ${actualHeal} HP`;
        state.log.push(healTxt);
        state.actions.push({
          round: state.rounds,
          actorType: 'hero',
          actorId: hero.id,
          actorName: hero.name,
          actionType: 'heal',
          targetId: mostInjured.id,
          amount: actualHeal,
          text: healTxt,
        });

        // Bastião AoE: if armed, also heal allies within 2 hex of mostInjured
        if (state.flags['bastion_armed']) {
          const centerPos = state.heroPositions[mostInjured.id];
          if (centerPos !== undefined) {
            for (const ally of state.heroes) {
              if (ally.id === mostInjured.id || ally.hpCurrent <= 0) continue;
              const allyPos = state.heroPositions[ally.id];
              if (allyPos === undefined) continue;
              if (GameMath.getHexDistance(centerPos, allyPos) <= 2) {
                const prev = ally.hpCurrent;
                ally.hpCurrent = Math.min(ally.hpMax, ally.hpCurrent + healAmount);
                const heal = ally.hpCurrent - prev;
                if (heal > 0) {
                  const t = `${hero.name} curou ${ally.name} em ${heal} HP (Bastião)`;
                  state.log.push(t);
                  state.actions.push({
                    round: state.rounds,
                    actorType: 'hero',
                    actorId: hero.id,
                    actorName: hero.name,
                    actionType: 'heal',
                    targetId: ally.id,
                    amount: heal,
                    text: t,
                  });
                }
              }
            }
          }
          delete state.flags['bastion_armed'];
        }

        state.handlers.onHealApplied(state, hero, mostInjured, actualHeal);
        return true; // Consome o turno do Healer
      }
    }
    return false; // Não consumiu o turno
  },

  /**
   * Processa o turno completo de um herói.
   */
  processHeroTurn(hero: Hero, state: BattleState, rng: () => number) {
    if (hero.hpCurrent <= 0) return;

    applyProtectorShield(hero, state);

    const aliveEnemies = state.enemies.filter(e => e.hp > 0);
    if (aliveEnemies.length === 0) return;

    // 1. Verificar habilidades de classe (Healer)
    if (this.executeClassAbility(hero, state)) return;

    // 1b. Verificar skills desbloqueadas (pre-attack)
    const preTarget = aliveEnemies.length > 0
      ? selectTarget(hero, state.heroPositions[hero.id] ?? 45, aliveEnemies, rng, {
          lastAttackerId: state.lastAttacker[hero.id],
        })
      : undefined;
    if (executePreAttackSkills(hero, preTarget, state, rng)) return;

    // Utilitários locais
    const getOccupied = () => new Set([...Object.values(state.heroPositions), ...Object.values(state.enemyPositions)]);
    const getAlliesInDanger = () => state.heroes.filter(h => h.hpCurrent / h.hpMax < 0.3).map(h => h.id);

    // 2. Movimentação
    const currentPos = state.heroPositions[hero.id] ?? 45;
    const initialTarget = selectTarget(hero, currentPos, aliveEnemies, rng, {
      lastAttackerId: state.lastAttacker[hero.id],
      alliesInDanger: getAlliesInDanger(),
      threats: state.threats
    });
    
    if (initialTarget) {
      const targetPos = state.enemyPositions[initialTarget.id];
      const dist = GameMath.getHexDistance(currentPos, targetPos);
      const initialBuffs = state.buffs[hero.id] ?? [];
      let initialRangeBonus = 0;
      for (const b of initialBuffs) {
        if (b.type === 'rangeFlat') initialRangeBonus += b.value;
      }
      const range = (hero.range ?? 1) + initialRangeBonus;

      if (dist > range) {
        const move = hero.movement ?? 2;
        const nextPos = findMovePath(currentPos, targetPos, move, getOccupied());
        
        if (nextPos !== currentPos) {
          const moveTxt = `${hero.name} moveu-se para a posição ${nextPos}`;
          state.log.push(moveTxt);
          state.actions.push({
            round: state.rounds,
            actorType: 'hero',
            actorId: hero.id,
            actorName: hero.name,
            actionType: 'move',
            text: moveTxt,
            fromPosition: currentPos,
            toPosition: nextPos,
          });
          state.heroPositions[hero.id] = nextPos;
        }
      }
    }

    // 3. Ataque (reavaliar alvo após possível movimento)
    const updatedPos = state.heroPositions[hero.id] ?? currentPos;
    const finalTarget = selectTarget(hero, updatedPos, aliveEnemies, rng, {
      lastAttackerId: state.lastAttacker[hero.id],
      alliesInDanger: getAlliesInDanger(),
      threats: state.threats
    });
    
    if (!finalTarget) return;

    const finalDist = GameMath.getHexDistance(updatedPos, state.enemyPositions[finalTarget.id]);
    // Apply rangeFlat buffs to hero range
    const buffs = state.buffs[hero.id] ?? [];
    let rangeBonus = 0;
    for (const b of buffs) {
      if (b.type === 'rangeFlat') rangeBonus += b.value;
    }
    const effectiveRange = (hero.range ?? 1) + rangeBonus;

    if (finalDist <= effectiveRange) {
      const hitChance = GameMath.calcHitChance(hero.atk, 0, 1);
      const result = calculateAttack(hero, finalTarget, hitChance, 'hero', state.rounds, rng, finalDist, state);

      if (result) {
        state.actions.push(result.action);
        state.log.push(result.action.text);
        let actualHeroDmg = result.dmg;
        const enemyShield = getShieldReduction(state, finalTarget.id);
        if (enemyShield > 0) {
          actualHeroDmg = Math.max(1, Math.floor(actualHeroDmg * (1 - enemyShield)));
        }
        finalTarget.hp = Math.max(0, finalTarget.hp - actualHeroDmg);
        onEnemyDamagedSkills(finalTarget, state);

        if (actualHeroDmg > 0) {
          const didMove = updatedPos !== currentPos;
          state.lastAttacker[finalTarget.id] = hero.id;
          state.handlers.onAttackResolved(state, hero as any, finalTarget as any, actualHeroDmg, finalDist);
          if (hero.classId === 'ROGUE') {
            onRogueHitSkills(hero, finalTarget, state, rng);
          }
          const extraAttack = applyPersonalityOnHit(hero, finalTarget, state, actualHeroDmg, rng, didMove);
          // Opportunist extra attack on kill — espelha o caminho normal de ataque
          if (extraAttack && finalTarget.hp <= 0) {
            const nextAlive = state.enemies.find(e => e.alive && e.id !== finalTarget.id);
            if (nextAlive) {
              const nextDist = GameMath.getHexDistance(updatedPos, state.enemyPositions[nextAlive.id]);
              if (nextDist <= effectiveRange) {
                const extraResult = calculateAttack(hero, nextAlive, 0.8, 'hero', state.rounds, rng, nextDist, state);
                if (extraResult) {
                  state.actions.push(extraResult.action);
                  state.log.push(extraResult.action.text);
                  let extraDmg = extraResult.dmg;
                  const extraShield = getShieldReduction(state, nextAlive.id);
                  if (extraShield > 0) {
                    extraDmg = Math.max(1, Math.floor(extraDmg * (1 - extraShield)));
                  }
                  nextAlive.hp = Math.max(0, nextAlive.hp - extraDmg);
                  onEnemyDamagedSkills(nextAlive, state);
                  if (extraDmg > 0) {
                    state.lastAttacker[nextAlive.id] = hero.id;
                    state.handlers.onAttackResolved(state, hero as any, nextAlive as any, extraDmg, nextDist);
                    if (hero.classId === 'ROGUE') {
                      onRogueHitSkills(hero, nextAlive, state, rng);
                    }
                  }
                  if (nextAlive.hp <= 0) {
                    nextAlive.alive = false;
                    delete state.enemyPositions[nextAlive.id];
                  }
                }
              }
            }
          }
        }

        if (finalTarget.hp <= 0) {
          finalTarget.alive = false;
          delete state.enemyPositions[finalTarget.id];
          const defeatTxt = `${finalTarget.id} foi derrotado!`;
          state.log.push(defeatTxt);
          state.actions.push({
            round: state.rounds,
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
  },

  /**
   * Processa o turno completo de um inimigo.
   */
  processEnemyTurn(enemy: BattleEnemy, state: BattleState, rng: () => number, tankMitigation: number = 0, enemyHitChance: number = 0.8) {
    if (enemy.hp <= 0) return;
    applyEnemyPassiveSkills(enemy, state);

    const aliveHeroes = state.heroes.filter(h => h.hpCurrent > 0);
    if (aliveHeroes.length === 0) return;

    // Utilitários locais
    const getOccupied = () => new Set([...Object.values(state.heroPositions), ...Object.values(state.enemyPositions)]);
    const getEnemiesInDanger = () => state.enemies.filter(e => e.hp / e.maxHp < 0.3).map(e => e.id);

    const modifyScore = (candidate: Hero, baseScore: number) =>
      state.handlers.modifyTargetScore(state, enemy, candidate, baseScore);

    // 1. Movimentação
    const currentPos = state.enemyPositions[enemy.id] ?? 0;
    const initialTarget = selectTarget(enemy, currentPos, aliveHeroes, rng, {
      lastAttackerId: state.lastAttacker[enemy.id],
      alliesInDanger: getEnemiesInDanger(),
      modifyScore,
    });

    if (initialTarget) {
      const targetPos = state.heroPositions[initialTarget.id] ?? 45;
      const dist = GameMath.getHexDistance(currentPos, targetPos);
      const range = enemy.range ?? 1;

      if (dist > range) {
        const move = enemy.movement ?? 2;
        const nextPos = findMovePath(currentPos, targetPos, move, getOccupied());

        if (nextPos !== currentPos) {
          const moveTxt = `${enemy.id} moveu-se para a posição ${nextPos}`;
          state.log.push(moveTxt);
          state.actions.push({
            round: state.rounds,
            actorType: 'enemy',
            actorId: enemy.id,
            actorName: enemy.id,
            actionType: 'move',
            text: moveTxt,
            fromPosition: currentPos,
            toPosition: nextPos,
          });
          state.enemyPositions[enemy.id] = nextPos;
        }
      }
    }

    // 2. Ataque
    const updatedPos = state.enemyPositions[enemy.id] ?? currentPos;
    const finalTarget = selectTarget(enemy, updatedPos, aliveHeroes, rng, {
      lastAttackerId: state.lastAttacker[enemy.id],
      alliesInDanger: getEnemiesInDanger(),
      modifyScore,
    });

    if (!finalTarget) return;

    const finalDist = GameMath.getHexDistance(updatedPos, state.heroPositions[finalTarget.id]);
    const finalRange = enemy.range ?? 1;

    if (executeEnemyPreAttackSkills(enemy, finalTarget, state, rng())) return;

    if (finalDist <= finalRange) {
      const result = calculateAttack(enemy, finalTarget, enemyHitChance, 'enemy', state.rounds, rng, finalDist, state);

      if (result) {
        let finalDmg = result.dmg;
        // Aplicação de mitigação dos Tanks (se aplicável ao alvo)
        if (finalTarget.classId !== 'TANK' && tankMitigation > 0) {
          finalDmg = Math.max(1, Math.floor(finalDmg * (1 - tankMitigation)));
          result.action.amount = finalDmg;
          result.action.text = `${enemy.id} causou ${finalDmg} de dano em ${finalTarget.name} (Reduzido por Tank)`;
        }

        // Apply shield reduction from skills
        const shieldReduction = getShieldReduction(state, finalTarget.id);
        if (shieldReduction > 0) {
          finalDmg = Math.max(1, Math.floor(finalDmg * (1 - shieldReduction)));
          result.action.amount = finalDmg;
          result.action.text += ` (Escudo: -${Math.round(shieldReduction * 100)}%)`;
        }

        state.actions.push(result.action);
        state.log.push(result.action.text);
        finalTarget.hpCurrent = Math.max(0, finalTarget.hpCurrent - finalDmg);

        state.handlers.onHeroDamaged(state, finalTarget, finalTarget.hpCurrent);
        onHeroDamagedSkills(finalTarget, state);
        if (finalDmg > 0) {
          state.handlers.onAttackResolved(state, enemy as any, finalTarget as any, finalDmg, finalDist);
          onEnemyHitSkills(enemy, finalTarget, state, rng());
          state.lastAttacker[finalTarget.id] = enemy.id;
          state.threats[enemy.id] = finalTarget.id;
        }

        if (finalTarget.hpCurrent <= 0) {
          onHeroDeathSkills(finalTarget, state);
          delete state.heroPositions[finalTarget.id];
          const incapTxt = `${finalTarget.name} está incapacitado!`;
          state.log.push(incapTxt);
          state.actions.push({
            round: state.rounds,
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
};
