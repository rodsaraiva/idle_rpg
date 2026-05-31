import { BattleEngine, BattleState } from '../../utils/battleEngine';
import { HeroTask, Hero } from '../../types';

describe('BattleEngine', () => {
  const mockRng = (val: number) => () => val;

  test('selectTarget picks highest-score target based on distance and HP', () => {
    const attacker = { id: 'a1', attackType: 'MELEE' as const, range: 1 };
    const candidates = [
      { id: 'e1', hp: 10, position: 5, classId: 'WARRIOR' },
      { id: 'e2', hp: 20, position: 1, classId: 'WARRIOR' },
      { id: 'e3', hp: 5, position: 2, classId: 'WARRIOR' },
    ];
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

describe('BattleEngine - AI and Tactics', () => {
  const mockRng = () => 0.5;

  describe('selectTarget (Personalities)', () => {
    const attackerPos = 45;
    const enemies = [
      { id: 'e1', hp: 100, maxHp: 100, position: 5 },
      { id: 'e2', hp: 10, maxHp: 100, position: 35 },
      { id: 'e3', hp: 100, maxHp: 100, position: 40 },
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
      expect(Math.floor(next / 5)).toBeLessThan(9);
      expect(Math.floor(next / 5)).toBeGreaterThanOrEqual(7);
    });

    test('should not move to occupied positions', () => {
      const start = 45;
      const target = 35;
      const movement = 1;
      const occupied = new Set([40]);
      const next = BattleEngine.findMovePath(start, target, movement, occupied);
      expect(next).not.toBe(40);
    });
  });

  describe('executeClassAbility (Healer)', () => {
    const makeState = (): BattleState => ({
      heroes: [],
      enemies: [],
      heroPositions: {},
      enemyPositions: {},
      lastAttacker: {},
      threats: {},
      log: [],
      actions: [],
      rounds: 1,
      activeSynergies: [],
      buffs: {},
      flags: {},
      handlers: {
        onBattleStart: () => {},
        onHealApplied: () => {},
        onHeroDamaged: () => {},
        onHeroDeath: () => {},
        shouldIgnoreDefense: () => false,
        getExtraHits: () => [],
      } as any,
      skillCooldowns: {},
      skillOnceUsed: {},
    });

    test('Healer should heal injured ally and consume turn', () => {
      const state = makeState();
      const injuredHero: Hero = {
        id: 'h2', name: 'Injured', hpMax: 20, hpCurrent: 5, atk: 10, mp: 0,
        defense: 0, crit: 0, agility: 0, currentTask: HeroTask.IDLE,
      };
      const healer: Hero = {
        id: 'h1', name: 'Healer', hpMax: 10, hpCurrent: 10, atk: 10, mp: 0,
        defense: 0, crit: 0, agility: 0, currentTask: HeroTask.IDLE, classId: 'HEALER',
      };
      state.heroes = [healer, injuredHero];
      const consumed = BattleEngine.executeClassAbility(healer, state);
      expect(consumed).toBe(true);
      expect(injuredHero.hpCurrent).toBeGreaterThan(5);
      expect(state.log.some(l => l.includes('curou'))).toBe(true);
    });

    test('Healer should NOT heal if allies are healthy', () => {
      const state = makeState();
      const healthyHero: Hero = {
        id: 'h2', name: 'Healthy', hpMax: 20, hpCurrent: 20, atk: 10, mp: 0,
        defense: 0, crit: 0, agility: 0, currentTask: HeroTask.IDLE,
      };
      const healer: Hero = {
        id: 'h1', name: 'Healer', hpMax: 10, hpCurrent: 10, atk: 10, mp: 0,
        defense: 0, crit: 0, agility: 0, currentTask: HeroTask.IDLE, classId: 'HEALER',
      };
      state.heroes = [healer, healthyHero];
      const consumed = BattleEngine.executeClassAbility(healer, state);
      expect(consumed).toBe(false);
      expect(healthyHero.hpCurrent).toBe(20);
    });

    test('Healer should NOT heal themselves even if injured', () => {
      const state = makeState();
      const healer: Hero = {
        id: 'h1', name: 'Healer', hpMax: 20, hpCurrent: 5, atk: 10, mp: 0,
        defense: 0, crit: 0, agility: 0, currentTask: HeroTask.IDLE, classId: 'HEALER',
      };
      state.heroes = [healer];
      const consumed = BattleEngine.executeClassAbility(healer, state);
      expect(consumed).toBe(false);
      expect(healer.hpCurrent).toBe(5);
    });
  });
});
