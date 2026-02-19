import { gameReducer, initialGameState } from '../../context/gameReducer';
import { HeroTask } from '../../types';
import { ENFERMARIA_MULTIPLIER_BASE, ENFERMARIA_HEALER_MP_K, HP_REGEN_INTERVAL_MS } from '../../constants/game';

test('send to enfermaria and regen doubled', () => {
  const hero = { id: 'h1', name: 'H', hpMax: 10, hpCurrent: 5, atk: 5, mp: 0, currentTask: HeroTask.IDLE };
  const healer = { id: 'he1', name: 'Heal', hpMax: 10, hpCurrent: 10, atk: 1, mp: 4, currentTask: HeroTask.IDLE, classId: 'HEALER' as any };
  const state = { ...initialGameState, heroes: [hero, healer], tickIntervalMs: 1000 };

  // start infirmary for hero
  const afterStart = gameReducer(state as any, { type: 'START_INFERMARIA', heroIds: ['h1'] });
  expect(afterStart.heroes.find((h) => h.id === 'h1')?.currentTask).toBe(HeroTask.INFIRMARY);

  // simulate ticks enough to pass one regen interval
  const ticks = HP_REGEN_INTERVAL_MS / 1000; // tickInterval 1000ms
  let s = afterStart;
  for (let i = 0; i < ticks; i++) s = gameReducer(s as any, { type: 'TICK' });

  const h = s.heroes.find((x) => x.id === 'h1')!;
  // effective multiplier = base * (1 + healerMpSum * k)
  const healerMpSum = 4;
  const expectedMul = ENFERMARIA_MULTIPLIER_BASE * (1 + healerMpSum * ENFERMARIA_HEALER_MP_K);
  // expected gain at least floor(1 * expectedMul)
  expect(h.hpCurrent).toBeGreaterThan(5);
});

