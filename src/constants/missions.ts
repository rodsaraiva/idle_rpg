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
    durationMs: 10_000,
    rewardMin: 1,
    rewardMax: 10,
    statWeights: { hp: 0.2, atk: 1.0, mp: 0.1 },
    scale: 1.0,
  },
  {
    id: 'mission_2',
    name: 'Expedição',
    minHeroes: 2,
    durationMs: 30_000,
    rewardMin: 5,
    rewardMax: 50,
    statWeights: { hp: 0.3, atk: 1.2, mp: 0.2 },
    scale: 1.15,
  },
  {
    id: 'mission_3',
    name: 'Assalto à Caravana',
    minHeroes: 3,
    durationMs: 60_000,
    rewardMin: 10,
    rewardMax: 100,
    statWeights: { hp: 0.25, atk: 1.25, mp: 0.15 },
    scale: 1.25,
  },
];

