export interface MissionTemplate {
  id: string;
  name: string;
  minHeroes: number;
  durationMs: number;
  rewardMin: number;
  rewardMax: number;
  statWeights?: { hp?: number; atk?: number; mp?: number };
  scale?: number;
}

export const MISSIONS: MissionTemplate[] = [
  {
    id: 'mission_1',
    name: 'Primeira Patrulha',
    minHeroes: 1,
    durationMs: 30_000,
    rewardMin: 2,
    rewardMax: 20,
    statWeights: { hp: 0.2, atk: 1.0, mp: 0.1 },
    scale: 1.0,
  },
  {
    id: 'mission_2',
    name: 'Expedição',
    minHeroes: 2,
    durationMs: 60_000,
    rewardMin: 10,
    rewardMax: 80,
    statWeights: { hp: 0.3, atk: 1.2, mp: 0.2 },
    scale: 1.15,
  },
];

