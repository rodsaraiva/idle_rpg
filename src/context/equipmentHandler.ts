import { GameState, Equipment } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { EQUIPMENT_TIERS, EQUIPMENT_TEMPLATES, MAX_EQUIPPED_ITEMS } from '../constants/equipment';

function generateEquipment(tier: number): Equipment {
  const template = EQUIPMENT_TEMPLATES[Math.floor(Math.random() * EQUIPMENT_TEMPLATES.length)];
  const name = template.names[Math.floor(Math.random() * template.names.length)];
  const tierDef = EQUIPMENT_TIERS.find(t => t.tier === tier)!;
  const statBonus: any = {};
  for (const sr of template.statRange) {
    const range = sr.max - sr.min;
    statBonus[sr.stat] = sr.min + Math.floor(Math.random() * range * tier * 0.7);
  }
  return { id: uuidv4(), name: `${name} ${tierDef.label}`, type: template.type, statBonus, tier };
}

export function handleForgeEquipment(state: GameState, tier: number, now: number): GameState {
  const tierDef = EQUIPMENT_TIERS.find(t => t.tier === tier);
  if (!tierDef || state.gold < tierDef.cost) return state;
  const equipment = generateEquipment(tier);
  const finishAt = now + tierDef.forgeTimeMs;
  return {
    ...state,
    gold: state.gold - tierDef.cost,
    forgingQueue: [...(state.forgingQueue || []), { equipmentId: equipment.id, finishAt }],
    inventory: [...(state.inventory || []), equipment],
  };
}

export function handleCollectEquipment(state: GameState, equipmentId: string): GameState {
  return {
    ...state,
    forgingQueue: (state.forgingQueue || []).filter(f => f.equipmentId !== equipmentId),
  };
}

export function handleEquipItem(state: GameState, heroId: string, equipmentId: string): GameState {
  const hero = state.heroes.find(h => h.id === heroId);
  const item = (state.inventory || []).find(e => e.id === equipmentId);
  if (!hero || !item) return state;
  const equipped = hero.equippedItems || [];
  if (equipped.length >= MAX_EQUIPPED_ITEMS) return state;
  if (equipped.includes(equipmentId)) return state;
  // Check no other hero has this item
  const alreadyEquipped = state.heroes.some(h => (h.equippedItems || []).includes(equipmentId));
  if (alreadyEquipped) return state;
  return {
    ...state,
    heroes: state.heroes.map(h => h.id === heroId ? { ...h, equippedItems: [...equipped, equipmentId] } : h),
  };
}

export function handleUnequipItem(state: GameState, heroId: string, equipmentId: string): GameState {
  return {
    ...state,
    heroes: state.heroes.map(h => h.id === heroId ? { ...h, equippedItems: (h.equippedItems || []).filter(id => id !== equipmentId) } : h),
  };
}
