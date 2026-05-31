import { MATERIALS, FORGE_RECIPES, hasEnoughMaterials, ForgeRecipe, MaterialId } from '../../constants/materials';

function getMissingMaterials(
  playerMaterials: Partial<Record<MaterialId, number>>,
  recipe: ForgeRecipe
): Array<{ name: string; icon: string; have: number; need: number }> {
  return MATERIALS
    .filter(m => (recipe.materials[m.id] ?? 0) > 0)
    .map(m => ({
      name: m.name,
      icon: m.icon,
      have: playerMaterials[m.id] ?? 0,
      need: recipe.materials[m.id] ?? 0,
    }))
    .filter(r => r.have < r.need);
}

describe('BlacksmithScreen materials derivations', () => {
  test('MATERIALS lista os 4 tipos', () => {
    expect(MATERIALS).toHaveLength(4);
    expect(MATERIALS.map(m => m.id)).toEqual(
      expect.arrayContaining(['iron', 'crystal', 'essence', 'starstone'])
    );
  });

  test('FORGE_RECIPES tier 1 weapon requer 3 iron', () => {
    const recipe = FORGE_RECIPES[1].weapon;
    expect(recipe.materials.iron).toBe(3);
  });

  test('getMissingMaterials: sem materiais → lista completa de faltantes', () => {
    const recipe = FORGE_RECIPES[1].weapon; // requer iron: 3
    const missing = getMissingMaterials({}, recipe);
    expect(missing).toHaveLength(1);
    expect(missing[0].name).toBe('Fragmento de Ferro');
    expect(missing[0].have).toBe(0);
    expect(missing[0].need).toBe(3);
  });

  test('getMissingMaterials: com materiais suficientes → lista vazia', () => {
    const recipe = FORGE_RECIPES[1].weapon; // iron: 3
    const missing = getMissingMaterials({ iron: 5 }, recipe);
    expect(missing).toHaveLength(0);
  });

  test('getMissingMaterials: com materiais parciais → lista parcial', () => {
    const recipe = FORGE_RECIPES[2].weapon; // iron: 8, essence: 2
    const missing = getMissingMaterials({ iron: 5 }, recipe);
    expect(missing).toHaveLength(2); // iron faltando 3, essence faltando 2
    const ironEntry = missing.find(m => m.name === 'Fragmento de Ferro');
    expect(ironEntry?.have).toBe(5);
    expect(ironEntry?.need).toBe(8);
  });

  test('hasEnoughMaterials: true quando tem o suficiente', () => {
    const recipe = FORGE_RECIPES[1].weapon;
    expect(hasEnoughMaterials({ iron: 3 }, recipe)).toBe(true);
  });

  test('hasEnoughMaterials: false quando falta material', () => {
    const recipe = FORGE_RECIPES[1].weapon;
    expect(hasEnoughMaterials({ iron: 2 }, recipe)).toBe(false);
  });
});
