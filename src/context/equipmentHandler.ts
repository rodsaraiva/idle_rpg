import { GameState, Equipment } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { EQUIPMENT_TIERS, EQUIPMENT_TEMPLATES, MAX_EQUIPPED_ITEMS } from '../constants/equipment';
import { updateDailyProgress } from './dailyQuestHandler';
import { emitFirstTierForged } from '../services/milestones';
import { FORGE_RECIPES, hasEnoughMaterials, deductMaterials, EquipmentType } from '../constants/materials';

function generateEquipment(tier: number, equipmentType?: 'weapon' | 'armor' | 'accessory'): Equipment {
  const templates = equipmentType
    ? EQUIPMENT_TEMPLATES.filter(t => t.type === equipmentType)
    : EQUIPMENT_TEMPLATES;
  const template = templates[Math.floor(Math.random() * templates.length)];
  const name = template.names[Math.floor(Math.random() * template.names.length)];
  const tierDef = EQUIPMENT_TIERS.find(t => t.tier === tier)!;
  const statBonus: Record<string, number> = {};
  for (const sr of template.statRange) {
    const tierMin = sr.min * tier;
    const tierMax = sr.max * tier;
    statBonus[sr.stat] = tierMin + Math.floor(Math.random() * (tierMax - tierMin + 1));
  }
  return { id: uuidv4(), name: `${name} ${tierDef.label}`, type: template.type, statBonus, tier };
}

export function handleForgeEquipment(state: GameState, tier: number, equipmentType: EquipmentType, now: number): GameState {
  const tierDef = EQUIPMENT_TIERS.find(t => t.tier === tier);
  if (!tierDef) return state;
  const recipe = FORGE_RECIPES[tier]?.[equipmentType];
  if (!recipe) return state;
  if (state.gold < recipe.gold) return state;
  if (!hasEnoughMaterials(state.materials ?? {}, recipe)) return state;
  const equipment = generateEquipment(tier, equipmentType);
  const existingOfTier = (state.inventory ?? []).filter((eq: any) => eq.tier === tier);
  if (existingOfTier.length === 0) {
    const tierDef2 = EQUIPMENT_TIERS.find(t => t.tier === tier);
    if (tierDef2) emitFirstTierForged(tierDef2.label);
  }
  const finishAt = now + tierDef.forgeTimeMs;
  const materials = deductMaterials(state.materials ?? {}, recipe);
  const newState = {
    ...state,
    gold: state.gold - recipe.gold,
    materials,
    forgingQueue: [...(state.forgingQueue || []), { equipmentId: equipment.id, finishAt }],
    inventory: [...(state.inventory || []), equipment],
  };
  return updateDailyProgress(newState, 'itemsForged', 1);
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
