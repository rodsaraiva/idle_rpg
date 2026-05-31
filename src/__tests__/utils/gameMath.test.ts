import { GameMath } from '../../utils/gameMath';

describe('GameMath - Basic', () => {
  test('getRecruitCost increases exponentially', () => {
    const cost0 = GameMath.getRecruitCost(0);
    const cost1 = GameMath.getRecruitCost(1);
    const cost2 = GameMath.getRecruitCost(2);
    expect(cost1).toBeGreaterThan(cost0);
    expect(cost2).toBeGreaterThan(cost1);
  });

  test('formatNumber formats thousands to K', () => {
    expect(GameMath.formatNumber(1500)).toBe('1.5K');
    expect(GameMath.formatNumber(1500000)).toBe('1.5M');
  });

  test('calcHitChance caps at 0.98', () => {
    expect(GameMath.calcHitChance(1000)).toBe(0.98);
  });
});

describe('GameMath - Combat Formulas', () => {
  describe('calcHitChance (Evasion diminishing returns)', () => {
    test('should return base hit chance when agility is 0', () => {
      expect(GameMath.calcHitChance(0, 0)).toBeCloseTo(0.75);
    });

    test('should apply exactly 50% evasion when agility is 50', () => {
      expect(GameMath.calcHitChance(0, 50)).toBeCloseTo(0.25);
    });

    test('should never return less than 0.05 hit chance', () => {
      expect(GameMath.calcHitChance(0, 1000)).toBe(0.05);
    });
  });

  describe('calcCritChance (Crit diminishing returns)', () => {
    test('should return base crit chance for non-rogue when crit attribute is 0', () => {
      expect(GameMath.calcCritChance('WARRIOR', 0)).toBeCloseTo(0.05);
    });

    test('should return base crit chance + 0.05 for rogue', () => {
      expect(GameMath.calcCritChance('ROGUE', 0)).toBeCloseTo(0.10);
    });

    test('should gain exactly 50% bonus crit from 100 crit attribute', () => {
      expect(GameMath.calcCritChance('WARRIOR', 100)).toBeCloseTo(0.55);
    });
  });

  describe('calcDamage (Defense diminishing returns)', () => {
    test('should deal full damage when defense is 0', () => {
      expect(GameMath.calcDamage(100, 0)).toBe(100);
    });

    test('should deal ~33% damage when defense is 100 (Def/(Def+50) formula)', () => {
      // mitigationFactor = 1 - 100/(100+50) = 1 - 0.667 = 0.333
      // floor(100 * 0.333) = 33
      expect(GameMath.calcDamage(100, 100)).toBe(33);
    });

    test('should apply crit multiplier (1.5x) before defense mitigation', () => {
      // baseDmg = 100 * 1.5 = 150; mitigation: 1 - 100/150 = 0.333; floor(50) = 50
      expect(GameMath.calcDamage(100, 100, true)).toBe(50);
    });

    test('should always deal at least 1 damage', () => {
      expect(GameMath.calcDamage(1, 9999)).toBe(1);
    });
  });
});

describe('GameMath - Hexagonal Geometry', () => {
  test('getHexCoords should return axial coordinates (0,0,0) for pos 0', () => {
    const coords = GameMath.getHexCoords(0);
    expect(coords.x).toBe(0);
    expect(Object.is(coords.y, -0) || Object.is(coords.y, 0)).toBe(true);
    expect(coords.z).toBe(0);
  });

  test('getHexDistance between adjacent cells should be 1', () => {
    expect(GameMath.getHexDistance(0, 1)).toBe(1);
    expect(GameMath.getHexDistance(0, 5)).toBe(1);
  });

  test('getHexDistance between row 7 and row 2 should be at least 5', () => {
    const heroPos = 7 * 5 + 0;
    const enemyPos = 2 * 5 + 0;
    expect(GameMath.getHexDistance(heroPos, enemyPos)).toBeGreaterThanOrEqual(5);
  });
});
