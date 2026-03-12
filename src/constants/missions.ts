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
];

