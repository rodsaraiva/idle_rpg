import { gameReducer, initialGameState } from '../../context/gameReducer';
import { HeroTask, Hero } from '../../types';
import { HP_REGEN_INTERVAL_MS } from '../../constants/game';

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
  };
}

test('infirmary time scaling is order-independent (10min in + 10min out == 30min out)', () => {
  // choose tickInterval = 10 minutes so each reducer TICK is 10min of real time
  const tenMin = 10 * 60 * 1000;
  const hero = makeHero('h1', 10, 5);
  const state = { ...initialGameState, heroes: [hero], tickIntervalMs: tenMin };

  // Case A: 10min inside then 10min outside
  let s = gameReducer(state as any, { type: 'START_INFERMARIA', heroIds: ['h1'] });
  s = gameReducer(s as any, { type: 'TICK' }); // 10min in infirmary
  s = gameReducer(s as any, { type: 'RELEASE_FROM_INFERMARIA', heroIds: ['h1'] });
  s = gameReducer(s as any, { type: 'TICK' }); // 10min outside
  const afterA = s.heroes.find((h) => h.id === 'h1')!;

  // Case B: 10min outside then 10min inside
  let t = gameReducer(state as any, { type: 'TICK' }); // 10min outside
  t = gameReducer(t as any, { type: 'START_INFERMARIA', heroIds: ['h1'] });
  t = gameReducer(t as any, { type: 'TICK' }); // 10min in infirmary
  const afterB = t.heroes.find((h) => h.id === 'h1')!;

  // Both should have same hp (order independent)
  expect(afterA.hpCurrent).toBe(afterB.hpCurrent);
  // And at least one point should be gained when combined equals 30min equivalent
  expect(afterA.hpCurrent).toBeGreaterThan(5);
});

test('healer MP boosts infirmary timeScale multiplicatively up to cap', () => {
  const tenMin = 10 * 60 * 1000;
  // create a wounded hero and a powerful healer (high mp) to force single-tick regen
  const hero = makeHero('h1', 10, 5);
  const healer = makeHero('he1', 10, 10, 'HEALER');
  // give healer a lot of mp to ensure boost crosses threshold
  healer.mp = 30;

  const state = { ...initialGameState, heroes: [hero, healer], tickIntervalMs: tenMin };

  // send hero to infirmary and tick once
  let s = gameReducer(state as any, { type: 'START_INFERMARIA', heroIds: ['h1'] });
  s = gameReducer(s as any, { type: 'TICK' });
  const after = s.heroes.find((h) => h.id === 'h1')!;
  // with heavy healer boost single infirmary tick should produce at least one point
  expect(after.hpCurrent).toBeGreaterThan(5);
});

test('START_MISSION rejects incapacitated heroes', () => {
  const hero = makeHero('h1', 10, 5);
  // mark hero incapacitated in future
  const now = Date.now();
  const state = { ...initialGameState, heroes: [{ ...hero, incapacitatedUntilMs: now + 60_000 }], activeMissions: [] };
  const next = gameReducer(state as any, { type: 'START_MISSION', templateId: 'mission_1', heroIds: ['h1'] });
  // should be unchanged (cannot start mission with incapacitated hero)
  expect(next.activeMissions).toBeUndefined() || expect(next.activeMissions && next.activeMissions.length).toBe(0);
  expect(next.heroes.find((h) => h.id === 'h1')?.currentTask).toBe(HeroTask.IDLE);
});

test('COMPLETE mission applies casualties and sets incapacitatedUntilMs when present', () => {
  const hero = makeHero('h1', 10, 10);
  const mission = {
    id: 'm1',
    templateId: 'mission_1',
    heroIds: ['h1'],
    remainingMs: 0,
    startedAt: Date.now(),
    precomputedOutcome: {
      reward: 5,
      casualties: [{ heroId: 'h1', hpLost: 7, hpAfter: 3, incapacitatedUntilMs: Date.now() + 30 * 60 * 1000 }],
      rounds: 1,
      actions: [],
      log: [],
      success: true,
      enemyCasualties: 0,
    },
  } as any;

  const state = { ...initialGameState, heroes: [hero], activeMissions: [mission], gold: 0 };
  const next = gameReducer(state as any, { type: 'TICK' });
  const h = next.heroes.find((x) => x.id === 'h1')!;
  expect(h.hpCurrent).toBe(3);
  expect(h.incapacitatedUntilMs && h.incapacitatedUntilMs > Date.now()).toBeTruthy();
});

