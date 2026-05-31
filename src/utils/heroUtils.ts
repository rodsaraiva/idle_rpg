import { Hero, HeroTask, GameState } from '../types';
import { INCAPACITATED_HP_THRESHOLD } from '../constants/game';

/** HP is below the incapacitation threshold (< 3). */
export function isHeroIncapacitated(hero: Hero): boolean {
  return hero.hpCurrent < INCAPACITATED_HP_THRESHOLD;
}

/** Hero is currently on a mission. */
export function isHeroInMission(hero: Hero): boolean {
  return hero.currentTask === HeroTask.MISSION;
}

/** Hero is not on a mission and not incapacitated — can be sent on a new mission. */
export function isHeroAvailableForMission(hero: Hero): boolean {
  return !isHeroInMission(hero) && !isHeroIncapacitated(hero);
}

/** Hero's current HP is below max — eligible for infirmary healing. */
export function isHeroInjured(hero: Hero): boolean {
  return hero.hpCurrent < hero.hpMax;
}

/**
 * Stats de combate efetivos com todos os bônus aplicados.
 * hpCurrent é incluído para permitir escalonamento proporcional ao ganho de hpMax.
 */
export interface EffectiveStats {
  hpMax: number;
  hpCurrent: number;
  atk: number;
  mp: number;
  defense: number;
  crit: number;
  agility: number;
}

/**
 * Único ponto de verdade para stats de combate efetivos.
 *
 * Ordem de composição (determinística):
 *   1. base (treinado)
 *   2. + equipamento (flat, todos os stats)
 *   3. + permanentBonuses (flat atk e hp apenas — conquistas)
 *   4. × pantheonBonuses (multiplicador atkPercent e hpPercent)
 *
 * DEF / CRIT / AGI só recebem equipamento (restrição: não são treináveis diretamente).
 * hpCurrent escala proporcional ao ganho de hpMax em cada etapa.
 */
export function getEffectiveStats(hero: Hero, state: GameState): EffectiveStats {
  const inventory = state.inventory ?? [];
  const equipped = hero.equippedItems ?? [];

  // ── 1. Base ──────────────────────────────────────────────────────────────
  let hpMax = hero.hpMax;
  let hpCurrent = hero.hpCurrent;
  let atk = hero.atk;
  let mp = hero.mp;
  let defense = hero.defense ?? 0;
  let crit = hero.crit ?? 0;
  let agility = hero.agility ?? 0;

  // ── 2. Equipamento (flat) ─────────────────────────────────────────────────
  for (const eqId of equipped) {
    const item = inventory.find(e => e.id === eqId);
    if (!item) continue;
    const b = item.statBonus;
    if (b.hp) {
      const gain = b.hp;
      hpCurrent = Math.min(hpMax + gain, hpCurrent + gain);
      hpMax += gain;
    }
    if (b.atk) atk += b.atk;
    if (b.mp) mp += b.mp;
    if (b.defense) defense += b.defense;
    if (b.crit) crit += b.crit;
    if (b.agility) agility += b.agility;
  }

  // ── 3. permanentBonuses (flat atk e hp apenas) ──────────────────────────
  const perm = state.permanentBonuses;
  if (perm) {
    if (perm.hp) {
      const gain = perm.hp;
      hpCurrent = Math.min(hpMax + gain, hpCurrent + gain);
      hpMax += gain;
    }
    if (perm.atk) atk += perm.atk;
  }

  // ── 4. pantheonBonuses (multiplicador sobre atk e hpMax) ─────────────────
  const pan = state.pantheonBonuses;
  if (pan) {
    if (pan.atkPercent) {
      atk = Math.floor(atk * (1 + pan.atkPercent / 100));
    }
    if (pan.hpPercent) {
      const oldHpMax = hpMax;
      hpMax = Math.floor(hpMax * (1 + pan.hpPercent / 100));
      const hpGain = hpMax - oldHpMax;
      hpCurrent = Math.min(hpMax, hpCurrent + hpGain);
    }
  }

  return { hpMax, hpCurrent, atk, mp, defense, crit, agility };
}

/**
 * Aplica o bônus percentual de gold do panteão sobre uma recompensa.
 * Chamado no momento da concessão do gold (missão completa) — nunca antes.
 * Retorna floor para evitar frações de gold.
 */
export function applyGoldBonus(reward: number, state: GameState): number {
  const goldPercent = state.pantheonBonuses?.goldPercent ?? 0;
  if (goldPercent <= 0) return reward;
  return Math.floor(reward * (1 + goldPercent / 100));
}
