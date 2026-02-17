import {
  RECRUIT_BASE_COST,
  RECRUIT_COST_MULTIPLIER,
  MISSION_BASE_GOLD,
  GOLD_PER_ATK,
} from '../constants/game';

/**
 * Calcula o custo para recrutar o próximo herói com base na quantidade já recrutada.
 * Fórmula: custoBase * (multiplicador ^ heroesRecruited)
 */
export function getRecruitCost(heroesRecruited: number): number {
  return Math.floor(
    RECRUIT_BASE_COST * Math.pow(RECRUIT_COST_MULTIPLIER, heroesRecruited)
  );
}

/**
 * Calcula o ouro gerado por tick de um herói em missão.
 * Fórmula: baseGold + (atk * goldPerAtk)
 */
export function getMissionGoldPerTick(atk: number): number {
  return MISSION_BASE_GOLD + atk * GOLD_PER_ATK;
}

/** Formata um número grande de forma legível (ex: 1.2K, 3.5M) */
export function formatNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(1) + 'B';
  }
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(1) + 'M';
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(1) + 'K';
  }
  return Math.floor(value).toString();
}
