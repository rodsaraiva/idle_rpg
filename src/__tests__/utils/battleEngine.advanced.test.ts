import { BattleEngine, BattleState, BattleEnemy, SynergyHandlers } from '../../utils/battleEngine';
import { Hero, HeroTask } from '../../types';
import { GameMath } from '../../utils/gameMath';
import { _NOOP_HANDLERS } from '../../utils/synergyEffects';

/**
 * Advanced coverage tests for battleEngine.ts.
 *
 * Goals: Exercise the per-personality branches of selectTarget,
 * class-based targeting, calculateAttack edge cases (miss, crit,
 * CAUTIOUS distance reduction), executeClassAbility flows,
 * findMovePath pathfinding, and processHeroTurn edge cases.
 */
describe('BattleEngine - advanced coverage', () => {
  const rngConst = (v: number) => () => v;
  // Default rng that never triggers the "20% pick second best" branch.
  const rngStable = rngConst(0.5);

  // --- Helpers ---------------------------------------------------------
  const makeHero = (overrides: Partial<Hero> = {}): Hero => ({
    id: 'h1',
    name: 'Hero',
    hpMax: 30,
    hpCurrent: 30,
    atk: 10,
    mp: 5,
    defense: 5,
    crit: 5,
    agility: 10,
    currentTask: HeroTask.IDLE,
    classId: 'WARRIOR',
    ...overrides,
  });

  const makeEnemy = (overrides: Partial<BattleEnemy> = {}): BattleEnemy => ({
    id: 'enemy_1',
    hp: 20,
    maxHp: 20,
    atk: 5,
    mp: 0,
    defense: 2,
    crit: 5,
    agility: 5,
    alive: true,
    attackType: 'MELEE',
    position: 5,
    range: 1,
    movement: 2,
    ...overrides,
  });

  const makeState = (overrides: Partial<BattleState> = {}): BattleState => ({
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
    handlers: _NOOP_HANDLERS,
    skillCooldowns: {},
    skillOnceUsed: {},
    ...overrides,
  });

  // --- selectTarget: personality branches ------------------------------
  describe('selectTarget personality branches', () => {
    test('AGGRESSIVE prefers low-HP enemy (targetHpPct < 0.3 bonus)', () => {
      const attacker = {
        id: 'h1',
        personality: 'AGGRESSIVE',
        classId: 'WARRIOR',
      };
      const candidates = [
        // Healthy enemy, closer (dist 1 from attacker at 40)
        { id: 'full', hp: 30, maxHp: 30, position: 45, classId: 'WARRIOR' },
        // Low HP (<30%) but slightly farther
        { id: 'low', hp: 5, maxHp: 30, position: 46, classId: 'WARRIOR' },
      ];
      const target = BattleEngine.selectTarget(attacker, 45, candidates, rngStable);
      expect(target?.id).toBe('low');
    });

    test('PROTECTOR prefers an enemy that threatens an ally in danger', () => {
      const attacker = {
        id: 'h1',
        personality: 'PROTECTOR',
        classId: 'TANK',
      };
      const candidates = [
        { id: 'enemy_1', hp: 30, maxHp: 30, position: 40, classId: 'WARRIOR' },
        { id: 'enemy_2', hp: 30, maxHp: 30, position: 41, classId: 'WARRIOR' },
      ];
      const context = {
        alliesInDanger: ['h2'],
        threats: { enemy_1: 'h2' },
      };
      const target = BattleEngine.selectTarget(
        attacker,
        45,
        candidates,
        rngStable,
        context
      );
      expect(target?.id).toBe('enemy_1');
    });

    test('PROTECTOR does not boost score if threatened ally is not in danger', () => {
      const attacker = {
        id: 'h1',
        personality: 'PROTECTOR',
        classId: 'TANK',
      };
      // enemy_far is farther (heavier distance penalty) — with no threat boost,
      // PROTECTOR should pick the closer one.
      const candidates = [
        { id: 'enemy_close', hp: 30, maxHp: 30, position: 45, classId: 'WARRIOR' },
        { id: 'enemy_far', hp: 30, maxHp: 30, position: 0, classId: 'WARRIOR' },
      ];
      const context = {
        alliesInDanger: ['h3'], // different ally
        threats: { enemy_far: 'h2' }, // does not match danger list
      };
      const target = BattleEngine.selectTarget(
        attacker,
        45,
        candidates,
        rngStable,
        context
      );
      expect(target?.id).toBe('enemy_close');
    });

    test('CAUTIOUS prefers target within attacker range', () => {
      const attacker = {
        id: 'h1',
        personality: 'CAUTIOUS',
        classId: 'ARCHER',
        range: 2,
      };
      const candidates = [
        // Close enough to be "in range"
        { id: 'close', hp: 30, maxHp: 30, position: 44, classId: 'WARRIOR' },
        // Far away (out of range 2)
        { id: 'far', hp: 30, maxHp: 30, position: 0, classId: 'WARRIOR' },
      ];
      const target = BattleEngine.selectTarget(attacker, 45, candidates, rngStable);
      expect(target?.id).toBe('close');
    });

    test('CAUTIOUS with default range 1 still uses range path', () => {
      const attacker = { id: 'h1', personality: 'CAUTIOUS' };
      const candidates = [
        { id: 'adj', hp: 30, maxHp: 30, position: 40, classId: 'WARRIOR' },
        { id: 'far', hp: 30, maxHp: 30, position: 5, classId: 'WARRIOR' },
      ];
      const target = BattleEngine.selectTarget(attacker, 45, candidates, rngStable);
      expect(target?.id).toBe('adj');
    });

    test('VENGEFUL prefers the last attacker (massive +200 bonus)', () => {
      const attacker = {
        id: 'h1',
        personality: 'VENGEFUL',
        classId: 'WARRIOR',
      };
      // enemy_2 is far away (big distance penalty), but VENGEFUL still picks it.
      const candidates = [
        { id: 'enemy_1', hp: 30, maxHp: 30, position: 45, classId: 'WARRIOR' },
        { id: 'enemy_2', hp: 30, maxHp: 30, position: 0, classId: 'WARRIOR' },
      ];
      const context = { lastAttackerId: 'enemy_2' };
      const target = BattleEngine.selectTarget(
        attacker,
        45,
        candidates,
        rngStable,
        context
      );
      expect(target?.id).toBe('enemy_2');
    });

    test('OPPORTUNIST prefers non-TANK over TANK at same HP/position', () => {
      const attacker = {
        id: 'h1',
        personality: 'OPPORTUNIST',
        classId: 'ROGUE',
      };
      const candidates = [
        { id: 'tank', hp: 30, maxHp: 30, position: 40, classId: 'TANK' },
        { id: 'fragile', hp: 30, maxHp: 30, position: 41, classId: 'WARRIOR' },
      ];
      const target = BattleEngine.selectTarget(attacker, 45, candidates, rngStable);
      expect(target?.id).toBe('fragile');
    });

    test('OPPORTUNIST strongly prefers low-HP non-TANK (<0.4 HP bonus)', () => {
      const attacker = {
        id: 'h1',
        personality: 'OPPORTUNIST',
        classId: 'ROGUE',
      };
      const candidates = [
        { id: 'tank', hp: 30, maxHp: 30, position: 40, classId: 'TANK' },
        { id: 'low', hp: 5, maxHp: 30, position: 41, classId: 'WARRIOR' },
      ];
      const target = BattleEngine.selectTarget(attacker, 45, candidates, rngStable);
      expect(target?.id).toBe('low');
    });

    test('rng < 0.2 picks the second-best candidate for variance', () => {
      const attacker = { id: 'h1', classId: 'WARRIOR' };
      const candidates = [
        { id: 'best', hp: 30, maxHp: 30, position: 40, classId: 'WARRIOR' },
        { id: 'second', hp: 30, maxHp: 30, position: 41, classId: 'WARRIOR' },
      ];
      const target = BattleEngine.selectTarget(
        attacker,
        45,
        candidates,
        rngConst(0.1) // triggers second-best branch
      );
      expect(target?.id).toBe('second');
    });

    test('uses hpCurrent fallback when hp field is missing', () => {
      const attacker = {
        id: 'h1',
        personality: 'AGGRESSIVE',
        classId: 'WARRIOR',
      };
      const candidates = [
        { id: 'full', hpCurrent: 30, maxHp: 30, position: 45, classId: 'WARRIOR' },
        { id: 'low', hpCurrent: 5, maxHp: 30, position: 46, classId: 'WARRIOR' },
      ];
      const target = BattleEngine.selectTarget(attacker, 45, candidates, rngStable);
      expect(target?.id).toBe('low');
    });
  });

  // --- selectTarget: class-specific targeting --------------------------
  describe('selectTarget class-specific targeting', () => {
    test('TANK attacker favours close targets (dist <= 1)', () => {
      const attacker = { id: 'h1', classId: 'TANK' };
      const candidates = [
        { id: 'close', hp: 30, maxHp: 30, position: 40, classId: 'WARRIOR' },
        { id: 'far', hp: 30, maxHp: 30, position: 5, classId: 'WARRIOR' },
      ];
      const target = BattleEngine.selectTarget(attacker, 45, candidates, rngStable);
      expect(target?.id).toBe('close');
    });

    test('WARRIOR attacker favours close targets (dist <= 1)', () => {
      const attacker = { id: 'h1', classId: 'WARRIOR' };
      const candidates = [
        { id: 'close', hp: 30, maxHp: 30, position: 40, classId: 'WARRIOR' },
        { id: 'far', hp: 30, maxHp: 30, position: 5, classId: 'WARRIOR' },
      ];
      const target = BattleEngine.selectTarget(attacker, 45, candidates, rngStable);
      expect(target?.id).toBe('close');
    });

    test('ROGUE prefers non-TANK fragile targets', () => {
      const attacker = { id: 'h1', classId: 'ROGUE' };
      const candidates = [
        { id: 'tank', hp: 30, maxHp: 30, position: 40, classId: 'TANK' },
        { id: 'fragile', hp: 30, maxHp: 30, position: 41, classId: 'WARRIOR' },
      ];
      const target = BattleEngine.selectTarget(attacker, 45, candidates, rngStable);
      expect(target?.id).toBe('fragile');
    });

    test('ARCHER prefers non-TANK fragile targets', () => {
      const attacker = { id: 'h1', classId: 'ARCHER' };
      const candidates = [
        { id: 'tank', hp: 30, maxHp: 30, position: 40, classId: 'TANK' },
        { id: 'fragile', hp: 30, maxHp: 30, position: 41, classId: 'WARRIOR' },
      ];
      const target = BattleEngine.selectTarget(attacker, 45, candidates, rngStable);
      expect(target?.id).toBe('fragile');
    });

    test('MAGE prefers non-TANK fragile targets with <50% HP bonus', () => {
      const attacker = { id: 'h1', classId: 'MAGE' };
      const candidates = [
        { id: 'tank', hp: 30, maxHp: 30, position: 40, classId: 'TANK' },
        { id: 'fragile_low', hp: 10, maxHp: 30, position: 41, classId: 'WARRIOR' },
      ];
      const target = BattleEngine.selectTarget(attacker, 45, candidates, rngStable);
      expect(target?.id).toBe('fragile_low');
    });
  });

  // --- calculateAttack branches ----------------------------------------
  describe('calculateAttack branches', () => {
    test('returns a miss action with dmg=0 when rng exceeds hit chance', () => {
      const attacker = { id: 'a1', name: 'Attacker', atk: 10, crit: 5 };
      const target = { id: 't1', name: 'Target', hp: 30, defense: 5, agility: 10 };
      const result = BattleEngine.calculateAttack(
        attacker,
        target,
        0.5,
        'hero',
        1,
        rngConst(0.99) // always miss
      );
      expect(result).not.toBeNull();
      expect(result?.action.actionType).toBe('miss');
      expect(result?.dmg).toBe(0);
      expect(result?.action.text).toContain('errou');
    });

    test('miss falls back to actor id when name is missing', () => {
      const attacker = { id: 'a1', atk: 10, crit: 5 };
      const target = { id: 't1', hp: 30, defense: 5, agility: 10 };
      const result = BattleEngine.calculateAttack(
        attacker,
        target,
        0.5,
        'hero',
        1,
        rngConst(0.99)
      );
      expect(result?.action.actorName).toBe('a1');
      expect(result?.action.text).toContain('a1');
      expect(result?.action.text).toContain('t1');
    });

    test('distance 5 introduces a large hit penalty that causes misses', () => {
      const attacker = {
        id: 'archer',
        name: 'Archer',
        atk: 10,
        crit: 5,
        classId: 'ARCHER',
      };
      const target = { id: 't1', name: 'Target', hp: 30, defense: 5, agility: 10 };
      // base hit 0.5 - evasion ~0.16 - distance penalty 4*0.05=0.2 ≈ 0.14
      const result = BattleEngine.calculateAttack(
        attacker,
        target,
        0.5,
        'hero',
        1,
        rngConst(0.5), // > 0.14, should miss
        5
      );
      expect(result?.action.actionType).toBe('miss');
    });

    test('high agility target (100) yields ~67% evasion and forces misses', () => {
      const attacker = { id: 'a1', name: 'A', atk: 10 };
      const dodgyTarget = { id: 't1', name: 'T', hp: 30, defense: 5, agility: 100 };
      // effective = max(0.05, 0.9 - 100/150) ≈ 0.233
      const result = BattleEngine.calculateAttack(
        attacker,
        dodgyTarget,
        0.9,
        'hero',
        1,
        rngConst(0.5) // > 0.233 → miss
      );
      expect(result?.action.actionType).toBe('miss');
    });

    test('CAUTIOUS personality reduces distance penalty (0.6x multiplier)', () => {
      // With base hit 0.5, agility 10 (evasion ~0.166), dist 5:
      // normal penalty = 0.2, effective ~0.133
      // cautious penalty = 0.12, effective ~0.213
      // rng at 0.18 — normal misses, cautious hits.
      const target = { id: 't1', name: 'T', hp: 30, defense: 5, agility: 10 };

      const normalAttacker = { id: 'a1', name: 'A', atk: 10 };
      const normalMiss = BattleEngine.calculateAttack(
        normalAttacker,
        target,
        0.5,
        'hero',
        1,
        rngConst(0.18),
        5
      );
      expect(normalMiss?.action.actionType).toBe('miss');

      const cautiousAttacker = {
        id: 'a2',
        name: 'Cautious',
        atk: 10,
        personality: 'CAUTIOUS',
      };
      const cautiousHit = BattleEngine.calculateAttack(
        cautiousAttacker,
        target,
        0.5,
        'hero',
        1,
        // 1st rng: hit roll; 2nd rng: crit roll. Use sequential.
        (() => {
          let i = 0;
          const seq = [0.18, 0.99];
          return () => seq[i++ % seq.length];
        })(),
        5
      );
      expect(cautiousHit?.action.actionType).toBe('hit');
    });

    test('ROGUE gets +5% crit chance baseline', () => {
      // calcCritChance('ROGUE', 0) = 0.05 (base) + 0.05 (rogue) + 0 = 0.1
      // rng second roll = 0.05 < 0.1 → crit
      const attacker = {
        id: 'rogue',
        name: 'Rogue',
        atk: 20,
        crit: 0,
        classId: 'ROGUE',
      };
      const target = { id: 't1', name: 'T', hp: 100, defense: 5, agility: 0 };
      const seq = [0.0, 0.05]; // hit, then crit
      let i = 0;
      const rng = () => seq[i++ % seq.length];
      const result = BattleEngine.calculateAttack(
        attacker,
        target,
        0.95,
        'hero',
        1,
        rng
      );
      expect(result?.action.actionType).toBe('hit');
      expect(result?.action.isCrit).toBe(true);
      expect(result?.action.text).toContain('CRÍTICO');
    });

    test('non-ROGUE with crit roll above threshold returns non-crit hit', () => {
      const attacker = { id: 'a1', name: 'A', atk: 10, crit: 0 };
      const target = { id: 't1', name: 'T', hp: 100, defense: 5, agility: 0 };
      // baseCrit = 0.05; rng 2nd = 0.9 → not crit
      const seq = [0.0, 0.9];
      let i = 0;
      const rng = () => seq[i++ % seq.length];
      const result = BattleEngine.calculateAttack(attacker, target, 0.95, 'enemy', 2, rng);
      expect(result?.action.actionType).toBe('hit');
      expect(result?.action.isCrit).toBe(false);
      expect(result?.action.text).not.toContain('CRÍTICO');
    });
  });

  // --- executeClassAbility ---------------------------------------------
  describe('executeClassAbility', () => {
    test('HEALER heals the most injured ally below 70% HP', () => {
      const state = makeState();
      const healer = makeHero({
        id: 'h1',
        name: 'Heal',
        classId: 'HEALER',
        mp: 10,
      });
      const moderatelyInjured = makeHero({
        id: 'h2',
        name: 'Mid',
        hpMax: 20,
        hpCurrent: 10, // 50%
      });
      const severelyInjured = makeHero({
        id: 'h3',
        name: 'Low',
        hpMax: 20,
        hpCurrent: 4, // 20%
      });
      state.heroes = [healer, moderatelyInjured, severelyInjured];

      const consumed = BattleEngine.executeClassAbility(healer, state);

      expect(consumed).toBe(true);
      expect(severelyInjured.hpCurrent).toBeGreaterThan(4);
      // moderately injured (50%) should NOT be chosen first, even though it
      // might also qualify, because severely injured has lowest HP ratio.
      expect(moderatelyInjured.hpCurrent).toBe(10);
      expect(state.actions.length).toBe(1);
      expect(state.actions[0].actionType).toBe('heal');
      expect(state.actions[0].targetId).toBe('h3');
    });

    test('HEALER does not heal when all allies are above 70% HP', () => {
      const state = makeState();
      const healer = makeHero({
        id: 'h1',
        classId: 'HEALER',
        mp: 10,
      });
      const ally = makeHero({
        id: 'h2',
        hpMax: 20,
        hpCurrent: 20, // healthy
      });
      state.heroes = [healer, ally];

      const consumed = BattleEngine.executeClassAbility(healer, state);
      expect(consumed).toBe(false);
      expect(state.actions.length).toBe(0);
      expect(ally.hpCurrent).toBe(20);
    });

    test('non-HEALER class returns false and does nothing', () => {
      const state = makeState();
      const warrior = makeHero({ classId: 'WARRIOR' });
      const injured = makeHero({ id: 'h2', hpCurrent: 1 });
      state.heroes = [warrior, injured];

      const consumed = BattleEngine.executeClassAbility(warrior, state);
      expect(consumed).toBe(false);
      expect(state.actions.length).toBe(0);
    });

    test('HEALER heal amount is capped at hpMax', () => {
      const state = makeState();
      const healer = makeHero({
        id: 'h1',
        classId: 'HEALER',
        mp: 1000, // huge heal amount
      });
      const injured = makeHero({
        id: 'h2',
        hpMax: 20,
        hpCurrent: 5,
      });
      state.heroes = [healer, injured];

      BattleEngine.executeClassAbility(healer, state);
      expect(injured.hpCurrent).toBe(20); // capped to max
    });
  });

  // --- findMovePath ----------------------------------------------------
  describe('findMovePath', () => {
    test('movement 0 returns current position', () => {
      const result = BattleEngine.findMovePath(45, 0, 0, new Set<number>());
      expect(result).toBe(45);
    });

    test('movement pushes the actor closer to the target', () => {
      const start = 45; // row 9
      const target = 0; // row 0
      const startDist = GameMath.getHexDistance(start, target);
      const result = BattleEngine.findMovePath(start, target, 2, new Set<number>());
      const newDist = GameMath.getHexDistance(result, target);
      expect(newDist).toBeLessThan(startDist);
      expect(result).not.toBe(start);
    });

    test('path avoids occupied positions', () => {
      const start = 45;
      const target = 0;
      // Block every neighbour except one we want to ensure isn't occupied.
      const occupied = new Set<number>([40, 41]);
      const result = BattleEngine.findMovePath(start, target, 1, occupied);
      expect(occupied.has(result)).toBe(false);
    });

    test('returns current position when fully surrounded by occupied tiles', () => {
      const start = 45;
      const neighbors = GameMath.getHexNeighbors(start, 10, 5);
      const occupied = new Set<number>(neighbors);
      const result = BattleEngine.findMovePath(start, 0, 3, occupied);
      expect(result).toBe(start);
    });
  });

  // --- processHeroTurn -------------------------------------------------
  describe('processHeroTurn edge cases', () => {
    test('dead hero (hpCurrent 0) takes no action', () => {
      const state = makeState();
      const deadHero = makeHero({ id: 'h1', hpCurrent: 0 });
      const enemy = makeEnemy({ id: 'enemy_1', position: 5 });
      state.heroes = [deadHero];
      state.enemies = [enemy];
      state.heroPositions = { h1: 45 };
      state.enemyPositions = { enemy_1: 5 };

      BattleEngine.processHeroTurn(deadHero, state, rngStable);

      expect(state.actions.length).toBe(0);
      expect(state.log.length).toBe(0);
    });

    test('no alive enemies short-circuits the turn', () => {
      const state = makeState();
      const hero = makeHero({ id: 'h1' });
      state.heroes = [hero];
      state.enemies = []; // no enemies
      state.heroPositions = { h1: 45 };

      BattleEngine.processHeroTurn(hero, state, rngStable);
      expect(state.actions.length).toBe(0);
    });

    test('HEALER turn is consumed by heal ability (no move/attack logged)', () => {
      const state = makeState();
      const healer = makeHero({
        id: 'h1',
        name: 'Heal',
        classId: 'HEALER',
        mp: 10,
      });
      const injured = makeHero({
        id: 'h2',
        hpMax: 20,
        hpCurrent: 5,
      });
      const enemy = makeEnemy({ id: 'enemy_1', position: 5 });
      state.heroes = [healer, injured];
      state.enemies = [enemy];
      state.heroPositions = { h1: 45, h2: 46 };
      state.enemyPositions = { enemy_1: 5 };

      BattleEngine.processHeroTurn(healer, state, rngStable);

      // Only the heal action should be recorded.
      expect(state.actions.length).toBe(1);
      expect(state.actions[0].actionType).toBe('heal');
    });

    test('hero moves toward distant enemy and then attacks when in range', () => {
      const state = makeState();
      const hero = makeHero({
        id: 'h1',
        classId: 'WARRIOR',
        range: 1,
        movement: 4,
        atk: 100,
        crit: 0,
      });
      const enemy = makeEnemy({
        id: 'enemy_1',
        hp: 10,
        maxHp: 10,
        defense: 0,
        agility: 0,
        position: 5,
      });
      state.heroes = [hero];
      state.enemies = [enemy];
      state.heroPositions = { h1: 45 };
      state.enemyPositions = { enemy_1: 5 };

      // rng always 0.5 — stable. Hero moves closer (logs move action).
      BattleEngine.processHeroTurn(hero, state, rngStable);

      const moveAction = state.actions.find((a) => a.actionType === 'move');
      expect(moveAction).toBeDefined();
      expect(moveAction?.fromPosition).toBe(45);
      // Hero new position should be different from start.
      expect(state.heroPositions.h1).not.toBe(45);
    });

    test('hero in range attacks, deals damage, and defeats enemy on lethal hit', () => {
      const state = makeState();
      const hero = makeHero({
        id: 'h1',
        name: 'Finisher',
        classId: 'WARRIOR',
        range: 1,
        atk: 1000, // guaranteed one-shot
        crit: 0,
      });
      const enemy = makeEnemy({
        id: 'enemy_1',
        hp: 5,
        maxHp: 5,
        defense: 0,
        agility: 0,
        position: 40,
      });
      state.heroes = [hero];
      state.enemies = [enemy];
      state.heroPositions = { h1: 45 };
      state.enemyPositions = { enemy_1: 40 };

      // Sequence: selectTarget rng (≥0.2), hit roll ≈0, crit roll (skip)
      const seq = [0.5, 0.0, 0.9, 0.5, 0.0, 0.9];
      let i = 0;
      const rng = () => seq[i++ % seq.length];

      BattleEngine.processHeroTurn(hero, state, rng);

      const hit = state.actions.find((a) => a.actionType === 'hit');
      expect(hit).toBeDefined();
      expect(enemy.hp).toBe(0);
      expect(enemy.alive).toBe(false);
      // enemy removed from positions map
      expect(state.enemyPositions.enemy_1).toBeUndefined();
      // defeat action recorded
      const defeat = state.actions.find((a) => a.actionType === 'defeat');
      expect(defeat).toBeDefined();
    });

    test('hero attack that hits records lastAttacker entry on target', () => {
      const state = makeState();
      const hero = makeHero({
        id: 'h1',
        name: 'Hit',
        classId: 'WARRIOR',
        range: 1,
        atk: 10,
        crit: 0,
      });
      const enemy = makeEnemy({
        id: 'enemy_1',
        hp: 100,
        maxHp: 100,
        defense: 0,
        agility: 0,
        position: 40,
      });
      state.heroes = [hero];
      state.enemies = [enemy];
      state.heroPositions = { h1: 45 };
      state.enemyPositions = { enemy_1: 40 };

      const seq = [0.5, 0.0, 0.9];
      let i = 0;
      const rng = () => seq[i++ % seq.length];

      BattleEngine.processHeroTurn(hero, state, rng);

      expect(state.lastAttacker.enemy_1).toBe('h1');
      expect(enemy.hp).toBeLessThan(100);
    });
  });

  // --- processEnemyTurn (lightweight coverage) -------------------------
  describe('processEnemyTurn basic flow', () => {
    test('dead enemy does not act', () => {
      const state = makeState();
      const hero = makeHero({ id: 'h1' });
      const enemy = makeEnemy({ id: 'enemy_1', hp: 0, position: 5 });
      state.heroes = [hero];
      state.enemies = [enemy];
      state.heroPositions = { h1: 45 };
      state.enemyPositions = { enemy_1: 5 };

      BattleEngine.processEnemyTurn(enemy, state, rngStable);
      expect(state.actions.length).toBe(0);
    });

    test('no alive heroes short-circuits enemy turn', () => {
      const state = makeState();
      const hero = makeHero({ id: 'h1', hpCurrent: 0 });
      const enemy = makeEnemy({ id: 'enemy_1', position: 5 });
      state.heroes = [hero];
      state.enemies = [enemy];
      state.heroPositions = { h1: 45 };
      state.enemyPositions = { enemy_1: 5 };

      BattleEngine.processEnemyTurn(enemy, state, rngStable);
      expect(state.actions.length).toBe(0);
    });

    test('enemy moves and attacks a hero, applying tank mitigation on non-TANK', () => {
      const state = makeState();
      const hero = makeHero({
        id: 'h1',
        name: 'Squishy',
        classId: 'WARRIOR',
        hpMax: 100,
        hpCurrent: 100,
        defense: 0,
        agility: 0,
      });
      const enemy = makeEnemy({
        id: 'enemy_1',
        atk: 50,
        agility: 0,
        position: 40,
        range: 1,
      });
      state.heroes = [hero];
      state.enemies = [enemy];
      state.heroPositions = { h1: 45 };
      state.enemyPositions = { enemy_1: 40 };

      // Force hit and non-crit
      const seq = [0.5, 0.0, 0.9];
      let i = 0;
      const rng = () => seq[i++ % seq.length];

      BattleEngine.processEnemyTurn(enemy, state, rng, 0.5, 0.95);

      const hit = state.actions.find((a) => a.actionType === 'hit');
      expect(hit).toBeDefined();
      expect(hit?.text).toContain('Reduzido por Tank');
      expect(hero.hpCurrent).toBeLessThan(100);
      // threats updated
      expect(state.threats.enemy_1).toBe('h1');
    });

    test('enemy attacking TANK hero does not apply tank mitigation text', () => {
      const state = makeState();
      const tank = makeHero({
        id: 'h1',
        name: 'Tanky',
        classId: 'TANK',
        hpMax: 100,
        hpCurrent: 100,
        defense: 0,
        agility: 0,
      });
      const enemy = makeEnemy({
        id: 'enemy_1',
        atk: 20,
        agility: 0,
        position: 40,
        range: 1,
      });
      state.heroes = [tank];
      state.enemies = [enemy];
      state.heroPositions = { h1: 45 };
      state.enemyPositions = { enemy_1: 40 };

      const seq = [0.5, 0.0, 0.9];
      let i = 0;
      const rng = () => seq[i++ % seq.length];

      BattleEngine.processEnemyTurn(enemy, state, rng, 0.5, 0.95);

      const hit = state.actions.find((a) => a.actionType === 'hit');
      expect(hit).toBeDefined();
      expect(hit?.text).not.toContain('Reduzido por Tank');
    });

    test('enemy out of range moves toward hero (logs move action)', () => {
      const state = makeState();
      const hero = makeHero({
        id: 'h1',
        hpMax: 100,
        hpCurrent: 100,
        defense: 0,
        agility: 0,
      });
      const enemy = makeEnemy({
        id: 'enemy_1',
        atk: 5,
        agility: 0,
        position: 0, // row 0
        range: 1,
        movement: 3,
      });
      state.heroes = [hero];
      state.enemies = [enemy];
      state.heroPositions = { h1: 45 }; // row 9 — far away
      state.enemyPositions = { enemy_1: 0 };

      BattleEngine.processEnemyTurn(enemy, state, rngStable);

      const moveAction = state.actions.find((a) => a.actionType === 'move');
      expect(moveAction).toBeDefined();
      expect(moveAction?.fromPosition).toBe(0);
      expect(state.enemyPositions.enemy_1).not.toBe(0);
    });

    test('enemy kill on hero triggers incapacitated defeat action', () => {
      const state = makeState();
      const hero = makeHero({
        id: 'h1',
        name: 'Glass',
        classId: 'WARRIOR',
        hpMax: 5,
        hpCurrent: 1,
        defense: 0,
        agility: 0,
      });
      const enemy = makeEnemy({
        id: 'enemy_1',
        atk: 100,
        agility: 0,
        position: 40,
        range: 1,
      });
      state.heroes = [hero];
      state.enemies = [enemy];
      state.heroPositions = { h1: 45 };
      state.enemyPositions = { enemy_1: 40 };

      const seq = [0.5, 0.0, 0.9];
      let i = 0;
      const rng = () => seq[i++ % seq.length];

      BattleEngine.processEnemyTurn(enemy, state, rng, 0, 0.99);

      expect(hero.hpCurrent).toBe(0);
      expect(state.heroPositions.h1).toBeUndefined();
      const defeat = state.actions.find((a) => a.actionType === 'defeat');
      expect(defeat?.text).toContain('incapacitado');
    });
  });

  // --- createEnemies ---------------------------------------------------
  describe('createEnemies', () => {
    test('creates enemies from explicit template definitions', () => {
      const template: any = {
        id: 'test',
        minHeroes: 1,
        enemies: [
          {
            count: 2,
            hp: 15,
            atk: 5,
            mp: 0,
            defense: 3,
            crit: 4,
            agility: 6,
            attackType: 'MELEE',
            range: 1,
            movement: 2,
          },
        ],
      };
      const enemies = BattleEngine.createEnemies(template);
      expect(enemies.length).toBe(2);
      expect(enemies[0].id).toBe('enemy_0_0');
      expect(enemies[1].id).toBe('enemy_0_1');
      expect(enemies.every((e) => e.alive)).toBe(true);
      expect(enemies.every((e) => e.attackType === 'MELEE')).toBe(true);
    });

    test('falls back to default orcs when no enemies defined', () => {
      const template: any = {
        id: 'test',
        minHeroes: 3,
      };
      const enemies = BattleEngine.createEnemies(template);
      expect(enemies.length).toBe(3);
      expect(enemies[0].id).toBe('orc_0');
      expect(enemies[0].attackType).toBe('MELEE'); // even index
      expect(enemies[1].attackType).toBe('RANGED'); // odd index
    });
  });
});
