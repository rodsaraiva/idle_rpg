import { calculateOfflineProgress } from '../../utils/offlineProgress';
import { GameState, HeroTask, ActiveMission, Hero } from '../../types';
import { MISSIONS } from '../../constants/missions';
import { WEEKLY_BOSS_POOL } from '../../constants/weeklyBosses';
import { MAX_OFFLINE_MS } from '../../constants/game';

const TPL = MISSIONS.find((m) => m.id === 'mission_1')!; // durationMs 10_000
const DUR = TPL.durationMs;

function makeHero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 'h1',
    name: 'Test',
    hpMax: 50,
    hpCurrent: 50,
    atk: 10,
    mp: 5,
    defense: 5,
    crit: 10,
    agility: 5,
    currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
    ...overrides,
  };
}

function makeMission(overrides: Partial<ActiveMission> = {}): ActiveMission {
  return {
    id: 'm1',
    templateId: 'mission_1',
    heroIds: ['h1'],
    startedAt: 0,
    looping: false,
    scheduledActions: [],
    enemiesState: [],
    precomputedOutcome: {
      reward: 100,
      rounds: 1,
      actions: [],
      log: [],
      success: true,
      casualties: [],
      enemyCasualties: 0,
    },
    ...overrides,
  };
}

/** Monta um GameState salvo `elapsedSinceStartMs` atrás, com a missão iniciada em `startedAt`. */
function makeState(opts: {
  elapsedSinceSavedMs: number;
  mission: ActiveMission;
  heroes?: Hero[];
}): GameState {
  const now = Date.now();
  return {
    gold: 0,
    heroes: opts.heroes ?? [makeHero()],
    heroesRecruited: 1,
    lastSavedAt: now - opts.elapsedSinceSavedMs,
    activeMissions: [opts.mission],
  };
}

describe('calculateOfflineProgress — missões (startedAt + durationMs)', () => {
  test('loop, 1 ciclo: credita reward, herói segue em MISSION, startedAt re-armado', () => {
    const now = Date.now();
    // missão iniciada DUR antes do save; save 1ms atrás → nowOffline ≈ startedAt + DUR
    const startedAt = now - 1 - DUR;
    const mission = makeMission({ looping: true, startedAt });
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: 1 + DUR, mission }))!;
    expect(summary.goldGained).toBe(100);
    const newMission = summary.newState!.activeMissions![0];
    expect(newMission).toBeDefined();
    expect(summary.newState!.heroes[0].currentTask).toBe(HeroTask.MISSION);
    expect(newMission.startedAt).toBeGreaterThan(startedAt); // re-armado
  });

  test('loop, N ciclos: 3.5*DUR decorridos → 3*reward, leftover ~0.5*DUR', () => {
    const now = Date.now();
    const elapsed = Math.floor(3.5 * DUR);
    const startedAt = now - elapsed;
    const mission = makeMission({ looping: true, startedAt });
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: elapsed, mission }))!;
    expect(summary.goldGained).toBe(300); // 3 ciclos completos
  });

  test('não-loop, completa: credita 1x reward, herói volta a IDLE, missão sai de activeMissions', () => {
    const now = Date.now();
    const startedAt = now - 1 - DUR;
    const mission = makeMission({ looping: false, startedAt });
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: 1 + DUR, mission }))!;
    expect(summary.goldGained).toBe(100);
    expect(summary.newState!.activeMissions!.length).toBe(0);
    expect(summary.newState!.heroes[0].currentTask).toBe(HeroTask.IDLE);
  });

  test('em andamento: elapsed < DUR → gold 0, missão intacta com startedAt preservado', () => {
    const now = Date.now();
    const startedAt = now - Math.floor(DUR / 2);
    const mission = makeMission({ looping: true, startedAt });
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: Math.floor(DUR / 2), mission }));
    // ticks > 0 garantido porque elapsedSinceSaved = DUR/2 = 5000ms >> tickInterval 500ms
    expect(summary!.goldGained).toBe(0);
    expect(summary!.newState!.activeMissions![0].startedAt).toBe(startedAt);
  });

  test('cap 72h: 100h decorridas em loop → ciclos contados sobre MAX_OFFLINE_MS, não sobre 100h', () => {
    const now = Date.now();
    const hundredHours = 100 * 60 * 60 * 1000;
    const startedAt = now - hundredHours;
    const mission = makeMission({ looping: true, startedAt });
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: hundredHours, mission }))!;
    const cappedCycles = Math.floor(MAX_OFFLINE_MS / DUR);
    expect(summary.goldGained).toBe(100 * cappedCycles);
  });

  test('save do motor novo (sem remainingMs, só startedAt + precomputedOutcome) → gold creditado (regressão do bug 1.2)', () => {
    const now = Date.now();
    const startedAt = now - 1 - DUR;
    const mission = makeMission({ looping: false, startedAt });
    expect((mission as any).remainingMs).toBeUndefined();
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: 1 + DUR, mission }))!;
    expect(summary.goldGained).toBe(100);
  });

  test('split per-hero: reward 100 / 2 heróis → floor(50) por herói em perHeroGold', () => {
    const now = Date.now();
    const startedAt = now - 1 - DUR;
    const heroes = [makeHero({ id: 'h1' }), makeHero({ id: 'h2' })];
    const mission = makeMission({ looping: false, startedAt, heroIds: ['h1', 'h2'] });
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: 1 + DUR, mission, heroes }))!;
    expect(summary.newState!.perHeroGold!['h1']).toBe(50);
    expect(summary.newState!.perHeroGold!['h2']).toBe(50);
  });

  test('fonte do reward: usa precomputedOutcome.reward quando presente', () => {
    const now = Date.now();
    const startedAt = now - 1 - DUR;
    const mission = makeMission({
      looping: false,
      startedAt,
      precomputedOutcome: {
        reward: 777, rounds: 1, actions: [], log: [], success: true, casualties: [], enemyCasualties: 0,
      },
    });
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: 1 + DUR, mission }))!;
    expect(summary.goldGained).toBe(777);
  });

  test('fonte do reward: sem precomputedOutcome cai no fallback calcMissionReward (> 0)', () => {
    const now = Date.now();
    const startedAt = now - 1 - DUR;
    const mission = makeMission({ looping: false, startedAt, precomputedOutcome: undefined });
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: 1 + DUR, mission }))!;
    expect(summary.goldGained).toBeGreaterThan(0);
  });

  test('boss semanal: templateId só em WEEKLY_BOSS_POOL, isWeeklyBoss true → resolve via bossToMissionTemplate, credita gold, herói a IDLE', () => {
    const boss = WEEKLY_BOSS_POOL[0]; // wb_hydra, durationMs 180_000, minHeroes 4
    const now = Date.now();
    const startedAt = now - 1 - boss.durationMs;
    const heroes = ['h1', 'h2', 'h3', 'h4'].map((id) => makeHero({ id }));
    const mission = makeMission({
      templateId: boss.id,
      isWeeklyBoss: true,
      looping: false,
      startedAt,
      heroIds: ['h1', 'h2', 'h3', 'h4'],
      precomputedOutcome: {
        reward: 300, rounds: 1, actions: [], log: [], success: true, casualties: [], enemyCasualties: 0,
      },
    });
    const summary = calculateOfflineProgress(
      makeState({ elapsedSinceSavedMs: 1 + boss.durationMs, mission, heroes })
    )!;
    expect(summary.goldGained).toBe(300);
    expect(summary.newState!.activeMissions!.length).toBe(0);
    expect(summary.newState!.heroes[0].currentTask).toBe(HeroTask.IDLE);
  });

  test('boss semanal offline: bossDefeated marcado como true no weeklyState após conclusão', () => {
    const boss = WEEKLY_BOSS_POOL[0];
    const now = Date.now();
    const startedAt = now - 1 - boss.durationMs;
    const heroes = ['h1', 'h2', 'h3', 'h4'].map((id) => makeHero({ id }));
    const mission = makeMission({
      templateId: boss.id,
      isWeeklyBoss: true,
      looping: false,
      startedAt,
      heroIds: ['h1', 'h2', 'h3', 'h4'],
      precomputedOutcome: {
        reward: 300, rounds: 1, actions: [], log: [], success: true, casualties: [], enemyCasualties: 0,
      },
    });
    const state = {
      ...makeState({ elapsedSinceSavedMs: 1 + boss.durationMs, mission, heroes }),
      weeklyState: { seed: 1, quests: [], progress: {}, allClaimed: false, bossDefeated: false },
    };
    const summary = calculateOfflineProgress(state)!;
    expect(summary.newState!.weeklyState?.bossDefeated).toBe(true);
  });

  test('boss semanal offline: concede 1 equipamento garantido no inventory (do tier do boss)', () => {
    const boss = WEEKLY_BOSS_POOL[0]; // guaranteedRewardTier: 2
    const now = Date.now();
    const startedAt = now - 1 - boss.durationMs;
    const heroes = ['h1', 'h2', 'h3', 'h4'].map((id) => makeHero({ id }));
    const mission = makeMission({
      templateId: boss.id,
      isWeeklyBoss: true,
      looping: false,
      startedAt,
      heroIds: ['h1', 'h2', 'h3', 'h4'],
      precomputedOutcome: {
        reward: 300, rounds: 1, actions: [], log: [], success: true, casualties: [], enemyCasualties: 0,
      },
    });
    const state = {
      ...makeState({ elapsedSinceSavedMs: 1 + boss.durationMs, mission, heroes }),
      weeklyState: { seed: 1, quests: [], progress: {}, allClaimed: false, bossDefeated: false },
      inventory: [] as any[],
    };
    const summary = calculateOfflineProgress(state)!;
    const inv = summary.newState!.inventory ?? [];
    expect(inv.length).toBe(1);
    expect(inv[0].tier).toBe(boss.guaranteedRewardTier);
  });
});
