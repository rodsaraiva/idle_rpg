import {
  getDropsForEnemy,
  hasEnoughMaterials,
  deductMaterials,
  ForgeRecipe,
} from '../../constants/materials';

describe('getDropsForEnemy', () => {
  test('returns empty array when rng() >= chance (no drop)', () => {
    // enemy with hp=10, atk=10 → chance = min(0.8, 20/100) = 0.2
    // rng returns 0.5 first call → 0.5 >= 0.2, so no drop
    const enemy = { hp: 10, atk: 10, attackType: 'MELEE' as const };
    const rng = jest.fn().mockReturnValue(0.5);
    const drops = getDropsForEnemy(enemy, 1, rng);
    expect(drops).toEqual([]);
  });

  test('MELEE enemy drops iron on low roll', () => {
    // enemy with hp=50, atk=50 → chance = min(0.8, 100/100) = 0.8
    // first rng call: 0.1 < 0.8 → drop occurs
    // second rng call (material roll): 0.1 < 0.80 → iron
    const enemy = { hp: 50, atk: 50, attackType: 'MELEE' as const };
    const rng = jest.fn()
      .mockReturnValueOnce(0.1)   // chance check: 0.1 < 0.8 → drop
      .mockReturnValueOnce(0.1);  // material roll: 0.1 < 0.80 → iron
    const drops = getDropsForEnemy(enemy, 1, rng);
    expect(drops).toHaveLength(1);
    expect(drops[0].materialId).toBe('iron');
    expect(drops[0].quantity).toBe(1);
  });

  test('RANGED enemy drops crystal on low roll', () => {
    // enemy with hp=50, atk=50 → chance = 0.8
    // first rng: 0.1 < 0.8 → drop occurs
    // second rng: 0.1 < 0.80 → crystal
    const enemy = { hp: 50, atk: 50, attackType: 'RANGED' as const };
    const rng = jest.fn()
      .mockReturnValueOnce(0.1)   // chance check
      .mockReturnValueOnce(0.1);  // material roll → crystal
    const drops = getDropsForEnemy(enemy, 1, rng);
    expect(drops).toHaveLength(1);
    expect(drops[0].materialId).toBe('crystal');
    expect(drops[0].quantity).toBe(1);
  });

  test('quantity scales with difficulty', () => {
    // difficulty 6 → quantity = 1 + floor(6/3) = 3
    const enemy = { hp: 50, atk: 50, attackType: 'MELEE' as const };
    const rng = jest.fn()
      .mockReturnValueOnce(0.1)   // chance check
      .mockReturnValueOnce(0.1)   // material roll → iron
      .mockReturnValueOnce(0.5);  // starstone check: 0.5 >= 0.02 → no starstone
    const drops = getDropsForEnemy(enemy, 6, rng);
    expect(drops).toHaveLength(1);
    expect(drops[0].quantity).toBe(3);
  });

  test('starstone drops when difficulty >= 4 and rng < 0.02', () => {
    const enemy = { hp: 50, atk: 50, attackType: 'MELEE' as const };
    const rng = jest.fn()
      .mockReturnValueOnce(0.1)    // chance check
      .mockReturnValueOnce(0.1)    // material roll → iron
      .mockReturnValueOnce(0.01);  // starstone check: 0.01 < 0.02 → starstone drops
    const drops = getDropsForEnemy(enemy, 4, rng);
    expect(drops).toHaveLength(2);
    expect(drops[1].materialId).toBe('starstone');
  });

  test('starstone does NOT drop when difficulty < 4', () => {
    const enemy = { hp: 50, atk: 50, attackType: 'MELEE' as const };
    const rng = jest.fn()
      .mockReturnValueOnce(0.1)    // chance check
      .mockReturnValueOnce(0.1);   // material roll → iron (no starstone check called)
    const drops = getDropsForEnemy(enemy, 3, rng);
    // No starstone drop, rng should only be called twice
    expect(drops).toHaveLength(1);
    expect(drops.every(d => d.materialId !== 'starstone')).toBe(true);
    expect(rng).toHaveBeenCalledTimes(2);
  });
});

describe('hasEnoughMaterials', () => {
  test('returns true when player has enough materials', () => {
    const recipe: ForgeRecipe = { materials: { iron: 3 }, gold: 10 };
    const playerMaterials = { iron: 5, crystal: 2 };
    expect(hasEnoughMaterials(playerMaterials, recipe)).toBe(true);
  });

  test('returns false when player lacks materials', () => {
    const recipe: ForgeRecipe = { materials: { iron: 3, essence: 2 }, gold: 30 };
    const playerMaterials = { iron: 2 };
    expect(hasEnoughMaterials(playerMaterials, recipe)).toBe(false);
  });
});

describe('deductMaterials', () => {
  test('deducts materials correctly and returns new record', () => {
    const recipe: ForgeRecipe = { materials: { iron: 3, crystal: 2 }, gold: 10 };
    const playerMaterials = { iron: 10, crystal: 5, essence: 3 };
    const result = deductMaterials(playerMaterials, recipe);
    expect(result.iron).toBe(7);
    expect(result.crystal).toBe(3);
    expect(result.essence).toBe(3);
    // original not mutated
    expect(playerMaterials.iron).toBe(10);
  });
});
