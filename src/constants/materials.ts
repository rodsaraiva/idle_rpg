export type MaterialId = 'iron' | 'crystal' | 'essence' | 'starstone';

export interface MaterialDef {
  id: MaterialId;
  name: string;
  icon: string;
}

export const MATERIALS: MaterialDef[] = [
  { id: 'iron', name: 'Fragmento de Ferro', icon: '⛏️' },
  { id: 'crystal', name: 'Cristal Arcano', icon: '💎' },
  { id: 'essence', name: 'Essência Vital', icon: '🧬' },
  { id: 'starstone', name: 'Pedra Estelar', icon: '🌟' },
];

export interface ForgeRecipe {
  materials: Partial<Record<MaterialId, number>>;
  gold: number;
}

export type EquipmentType = 'weapon' | 'armor' | 'accessory';

export const FORGE_RECIPES: Record<number, Record<EquipmentType, ForgeRecipe>> = {
  1: {
    weapon:    { materials: { iron: 3 }, gold: 10 },
    armor:     { materials: { essence: 3 }, gold: 10 },
    accessory: { materials: { crystal: 3 }, gold: 10 },
  },
  2: {
    weapon:    { materials: { iron: 8, essence: 2 }, gold: 30 },
    armor:     { materials: { essence: 8, crystal: 2 }, gold: 30 },
    accessory: { materials: { crystal: 8, iron: 2 }, gold: 30 },
  },
  3: {
    weapon:    { materials: { iron: 15, crystal: 5, starstone: 2 }, gold: 80 },
    armor:     { materials: { essence: 15, iron: 5, starstone: 2 }, gold: 80 },
    accessory: { materials: { crystal: 15, essence: 5, starstone: 2 }, gold: 80 },
  },
};

export interface MaterialDrop {
  materialId: MaterialId;
  quantity: number;
}

type EnemyForDrop = { hp: number; atk: number; attackType?: 'MELEE' | 'RANGED' };

export function getDropsForEnemy(
  enemy: EnemyForDrop,
  missionDifficulty: number,
  rng: () => number
): MaterialDrop[] {
  const chance = Math.min(0.8, (enemy.hp + enemy.atk) / 100);
  if (rng() >= chance) return [];

  const quantity = 1 + Math.floor(missionDifficulty / 3);
  const drops: MaterialDrop[] = [];

  // Determine primary material based on attack type
  const roll = rng();
  let materialId: MaterialId;

  if (enemy.attackType === 'RANGED') {
    if (roll < 0.80) {
      materialId = 'crystal';
    } else if (roll < 0.90) {
      materialId = 'essence';
    } else {
      materialId = 'iron';
    }
  } else {
    // MELEE or undefined defaults to MELEE behavior
    if (roll < 0.80) {
      materialId = 'iron';
    } else if (roll < 0.90) {
      materialId = 'essence';
    } else {
      materialId = 'crystal';
    }
  }

  drops.push({ materialId, quantity });

  // Starstone: 2% chance only if difficulty >= 4
  if (missionDifficulty >= 4 && rng() < 0.02) {
    drops.push({ materialId: 'starstone', quantity: 1 });
  }

  return drops;
}

export function hasEnoughMaterials(
  playerMaterials: Partial<Record<MaterialId, number>>,
  recipe: ForgeRecipe
): boolean {
  for (const [matId, required] of Object.entries(recipe.materials) as [MaterialId, number][]) {
    const owned = playerMaterials[matId] ?? 0;
    if (owned < required) return false;
  }
  return true;
}

export function deductMaterials(
  playerMaterials: Partial<Record<MaterialId, number>>,
  recipe: ForgeRecipe
): Partial<Record<MaterialId, number>> {
  const result = { ...playerMaterials };
  for (const [matId, required] of Object.entries(recipe.materials) as [MaterialId, number][]) {
    result[matId] = (result[matId] ?? 0) - required;
  }
  return result;
}
