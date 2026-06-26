import type { MaterialId } from './materials';

export type ChestTier = 'bronze' | 'silver' | 'gold';

export interface MaterialReward {
  kind: 'material';
  id: MaterialId;
  qty: number;
}

export interface EquipmentReward {
  kind: 'equipment';
  tier: number;
}

export type ChestRewardEntry = MaterialReward | EquipmentReward;

/**
 * Recompensas por tier de baú. Nunca incluem gold (invariante anti-P2W).
 * A seleção é feita por rng injetável em handleOpenKeyChest.
 */
export const KEY_CHEST_REWARDS: Record<ChestTier, ChestRewardEntry[]> = {
  bronze: [
    { kind: 'material', id: 'iron', qty: 8 },
    { kind: 'material', id: 'crystal', qty: 4 },
    { kind: 'material', id: 'essence', qty: 3 },
    { kind: 'equipment', tier: 1 },
  ],
  silver: [
    { kind: 'material', id: 'crystal', qty: 10 },
    { kind: 'material', id: 'essence', qty: 8 },
    { kind: 'material', id: 'starstone', qty: 2 },
    { kind: 'equipment', tier: 2 },
  ],
  gold: [
    { kind: 'material', id: 'essence', qty: 12 },
    { kind: 'material', id: 'starstone', qty: 5 },
    { kind: 'equipment', tier: 3 },
    { kind: 'equipment', tier: 3 },
  ],
};
