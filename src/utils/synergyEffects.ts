import { Hero } from '../types';
import {
  BattleState,
  BattleEnemy,
  SynergyHandlers,
  SynergyId,
} from './battleEngine';
import { GameMath } from './gameMath';

const NOOP_HANDLERS: SynergyHandlers = {
  onBattleStart: () => {},
  onHealApplied: () => {},
  onHeroDamaged: () => {},
  onAttackResolved: () => {},
  shouldIgnoreDefense: () => false,
  modifyTargetScore: (_state, _enemy, _candidate, baseScore) => baseScore,
};

const SYNERGY_IMPLS: Record<SynergyId, Partial<SynergyHandlers>> = {
  // Linha de Frente (Furor): curar Guerreiro aplica atkMul 1.30 por 1 turno
  LINHA_DE_FRENTE: {
    onHealApplied: (state, _healer, target, amount) => {
      if (target.classId !== 'WARRIOR' || amount <= 0) return;
      const existing = state.buffs[target.id] ?? [];
      const filtered = existing.filter(b => b.source !== 'LINHA_DE_FRENTE');
      filtered.push({
        source: 'LINHA_DE_FRENTE',
        type: 'atkMul',
        value: 1.30,
        expiresAfterRound: state.rounds + 1,
      });
      state.buffs[target.id] = filtered;
    },
  },

  // Muralha e Flecha (Posição Fortificada): Tanque atrai, Arqueiro ganha range+crit
  MURALHA_E_FLECHA: {
    onBattleStart: (state) => {
      const tanksAlive = state.heroes.some(h => h.classId === 'TANK' && h.hpCurrent > 0);
      if (!tanksAlive) return;
      for (const h of state.heroes) {
        if (h.hpCurrent <= 0) continue;
        if (h.classId === 'TANK') {
          state.buffs[h.id] = [
            ...(state.buffs[h.id] ?? []),
            { source: 'MURALHA_E_FLECHA', type: 'taunt', value: 60, expiresAfterRound: -1 },
          ];
        } else if (h.classId === 'ARCHER') {
          state.buffs[h.id] = [
            ...(state.buffs[h.id] ?? []),
            { source: 'MURALHA_E_FLECHA', type: 'rangeFlat', value: 1, expiresAfterRound: -1 },
            { source: 'MURALHA_E_FLECHA', type: 'critFlat', value: 20, expiresAfterRound: -1 },
          ];
        }
      }
    },
    onHeroDamaged: (state, hero, hpAfter) => {
      if (hero.classId !== 'TANK' || hpAfter > 0) return;
      const anyTankAlive = state.heroes.some(h => h.classId === 'TANK' && h.hpCurrent > 0);
      if (anyTankAlive) return;
      for (const id of Object.keys(state.buffs)) {
        state.buffs[id] = state.buffs[id].filter(b => b.source !== 'MURALHA_E_FLECHA');
        if (state.buffs[id].length === 0) delete state.buffs[id];
      }
    },
    modifyTargetScore: (state, _enemy, candidate, baseScore) => {
      const buffs = state.buffs[candidate.id] ?? [];
      let bonus = 0;
      for (const b of buffs) {
        if (b.type === 'taunt') bonus += b.value;
      }
      return baseScore + bonus;
    },
  },

  // Bastião (Sopro de Esperança): Tanque < 50% HP arma flag para cura AoE
  BASTIAO: {
    onHeroDamaged: (state, hero, hpAfter) => {
      if (hero.classId !== 'TANK') return;
      if (state.flags['bastion_armed']) return;
      const pct = hpAfter / (hero.hpMax || 1);
      if (pct < 0.5) {
        state.flags['bastion_armed'] = true;
      }
    },
  },

  // Caos Arcano (Disjunção): Mago debuffa defesa do alvo
  CAOS_ARCANO: {
    onAttackResolved: (state, attacker, target, dmg, _distance) => {
      if ((attacker as any).classId !== 'MAGE' || dmg <= 0) return;
      const existing = state.buffs[target.id] ?? [];
      const filtered = existing.filter(b => b.source !== 'CAOS_ARCANO');
      filtered.push({
        source: 'CAOS_ARCANO',
        type: 'defDebuffMul',
        value: 0.5,
        expiresAfterRound: state.rounds + 1,
      });
      state.buffs[target.id] = filtered;
    },
  },

  // Emboscada (Surpresa): Guerreiro e Ladino ignoram defesa nos rounds 1-2
  EMBOSCADA: {
    shouldIgnoreDefense: (state, attacker) => {
      if (state.rounds > 2) return false;
      const cid = (attacker as any).classId;
      return cid === 'WARRIOR' || cid === 'ROGUE';
    },
  },

  // Artilharia (Bombardeio): Ataques ranged >=2 hex têm 50% chance de splash
  ARTILHARIA: {
    onAttackResolved: (state, attacker, target, dmg, distance) => {
      const cid = (attacker as any).classId;
      if (cid !== 'ARCHER' && cid !== 'MAGE') return;
      if (distance < 2 || dmg <= 0) return;
      if (Math.random() >= 0.5) return;

      const targetPos = state.enemyPositions[target.id];
      if (targetPos === undefined) return;

      const candidates = state.enemies.filter(e =>
        e.id !== target.id &&
        e.hp > 0 &&
        state.enemyPositions[e.id] !== undefined &&
        GameMath.getHexDistance(targetPos, state.enemyPositions[e.id]!) <= 2
      );
      if (candidates.length === 0) return;

      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const splashDmg = Math.max(1, Math.floor(dmg * 0.5));
      pick.hp = Math.max(0, pick.hp - splashDmg);
      const txt = `Bombardeio: ${(attacker as any).name ?? (attacker as any).id} causou ${splashDmg} de dano em respingo em ${pick.id}`;
      state.log.push(txt);
      state.actions.push({
        round: state.rounds,
        actorType: 'hero',
        actorId: (attacker as any).id,
        actorName: (attacker as any).name ?? (attacker as any).id,
        actionType: 'hit',
        targetId: pick.id,
        amount: splashDmg,
        text: txt,
      });
    },
  },
};

/**
 * Builds a SynergyHandlers object that fans out each hook to every active
 * synergy's individual handler. Inactive synergies contribute nothing.
 */
export function createSynergyHandlers(active: SynergyId[]): SynergyHandlers {
  if (!active || active.length === 0) return NOOP_HANDLERS;

  const perSynergy: Partial<SynergyHandlers>[] = active.map(id => SYNERGY_IMPLS[id]);

  return {
    onBattleStart: (state) => {
      for (const h of perSynergy) h.onBattleStart?.(state);
    },
    onHealApplied: (state, healer, target, amount) => {
      for (const h of perSynergy) h.onHealApplied?.(state, healer, target, amount);
    },
    onHeroDamaged: (state, hero, hpAfter) => {
      for (const h of perSynergy) h.onHeroDamaged?.(state, hero, hpAfter);
    },
    onAttackResolved: (state, attacker, target, dmg, distance) => {
      for (const h of perSynergy) h.onAttackResolved?.(state, attacker, target, dmg, distance);
    },
    shouldIgnoreDefense: (state, attacker) => {
      for (const h of perSynergy) {
        if (h.shouldIgnoreDefense?.(state, attacker)) return true;
      }
      return false;
    },
    modifyTargetScore: (state, enemy, candidate, baseScore) => {
      let score = baseScore;
      for (const h of perSynergy) {
        if (h.modifyTargetScore) score = h.modifyTargetScore(state, enemy, candidate, score);
      }
      return score;
    },
  };
}

export const _NOOP_HANDLERS = NOOP_HANDLERS;
