import { MissionTemplate } from './missions';

export interface WeeklyBossTemplate {
  id: string;
  bossName: string;
  name: string;
  minHeroes: number;
  durationMs: number;
  difficulty: number;
  baseReward: number;
  enemies: Array<{
    hp: number; atk: number; mp: number; defense: number;
    crit: number; agility: number; count: number;
    attackType?: 'MELEE' | 'RANGED'; range?: number; movement?: number;
  }>;
  rewardMin: number;
  rewardMax: number;
  statWeights: { hp: number; atk: number; mp: number };
  guaranteedRewardTier?: number;
}

export const WEEKLY_BOSS_POOL: WeeklyBossTemplate[] = [
  {
    id: 'wb_hydra', bossName: 'Hydra das Profundezas', name: 'Hydra das Profundezas',
    minHeroes: 4, durationMs: 180_000, difficulty: 6, baseReward: 300,
    rewardMin: 200, rewardMax: 400,
    enemies: [
      { hp: 200, atk: 25, mp: 10, defense: 15, crit: 10, agility: 8, count: 1, attackType: 'MELEE', range: 2, movement: 1 },
      { hp: 60, atk: 12, mp: 5, defense: 8, crit: 5, agility: 10, count: 3, attackType: 'RANGED', range: 3, movement: 2 },
    ],
    statWeights: { hp: 0.3, atk: 0.4, mp: 0.3 },
    guaranteedRewardTier: 2,
  },
  {
    id: 'wb_golem', bossName: 'Golem Ancestral', name: 'Golem Ancestral',
    minHeroes: 3, durationMs: 150_000, difficulty: 6, baseReward: 250,
    rewardMin: 150, rewardMax: 350,
    enemies: [
      { hp: 300, atk: 18, mp: 0, defense: 30, crit: 0, agility: 2, count: 1, attackType: 'MELEE', range: 1, movement: 1 },
      { hp: 40, atk: 10, mp: 5, defense: 5, crit: 5, agility: 15, count: 2, attackType: 'MELEE', range: 1, movement: 3 },
    ],
    statWeights: { hp: 0.4, atk: 0.3, mp: 0.3 },
    guaranteedRewardTier: 2,
  },
  {
    id: 'wb_dragon', bossName: 'Dragão Sombrio', name: 'Dragão Sombrio',
    minHeroes: 4, durationMs: 240_000, difficulty: 7, baseReward: 500,
    rewardMin: 350, rewardMax: 600,
    enemies: [
      { hp: 350, atk: 35, mp: 15, defense: 20, crit: 15, agility: 12, count: 1, attackType: 'RANGED', range: 4, movement: 1 },
      { hp: 80, atk: 15, mp: 5, defense: 10, crit: 10, agility: 8, count: 2, attackType: 'MELEE', range: 1, movement: 2 },
    ],
    statWeights: { hp: 0.3, atk: 0.4, mp: 0.3 },
    guaranteedRewardTier: 3,
  },
  {
    id: 'wb_lich', bossName: 'Lorde Lich', name: 'Lorde Lich',
    minHeroes: 3, durationMs: 180_000, difficulty: 7, baseReward: 400,
    rewardMin: 250, rewardMax: 500,
    enemies: [
      { hp: 180, atk: 30, mp: 20, defense: 12, crit: 20, agility: 15, count: 1, attackType: 'RANGED', range: 4, movement: 1 },
      { hp: 50, atk: 12, mp: 8, defense: 5, crit: 5, agility: 5, count: 3, attackType: 'MELEE', range: 1, movement: 2 },
    ],
    statWeights: { hp: 0.3, atk: 0.3, mp: 0.4 },
  },
  {
    id: 'wb_titan', bossName: 'Titã do Caos', name: 'Titã do Caos',
    minHeroes: 5, durationMs: 300_000, difficulty: 8, baseReward: 600,
    rewardMin: 400, rewardMax: 800,
    enemies: [
      { hp: 500, atk: 40, mp: 20, defense: 25, crit: 10, agility: 5, count: 1, attackType: 'MELEE', range: 2, movement: 1 },
      { hp: 100, atk: 20, mp: 10, defense: 15, crit: 10, agility: 10, count: 2, attackType: 'RANGED', range: 3, movement: 2 },
      { hp: 60, atk: 15, mp: 5, defense: 8, crit: 15, agility: 20, count: 2, attackType: 'MELEE', range: 1, movement: 3 },
    ],
    statWeights: { hp: 0.3, atk: 0.4, mp: 0.3 },
    guaranteedRewardTier: 3,
  },
];

export function getWeeklyBoss(seed: number): WeeklyBossTemplate {
  const index = seed % WEEKLY_BOSS_POOL.length;
  return WEEKLY_BOSS_POOL[index];
}
