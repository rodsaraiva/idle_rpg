import { GameState } from '../types';

export interface LegacySeal {
  id: string;
  name: string;
  icon: string;
  condition: (s: GameState) => boolean;
  exp: number;
}

/** Cada nível de Legado exige esta quantidade de exp acumulada. */
export function legacyExpThreshold(level: number): number {
  return (level + 1) * 100;
}

const cleared = (s: GameState, missionId: string): boolean =>
  (s.completedMissionIds ?? []).includes(missionId);

export const LEGACY_SEALS: LegacySeal[] = [
  {
    id: 'seal_costa',
    name: 'Guardião da Costa',
    icon: '🌊',
    condition: (s) => cleared(s, 'z2_costa_1'),
    exp: 50,
  },
  {
    id: 'seal_costa_boss',
    name: 'Vencedor do Capitão',
    icon: '⚓',
    condition: (s) => cleared(s, 'z2_costa_2'),
    exp: 60,
  },
  {
    id: 'seal_picos',
    name: 'Escalador dos Picos',
    icon: '🏔️',
    condition: (s) => cleared(s, 'z3_picos_1'),
    exp: 70,
  },
  {
    id: 'seal_picos_boss',
    name: 'Sobrevivente da Tempestade',
    icon: '❄️',
    condition: (s) => cleared(s, 'z3_picos_2'),
    exp: 80,
  },
  {
    id: 'seal_abismo',
    name: 'Explorador do Abismo',
    icon: '🕳️',
    condition: (s) => cleared(s, 'z4_abismo_1'),
    exp: 100,
  },
  {
    id: 'seal_abismo_boss',
    name: 'Senhor das Profundezas',
    icon: '👑',
    condition: (s) => cleared(s, 'z4_abismo_boss'),
    exp: 150,
  },
];
