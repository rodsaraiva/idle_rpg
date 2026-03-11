import { BattleEngine } from '../../utils/battleEngine';

describe('BattleEngine - New Attributes', () => {
  const mockRng = (val: number) => () => val;

  test('Defense reduces damage taken', () => {
    // Attacker with 10 ATK
    const attacker = { id: 'hero1', atk: 10, name: 'Hero' };
    // Target with 5 defense
    const target = { id: 'enemy1', defense: 5, name: 'Enemy' };
    
    // hitChance 1.0 (always hits), rng 0.1 (not a crit)
    const result = BattleEngine.calculateAttack(attacker, target as any, 1.0, 'hero', 1, mockRng(0.1));
    
    // Expected damage: atk (10) - defense (5) = 5
    // Current implementation ignores defense, so this will return 10.
    expect(result?.dmg).toBe(5);
  });

  test('Agility increases miss chance (evasion)', () => {
    // Attacker
    const attacker = { id: 'hero1', atk: 10, name: 'Hero' };
    // Target with high agility (e.g. 50)
    const target = { id: 'enemy1', agility: 50, name: 'Enemy' };
    
    // Base hit chance 0.8
    // With 50 agility, maybe miss chance increases by 25% (0.5 * agility) -> effective hit chance 0.8 - 0.25 = 0.55
    // Current implementation ignores agility.
    
    const result = BattleEngine.calculateAttack(attacker, target as any, 0.8, 'hero', 1, mockRng(0.8));
    // 0.8 > 0.7 (effective hit chance with agility), so it should miss.
    expect(result?.action.actionType).toBe('miss');
  });

  test('Crit attribute increases crit chance', () => {
    // Attacker with 20 crit attribute
    const attacker = { id: 'hero1', atk: 10, crit: 20, name: 'Hero' };
    const target = { id: 'enemy1', name: 'Enemy' };
    
    // Base crit chance is 0.05. 
    // If 20 crit attribute adds 10% (0.5 * crit) -> total 0.15
    // Current implementation uses classId or base chance.
    
    const result = BattleEngine.calculateAttack(attacker as any, target, 1.0, 'hero', 1, mockRng(0.12));
    // 0.12 < 0.15, so it should crit.
    // Current implementation 0.12 > 0.05, so it won't crit.
    expect(result?.action.isCrit).toBe(true);
  });
});
