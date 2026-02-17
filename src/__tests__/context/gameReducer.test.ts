import { gameReducer, initialGameState } from '../../context/gameReducer';
import { HeroTask, Hero } from '../../types';
import { HP_TRAIN_PER_TICK, ATK_TRAIN_PER_TICK } from '../../constants/game';
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
  test('TRAIN_HP increases hp by HP_TRAIN_PER_TICK', () => {
    const hero = createHero({ currentTask: HeroTask.TRAIN_HP, hp: 10 });
    const state = { ...initialGameState, heroes: [hero] };
    const next = gameReducer(state, { type: 'TICK' });
    expect(next.heroes[0].hp).toBeCloseTo(10 + HP_TRAIN_PER_TICK);
  });

  test('TRAIN_ATK increases atk by ATK_TRAIN_PER_TICK (float handling)', () => {
    const hero = createHero({ currentTask: HeroTask.TRAIN_ATK, atk: 2.5 });
    const state = { ...initialGameState, heroes: [hero] };
    const next = gameReducer(state, { type: 'TICK' });
    expect(next.heroes[0].atk).toBeCloseTo(2.5 + ATK_TRAIN_PER_TICK);
  });

  test('TRAIN_MP increases mp by MP_TRAIN_PER_TICK (float handling)', () => {
    const { MP_TRAIN_PER_TICK } = require('../../constants/game');
    const hero = createHero({ currentTask: HeroTask.TRAIN_MP, mp: 1.5 });
    const state = { ...initialGameState, heroes: [hero] };
    const next = gameReducer(state, { type: 'TICK' });
    expect(next.heroes[0].mp).toBeCloseTo(1.5 + MP_TRAIN_PER_TICK);
  });

  test('MISSION generates gold based on atk', () => {
    const hero = createHero({ currentTask: HeroTask.MISSION, atk: 8 });
    const state = { ...initialGameState, heroes: [hero], gold: 0 };
    const next = gameReducer(state, { type: 'TICK' });
    expect(next.gold).toBeCloseTo(getMissionGoldPerTick(8));
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

