import { gameReducer, initialGameState } from '../../context/gameReducer';
import { HeroTask } from '../../types';
import { HP_REGEN_INTERVAL_MS } from '../../constants/game';

function makeHero() {
  return { id: 'h1', name: 'H', hpMax: 10, hpCurrent: 0, atk: 0, mp: 0, currentTask: HeroTask.IDLE };
}

test('multiple regen intervals applied in one large tick', () => {
  const hero = makeHero();
  const largeTick = HP_REGEN_INTERVAL_MS * 3; // should give 3 points
  const state = { ...initialGameState, heroes: [hero], tickIntervalMs: largeTick };
  const next = gameReducer(state as any, { type: 'TICK', now: Date.now() });
  expect(next.heroes[0].hpCurrent).toBeGreaterThanOrEqual(3);
});

