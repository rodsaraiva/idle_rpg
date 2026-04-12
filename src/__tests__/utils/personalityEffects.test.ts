import { applyPersonalityOnHit, applyProtectorShield } from '../../utils/personalityEffects';
import { BattleState, BattleEnemy } from '../../utils/battleEngine';
import { Hero, HeroTask } from '../../types';

function makeHero(overrides: Partial<Hero>): Hero {
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
    attackType: 'MELEE', range: 1, movement: 2, position: 2,
    ...overrides,
  };
}

function makeState(heroes: Hero[], enemies: BattleEnemy[]): BattleState {
  const heroPositions: Record<string, number> = {};
  heroes.forEach((h, i) => { heroPositions[h.id] = 40 + i; });
  const enemyPositions: Record<string, number> = {};
  enemies.forEach(e => { enemyPositions[e.id] = e.position ?? 2; });

  return {
    heroes, enemies, heroPositions, enemyPositions,
    lastAttacker: {}, threats: {},
    log: [], actions: [], rounds: 1,
    activeSynergies: [], buffs: {}, flags: {},
    handlers: {} as any,
    skillCooldowns: {}, skillOnceUsed: {},
  };
}

describe('personalityEffects', () => {
  test('AGGRESSIVE: buff atkMul when target < 30% HP', () => {
    const hero = makeHero({ personality: 'AGGRESSIVE' });
    const enemy = makeEnemy({ hp: 10, maxHp: 50 });
    const state = makeState([hero], [enemy]);

    applyPersonalityOnHit(hero, enemy, state, 5, () => 0.5, false);
    const buff = state.buffs['h1']?.find(b => b.source === 'PERSONALITY_AGGRESSIVE');
    expect(buff?.type).toBe('atkMul');
    expect(buff?.value).toBe(1.15);
  });

  test('AGGRESSIVE: no buff when target >= 30% HP', () => {
    const hero = makeHero({ personality: 'AGGRESSIVE' });
    const enemy = makeEnemy({ hp: 40, maxHp: 50 });
    const state = makeState([hero], [enemy]);

    applyPersonalityOnHit(hero, enemy, state, 5, () => 0.5, false);
    expect(state.buffs['h1']).toBeUndefined();
  });

  test('CAUTIOUS: buff crit when no move', () => {
    const hero = makeHero({ personality: 'CAUTIOUS' });
    const enemy = makeEnemy();
    const state = makeState([hero], [enemy]);

    applyPersonalityOnHit(hero, enemy, state, 5, () => 0.5, false);
    const buff = state.buffs['h1']?.find(b => b.source === 'PERSONALITY_CAUTIOUS');
    expect(buff?.type).toBe('critFlat');
  });

  test('CAUTIOUS: no buff when moved', () => {
    const hero = makeHero({ personality: 'CAUTIOUS' });
    const enemy = makeEnemy();
    const state = makeState([hero], [enemy]);

    applyPersonalityOnHit(hero, enemy, state, 5, () => 0.5, true);
    expect(state.buffs['h1']).toBeUndefined();
  });

  test('VENGEFUL: buff against last attacker', () => {
    const hero = makeHero({ personality: 'VENGEFUL' });
    const enemy = makeEnemy();
    const state = makeState([hero], [enemy]);
    state.lastAttacker['h1'] = 'e1';

    applyPersonalityOnHit(hero, enemy, state, 5, () => 0.5, false);
    const buff = state.buffs['h1']?.find(b => b.source === 'PERSONALITY_VENGEFUL');
    expect(buff?.value).toBe(1.25);
  });

  test('OPPORTUNIST: extra attack chance on kill', () => {
    const hero = makeHero({ personality: 'OPPORTUNIST' });
    const enemy = makeEnemy({ hp: 0 });
    const state = makeState([hero], [enemy]);

    const extra = applyPersonalityOnHit(hero, enemy, state, 5, () => 0.1, false);
    expect(extra).toBe(true);
  });

  test('OPPORTUNIST: no extra attack when rng >= 0.25', () => {
    const hero = makeHero({ personality: 'OPPORTUNIST' });
    const enemy = makeEnemy({ hp: 0 });
    const state = makeState([hero], [enemy]);

    const extra = applyPersonalityOnHit(hero, enemy, state, 5, () => 0.5, false);
    expect(extra).toBe(false);
  });

  test('PROTECTOR: shield on adjacent injured ally', () => {
    const hero = makeHero({ id: 'prot', personality: 'PROTECTOR' });
    const ally = makeHero({ id: 'ally', hpCurrent: 30, hpMax: 100 });
    const state = makeState([hero, ally], [makeEnemy()]);
    state.heroPositions['prot'] = 40;
    state.heroPositions['ally'] = 41;

    applyProtectorShield(hero, state);
    const shield = state.buffs['ally']?.find(b => b.source === 'PERSONALITY_PROTECTOR');
    expect(shield?.type).toBe('shield');
    expect(shield?.value).toBe(0.20);
  });
});
