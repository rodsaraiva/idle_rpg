import { GameMath } from '../../utils/gameMath';

describe('GameMath', () => {
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
