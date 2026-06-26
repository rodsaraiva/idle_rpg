import { MissionAction, MissionActorType } from '../../types';
import { HIT_CHANCE_DISTANCE_PENALTY } from '../../constants/game';
import { GameMath } from '../gameMath';
import { BattleState } from './types';

/**
 * Remove buffs cujo expiresAfterRound é < round atual. Persistentes (-1) ficam.
 */
export function cleanExpiredBuffs(state: BattleState): void {
  for (const actorId of Object.keys(state.buffs)) {
    state.buffs[actorId] = state.buffs[actorId].filter(
      b => b.expiresAfterRound === -1 || b.expiresAfterRound >= state.rounds
    );
    if (state.buffs[actorId].length === 0) delete state.buffs[actorId];
  }
}

/**
 * Calcula o resultado de um ataque (evasão, penalidade de distância, buffs,
 * crit/dano).
 */
export function calculateAttack(
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

  // Lê buffs do atacante
  let atkMul = 1;
  let atkFlat = 0;
  let critFlat = 0;
  if (state) {
    const attackerBuffs = state.buffs[attacker.id] ?? [];
    for (const b of attackerBuffs) {
      if (b.type === 'atkMul') atkMul *= b.value;
      else if (b.type === 'atkFlat') atkFlat += b.value;
      else if (b.type === 'critFlat') critFlat += b.value;
    }
  }

  // Lê debuffs do alvo (defDebuffMul de sinergias + defMul de habilidades)
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
  const effectiveAtk = Math.floor(attacker.atk * atkMul) + atkFlat;
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
}
