import { handleTick } from '../../context/tickHandler';
import { initialGameState } from '../../context/gameReducer';
import { HeroTask, Hero } from '../../types';

function createHero(overrides: Partial<Hero> = {}): Hero {
  const hpVal = overrides.hpMax ?? 10;
  return {
    id: overrides.id || 'h1',
    name: overrides.name || 'Hero',
    hpMax: hpVal,
    hpCurrent: overrides.hpCurrent ?? hpVal,
    atk: overrides.atk ?? 5,
    mp: overrides.mp ?? 3,
    currentTask: overrides.currentTask ?? HeroTask.IDLE,
    trainingProgressMs: overrides.trainingProgressMs ?? { hp: 0, atk: 0, mp: 0 },
    trainingCount: overrides.trainingCount ?? { hp: 0, atk: 0, mp: 0 },
  } as Hero;
}

describe('tickHandler', () => {
  test('handleTick should process training for heroes', () => {
    const hero = createHero({ currentTask: HeroTask.TRAIN_HP });
    const state = { ...initialGameState, heroes: [hero] };
    
    const next = handleTick(state);
    
    expect(next.heroes[0].trainingProgressMs?.hp).toBeGreaterThan(0);
  });

  test('handleTick should handle regeneration for heroes', () => {
    const hero = createHero({ hpCurrent: 5, hpMax: 10, currentTask: HeroTask.IDLE });
    // tick for longer than regen interval
    const state = { ...initialGameState, heroes: [hero], tickIntervalMs: 20 * 60 * 1000 };
    
    const next = handleTick(state);
    
    expect(next.heroes[0].hpCurrent).toBeGreaterThan(5);
  });
});
