import { ClassId } from '../types';

export interface MissionRequirement {
  type: 'min_stat' | 'class_needed' | 'min_avg_stat' | 'mission_cleared';
  stat?: 'hp' | 'atk' | 'mp';
  value?: number;
  classId?: ClassId;
  missionId?: string; // usado por 'mission_cleared'
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
    ref: 40,
    exponent: 1.5,
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
    // ref reduzido de 120→55 para garantir curva gold/hora monotônica com stats base
    scale: 1.15,
    ref: 55,
    exponent: 1.5,
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
    // ref reduzido de 200→40 para garantir curva gold/hora monotônica com stats base
    scale: 1.08,
    ref: 40,
    exponent: 1.4,
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
    ref: 180,
    exponent: 1.4,
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
    // ref reduzido de 300→50 para garantir curva gold/hora monotônica com stats base
    scale: 1.05,
    ref: 50,
    exponent: 1.3,
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
    ref: 500,
    exponent: 1.2,
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

  // ── Zona 2 — Costa dos Ventos (difficulty 6-7) ──────────────────────────
  {
    id: 'z2_costa_1',
    name: 'Costa dos Ventos',
    minHeroes: 4,
    durationMs: 180_000,
    rewardMin: 80,
    rewardMax: 400,
    statWeights: { hp: 0.3, atk: 0.3, mp: 0.2 },
    scale: 1.0,
    ref: 600,
    exponent: 1.2,
    synergyK: 0.02,
    enemies: [
      { hp: 14, atk: 6, mp: 2, defense: 7, crit: 8, agility: 18, count: 4 },
      { hp: 65, atk: 16, mp: 6, defense: 24, crit: 18, agility: 10, count: 1, range: 3 },
    ],
    difficulty: 6,
    requirements: [
      { type: 'mission_cleared', missionId: 'mission_boss_1', label: 'Derrote o Dragão primeiro' },
      { type: 'min_avg_stat', stat: 'hp', value: 25, label: 'HP médio >= 25' },
      { type: 'min_avg_stat', stat: 'atk', value: 15, label: 'ATK médio >= 15' },
    ],
  },
  {
    id: 'z2_costa_2',
    name: 'Capitão da Costa',
    minHeroes: 4,
    durationMs: 240_000,
    rewardMin: 100,
    rewardMax: 500,
    statWeights: { hp: 0.3, atk: 0.3, mp: 0.2 },
    scale: 1.0,
    ref: 700,
    exponent: 1.2,
    synergyK: 0.02,
    enemies: [
      { hp: 18, atk: 8, mp: 3, defense: 10, crit: 10, agility: 20, count: 4 },
      { hp: 80, atk: 20, mp: 8, defense: 30, crit: 20, agility: 12, count: 1, range: 3 },
    ],
    difficulty: 7,
    requirements: [
      { type: 'mission_cleared', missionId: 'z2_costa_1', label: 'Limpe a Costa dos Ventos primeiro' },
      { type: 'min_avg_stat', stat: 'atk', value: 18, label: 'ATK médio >= 18' },
    ],
  },

  // ── Zona 3 — Picos Gelados (difficulty 8-9) ──────────────────────────────
  {
    id: 'z3_picos_1',
    name: 'Picos Gelados',
    minHeroes: 4,
    durationMs: 300_000,
    rewardMin: 130,
    rewardMax: 650,
    statWeights: { hp: 0.3, atk: 0.25, mp: 0.25 },
    scale: 1.0,
    ref: 800,
    exponent: 1.2,
    synergyK: 0.02,
    enemies: [
      { hp: 22, atk: 10, mp: 4, defense: 14, crit: 12, agility: 22, count: 5 },
      { hp: 100, atk: 25, mp: 10, defense: 38, crit: 22, agility: 14, count: 1, range: 3 },
    ],
    difficulty: 8,
    requirements: [
      { type: 'mission_cleared', missionId: 'z2_costa_2', label: 'Derrote o Capitão da Costa primeiro' },
      { type: 'min_avg_stat', stat: 'hp', value: 35, label: 'HP médio >= 35' },
      { type: 'class_needed', classId: 'HEALER', label: 'Requer um Curandeiro' },
    ],
  },
  {
    id: 'z3_picos_2',
    name: 'Tempestade Glacial',
    minHeroes: 5,
    durationMs: 360_000,
    rewardMin: 160,
    rewardMax: 700,
    statWeights: { hp: 0.3, atk: 0.25, mp: 0.25 },
    scale: 1.0,
    ref: 900,
    exponent: 1.2,
    synergyK: 0.02,
    enemies: [
      { hp: 26, atk: 12, mp: 5, defense: 16, crit: 14, agility: 24, count: 5 },
      { hp: 120, atk: 30, mp: 12, defense: 45, crit: 25, agility: 16, count: 1, range: 3 },
    ],
    difficulty: 9,
    requirements: [
      { type: 'mission_cleared', missionId: 'z3_picos_1', label: 'Conquiste os Picos Gelados primeiro' },
      { type: 'min_avg_stat', stat: 'atk', value: 22, label: 'ATK médio >= 22' },
    ],
  },

  // ── Zona 4 — Abismo Eterno (difficulty 9-10) ─────────────────────────────
  {
    id: 'z4_abismo_1',
    name: 'Abismo Eterno',
    minHeroes: 5,
    durationMs: 480_000,
    rewardMin: 200,
    rewardMax: 900,
    statWeights: { hp: 0.3, atk: 0.3, mp: 0.25 },
    scale: 1.0,
    ref: 1100,
    exponent: 1.15,
    synergyK: 0.02,
    enemies: [
      { hp: 32, atk: 15, mp: 6, defense: 20, crit: 16, agility: 26, count: 5 },
      { hp: 150, atk: 36, mp: 15, defense: 55, crit: 28, agility: 18, count: 1, range: 3 },
    ],
    difficulty: 9,
    requirements: [
      { type: 'mission_cleared', missionId: 'z3_picos_2', label: 'Sobreviva à Tempestade Glacial primeiro' },
      { type: 'min_avg_stat', stat: 'hp', value: 45, label: 'HP médio >= 45' },
      { type: 'class_needed', classId: 'TANK', label: 'Requer um Tanque' },
    ],
  },
  {
    id: 'z4_abismo_boss',
    name: 'Senhor do Abismo',
    minHeroes: 5,
    durationMs: 600_000,
    rewardMin: 300,
    rewardMax: 1200,
    statWeights: { hp: 0.3, atk: 0.3, mp: 0.25 },
    scale: 1.0,
    ref: 1400,
    exponent: 1.1,
    synergyK: 0.02,
    enemies: [
      { hp: 40, atk: 18, mp: 8, defense: 25, crit: 18, agility: 28, count: 5 },
      { hp: 200, atk: 45, mp: 20, defense: 70, crit: 30, agility: 20, count: 1, range: 4 },
    ],
    difficulty: 10,
    requirements: [
      { type: 'mission_cleared', missionId: 'z4_abismo_1', label: 'Explore o Abismo Eterno primeiro' },
      { type: 'min_avg_stat', stat: 'hp', value: 50, label: 'HP médio >= 50' },
      { type: 'min_avg_stat', stat: 'atk', value: 28, label: 'ATK médio >= 28' },
      { type: 'class_needed', classId: 'TANK', label: 'Requer um Tanque' },
      { type: 'class_needed', classId: 'HEALER', label: 'Requer um Curandeiro' },
    ],
  },
];

