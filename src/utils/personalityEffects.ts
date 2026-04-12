import { Hero } from '../types';
import { BattleState, BattleEnemy, Buff } from './battleEngine';
import { GameMath } from './gameMath';

function addBuff(state: BattleState, actorId: string, buff: Buff): void {
  if (!state.buffs[actorId]) state.buffs[actorId] = [];
  const existing = state.buffs[actorId].findIndex(b => b.source === buff.source && b.type === buff.type);
  if (existing >= 0) {
    state.buffs[actorId][existing] = buff;
  } else {
    state.buffs[actorId].push(buff);
  }
}

/**
 * Apply personality-based buffs after a hero attacks.
 * Returns true to signal "try another attack" (Opportunist).
 */
export function applyPersonalityOnHit(
  hero: Hero,
  target: BattleEnemy,
  state: BattleState,
  dmg: number,
  rng: () => number,
  didMove: boolean,
): boolean {
  if (!hero.personality) return false;

  switch (hero.personality) {
    case 'AGGRESSIVE': {
      const targetHpPct = target.hp / target.maxHp;
      if (targetHpPct < 0.3) {
        addBuff(state, hero.id, {
          source: 'PERSONALITY_AGGRESSIVE', type: 'atkMul',
          value: 1.15, expiresAfterRound: state.rounds + 1,
        });
        state.log.push(`${hero.name} (Sanguinário) — fúria ativada!`);
      }
      break;
    }

    case 'CAUTIOUS': {
      if (!didMove) {
        addBuff(state, hero.id, {
          source: 'PERSONALITY_CAUTIOUS', type: 'critFlat',
          value: 10, expiresAfterRound: state.rounds + 1,
        });
      }
      break;
    }

    case 'VENGEFUL': {
      if (state.lastAttacker[hero.id] === target.id) {
        addBuff(state, hero.id, {
          source: 'PERSONALITY_VENGEFUL', type: 'atkMul',
          value: 1.25, expiresAfterRound: state.rounds + 1,
        });
        state.log.push(`${hero.name} (Vingativo) — vingança!`);
      }
      break;
    }

    case 'OPPORTUNIST': {
      if (target.hp <= 0 && rng() < 0.25) {
        state.log.push(`${hero.name} (Oportunista) — ataque extra!`);
        return true;
      }
      break;
    }
  }

  return false;
}

/**
 * Apply Protector personality's defensive shield.
 * Called at the start of each hero's turn.
 */
export function applyProtectorShield(hero: Hero, state: BattleState): void {
  if (hero.personality !== 'PROTECTOR' || hero.hpCurrent <= 0) return;

  const heroPos = state.heroPositions[hero.id] ?? 0;

  for (const ally of state.heroes.filter(h => h.id !== hero.id && h.hpCurrent > 0)) {
    if (ally.hpCurrent / ally.hpMax >= 0.5) continue;

    const allyPos = state.heroPositions[ally.id] ?? 0;
    if (GameMath.getHexDistance(heroPos, allyPos) <= 1) {
      addBuff(state, ally.id, {
        source: 'PERSONALITY_PROTECTOR', type: 'shield',
        value: 0.20, expiresAfterRound: state.rounds + 1,
      });
      state.log.push(`${hero.name} (Guardião) — protege ${ally.name}!`);
      break;
    }
  }
}
