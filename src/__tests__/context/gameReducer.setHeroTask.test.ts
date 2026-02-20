import { gameReducer, initialGameState } from '../../context/gameReducer';
import { HeroTask, Hero } from '../../types';

function createHero(id = 'h1', task = HeroTask.IDLE): Hero {
  return {
    id,
    name: 'Hero',
    hpMax: 10,
    hpCurrent: 10,
    atk: 5,
    mp: 3,
    currentTask: task,
  } as Hero;
}

test('SET_HERO_TASK does not interrupt heroes in mission', () => {
  const hero = createHero('h1', HeroTask.MISSION);
  const state = { ...initialGameState, heroes: [hero] };
  const next = gameReducer(state, { type: 'SET_HERO_TASK', heroId: 'h1', task: HeroTask.TRAIN_HP } as any);
  expect(next.heroes[0].currentTask).toBe(HeroTask.MISSION);
});

test('START_INFERMARIA can send training hero to infirmary but not mission hero', () => {
  const tHero = createHero('t1', HeroTask.TRAIN_HP);
  tHero.hpCurrent = 5;
  const mHero = createHero('m1', HeroTask.MISSION);
  mHero.hpCurrent = 5;
  const state = { ...initialGameState, heroes: [tHero, mHero] as Hero[], activeMissions: [] as any[] };

  // attempt to send both to infirmary
  const after = gameReducer(state, { type: 'START_INFERMARIA', heroIds: ['t1', 'm1'] } as any);
  // training hero should be in infirmary
  const t = after.heroes.find((h) => h.id === 't1');
  const m = after.heroes.find((h) => h.id === 'm1');
  expect(t?.currentTask).toBe(HeroTask.INFIRMARY);
  // mission hero should remain on mission
  expect(m?.currentTask).toBe(HeroTask.MISSION);
});

