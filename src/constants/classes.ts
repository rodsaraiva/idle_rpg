import { ClassId } from '../types';

export interface ClassDef {
  id: ClassId;
  displayName: string;
  baseStatDelta?: { hp?: number; atk?: number; mp?: number };
  // trainSpeed >1 means faster training (time per point is divided by this)
  trainSpeed?: { hp?: number; atk?: number; mp?: number };
  // passive multipliers for mission calculation
  missionMultiplier?: { hp?: number; atk?: number; mp?: number; scale?: number };
  // ability only for chosen classes (ROGUE, HEALER)
  ability?: 'ROGUE_BONUS' | 'HEALER_BUFF';
  attackType?: 'MELEE' | 'RANGED';
}

export const CLASS_DEFS: Record<ClassId, ClassDef> = {
  WARRIOR: {
    id: 'WARRIOR',
    displayName: 'Guerreiro',
    baseStatDelta: { hp: 3, atk: 2 },
    trainSpeed: { atk: 1.1 },
    missionMultiplier: { atk: 1.05 },
    attackType: 'MELEE',
  },
  TANK: {
    id: 'TANK',
    displayName: 'Tanque',
    baseStatDelta: { hp: 8 },
    trainSpeed: { hp: 1.15 },
    missionMultiplier: { hp: 1.1 },
    attackType: 'MELEE',
  },
  ROGUE: {
    id: 'ROGUE',
    displayName: 'Ladino',
    baseStatDelta: { atk: 1 },
    trainSpeed: { atk: 1.05 },
    ability: 'ROGUE_BONUS',
    attackType: 'MELEE',
  },
  ARCHER: {
    id: 'ARCHER',
    displayName: 'Arqueiro',
    baseStatDelta: { atk: 2 },
    trainSpeed: { atk: 1.07 },
    attackType: 'RANGED',
  },
  MAGE: {
    id: 'MAGE',
    displayName: 'Mago',
    baseStatDelta: { mp: 4 },
    trainSpeed: { mp: 1.2 },
    missionMultiplier: { mp: 1.15 },
    attackType: 'RANGED',
  },
  HEALER: {
    id: 'HEALER',
    displayName: 'Curandeiro',
    baseStatDelta: { mp: 2 },
    trainSpeed: { mp: 1.05 },
    ability: 'HEALER_BUFF',
    attackType: 'RANGED',
  },
};

