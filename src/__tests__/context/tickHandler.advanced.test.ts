import { handleTick } from '../../context/tickHandler';
import { initialGameState } from '../../context/gameReducer';
import { HeroTask, Hero, ActiveMission, MissionOutcome } from '../../types';
import { MISSION_FINISH_DELAY_MS } from '../../constants/game';

function createHero(overrides: Partial<Hero> = {}): Hero {
  const hpVal = overrides.hpMax ?? 20;
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
    currentTask: overrides.currentTask ?? HeroTask.MISSION,
    trainingProgressMs: overrides.trainingProgressMs ?? { hp: 0, atk: 0, mp: 0 },
    trainingCount: overrides.trainingCount ?? { hp: 0, atk: 0, mp: 0 },
    ...overrides,
  } as Hero;
}

const FIXED_NOW = 1_700_000_000_000;

describe('tickHandler — processMissions branches', () => {
  test('applies scheduled hero hit action to enemy hp', () => {
    const hero = createHero({ id: 'h1' });
    const startedAt = FIXED_NOW - 5000; // elapsed=5000 > atMsFromStart=100
    const mission: ActiveMission = {
      id: 'm1',
      templateId: 'mission_1',
      heroIds: ['h1'],
      startedAt,
      enemiesState: [
        { id: 'enemy_0_0', hp: 10, maxHp: 10, atk: 1, mp: 1, alive: true },
      ],
      scheduledActions: [
        {
          atMsFromStart: 100,
          action: {
            actorType: 'hero',
            actionType: 'hit',
            actorId: 'h1',
            targetId: 'enemy_0_0',
            amount: 5,
            text: 'h1 hits enemy',
          },
          applied: false,
        },
      ],
    };

    const state = { ...initialGameState, heroes: [hero], activeMissions: [mission] };
    const next = handleTick(state, FIXED_NOW);

    const updatedMission = next.activeMissions?.find((m) => m.id === 'm1');
    expect(updatedMission?.enemiesState?.[0].hp).toBe(5);
    expect(updatedMission?.scheduledActions?.[0].applied).toBe(true);
  });

  test('applies scheduled enemy hit action to hero hpCurrent', () => {
    const hero = createHero({ id: 'h1', hpMax: 20, hpCurrent: 20 });
    const startedAt = FIXED_NOW - 5000;
    const mission: ActiveMission = {
      id: 'm-enemy-hit',
      templateId: 'mission_1',
      heroIds: ['h1'],
      startedAt,
      enemiesState: [
        { id: 'enemy_0_0', hp: 10, maxHp: 10, atk: 3, mp: 1, alive: true },
      ],
      scheduledActions: [
        {
          atMsFromStart: 100,
          action: {
            actorType: 'enemy',
            actionType: 'hit',
            actorId: 'enemy_0_0',
            targetId: 'h1',
            amount: 7,
            text: 'enemy hits h1',
          },
          applied: false,
        },
      ],
    };

    const state = { ...initialGameState, heroes: [hero], activeMissions: [mission] };
    const next = handleTick(state, FIXED_NOW);

    expect(next.heroes[0].hpCurrent).toBe(13);
    const updatedMission = next.activeMissions?.find((m) => m.id === 'm-enemy-hit');
    expect(updatedMission?.scheduledActions?.[0].applied).toBe(true);
  });

  test('applies scheduled move action to enemy position and hero position', () => {
    const hero = createHero({ id: 'h1' });
    const startedAt = FIXED_NOW - 5000;
    const mission: ActiveMission = {
      id: 'm-move',
      templateId: 'mission_1',
      heroIds: ['h1'],
      heroPositions: { h1: 47 },
      startedAt,
      enemiesState: [
        { id: 'enemy_0_0', hp: 10, maxHp: 10, atk: 1, mp: 1, alive: true, position: 2 },
      ],
      scheduledActions: [
        {
          atMsFromStart: 100,
          action: {
            actorType: 'enemy',
            actionType: 'move',
            actorId: 'enemy_0_0',
            toPosition: 7,
            text: 'enemy moves',
          },
          applied: false,
        },
        {
          atMsFromStart: 200,
          action: {
            actorType: 'hero',
            actionType: 'move',
            actorId: 'h1',
            toPosition: 42,
            text: 'hero moves',
          },
          applied: false,
        },
      ],
    };

    const state = { ...initialGameState, heroes: [hero], activeMissions: [mission] };
    const next = handleTick(state, FIXED_NOW);

    const updatedMission = next.activeMissions?.find((m) => m.id === 'm-move');
    expect(updatedMission?.enemiesState?.[0].position).toBe(7);
    expect(updatedMission?.heroPositions?.h1).toBe(42);
  });

  test('scheduled defeat action with no enemies alive sets finishAt', () => {
    const hero = createHero({ id: 'h1' });
    const startedAt = FIXED_NOW - 5000;
    const mission: ActiveMission = {
      id: 'm-defeat',
      templateId: 'mission_1',
      heroIds: ['h1'],
      startedAt,
      enemiesState: [
        { id: 'enemy_0_0', hp: 0, maxHp: 10, atk: 1, mp: 1, alive: false },
      ],
      scheduledActions: [
        {
          atMsFromStart: 100,
          action: {
            actorType: 'hero',
            actionType: 'defeat',
            actorId: 'h1',
            targetId: 'enemy_0_0',
            text: 'enemy defeated',
          },
          applied: false,
        },
      ],
    };

    const state = { ...initialGameState, heroes: [hero], activeMissions: [mission] };
    const next = handleTick(state, FIXED_NOW);

    const updatedMission = next.activeMissions?.find((m) => m.id === 'm-defeat');
    expect(updatedMission?.finishAt).toBeDefined();
    expect(updatedMission?.finishAt).toBeGreaterThanOrEqual(FIXED_NOW);
  });

  test('mission with finishAt in past and precomputedOutcome completes with gold and releases heroes', () => {
    const hero = createHero({ id: 'h1', currentTask: HeroTask.MISSION });
    const precomputedOutcome: MissionOutcome = {
      reward: 42,
      rounds: 3,
      actions: [],
      log: ['victory'],
      success: true,
      casualties: [{ heroId: 'h1', hpLost: 2, hpAfter: 18 }],
      enemyCasualties: 2,
    };
    const mission: ActiveMission = {
      id: 'm-complete',
      templateId: 'mission_1',
      heroIds: ['h1'],
      startedAt: FIXED_NOW - 10_000,
      finishAt: FIXED_NOW - 100,
      enemiesState: [],
      scheduledActions: [],
      precomputedOutcome,
    };

    // Pre-unlock achievements so they don't add extra gold during the tick
    const unlockedAll = ['first_mission', 'five_missions', 'twenty_missions', 'mission_variety_3', 'all_mission_types', 'gold_100', 'gold_1000', 'gold_10000', 'recruit_3', 'recruit_5'];
    const state = { ...initialGameState, heroes: [hero], gold: 0, activeMissions: [mission], unlockedAchievements: unlockedAll };
    const next = handleTick(state, FIXED_NOW);

    expect(next.gold).toBeGreaterThanOrEqual(42);
    expect(next.heroes[0].currentTask).toBe(HeroTask.IDLE);
    expect(next.heroes[0].hpCurrent).toBe(18);
    expect(next.activeMissions?.length).toBe(0);
    expect(next.recentMissionResults?.length).toBe(1);
    expect(next.recentMissionResults?.[0].missionId).toBe('m-complete');
  });

  test('looping mission on success restarts with new id and fresh scheduledActions', () => {
    const hero = createHero({ id: 'h1', currentTask: HeroTask.MISSION, atk: 20, hpMax: 50, hpCurrent: 50 });
    const precomputedOutcome: MissionOutcome = {
      reward: 10,
      rounds: 2,
      actions: [],
      log: ['ok'],
      success: true,
      casualties: [{ heroId: 'h1', hpLost: 0, hpAfter: 50 }],
      enemyCasualties: 2,
    };
    const mission: ActiveMission = {
      id: 'm-loop',
      templateId: 'mission_1',
      heroIds: ['h1'],
      startedAt: FIXED_NOW - 10_000,
      finishAt: FIXED_NOW - 100,
      enemiesState: [],
      scheduledActions: [],
      precomputedOutcome,
      looping: true,
    };

    const unlockedAll = ['first_mission', 'five_missions', 'twenty_missions', 'mission_variety_3', 'all_mission_types', 'gold_100', 'gold_1000', 'gold_10000', 'recruit_3', 'recruit_5'];
    const state = { ...initialGameState, heroes: [hero], gold: 0, activeMissions: [mission], unlockedAchievements: unlockedAll };
    const next = handleTick(state, FIXED_NOW);

    expect(next.gold).toBeGreaterThanOrEqual(10);
    // original mission removed but a new looping mission pushed with new uuid
    expect(next.activeMissions?.length).toBe(1);
    expect(next.activeMissions?.[0].id).not.toBe('m-loop');
    expect(next.activeMissions?.[0].templateId).toBe('mission_1');
    expect(next.activeMissions?.[0].looping).toBe(true);
    expect(next.activeMissions?.[0].scheduledActions?.length).toBeGreaterThan(0);
    // Hero should not be released to IDLE since loop continues
    expect(next.heroes[0].currentTask).toBe(HeroTask.MISSION);
  });

  test('looping success applies equipment stat bonuses for next cycle', () => {
    const hero = createHero({
      id: 'h1',
      currentTask: HeroTask.MISSION,
      atk: 20,
      hpMax: 50,
      hpCurrent: 50,
      equippedItems: ['eq-weapon', 'eq-missing'],
    });
    const inventory = [
      {
        id: 'eq-weapon',
        name: 'Test Sword',
        type: 'weapon' as const,
        tier: 1,
        statBonus: { hp: 3, atk: 2, mp: 1, defense: 1, crit: 1, agility: 1 },
      },
    ];
    const precomputedOutcome: MissionOutcome = {
      reward: 5,
      rounds: 2,
      actions: [],
      log: ['ok'],
      success: true,
      casualties: [{ heroId: 'h1', hpLost: 0, hpAfter: 50 }],
      enemyCasualties: 2,
    };
    const mission: ActiveMission = {
      id: 'm-loop-eq',
      templateId: 'mission_1',
      heroIds: ['h1'],
      startedAt: FIXED_NOW - 10_000,
      finishAt: FIXED_NOW - 100,
      enemiesState: [],
      scheduledActions: [],
      precomputedOutcome,
      looping: true,
    };
    const unlockedAll = ['first_mission', 'five_missions', 'twenty_missions', 'mission_variety_3', 'all_mission_types', 'gold_100', 'gold_1000', 'gold_10000', 'recruit_3', 'recruit_5'];
    const state = {
      ...initialGameState,
      heroes: [hero],
      inventory,
      gold: 0,
      activeMissions: [mission],
      unlockedAchievements: unlockedAll,
    };
    const next = handleTick(state, FIXED_NOW);

    // Looped mission should have been re-pushed
    expect(next.activeMissions?.length).toBe(1);
    expect(next.activeMissions?.[0].looping).toBe(true);
    expect(next.activeMissions?.[0].id).not.toBe('m-loop-eq');
  });

  test('looping mission on failure stops looping and releases heroes', () => {
    const hero = createHero({ id: 'h1', currentTask: HeroTask.MISSION, hpCurrent: 1 });
    const precomputedOutcome: MissionOutcome = {
      reward: 0,
      rounds: 5,
      actions: [],
      log: ['dead'],
      success: false,
      casualties: [{ heroId: 'h1', hpLost: 19, hpAfter: 1 }],
      enemyCasualties: 0,
    };
    const mission: ActiveMission = {
      id: 'm-loop-fail',
      templateId: 'mission_1',
      heroIds: ['h1'],
      startedAt: FIXED_NOW - 10_000,
      finishAt: FIXED_NOW - 100,
      enemiesState: [],
      scheduledActions: [],
      precomputedOutcome,
      looping: true,
    };

    const state = { ...initialGameState, heroes: [hero], gold: 0, activeMissions: [mission] };
    const next = handleTick(state, FIXED_NOW);

    expect(next.activeMissions?.length).toBe(0);
    expect(next.heroes[0].currentTask).toBe(HeroTask.IDLE);
  });

  test('mission with invalid templateId is skipped', () => {
    const hero = createHero({ id: 'h1', currentTask: HeroTask.MISSION });
    const mission: ActiveMission = {
      id: 'm-invalid',
      templateId: 'invalid_template_id',
      heroIds: ['h1'],
      startedAt: FIXED_NOW - 5000,
      finishAt: FIXED_NOW - 100,
      enemiesState: [],
      scheduledActions: [],
    };

    const state = { ...initialGameState, heroes: [hero], gold: 0, activeMissions: [mission] };
    const next = handleTick(state, FIXED_NOW);

    // Mission kept, no gold, no completion since template lookup skipped it
    expect(next.activeMissions?.length).toBe(1);
    expect(next.activeMissions?.[0].id).toBe('m-invalid');
    expect(next.gold).toBe(0);
    expect(next.heroes[0].currentTask).toBe(HeroTask.MISSION);
  });

  test('mission auto sets finishAt when all enemies dead without explicit defeat action', () => {
    const hero = createHero({ id: 'h1', currentTask: HeroTask.MISSION });
    const mission: ActiveMission = {
      id: 'm-autofinish',
      templateId: 'mission_1',
      heroIds: ['h1'],
      startedAt: FIXED_NOW - 5000,
      enemiesState: [
        { id: 'enemy_0_0', hp: 0, maxHp: 10, atk: 1, mp: 1, alive: false },
      ],
      scheduledActions: [],
    };

    const state = { ...initialGameState, heroes: [hero], activeMissions: [mission] };
    const next = handleTick(state, FIXED_NOW);

    const updated = next.activeMissions?.find((m) => m.id === 'm-autofinish');
    expect(updated?.finishAt).toBeDefined();
    expect(updated?.finishAt).toBeGreaterThanOrEqual(FIXED_NOW);
    expect(updated?.finishAt).toBeLessThanOrEqual(FIXED_NOW + MISSION_FINISH_DELAY_MS + 10);
  });
});
