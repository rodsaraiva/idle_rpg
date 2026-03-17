import { GameMath } from '../gameMath';

describe('GameMath - Combat Formulas', () => {
  describe('calcHitChance (Evasion diminishing returns)', () => {
    test('should return base hit chance when agility is 0', () => {
      const atk = 0;
      const agi = 0;
      // Base hit chance: 0.75 + 0 * 0.02 = 0.75
      // Evasion: 0 / (0 + 50) = 0
      // Final: 0.75
      expect(GameMath.calcHitChance(atk, agi)).toBeCloseTo(0.75);
    });

    test('should apply exaclty 50% evasion when agility is 50', () => {
      const atk = 0;
      const agi = 50;
      // Base: 0.75
      // Evasion: 50 / (50 + 50) = 0.5
      // Final: 0.75 - 0.5 = 0.25
      expect(GameMath.calcHitChance(atk, agi)).toBeCloseTo(0.25);
    });

    test('should never return less than 0.05 hit chance', () => {
      const atk = 0;
      const agi = 1000;
      // Base: 0.75
      // Evasion: 1000 / 1050 = 0.952
      // Final: 0.75 - 0.952 = -0.202 -> capped to 0.05
      expect(GameMath.calcHitChance(atk, agi)).toBe(0.05);
    });
  });

  describe('calcCritChance (Crit diminishing returns)', () => {
    test('should return base crit chance for non-rogue when crit attribute is 0', () => {
      // Base: 0.05
      expect(GameMath.calcCritChance('WARRIOR', 0)).toBeCloseTo(0.05);
    });

    test('should return base crit chance + 0.05 for rogue', () => {
      // Base: 0.05 + 0.05 = 0.10
      expect(GameMath.calcCritChance('ROGUE', 0)).toBeCloseTo(0.10);
    });

    test('should gain exactly 50% bonus crit from 100 crit attribute', () => {
      // Bonus: 100 / (100 + 100) = 0.5
      // Total (Warrior): 0.05 + 0.5 = 0.55
      expect(GameMath.calcCritChance('WARRIOR', 100)).toBeCloseTo(0.55);
    });
  });

  describe('calcDamage (Defense diminishing returns)', () => {
    test('should deal full damage when defense is 0', () => {
      const atk = 100;
      const def = 0;
      // Mitigation: 100 / (100 + 0) = 1.0
      expect(GameMath.calcDamage(atk, def)).toBe(100);
    });

    test('should deal 50% damage when defense is 100', () => {
      const atk = 100;
      const def = 100;
      // Mitigation: 100 / (100 + 100) = 0.5
      expect(GameMath.calcDamage(atk, def)).toBe(50);
    });

    test('should apply crit before defense mitigation', () => {
      const atk = 100;
      const def = 100;
      // Base Crit Dmg: 100 * 1.5 = 150 (CRIT_MULTIPLIER = 1.5)
      // Mitigation: 150 * 0.5 = 75
      expect(GameMath.calcDamage(atk, def, true)).toBe(75);
    });

    test('should always deal at least 1 damage', () => {
      const atk = 1;
      const def = 9999;
      expect(GameMath.calcDamage(atk, def)).toBe(1);
    });
  });
});

describe('GameMath - Hexagonal Geometry', () => {
  test('getHexCoords should return axial coordinates (0, 0, 0) for pos 0', () => {
    // Pos 0: r=0, c=0. x = 0 - (0 >> 1) = 0. z = 0. y = -0-0 = 0.
    const coords = GameMath.getHexCoords(0);
    expect(coords.x).toBe(0);
    expect(Object.is(coords.y, -0) || Object.is(coords.y, 0)).toBe(true);
    expect(coords.z).toBe(0);
  });

  test('getHexDistance between adjacent cells should be 1', () => {
    // Pos 0 (0,0) and Pos 1 (1,0) are horizontal neighbors in row 0
    expect(GameMath.getHexDistance(0, 1)).toBe(1);
    // Pos 0 (0,0) and Pos 5 (0,1) are vertical/diagonal neighbors
    // Row 0, Col 0 -> (0,0,0)
    // Row 1, Col 0 -> r=1, c=0. x = 0 - (1 >> 1) = 0. z = 1. y = -1. (0, -1, 1)
    // Distance: max(|0-0|, |0-(-1)|, |0-1|) = 1
    expect(GameMath.getHexDistance(0, 5)).toBe(1);
  });

  test('getHexDistance between row 7 and row 2 should be at least 5', () => {
    const heroPos = 7 * 5 + 0; // Row 7, Col 0 (pos 35)
    const enemyPos = 2 * 5 + 0; // Row 2, Col 0 (pos 10)
    // Vertical distance is z2 - z1 = 7 - 2 = 5
    expect(GameMath.getHexDistance(heroPos, enemyPos)).toBeGreaterThanOrEqual(5);
  });
});
