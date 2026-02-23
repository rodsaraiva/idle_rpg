import { gameReducer, initialGameState } from '../../context/gameReducer';
import { HeroTask } from '../../types';

test('START_MISSION rejects missing, incapacitated, or mission heroes', () => {
  const now = Date.now();
  const validHero = { id: 'h1', name: 'V', hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, currentTask: HeroTask.IDLE };
  const incapacitated = { id: 'h2', name: 'I', hpMax: 10, hpCurrent: 1, atk: 5, mp: 0, currentTask: HeroTask.IDLE, incapacitatedUntilMs: now + 60000 };
  const inMission = { id: 'h3', name: 'M', hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, currentTask: HeroTask.MISSION };

  const state = { ...initialGameState, heroes: [validHero, incapacitated, inMission], activeMissions: [] };

  // missing hero id should abort
  const s1 = gameReducer(state as any, { type: 'START_MISSION', templateId: 'mission_1', heroIds: ['nope'] });
  expect(s1.activeMissions).toBeUndefined();

  // incapacitated should abort
  const s2 = gameReducer(state as any, { type: 'START_MISSION', templateId: 'mission_1', heroIds: ['h2'] });
  expect(s2.activeMissions).toBeUndefined();

  // already in mission should abort
  const s3 = gameReducer(state as any, { type: 'START_MISSION', templateId: 'mission_1', heroIds: ['h3'] });
  expect(s3.activeMissions).toBeUndefined();

  // valid should proceed
  const s4 = gameReducer(state as any, { type: 'START_MISSION', templateId: 'mission_1', heroIds: ['h1'] });
  expect(s4.activeMissions && s4.activeMissions.length).toBeGreaterThanOrEqual(1);
});

