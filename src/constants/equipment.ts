import { Rarity } from '../theme/tokens/rarity';

export interface EquipmentTemplate {
  type: 'weapon' | 'armor' | 'accessory';
  names: string[];
  statRange: { stat: string; min: number; max: number }[];
}

export const EQUIPMENT_TIERS: { tier: number; label: string; cost: number; forgeTimeMs: number; rarity: Rarity }[] = [
  { tier: 1, label: 'Comum', cost: 50, forgeTimeMs: 30_000, rarity: 'common' },
  { tier: 2, label: 'Raro', cost: 150, forgeTimeMs: 60_000, rarity: 'rare' },
  { tier: 3, label: 'Épico', cost: 400, forgeTimeMs: 120_000, rarity: 'epic' },
];

export const EQUIPMENT_TEMPLATES: EquipmentTemplate[] = [
  { type: 'weapon', names: ['Espada', 'Machado', 'Arco', 'Cajado', 'Adaga'], statRange: [{ stat: 'atk', min: 2, max: 8 }] },
  { type: 'armor', names: ['Escudo', 'Armadura', 'Manto', 'Cota'], statRange: [{ stat: 'defense', min: 3, max: 10 }, { stat: 'hp', min: 2, max: 6 }] },
  { type: 'accessory', names: ['Anel', 'Amuleto', 'Capa', 'Botas'], statRange: [{ stat: 'crit', min: 2, max: 8 }, { stat: 'agility', min: 2, max: 8 }] },
];

export const MAX_EQUIPPED_ITEMS = 2;
