import { BattleEngine, BattleState } from '../battleEngine';
import { HeroTask, Hero } from '../../types';

describe('BattleEngine - AI and Tactics', () => {
  const mockRng = () => 0.5; // Always mid-range to avoid randomness in tests

  describe('selectTarget (Personalities)', () => {
    const attackerPos = 45; // Bottom row
    const enemies = [
      { id: 'e1', hp: 100, maxHp: 100, position: 5 },  // Top row, far
      { id: 'e2', hp: 10, maxHp: 100, position: 35 }, // Dist 2, low HP
      { id: 'e3', hp: 100, maxHp: 100, position: 40 }, // Dist 1, high HP
    ];

    test('AGGRESSIVE should prioritize low HP target (e2)', () => {
      const attacker = { id: 'h1', personality: 'AGGRESSIVE', classId: 'WARRIOR' };
      const target = BattleEngine.selectTarget(attacker, attackerPos, enemies, mockRng);
      expect(target?.id).toBe('e2');
    });

    test('CAUTIOUS should prioritize targets within range without moving (e3)', () => {
      const attacker = { id: 'h1', personality: 'CAUTIOUS', range: 1, classId: 'WARRIOR' };
      const target = BattleEngine.selectTarget(attacker, attackerPos, enemies, mockRng);
      expect(target?.id).toBe('e3');
    });

    test('VENGEFUL should prioritize the last attacker', () => {
      const attacker = { id: 'h1', personality: 'VENGEFUL', classId: 'WARRIOR' };
      const context = { lastAttackerId: 'e1' };
      const target = BattleEngine.selectTarget(attacker, attackerPos, enemies, mockRng, context);
      expect(target?.id).toBe('e1');
    });
  });

  describe('findMovePath (Hex Pathfinding)', () => {
    test('should move closer to target when within movement range', () => {
      const start = 45;
      const target = 0;
      const movement = 2;
      const occupied = new Set<number>();
      
      const next = BattleEngine.findMovePath(start, target, movement, occupied);
      // It should move towards row 0. 45 is row 9. 2 moves should reach row 7.
      expect(Math.floor(next / 5)).toBeLessThan(9);
      expect(Math.floor(next / 5)).toBeGreaterThanOrEqual(7);
    });

    test('should not move to occupied positions', () => {
      const start = 45;
      const target = 35; // Straight up
      const movement = 1;
      const occupied = new Set([40]); // Block the straight path
      
      const next = BattleEngine.findMovePath(start, target, movement, occupied);
      expect(next).not.toBe(40);
    });
  });

  describe('executeClassAbility (Healer)', () => {
    const createBaseState = (): BattleState => ({
      heroes: [],
      enemies: [],
      heroPositions: {},
      enemyPositions: {},
      lastAttacker: {},
      threats: {},
      log: [],
      actions: [],
      rounds: 1
    });

    test('Healer should heal injured ally and consume turn', () => {
      const state = createBaseState();
      const injuredHero: Hero = { 
        id: 'h2', name: 'Injured', hpMax: 20, hpCurrent: 5, atk: 10, mp: 0, 
        defense: 0, crit: 0, agility: 0, currentTask: HeroTask.IDLE 
      };
      const healer: Hero = { 
        id: 'h1', name: 'Healer', hpMax: 10, hpCurrent: 10, atk: 10, mp: 0, 
        defense: 0, crit: 0, agility: 0, currentTask: HeroTask.IDLE, classId: 'HEALER' 
      };
      
      state.heroes = [healer, injuredHero];
      
      const consumed = BattleEngine.executeClassAbility(healer, state);
      
      expect(consumed).toBe(true);
      expect(injuredHero.hpCurrent).toBeGreaterThan(5);
      expect(state.log.some(l => l.includes('curou'))).toBe(true);
    });

    test('Healer should NOT heal if allies are healthy', () => {
      const state = createBaseState();
      const healthyHero: Hero = { 
        id: 'h2', name: 'Healthy', hpMax: 20, hpCurrent: 20, atk: 10, mp: 0, 
        defense: 0, crit: 0, agility: 0, currentTask: HeroTask.IDLE 
      };
      const healer: Hero = { 
        id: 'h1', name: 'Healer', hpMax: 10, hpCurrent: 10, atk: 10, mp: 0, 
        defense: 0, crit: 0, agility: 0, currentTask: HeroTask.IDLE, classId: 'HEALER' 
      };
      
      state.heroes = [healer, healthyHero];
      
      const consumed = BattleEngine.executeClassAbility(healer, state);
      
      expect(consumed).toBe(false);
      expect(healthyHero.hpCurrent).toBe(20);
    });
  });
});
