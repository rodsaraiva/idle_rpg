import { BattleEngine } from '../../utils/battleEngine';

describe('BattleEngine', () => {
  const mockRng = (val: number) => () => val;

  test('selectTarget selects highest HP target for MELEE (roll < 70)', () => {
    const candidates = [{ hp: 10 }, { hp: 20 }, { hp: 5 }];
    const target = BattleEngine.selectTarget('MELEE', candidates, mockRng(0.5));
    expect(target?.hp).toBe(20);
  });

  test('selectTarget selects lowest HP target for RANGED (roll < 60)', () => {
    const candidates = [{ hp: 10 }, { hp: 20 }, { hp: 5 }];
    const target = BattleEngine.selectTarget('RANGED', candidates, mockRng(0.5));
    expect(target?.hp).toBe(5);
  });

  test('calculateAttack returns miss when roll > hitChance', () => {
    const attacker = { id: 'a1', atk: 10 };
    const target = { id: 't1', hp: 100 };
    const result = BattleEngine.calculateAttack(attacker, target, 0.5, 'hero', 1, mockRng(0.6));
    expect(result?.action.actionType).toBe('miss');
    expect(result?.dmg).toBe(0);
  });

  test('calculateAttack returns hit with damage when roll <= hitChance', () => {
    const attacker = { id: 'a1', atk: 10 };
    const target = { id: 't1', hp: 100 };
    const result = BattleEngine.calculateAttack(attacker, target, 0.8, 'hero', 1, mockRng(0.5));
    expect(result?.action.actionType).toBe('hit');
    expect(result?.dmg).toBeGreaterThan(0);
  });
});
