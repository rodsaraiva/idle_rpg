import { GameMath } from './gameMath';

/**
 * Mulberry32 PRNG seedável — qualidade suficiente para jogos/simulações (não-cripto).
 * Retorna valores em [0, 1).
 */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

/**
 * Retorna um multiplicador baseado em uma distribuição Gaussiana (Box-Muller).
 * @param mean Média da distribuição (padrão 1.0)
 * @param stdDev Desvio padrão. Para ~99% dentro de ±50%, use ~0.16.
 * @param min Cap mínimo (padrão 0.5 para 50%)
 * @param max Cap máximo (padrão 1.5 para 150%)
 */
export function getGaussianVariance(mean = 1.0, stdDev = 0.16, min = 0.5, max = 1.5): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  const result = num * stdDev + mean;
  return Math.min(Math.max(result, min), max);
}

export const getRecruitCost = GameMath.getRecruitCost;
export const getMissionGoldPerTick = GameMath.getMissionGoldPerTick;
export const formatNumber = GameMath.formatNumber;
