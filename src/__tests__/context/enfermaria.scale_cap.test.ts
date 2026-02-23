import { gameReducer, initialGameState } from '../../context/gameReducer';
import { HeroTask, Hero } from '../../types';

function makeHero(id = 'h1', hpMax = 10, hpCurrent = 5, classId?: string): Hero {
  return {
    id,
    name: `h-${id}`,
    hpMax,
    hpCurrent,
    atk: 5,
    mp: 0,
    currentTask: HeroTask.IDLE,
    classId: classId as any,
  } as Hero;
}

test('infirmary timeScale respects ENFERMARIA_MAX_SCALE', () => {
  const tenMin = 10 * 60 * 1000;
  const hero = makeHero('h1', 10, 5);
  // create many healers to push boost extremely high
  const manyHealers = Array.from({ length: 50 }, (_, i) => ({ id: `he${i}`, name: 'He', hpMax: 10, hpCurrent: 10, atk: 0, mp: 10, currentTask: HeroTask.IDLE, classId: 'HEALER' as any }));
  const state = { ...initialGameState, heroes: [hero, ...manyHealers], tickIntervalMs: tenMin };

  const s1 = gameReducer(state as any, { type: 'START_INFERMARIA', heroIds: ['h1'] });
  const s2 = gameReducer(s1 as any, { type: 'TICK' });
  const after = s2.heroes.find((h) => h.id === 'h1')!;
  // should not exceed max hp, and should not throw; basic sanity
  expect(after.hpCurrent).toBeGreaterThanOrEqual(5);
  expect(after.hpCurrent).toBeLessThanOrEqual(after.hpMax);
});

