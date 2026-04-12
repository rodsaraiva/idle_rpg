import { Hero, MissionAction, MissionActorType } from '../types';
import { MissionTemplate } from '../constants/missions';
import { 
  CRIT_MULTIPLIER,
  ENEMY_ROWS,
  GRID_COLUMNS,
  GRID_ROWS,
  HIT_CHANCE_DISTANCE_PENALTY
} from '../constants/game';
import { GameMath } from './gameMath';
import { getActiveSynergies } from '../constants/synergies';
import { createSynergyHandlers } from './synergyEffects';
import { ClassId } from '../types';
import { executePreAttackSkills, onHeroDamagedSkills, onHeroDeathSkills, onRogueHitSkills, processDoTBuffs, getShieldReduction, getDefMulProduct } from './skillEffects';
import { applyPersonalityOnHit, applyProtectorShield } from './personalityEffects';

export type SynergyId =
  | 'LINHA_DE_FRENTE'
  | 'MURALHA_E_FLECHA'
  | 'BASTIAO'
  | 'CAOS_ARCANO'
  | 'EMBOSCADA'
  | 'ARTILHARIA';

export type BuffType =
  | 'atkMul'        // multiplicador de ATK do atacante
  | 'critFlat'      // soma flat ao crit (ex: +20)
  | 'rangeFlat'     // soma flat ao alcance
  | 'defDebuffMul'  // multiplicador <1 aplicado à defesa do alvo
  | 'taunt'         // soma flat ao score quando este ator é alvo de seleção
  | 'dot'           // dano por turno (value = dano por round)
  | 'shield'        // absorve dano (value = % de redução no próximo hit)
  | 'defMul'        // multiplicador de DEF do alvo (value > 1 = buff, < 1 = debuff)
  | 'revive';       // marca herói para reviver (value = % HP ao reviver)

export interface Buff {
  source: string;  // SynergyId | SkillId | PersonalitySource
  type: BuffType;
  value: number;
  expiresAfterRound: number; // -1 = persistente até source desativar
}

export interface BattleEnemy {
  id: string;
  hp: number;
  maxHp: number;
  atk: number;
  mp: number;
  defense: number;
  crit: number;
  agility: number;
    alive: boolean;
    attackType: 'MELEE' | 'RANGED';
    position?: number;
    range: number;
    movement: number;
  skills?: import('../constants/enemySkills').EnemySkillDef[];
  skillCooldowns?: Record<string, number>;
  skillOnceUsed?: Record<string, boolean>;
  }

export interface SynergyHandlers {
  onBattleStart: (state: BattleState) => void;
  onHealApplied: (state: BattleState, healer: Hero, target: Hero, amount: number) => void;
  onHeroDamaged: (state: BattleState, hero: Hero, hpAfter: number) => void;
  onAttackResolved: (
    state: BattleState,
    attacker: Hero | BattleEnemy,
    target: Hero | BattleEnemy,
    dmg: number,
    distance: number
  ) => void;
  shouldIgnoreDefense: (state: BattleState, attacker: Hero | BattleEnemy) => boolean;
  modifyTargetScore: (
    state: BattleState,
    enemy: BattleEnemy,
    candidate: Hero,
    baseScore: number
  ) => number;
}

export interface BattleState {
  heroes: Hero[];
  enemies: BattleEnemy[];
  heroPositions: Record<string, number>;
  enemyPositions: Record<string, number>;
  lastAttacker: Record<string, string>;
  threats: Record<string, string>; // enemyId -> targetAllyId
  log: string[];
  actions: MissionAction[];
  rounds: number;
  activeSynergies: SynergyId[];
  buffs: Record<string, Buff[]>;
  flags: Record<string, boolean | number>;
  handlers: SynergyHandlers;
  skillCooldowns: Record<string, number>;   // "heroId_skillId" -> round em que fica disponível
  skillOnceUsed: Record<string, boolean>;   // "heroId_skillId" -> true se já usada
}

export const BattleEngine = {
  /**
   * Cria os inimigos para a batalha baseado no template da missão.
   */
  createEnemies(template: MissionTemplate): BattleEnemy[] {
    const enemies: BattleEnemy[] = [];
    const enemyPositions = [...ENEMY_ROWS].flatMap(r => 
      Array.from({ length: GRID_COLUMNS }, (_, c) => r * GRID_COLUMNS + c)
    );
    // Shuffle positions to place enemies randomly in the enemy zone
    for (let i = enemyPositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [enemyPositions[i], enemyPositions[j]] = [enemyPositions[j], enemyPositions[i]];
    }

    let posIdx = 0;

    if (template.enemies && template.enemies.length > 0) {
      template.enemies.forEach((edef, gi) => {
        const cnt = edef.count ?? 1;
        for (let i = 0; i < cnt; i++) {
          const attackType = edef.attackType ?? (Math.random() < 0.5 ? 'MELEE' : 'RANGED');
          enemies.push({
            id: `enemy_${gi}_${i}`,
            hp: edef.hp,
            maxHp: edef.hp,
            atk: edef.atk,
            mp: edef.mp,
            defense: edef.defense ?? 2,
            crit: edef.crit ?? 5,
            agility: edef.agility ?? 5,
            alive: true,
            attackType,
            position: enemyPositions[posIdx++] ?? 0,
            range: edef.range ?? (attackType === 'RANGED' ? 3 : 1),
            movement: edef.movement ?? 2,
          });
        }
      });
    } else {
      const enemyCount = template.minHeroes;
      for (let i = 0; i < enemyCount; i++) {
        enemies.push({
          id: `orc_${i}`,
          hp: 5,
          maxHp: 5,
          atk: 2,
          mp: 1,
          defense: 1,
          crit: 2,
          agility: 2,
          alive: true,
          attackType: i % 2 === 0 ? 'MELEE' : 'RANGED',
          position: enemyPositions[posIdx++] ?? 0,
          range: i % 2 === 0 ? 1 : 3,
          movement: 2,
        });
      }
    }
    return enemies;
  },

  /**
   * Constructs a fresh BattleState with synergy handlers wired up and
   * positions initialized.
   */
  initializeBattle(
    heroes: Hero[],
    template: MissionTemplate,
    opts: { heroPositions?: Record<string, number> } = {}
  ): BattleState {
    const enemies = this.createEnemies(template);
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
    };

    handlers.onBattleStart(state);
    return state;
  },

  /**
   * Removes buffs whose expiresAfterRound is < current round.
   * Persistent buffs (expiresAfterRound === -1) are kept.
   */
  cleanExpiredBuffs(state: BattleState): void {
    for (const actorId of Object.keys(state.buffs)) {
      state.buffs[actorId] = state.buffs[actorId].filter(
        b => b.expiresAfterRound === -1 || b.expiresAfterRound >= state.rounds
      );
      if (state.buffs[actorId].length === 0) delete state.buffs[actorId];
    }
  },

  /**
   * Encontra a melhor posição para se mover em direção ao alvo.
   */
  findMovePath(
    currentPos: number,
    targetPos: number,
    movement: number,
    occupiedPositions: Set<number>
  ): number {
    if (movement <= 0) return currentPos;
    
    let bestPos = currentPos;
    let minDistance = GameMath.getHexDistance(currentPos, targetPos);

    // BFS simplificada para encontrar a célula dentro do alcance de movimento que está mais próxima do alvo
    const queue: { pos: number; dist: number }[] = [{ pos: currentPos, dist: 0 }];
    const visited = new Set<number>([currentPos]);

    while (queue.length > 0) {
      const { pos, dist } = queue.shift()!;

      if (dist < movement) {
        const neighbors = GameMath.getHexNeighbors(pos, GRID_ROWS, GRID_COLUMNS);
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && !occupiedPositions.has(neighbor)) {
            visited.add(neighbor);
            const dToTarget = GameMath.getHexDistance(neighbor, targetPos);
            if (dToTarget < minDistance) {
              minDistance = dToTarget;
              bestPos = neighbor;
            }
            queue.push({ pos: neighbor, dist: dist + 1 });
          }
        }
      }
    }

    return bestPos;
  },

  /**
   * Lógica de seleção de alvo.
   * Agora considera a distância, classe e personalidade.
   */
  selectTarget<T extends { id: string; hp?: number; hpCurrent?: number; position?: number; classId?: string; range?: number }>(
    attacker: { id: string; attackType?: 'MELEE' | 'RANGED'; personality?: string; classId?: string; range?: number },
    attackerPos: number,
    candidates: T[],
    rng: () => number,
    context: {
      lastAttackerId?: string;
      alliesInDanger?: string[];
      threats?: Record<string, string>; // enemyId -> targetAllyId
      modifyScore?: (candidate: T, baseScore: number) => number;
    } = {}
  ): T | undefined {
    if (!candidates || candidates.length === 0) return undefined;

    const hpOf = (c: T) => (typeof c.hp === 'number' ? c.hp : c.hpCurrent ?? 0);
    const maxHpOf = (c: any) => (typeof c.maxHp === 'number' ? c.maxHp : 100); // Default fallback

    const scores = candidates.map(target => {
      let score = 100; // Base score
      const dist = GameMath.getHexDistance(attackerPos, target.position ?? 0);
      const targetHpPct = hpOf(target) / maxHpOf(target);
      
      // 1. Distância (Penalidade base)
      score -= dist * 10;

      // 2. Lógica por Classe do Atacante
      if (attacker.classId === 'TANK' || attacker.classId === 'WARRIOR') {
        // Preferem alvos próximos
        if (dist <= 1) score += 20;
      } else if (attacker.classId === 'ROGUE' || attacker.classId === 'ARCHER' || attacker.classId === 'MAGE') {
        // Preferem alvos frágeis (não TANK)
        if (target.classId !== 'TANK') score += 15;
        if (targetHpPct < 0.5) score += 10;
      }

      // 3. Lógica por Personalidade
      switch (attacker.personality) {
        case 'AGGRESSIVE':
          // Prioriza quem pode morrer
          if (targetHpPct < 0.3) score += 40;
          // Se puder matar com o dano médio, ignora distância (no simulador isso será refletido no score alto)
          break;
        case 'PROTECTOR':
          // Prioriza quem atacou aliados em perigo
          if (context.threats && target.id in context.threats) {
            const targetOfEnemy = context.threats[target.id];
            if (context.alliesInDanger?.includes(targetOfEnemy)) {
              score += 100;
            }
          }
          break;
        case 'CAUTIOUS':
          // Prefere alvos no alcance sem mover
          const range = attacker.range ?? 1;
          if (dist <= range) score += 30;
          // Alvos isolados (menos vizinhos inimigos - simplificado para: prefere quem está longe do centro do grid inimigo)
          break;
        case 'VENGEFUL':
          // Bônus imenso contra quem o atacou
          if (target.id === context.lastAttackerId) {
            score += 200;
          }
          break;
        case 'OPPORTUNIST':
          // Alvos fáceis e HP baixo
          if (target.classId !== 'TANK') score += 20;
          if (targetHpPct < 0.4) score += 30;
          break;
      }

      if (context.modifyScore) {
        score = context.modifyScore(target, score);
      }

      return { target, score };
    });

    // Ordena por score descendente e pega o melhor
    scores.sort((a, b) => b.score - a.score);
    
    // Adiciona uma pequena aleatoriedade para não ser 100% determinístico
    const topCandidates = scores.slice(0, 2);
    if (topCandidates.length > 1 && rng() < 0.2) {
      return topCandidates[1].target;
    }

    return topCandidates[0]?.target;
  },

  /**
   * Calcula o resultado de um ataque.
   */
  calculateAttack(
    attacker: { id: string; name?: string; atk: number; crit?: number; classId?: string; attackType?: 'MELEE' | 'RANGED'; personality?: string },
    target: { id: string; name?: string; hp?: number; hpCurrent?: number; defense?: number; agility?: number },
    baseHitChance: number,
    actorType: MissionActorType,
    round: number,
    rng: () => number,
    distance: number = 1,
    state?: BattleState
  ): { action: MissionAction; dmg: number } | null {
    const evasion = (target.agility ?? 0) / ((target.agility ?? 0) + 50);
    let distancePenalty = Math.max(0, distance - 1) * HIT_CHANCE_DISTANCE_PENALTY;
    if (attacker.personality === 'CAUTIOUS') {
      distancePenalty *= 0.6;
    }
    const effectiveHitChance = Math.max(0.05, baseHitChance - evasion - distancePenalty);

    if (rng() > effectiveHitChance) {
      return {
        action: {
          round,
          actorType,
          actorId: attacker.id,
          actorName: attacker.name ?? attacker.id,
          actionType: 'miss',
          targetId: target.id,
          text: `${attacker.name ?? attacker.id} errou o ataque em ${target.name ?? target.id}`,
        },
        dmg: 0,
      };
    }

    // Read attacker buffs
    let atkMul = 1;
    let critFlat = 0;
    if (state) {
      const attackerBuffs = state.buffs[attacker.id] ?? [];
      for (const b of attackerBuffs) {
        if (b.type === 'atkMul') atkMul *= b.value;
        else if (b.type === 'critFlat') critFlat += b.value;
      }
    }

    // Read target debuffs (defDebuffMul from synergies + defMul from skills)
    let defMul = 1;
    if (state) {
      const targetBuffs = state.buffs[target.id] ?? [];
      for (const b of targetBuffs) {
        if (b.type === 'defDebuffMul') defMul *= b.value;
        else if (b.type === 'defMul') defMul *= b.value;
      }
    }

    const ignoreDef = state ? state.handlers.shouldIgnoreDefense(state, attacker as any) : false;
    const effectiveDef = ignoreDef ? 0 : Math.floor((target.defense ?? 0) * defMul);

    const critChance = GameMath.calcCritChance(attacker.classId, (attacker.crit ?? 0) + critFlat);
    const isCrit = rng() < critChance;
    const effectiveAtk = Math.floor(attacker.atk * atkMul);
    const dmg = GameMath.calcDamage(effectiveAtk, effectiveDef, isCrit);

    return {
      action: {
        round,
        actorType,
        actorId: attacker.id,
        actorName: attacker.name ?? attacker.id,
        actionType: 'hit',
        targetId: target.id,
        amount: dmg,
        isCrit,
        text: `${attacker.name ?? attacker.id} causou ${dmg} de dano em ${target.name ?? target.id}${isCrit ? ' (CRÍTICO!)' : ''}`,
      },
      dmg,
    };
  },

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
      ? this.selectTarget(hero, state.heroPositions[hero.id] ?? 45, aliveEnemies, rng, {
          lastAttackerId: state.lastAttacker[hero.id],
        })
      : undefined;
    if (executePreAttackSkills(hero, preTarget, state, rng)) return;

    // Utilitários locais
    const getOccupied = () => new Set([...Object.values(state.heroPositions), ...Object.values(state.enemyPositions)]);
    const getAlliesInDanger = () => state.heroes.filter(h => h.hpCurrent / h.hpMax < 0.3).map(h => h.id);

    // 2. Movimentação
    const currentPos = state.heroPositions[hero.id] ?? 45;
    const initialTarget = this.selectTarget(hero, currentPos, aliveEnemies, rng, {
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
        const nextPos = this.findMovePath(currentPos, targetPos, move, getOccupied());
        
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
    const finalTarget = this.selectTarget(hero, updatedPos, aliveEnemies, rng, {
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
      const result = this.calculateAttack(hero, finalTarget, hitChance, 'hero', state.rounds, rng, finalDist, state);

      if (result) {
        state.actions.push(result.action);
        state.log.push(result.action.text);
        finalTarget.hp = Math.max(0, finalTarget.hp - result.dmg);

        if (result.dmg > 0) {
          const didMove = updatedPos !== currentPos;
          state.lastAttacker[finalTarget.id] = hero.id;
          state.handlers.onAttackResolved(state, hero as any, finalTarget as any, result.dmg, finalDist);
          if (hero.classId === 'ROGUE') {
            onRogueHitSkills(hero, finalTarget, state, rng);
          }
          const extraAttack = applyPersonalityOnHit(hero, finalTarget, state, result.dmg, rng, didMove);
          // Opportunist extra attack on kill
          if (extraAttack && finalTarget.hp <= 0) {
            const nextAlive = state.enemies.find(e => e.alive && e.id !== finalTarget.id);
            if (nextAlive) {
              const nextDist = GameMath.getHexDistance(updatedPos, state.enemyPositions[nextAlive.id]);
              if (nextDist <= effectiveRange) {
                const extraResult = this.calculateAttack(hero, nextAlive, 0.8, 'hero', state.rounds, rng, nextDist, state);
                if (extraResult) {
                  state.actions.push(extraResult.action);
                  state.log.push(extraResult.action.text);
                  nextAlive.hp = Math.max(0, nextAlive.hp - extraResult.dmg);
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
    
    const aliveHeroes = state.heroes.filter(h => h.hpCurrent > 0);
    if (aliveHeroes.length === 0) return;

    // Utilitários locais
    const getOccupied = () => new Set([...Object.values(state.heroPositions), ...Object.values(state.enemyPositions)]);
    const getEnemiesInDanger = () => state.enemies.filter(e => e.hp / e.maxHp < 0.3).map(e => e.id);

    const modifyScore = (candidate: Hero, baseScore: number) =>
      state.handlers.modifyTargetScore(state, enemy, candidate, baseScore);

    // 1. Movimentação
    const currentPos = state.enemyPositions[enemy.id] ?? 0;
    const initialTarget = this.selectTarget(enemy, currentPos, aliveHeroes, rng, {
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
        const nextPos = this.findMovePath(currentPos, targetPos, move, getOccupied());

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
    const finalTarget = this.selectTarget(enemy, updatedPos, aliveHeroes, rng, {
      lastAttackerId: state.lastAttacker[enemy.id],
      alliesInDanger: getEnemiesInDanger(),
      modifyScore,
    });

    if (!finalTarget) return;

    const finalDist = GameMath.getHexDistance(updatedPos, state.heroPositions[finalTarget.id]);
    const finalRange = enemy.range ?? 1;

    if (finalDist <= finalRange) {
      const result = this.calculateAttack(enemy, finalTarget, enemyHitChance, 'enemy', state.rounds, rng, finalDist, state);

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
