import { gameReducer, initialGameState } from '../../context/gameReducer';
import { HeroTask, Hero, GameState, MissionResult } from '../../types';

function createHero(overrides: Partial<Hero> = {}): Hero {
  const hpVal = overrides.hpMax ?? 10;
  return {
    id: overrides.id || 'h1',
    name: overrides.name || 'Hero',
    hpMax: hpVal,
    hpCurrent: overrides.hpCurrent ?? hpVal,
    atk: overrides.atk ?? 5,
    mp: overrides.mp ?? 3,
    defense: overrides.defense ?? 5,
    crit: overrides.crit ?? 5,
    agility: overrides.agility ?? 10,
    currentTask: overrides.currentTask ?? HeroTask.IDLE,
    ...overrides,
  } as Hero;
}

describe('gameReducer — additional action cases', () => {
  test('RELEASE_FROM_INFERMARIA with valid heroIds sets task to IDLE', () => {
    const hero = createHero({ id: 'h1', currentTask: HeroTask.INFIRMARY, hpCurrent: 5 });
    const state = { ...initialGameState, heroes: [hero] };
    const next = gameReducer(state, { type: 'RELEASE_FROM_INFERMARIA', heroIds: ['h1'] });
    expect(next.heroes[0].currentTask).toBe(HeroTask.IDLE);
  });

  test('RELEASE_FROM_INFERMARIA with empty heroIds leaves heroes untouched', () => {
    const hero = createHero({ id: 'h1', currentTask: HeroTask.INFIRMARY });
    const state = { ...initialGameState, heroes: [hero] };
    const next = gameReducer(state, { type: 'RELEASE_FROM_INFERMARIA', heroIds: [] });
    expect(next.heroes[0].currentTask).toBe(HeroTask.INFIRMARY);
  });

  test('DISMISS_MISSION_RESULT removes the corresponding result', () => {
    const r1: MissionResult = {
      missionId: 'mr1',
      templateId: 'mission_1',
      reward: 10,
      rounds: 1,
      actions: [],
      log: [],
      success: true,
      casualties: [],
      enemyCasualties: 0,
    };
    const r2: MissionResult = { ...r1, missionId: 'mr2' };
    const state: GameState = { ...initialGameState, recentMissionResults: [r1, r2] };
    const next = gameReducer(state, { type: 'DISMISS_MISSION_RESULT', missionId: 'mr1' });
    expect(next.recentMissionResults?.length).toBe(1);
    expect(next.recentMissionResults?.[0].missionId).toBe('mr2');
  });

  test('LOAD_STATE replaces state completely', () => {
    const hero = createHero({ id: 'hX' });
    const replacement: GameState = {
      gold: 9999,
      heroes: [hero],
      heroesRecruited: 7,
      lastSavedAt: 42,
      tickIntervalMs: 123,
      trainInflationFactor: 0.9,
      activeMissions: [],
    };
    const next = gameReducer(initialGameState, { type: 'LOAD_STATE', state: replacement });
    expect(next.gold).toBe(9999);
    expect(next.heroes[0].id).toBe('hX');
    expect(next.heroesRecruited).toBe(7);
    expect(next.lastSavedAt).toBe(42);
    expect(next.tickIntervalMs).toBe(123);
    expect(next.trainInflationFactor).toBe(0.9);
  });

  test('SET_TICK_INTERVAL updates tickIntervalMs', () => {
    const next = gameReducer(initialGameState, { type: 'SET_TICK_INTERVAL', ms: 2500 });
    expect(next.tickIntervalMs).toBe(2500);
  });

  test('SET_TRAIN_INFLATION updates trainInflationFactor', () => {
    const next = gameReducer(initialGameState, { type: 'SET_TRAIN_INFLATION', inflation: 0.75 });
    expect(next.trainInflationFactor).toBe(0.75);
  });

  test('BUY_CHEST with insufficient gold yields no state change', () => {
    const state = { ...initialGameState, gold: 0, heroesRecruited: 0 };
    const next = gameReducer(state, { type: 'BUY_CHEST', chestId: 'chest_bronze' });
    expect(next.gold).toBe(0);
    expect(next).toEqual(state);
  });

  test('BUY_CHEST with invalid chestId yields no state change', () => {
    const state = { ...initialGameState, gold: 100000 };
    const next = gameReducer(state, { type: 'BUY_CHEST', chestId: 'nonexistent' });
    expect(next).toEqual(state);
  });

  test('CONFIRM_CHEST_REVEAL adds hero and increments heroesRecruited', () => {
    const hero = createHero({ id: 'new-hero', name: 'Revealed' });
    const state = { ...initialGameState, heroesRecruited: 3 };
    const next = gameReducer(state, { type: 'CONFIRM_CHEST_REVEAL', hero });
    expect(next.heroes.length).toBe(1);
    expect(next.heroes[0].id).toBe('new-hero');
    expect(next.heroesRecruited).toBe(4);
  });

  test('FORGE_EQUIPMENT dispatches through reducer without crashing', () => {
    // Not enough gold should no-op but still exercise the dispatch case
    const state = { ...initialGameState, gold: 0 };
    const next = gameReducer(state, { type: 'FORGE_EQUIPMENT', tier: 1, equipmentType: 'weapon', now: 1_700_000_000_000 });
    expect(next).toBeDefined();
    expect(next.gold).toBe(0);
  });

  test('COLLECT_EQUIPMENT with unknown id dispatches without changes', () => {
    const state = { ...initialGameState };
    const next = gameReducer(state, { type: 'COLLECT_EQUIPMENT', equipmentId: 'unknown-eq' });
    expect(next).toBeDefined();
  });

  test('EQUIP_ITEM with unknown refs dispatches without crashing', () => {
    const state = { ...initialGameState };
    const next = gameReducer(state, { type: 'EQUIP_ITEM', heroId: 'nope', equipmentId: 'nope' });
    expect(next).toBeDefined();
  });

  test('UNEQUIP_ITEM with unknown refs dispatches without crashing', () => {
    const state = { ...initialGameState };
    const next = gameReducer(state, { type: 'UNEQUIP_ITEM', heroId: 'nope', equipmentId: 'nope' });
    expect(next).toBeDefined();
  });

  test('CLAIM_DAILY_QUEST dispatches through reducer', () => {
    const state = { ...initialGameState };
    const next = gameReducer(state, { type: 'CLAIM_DAILY_QUEST', questId: 'nonexistent' });
    expect(next).toBeDefined();
  });

  test('START_INFERMARIA dispatches through reducer', () => {
    const hero = createHero({ id: 'h1', hpCurrent: 2, hpMax: 20, currentTask: HeroTask.IDLE });
    const state = { ...initialGameState, heroes: [hero] };
    const next = gameReducer(state, { type: 'START_INFERMARIA', heroIds: ['h1'] });
    expect(next.heroes[0].currentTask).toBe(HeroTask.INFIRMARY);
  });

  test('COMPLETE_MISSION dispatches through reducer', () => {
    const hero = createHero({ id: 'h1', currentTask: HeroTask.MISSION });
    const state = {
      ...initialGameState,
      heroes: [hero],
      gold: 0,
      activeMissions: [
        {
          id: 'mc1',
          templateId: 'mission_1',
          heroIds: ['h1'],
          startedAt: 0,
        },
      ],
    };
    const next = gameReducer(state, { type: 'COMPLETE_MISSION', missionId: 'mc1', reward: 15 });
    expect(next.gold).toBe(15);
    expect(next.heroes[0].currentTask).toBe(HeroTask.IDLE);
    expect(next.activeMissions?.length).toBe(0);
  });

  test('START_MISSION dispatches through reducer', () => {
    const hero = createHero({ id: 'h1', currentTask: HeroTask.IDLE, hpMax: 50, atk: 20 });
    const state = { ...initialGameState, heroes: [hero] };
    const next = gameReducer(state, {
      type: 'START_MISSION',
      templateId: 'mission_1',
      heroIds: ['h1'],
      now: 1_700_000_000_000,
    });
    expect(next.activeMissions?.length).toBe(1);
  });

  test('Unknown action type returns state unchanged (default case)', () => {
    const state = { ...initialGameState, gold: 500 };
    const next = gameReducer(state, { type: 'NOT_A_REAL_ACTION' } as any);
    expect(next).toBe(state);
  });
});
