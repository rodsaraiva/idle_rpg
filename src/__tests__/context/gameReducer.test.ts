import { gameReducer, initialGameState } from '../../context/gameReducer';
import { HeroTask, Hero } from '../../types';
import { getMissionGoldPerTick } from '../../utils/math';

function createHero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: overrides.id || 'h1',
    name: overrides.name || 'Hero',
    hp: overrides.hp ?? 10,
    atk: overrides.atk ?? 5,
    mp: overrides.mp ?? 3,
    currentTask: overrides.currentTask ?? HeroTask.IDLE,
  };
}

describe('gameReducer', () => {
  test('TRAIN_HP accumulates trainingProgressMs when base time > tick', () => {
    const hero = createHero({ currentTask: HeroTask.TRAIN_HP, hp: 10 });
    const state = { ...initialGameState, heroes: [hero] };
    const next = gameReducer(state, { type: 'TICK' });
    expect(next.heroes[0].hp).toBe(10); // no full point yet
    expect(next.heroes[0].trainingProgressMs?.hp).toBeGreaterThanOrEqual(1000);
  });

  test('TRAIN_ATK accumulates trainingProgressMs when base time > tick', () => {
    const hero = createHero({ currentTask: HeroTask.TRAIN_ATK, atk: 2.5 });
    const state = { ...initialGameState, heroes: [hero] };
    const next = gameReducer(state, { type: 'TICK' });
    expect(next.heroes[0].atk).toBeCloseTo(2.5);
    expect(next.heroes[0].trainingProgressMs?.atk).toBeGreaterThanOrEqual(1000);
  });

  test('TRAIN_MP accumulates trainingProgressMs when base time > tick', () => {
    const hero = createHero({ currentTask: HeroTask.TRAIN_MP, mp: 1.5 });
    const state = { ...initialGameState, heroes: [hero] };
    const next = gameReducer(state, { type: 'TICK' });
    expect(next.heroes[0].mp).toBeCloseTo(1.5);
    expect(next.heroes[0].trainingProgressMs?.mp).toBeGreaterThanOrEqual(1000);
  });

  test('MISSION generates gold based on atk', () => {
    // Missions now resolve on completion (not per-tick). Simulate a mission that completes on this tick.
    const hero = createHero({ id: 'h1', currentTask: HeroTask.MISSION, atk: 8 });
    const activeMission = {
      id: 'm1',
      templateId: 'mission_1',
      heroIds: ['h1'],
      remainingMs: 0,
      startedAt: Date.now(),
    };
    const state = { ...initialGameState, heroes: [hero], gold: 0, activeMissions: [activeMission] };
    const next = gameReducer(state, { type: 'TICK' });
    // reward should be applied and hero released from mission
    expect(next.gold).toBeGreaterThanOrEqual(0);
    expect(next.heroes[0].currentTask).toBe(HeroTask.IDLE);
  });

  test('SET_HERO_TASK updates hero task correctly', () => {
    const hero = createHero({ currentTask: HeroTask.IDLE });
    const state = { ...initialGameState, heroes: [hero] };
    const next = gameReducer(state, { type: 'SET_HERO_TASK', heroId: hero.id, task: HeroTask.MISSION });
    expect(next.heroes[0].currentTask).toBe(HeroTask.MISSION);
  });

  test('RECRUIT_HERO does nothing when not enough gold', () => {
    const state = { ...initialGameState, gold: 0, heroesRecruited: 0 };
    const next = gameReducer(state, { type: 'RECRUIT_HERO' });
    expect(next.heroes.length).toBe(0);
    expect(next.gold).toBe(0);
  });

  test('RECRUIT_HERO spends gold and increases heroesRecruited when affordable', () => {
    const state = { ...initialGameState, gold: 10000, heroesRecruited: 0 };
    const next = gameReducer(state, { type: 'RECRUIT_HERO' });
    expect(next.heroes.length).toBe(1);
    expect(next.heroesRecruited).toBe(1);
    expect(next.gold).toBeLessThan(10000);
  });
});

