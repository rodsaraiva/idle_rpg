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
  };
}

test('START_MISSION assigns heroes and creates active mission', () => {
  const hero = createHero('h1', HeroTask.IDLE);
  const state = { ...initialGameState, heroes: [hero], activeMissions: [], gold: 0 };
  const next = gameReducer(state, { type: 'START_MISSION', templateId: 'mission_1', heroIds: ['h1'], now: Date.now() });
  expect(next.activeMissions && next.activeMissions.length).toBe(1);
  expect(next.heroes[0].currentTask).toBe(HeroTask.MISSION);
});

test('COMPLETE_MISSION adds reward and releases heroes', () => {
  const hero = createHero('h1', HeroTask.MISSION);
  const activeMission = { id: 'm1', templateId: 'mission_1', heroIds: ['h1'], startedAt: Date.now() };
  const state = { ...initialGameState, heroes: [hero], activeMissions: [activeMission], gold: 0 };
  const next = gameReducer(state, { type: 'COMPLETE_MISSION', missionId: 'm1', reward: 50 });
  expect(next.gold).toBe(50);
  expect(next.activeMissions?.length).toBe(0);
  expect(next.heroes[0].currentTask).toBe(HeroTask.IDLE);
});

test('DISMISS_MISSION_RESULT removes result from state', () => {
  const result = { missionId: 'm1', templateId: 't1', reward: 10, success: true, rounds: 1, actions: [], log: [], casualties: [], enemyCasualties: 0 };
  const state = { ...initialGameState, recentMissionResults: [result] };
  const next = gameReducer(state, { type: 'DISMISS_MISSION_RESULT', missionId: 'm1' });
  expect(next.recentMissionResults?.length).toBe(0);
});

test('START_MISSION returns state if template not found', () => {
  const state = { ...initialGameState };
  const next = gameReducer(state, { type: 'START_MISSION', templateId: 'invalid', heroIds: [], now: Date.now() });
  expect(next).toBe(state);
});

test('START_MISSION returns state if heroIds length < minHeroes', () => {
  const state = { ...initialGameState };
  // mission_2 needs 2 heroes
  const next = gameReducer(state, { type: 'START_MISSION', templateId: 'mission_2', heroIds: ['h1'], now: Date.now() });
  expect(next).toBe(state);
});

