import { gameReducer, initialGameState } from '../../context/gameReducer';
import { HeroTask, Hero } from '../../types';

function createHero(id = 'h1', task = HeroTask.IDLE): Hero {
  return {
    id,
    name: 'Hero',
    hp: 10,
    atk: 5,
    mp: 3,
    currentTask: task,
  };
}

test('START_MISSION assigns heroes and creates active mission', () => {
  const hero = createHero('h1', HeroTask.IDLE);
  const state = { ...initialGameState, heroes: [hero], activeMissions: [], gold: 0 };
  const next = gameReducer(state, { type: 'START_MISSION', templateId: 'mission_1', heroIds: ['h1'] });
  expect(next.activeMissions && next.activeMissions.length).toBe(1);
  expect(next.heroes[0].currentTask).toBe(HeroTask.MISSION);
});

