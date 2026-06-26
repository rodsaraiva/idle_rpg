// Pool de recompensas de login diário — NUNCA inclui gold (invariante anti-P2W)
export type LoginReward =
  | { kind: 'material'; id: string; qty: number }
  | { kind: 'key'; tier: 'bronze' | 'silver' | 'gold'; qty: number }
  | { kind: 'cosmetic'; id: string };

/** 7 recompensas de streak — nenhuma credita gold. Ciclo infinito (mod 7). */
export const LOGIN_REWARDS: LoginReward[] = [
  { kind: 'material', id: 'iron', qty: 5 },
  { kind: 'material', id: 'crystal', qty: 3 },
  { kind: 'key', tier: 'bronze', qty: 1 },
  { kind: 'material', id: 'essence', qty: 3 },
  { kind: 'key', tier: 'silver', qty: 1 },
  { kind: 'cosmetic', id: 'frame_bronze' },
  { kind: 'key', tier: 'gold', qty: 1 },
];

/** Retorna a recompensa para o dia N de streak (ciclo de 7). count começa em 1. */
export function rewardForStreakDay(count: number): LoginReward {
  return LOGIN_REWARDS[(count - 1) % LOGIN_REWARDS.length];
}
