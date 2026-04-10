import { BattleEngine } from '../../utils/battleEngine';

describe('BattleEngine', () => {
  const mockRng = (val: number) => () => val;

  test('selectTarget picks highest-score target based on distance and HP', () => {
    const attacker = { id: 'a1', attackType: 'MELEE' as const, range: 1 };
    const candidates = [
      { id: 'e1', hp: 10, position: 5, classId: 'WARRIOR' },
      { id: 'e2', hp: 20, position: 1, classId: 'WARRIOR' },
      { id: 'e3', hp: 5, position: 2, classId: 'WARRIOR' },
    ];
    // With rng=0 (never picks second-best), attacker at pos 0 prefers closest
    const target = BattleEngine.selectTarget(attacker, 0, candidates, mockRng(0));
    expect(target).toBeDefined();
  });

  test('selectTarget returns undefined for empty candidates', () => {
    const attacker = { id: 'a1' };
    const target = BattleEngine.selectTarget(attacker, 0, [], mockRng(0.5));
    expect(target).toBeUndefined();
  });

  test('calculateAttack returns miss when roll > hitChance', () => {
    const attacker = { id: 'a1', atk: 10, defense: 5, crit: 5, agility: 10 };
    const target = { id: 't1', hp: 100, defense: 5, crit: 5, agility: 10 };
    const result = BattleEngine.calculateAttack(attacker, target, 0.5, 'hero', 1, mockRng(0.6));
    expect(result?.action.actionType).toBe('miss');
    expect(result?.dmg).toBe(0);
  });

  test('calculateAttack returns hit with damage when roll <= hitChance', () => {
    const attacker = { id: 'a1', atk: 10, defense: 5, crit: 5, agility: 10 };
    const target = { id: 't1', hp: 100, defense: 5, crit: 5, agility: 10 };
    const result = BattleEngine.calculateAttack(attacker, target, 0.8, 'hero', 1, mockRng(0.5));
    expect(result?.action.actionType).toBe('hit');
    expect(result?.dmg).toBeGreaterThan(0);
  });
});
