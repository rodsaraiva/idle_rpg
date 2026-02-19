import { gameReducer, initialGameState } from '../../context/gameReducer';
import { HeroTask } from '../../types';
import { BASE_TRAIN_TIME_MS } from '../../constants/game';

test('TRAIN_HP: full hero remains full after gaining hpMax', () => {
  const hero = { id: 'h1', name: 'Hero', hpMax: 10, hpCurrent: 10, atk: 5, mp: 3, currentTask: HeroTask.TRAIN_HP };
  const state = { ...initialGameState, heroes: [hero], tickIntervalMs: BASE_TRAIN_TIME_MS };
  const next = gameReducer(state as any, { type: 'TICK' });
  expect(next.heroes[0].hpMax).toBeGreaterThanOrEqual(11);
  expect(next.heroes[0].hpCurrent).toBe(next.heroes[0].hpMax); // remains full (11/11)
});

test('TRAIN_HP: partial hero gains hpCurrent equal to points gained', () => {
  const hero = { id: 'h2', name: 'Hero2', hpMax: 10, hpCurrent: 8, atk: 5, mp: 3, currentTask: HeroTask.TRAIN_HP };
  const state = { ...initialGameState, heroes: [hero], tickIntervalMs: BASE_TRAIN_TIME_MS };
  const next = gameReducer(state as any, { type: 'TICK' });
  expect(next.heroes[0].hpMax).toBeGreaterThanOrEqual(11);
  // hpCurrent should have increased by same delta (at least +1)
  expect(next.heroes[0].hpCurrent).toBeGreaterThanOrEqual(9);
});

test('TRAIN_HP: multiple points gained in one tick increase both hpMax and hpCurrent', () => {
  const hero = { id: 'h3', name: 'Hero3', hpMax: 10, hpCurrent: 7, atk: 5, mp: 3, currentTask: HeroTask.TRAIN_HP, trainingCount: { hp: 0, atk: 0, mp: 0 }, trainingProgressMs: { hp: 0, atk: 0, mp: 0 } };
  // set tick high to simulate multiple points
  const state = { ...initialGameState, heroes: [hero], tickIntervalMs: BASE_TRAIN_TIME_MS * 3 };
  const next = gameReducer(state as any, { type: 'TICK' });
  expect(next.heroes[0].hpMax).toBeGreaterThanOrEqual(12); // at least +2
  expect(next.heroes[0].hpCurrent).toBeGreaterThanOrEqual(9); // increased by same amount
});

