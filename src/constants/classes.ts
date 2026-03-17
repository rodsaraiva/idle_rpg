import { ClassId } from '../types';

export interface ClassDef {
  id: ClassId;
  displayName: string;
  baseStatDelta?: { hp?: number; atk?: number; mp?: number; defense?: number; crit?: number; agility?: number };
  // trainSpeed >1 means faster training (time per point is divided by this)
  trainSpeed?: { hp?: number; atk?: number; mp?: number };
  // passive multipliers for mission calculation
  missionMultiplier?: { hp?: number; atk?: number; mp?: number; scale?: number };
  // ability only for chosen classes (ROGUE, HEALER)
  ability?: 'ROGUE_BONUS' | 'HEALER_BUFF';
  attackType?: 'MELEE' | 'RANGED';
  range: number;
}

export const CLASS_DEFS: Record<ClassId, ClassDef> = {
  WARRIOR: {
    id: 'WARRIOR',
    displayName: 'Guerreiro',
    baseStatDelta: { hp: 3, atk: 2, defense: 2, crit: 5, agility: 10 },
    trainSpeed: { hp: 1.1, atk: 1.3, mp: 0.5 },
    missionMultiplier: { atk: 1.05 },
    attackType: 'MELEE',
    range: 1,
  },
  TANK: {
    id: 'TANK',
    displayName: 'Tanque',
    baseStatDelta: { hp: 8, defense: 5, crit: 0, agility: 5 },
    trainSpeed: { hp: 1.6, atk: 0.6, mp: 0.4 },
    missionMultiplier: { hp: 1.1 },
    attackType: 'MELEE',
    range: 1,
  },
  ROGUE: {
    id: 'ROGUE',
    displayName: 'Ladino',
    baseStatDelta: { atk: 1, defense: 1, crit: 15, agility: 25 },
    trainSpeed: { hp: 0.7, atk: 1.4, mp: 0.6 },
    ability: 'ROGUE_BONUS',
    attackType: 'MELEE',
    range: 2,
  },
  ARCHER: {
    id: 'ARCHER',
    displayName: 'Arqueiro',
    baseStatDelta: { atk: 2, defense: 1, crit: 10, agility: 20 },
    trainSpeed: { hp: 0.6, atk: 1.5, mp: 0.5 },
    attackType: 'RANGED',
    range: 3,
  },
  MAGE: {
    id: 'MAGE',
    displayName: 'Mago',
    baseStatDelta: { mp: 4, defense: 0, crit: 5, agility: 10 },
    trainSpeed: { hp: 0.4, atk: 0.4, mp: 1.8 },
    missionMultiplier: { mp: 1.15 },
    attackType: 'RANGED',
    range: 4,
  },
  HEALER: {
    id: 'HEALER',
    displayName: 'Curandeiro',
    baseStatDelta: { mp: 2, defense: 1, crit: 2, agility: 12 },
    trainSpeed: { hp: 1.2, atk: 0.4, mp: 1.5 },
    ability: 'HEALER_BUFF',
    attackType: 'RANGED',
    range: 2,
  },
};

