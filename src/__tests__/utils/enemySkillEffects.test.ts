import {
  applyEnemyPassiveSkills,
  executeEnemyPreAttackSkills,
  onEnemyHitSkills,
  onEnemyDamagedSkills,
  processEnemyRegenBuffs,
} from '../../utils/enemySkillEffects';
import { BattleState, BattleEnemy } from '../../utils/battleEngine';
import { Hero, HeroTask } from '../../types';
import { EnemySkillDef } from '../../constants/enemySkills';

function makeHero(overrides?: Partial<Hero>): Hero {
  return {
    id: 'h1', name: 'Hero', hpMax: 100, hpCurrent: 100,
    atk: 20, mp: 10, defense: 5, crit: 10, agility: 5,
    currentTask: HeroTask.IDLE,
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    ...overrides,
  } as Hero;
}

function makeEnemy(overrides?: Partial<BattleEnemy>): BattleEnemy {
  return {
    id: 'e1', hp: 50, maxHp: 50, atk: 10, mp: 0,
    defense: 5, crit: 5, agility: 5, alive: true,
    attackType: 'MELEE', range: 1, movement: 2,
    position: 2,
    skills: [],
    skillCooldowns: {},
    skillOnceUsed: {},
    ...overrides,
  };
}

function makeState(heroes: Hero[], enemies: BattleEnemy[], round = 1): BattleState {
  const heroPositions: Record<string, number> = {};
  heroes.forEach((h, i) => { heroPositions[h.id] = 40 + i; });
  const enemyPositions: Record<string, number> = {};
  enemies.forEach(e => { enemyPositions[e.id] = e.position ?? 2; });
  return {
    heroes, enemies, heroPositions, enemyPositions,
    lastAttacker: {}, threats: {}, log: [], actions: [], rounds: round,
    activeSynergies: [], buffs: {}, flags: {}, handlers: {} as any,
    skillCooldowns: {}, skillOnceUsed: {},
  };
}

const skillDef = (id: string, cd: number): EnemySkillDef => ({
  id, name: id, icon: '?', cooldownRounds: cd, minDifficulty: 1,
});

describe('enemySkillEffects', () => {
  test('1. CHARGE: +30% ATK buff on round 1', () => {
    const enemy = makeEnemy({ skills: [skillDef('CHARGE', -1)] });
    const hero = makeHero();
    const state = makeState([hero], [enemy], 1);

    executeEnemyPreAttackSkills(enemy, hero, state, 0.5);

    const buff = state.buffs['e1']?.find(b => b.source === 'ENEMY_CHARGE' && b.type === 'atkMul');
    expect(buff).toBeDefined();
    expect(buff?.value).toBe(1.30);
  });

  test('2. CARAPACE: +20% DEF buff when HP > 50%', () => {
    const enemy = makeEnemy({ hp: 40, maxHp: 50, skills: [skillDef('CARAPACE', 0)] }); // 80% HP
    const state = makeState([], [enemy]);

    applyEnemyPassiveSkills(enemy, state);

    const buff = state.buffs['e1']?.find(b => b.source === 'ENEMY_CARAPACE' && b.type === 'defMul');
    expect(buff).toBeDefined();
    expect(buff?.value).toBe(1.20);
  });

  test('3. CARAPACE: no buff when HP <= 50%', () => {
    const enemy = makeEnemy({ hp: 25, maxHp: 50, skills: [skillDef('CARAPACE', 0)] }); // 50% HP
    const state = makeState([], [enemy]);

    applyEnemyPassiveSkills(enemy, state);

    const buff = state.buffs['e1']?.find(b => b.source === 'ENEMY_CARAPACE');
    expect(buff).toBeUndefined();
  });

  test('4. POISON: applies DoT when rng < 0.2', () => {
    const enemy = makeEnemy({ atk: 20, skills: [skillDef('POISON', 0)] });
    const hero = makeHero();
    const state = makeState([hero], [enemy]);

    onEnemyHitSkills(enemy, hero, state, 0.1); // rng < 0.2 -> poison applied

    const dot = state.buffs['h1']?.find(b => b.source === 'ENEMY_POISON' && b.type === 'dot');
    expect(dot).toBeDefined();
    expect(dot?.value).toBeGreaterThanOrEqual(1);
    expect(dot?.value).toBe(Math.max(1, Math.floor(20 * 0.05)));
  });

  test('5. BOSS_FURY: +50% ATK when HP < 25%, once, persistent', () => {
    const enemy = makeEnemy({ hp: 10, maxHp: 50, skills: [skillDef('BOSS_FURY', -1)] }); // 20% HP
    const state = makeState([], [enemy]);

    applyEnemyPassiveSkills(enemy, state);

    const buff = state.buffs['e1']?.find(b => b.source === 'ENEMY_BOSS_FURY' && b.type === 'atkMul');
    expect(buff).toBeDefined();
    expect(buff?.value).toBe(1.50);
    expect(buff?.expiresAfterRound).toBe(-1);
  });

  test('6. REGEN: heals 10% maxHp', () => {
    const enemy = makeEnemy({
      hp: 20, maxHp: 50, alive: true,
      skills: [skillDef('REGEN', 3)],
      skillCooldowns: {},
    });
    const state = makeState([], [enemy]);

    processEnemyRegenBuffs(state);

    expect(enemy.hp).toBe(25); // 20 + floor(50 * 0.1) = 20 + 5 = 25
  });

  test('7. MAGIC_SHIELD: 30% shield on damage', () => {
    const enemy = makeEnemy({ skills: [skillDef('MAGIC_SHIELD', 4)] });
    const state = makeState([], [enemy]);

    onEnemyDamagedSkills(enemy, state);

    const shield = state.buffs['e1']?.find(b => b.source === 'ENEMY_MAGIC_SHIELD' && b.type === 'shield');
    expect(shield).toBeDefined();
    expect(shield?.value).toBe(0.30);
  });

  test('8. AOE_ATTACK: damages 2 closest heroes, returns true', () => {
    const hero1 = makeHero({ id: 'h1', hpCurrent: 100, atk: 10 });
    const hero2 = makeHero({ id: 'h2', hpCurrent: 100, atk: 10 });
    const hero3 = makeHero({ id: 'h3', hpCurrent: 100, atk: 10 });
    const enemy = makeEnemy({ atk: 20, skills: [skillDef('AOE_ATTACK', 4)] });
    const state = makeState([hero1, hero2, hero3], [enemy]);

    const consumed = executeEnemyPreAttackSkills(enemy, hero1, state, 0.5);

    expect(consumed).toBe(true);
    const dmg = Math.max(1, Math.floor(20 * 0.5)); // 10
    // At least 2 heroes should have taken damage
    const damaged = [hero1, hero2, hero3].filter(h => h.hpCurrent < 100);
    expect(damaged.length).toBe(2);
    damaged.forEach(h => expect(h.hpCurrent).toBe(100 - dmg));
  });
});
