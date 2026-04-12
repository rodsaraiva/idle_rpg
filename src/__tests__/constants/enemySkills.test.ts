import { ENEMY_SKILL_POOL, assignEnemySkills } from '../../constants/enemySkills';

describe('enemySkills', () => {
  test('pool has 8 skills', () => {
    expect(ENEMY_SKILL_POOL).toHaveLength(8);
  });

  test('difficulty 1 assigns 0-1 skills from minDifficulty <= 1', () => {
    // rng always < 0.5 → may get 1 skill
    const rngLow = () => 0.3;
    const result = assignEnemySkills(1, false, rngLow);
    expect(result.length).toBeLessThanOrEqual(1);
    result.forEach(skill => {
      expect(skill.minDifficulty).toBeLessThanOrEqual(1);
    });
  });

  test('difficulty 5 assigns up to 3 skills', () => {
    // rng always < 0.5 so we won't short-circuit
    let call = 0;
    const rng = () => {
      call++;
      return 0.1 * (call % 9); // deterministic, stays < 1
    };
    const result = assignEnemySkills(5, false, rng);
    expect(result.length).toBeLessThanOrEqual(3);
    result.forEach(skill => {
      expect(skill.minDifficulty).toBeLessThanOrEqual(5);
    });
  });

  test('boss always gets BOSS_FURY', () => {
    // Use various rng seeds to confirm BOSS_FURY always appears
    const seeds = [0.1, 0.3, 0.6, 0.9];
    for (const seed of seeds) {
      let toggle = false;
      const rng = () => {
        toggle = !toggle;
        return toggle ? seed : 1 - seed;
      };
      const result = assignEnemySkills(6, true, rng);
      expect(result.some(s => s.id === 'BOSS_FURY')).toBe(true);
    }
  });

  test('low difficulty can return empty when rng > 0.5', () => {
    // rng always > 0.5 → early exit, returns []
    const rngHigh = () => 0.9;
    const result = assignEnemySkills(1, false, rngHigh);
    expect(result).toHaveLength(0);
  });
});
