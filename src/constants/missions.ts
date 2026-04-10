import { ClassId } from '../types';

export interface MissionRequirement {
  type: 'min_stat' | 'class_needed' | 'min_avg_stat';
  stat?: 'hp' | 'atk' | 'mp';
  value?: number;
  classId?: ClassId;
  label: string;
}

export interface MissionTemplate {
  id: string;
  name: string;
  minHeroes: number;
  durationMs: number;
  rewardMin: number;
  rewardMax: number;
  statWeights?: { hp?: number; atk?: number; mp?: number };
  scale?: number;
  // optional balance overrides for reward curve
  ref?: number;
  exponent?: number;
  synergyK?: number;
  // optional explicit enemy composition for battle simulation
  enemies?: { 
    hp: number; 
    atk: number; 
    mp: number; 
    defense?: number; 
    crit?: number; 
    agility?: number; 
    count?: number;
    range?: number;
    movement?: number;
    attackType?: 'MELEE' | 'RANGED';
  }[];
  requirements?: MissionRequirement[];
  difficulty?: number; // 1-5
}

export const MISSIONS: MissionTemplate[] = [
  {
    id: 'mission_1',
    name: 'Primeira Patrulha',
    minHeroes: 1,
    durationMs: 10_000,
    rewardMin: 1,
    rewardMax: 10,
    statWeights: { hp: 0.2, atk: 0.3, mp: 0.1 },
    // tuned to saturate already at ~30min for single hero
    scale: 1.3,
    ref: 75,
    exponent: 2.2,
    synergyK: 0.055,
    enemies: [{ hp: 5, atk: 1, mp: 1, defense: 1, crit: 2, agility: 5, count: 2 }],
    difficulty: 1,
  },
  {
    id: 'mission_2',
    name: 'Expedição',
    minHeroes: 2,
    durationMs: 30_000,
    rewardMin: 5,
    rewardMax: 50,
    statWeights: { hp: 0.2, atk: 0.3, mp: 0.1 },
    // tuned to saturate around 2h for two-hero teams
    scale: 1.15,
    ref: 200,
    exponent: 1.9,
    synergyK: 0.04,
    enemies: [
      { hp: 6, atk: 2, mp: 1, defense: 2, crit: 5, agility: 8, count: 2 },
      { hp: 10, atk: 3, mp: 1, defense: 4, crit: 2, agility: 5, count: 1 },
    ],
    difficulty: 2,
  },
  {
    id: 'mission_3',
    name: 'Assalto à Caravana',
    minHeroes: 3,
    durationMs: 60_000,
    rewardMin: 10,
    rewardMax: 100,
    statWeights: { hp: 0.2, atk: 0.3, mp: 0.1 },
    // tuned to avoid saturation in 2h for three-hero teams
    scale: 1.08,
    ref: 350,
    exponent: 1.6,
    synergyK: 0.02,
    enemies: [
      { hp: 6, atk: 2, mp: 1, defense: 2, crit: 5, agility: 10, count: 3 },
      { hp: 10, atk: 3, mp: 2, defense: 5, crit: 10, agility: 5, count: 2 },
    ],
    difficulty: 3,
  },
  {
    id: 'mission_4',
    name: 'Floresta Sombria',
    minHeroes: 2,
    durationMs: 45_000,
    rewardMin: 15,
    rewardMax: 80,
    statWeights: { hp: 0.25, atk: 0.3, mp: 0.15 },
    scale: 1.1,
    ref: 300,
    exponent: 1.8,
    synergyK: 0.04,
    enemies: [
      { hp: 12, atk: 4, mp: 2, defense: 6, crit: 8, agility: 12, count: 3 },
      { hp: 8, atk: 6, mp: 3, defense: 3, crit: 15, agility: 18, count: 1, attackType: 'RANGED', range: 3 },
    ],
    difficulty: 3,
    requirements: [{ type: 'min_avg_stat', stat: 'atk', value: 10, label: 'ATK médio >= 10' }],
  },
  {
    id: 'mission_5',
    name: 'Ruínas Ancestrais',
    minHeroes: 3,
    durationMs: 90_000,
    rewardMin: 25,
    rewardMax: 150,
    statWeights: { hp: 0.2, atk: 0.25, mp: 0.2 },
    scale: 1.05,
    ref: 500,
    exponent: 1.5,
    synergyK: 0.03,
    enemies: [
      { hp: 15, atk: 5, mp: 3, defense: 8, crit: 10, agility: 10, count: 3 },
      { hp: 20, atk: 7, mp: 4, defense: 12, crit: 5, agility: 6, count: 2 },
    ],
    difficulty: 4,
    requirements: [
      { type: 'min_stat', stat: 'hp', value: 25, label: 'Pelo menos 1 herói com HP >= 25' },
      { type: 'class_needed', classId: 'HEALER', label: 'Requer um Curandeiro' },
    ],
  },
  {
    id: 'mission_boss_1',
    name: 'Covil do Dragão',
    minHeroes: 4,
    durationMs: 120_000,
    rewardMin: 50,
    rewardMax: 300,
    statWeights: { hp: 0.3, atk: 0.3, mp: 0.2 },
    scale: 1.0,
    ref: 800,
    exponent: 1.3,
    synergyK: 0.02,
    enemies: [
      { hp: 10, atk: 4, mp: 1, defense: 5, crit: 5, agility: 15, count: 4 },
      { hp: 50, atk: 12, mp: 5, defense: 20, crit: 15, agility: 8, count: 1, range: 3 },
    ],
    difficulty: 5,
    requirements: [
      { type: 'min_avg_stat', stat: 'hp', value: 20, label: 'HP médio >= 20' },
      { type: 'min_avg_stat', stat: 'atk', value: 12, label: 'ATK médio >= 12' },
      { type: 'class_needed', classId: 'TANK', label: 'Requer um Tanque' },
    ],
  },
];

