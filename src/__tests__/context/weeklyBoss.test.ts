import { handleStartWeeklyBoss } from '../../context/missionHandler';
import { handleTick } from '../../context/tickHandler';
import { initialGameState } from '../../context/gameReducer';
import { GameState, HeroTask, Hero, ActiveMission } from '../../types';
import { WEEKLY_BOSS_POOL, getWeeklyBoss } from '../../constants/weeklyBosses';
import { getWeeklySeed } from '../../constants/weeklyQuests';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeHero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 'h1',
    name: 'Aldric',
    hpMax: 50,
    hpCurrent: 50,
    atk: 25,
    mp: 10,
    defense: 10,
    crit: 10,
    agility: 10,
    currentTask: HeroTask.IDLE,
    classId: 'WARRIOR',
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    ...overrides,
  } as Hero;
}

/**
 * Estado mínimo válido com weeklyState usando o seed da semana atual.
 * Usar seed real (getWeeklySeed()) evita que handleTick chame refreshWeeklyState
 * e sobrescreva bossDefeated/progress — refreshWeeklyState só reseta se seed mudou.
 * O boss selecionado varia por semana: use getWeeklyBoss(state.weeklyState!.seed)
 * dentro de cada teste para obter o boss correto para o seed atual.
 */
function makeState(heroCount: number = 5): GameState {
  const heroes = Array.from({ length: heroCount }, (_, i) =>
    makeHero({ id: `h${i + 1}`, name: `Hero ${i + 1}` })
  );
  const currentSeed = getWeeklySeed();
  const base: GameState = {
    ...initialGameState,
    heroes,
    activeMissions: [],
  };
  return {
    ...base,
    weeklyState: {
      seed: currentSeed,
      quests: [],
      progress: {},
      allClaimed: false,
      bossDefeated: false,
    },
  };
}

// ── F4-1: gate de bossDefeated ────────────────────────────────────────────────

describe('handleStartWeeklyBoss — gate semanal', () => {
  test('retorna estado inalterado se bossDefeated já é true', () => {
    let state = makeState(5);
    state = { ...state, weeklyState: { ...state.weeklyState!, bossDefeated: true } };
    const heroIds = state.heroes.slice(0, 5).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());
    expect(next).toBe(state);
  });

  test('retorna estado inalterado se heroIds abaixo de minHeroes', () => {
    const state = makeState(5);
    const boss = getWeeklyBoss(state.weeklyState!.seed);
    // boss.minHeroes é 3, 4 ou 5; enviar menos que o mínimo
    const tooFew = state.heroes.slice(0, boss.minHeroes - 1).map(h => h.id);
    const next = handleStartWeeklyBoss(state, tooFew, undefined, Date.now());
    expect(next).toBe(state);
  });
});

// ── F4-2: build do encontro ───────────────────────────────────────────────────

describe('handleStartWeeklyBoss — build do encontro', () => {
  test('cria ActiveMission com isWeeklyBoss=true', () => {
    const state = makeState(5);
    const heroIds = state.heroes.slice(0, 5).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());

    expect(next.activeMissions).toHaveLength(1);
    expect(next.activeMissions![0].isWeeklyBoss).toBe(true);
  });

  test('ActiveMission.templateId corresponde ao id do boss semanal', () => {
    const state = makeState(5);
    const boss = getWeeklyBoss(state.weeklyState!.seed);
    const heroIds = state.heroes.slice(0, boss.minHeroes).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());

    expect(next.activeMissions![0].templateId).toBe(boss.id);
  });

  test('enemiesState é populado com inimigos do template do boss', () => {
    const state = makeState(5);
    const boss = getWeeklyBoss(state.weeklyState!.seed);
    const heroIds = state.heroes.slice(0, boss.minHeroes).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());
    const mission = next.activeMissions![0];

    // Total de inimigos deve ser a soma dos counts do template
    const expectedTotal = boss.enemies.reduce((sum, e) => sum + e.count, 0);
    expect(mission.enemiesState).toHaveLength(expectedTotal);
  });

  test('heróis passam para HeroTask.MISSION após início', () => {
    const state = makeState(5);
    const heroIds = state.heroes.slice(0, 4).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());

    for (const hid of heroIds) {
      const hero = next.heroes.find(h => h.id === hid)!;
      expect(hero.currentTask).toBe(HeroTask.MISSION);
    }
  });

  test('mission não tem looping=true', () => {
    const state = makeState(5);
    const heroIds = state.heroes.slice(0, 4).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());

    expect(next.activeMissions![0].looping).toBe(false);
  });
});

// ── F4-3: conclusão por vitória ───────────────────────────────────────────────

describe('tick — conclusão do boss semanal', () => {
  /** Injeta uma missão de boss já terminada (finishAt no passado) */
  function makeFinishedBossMission(state: GameState, success: boolean): GameState {
    const boss = getWeeklyBoss(state.weeklyState!.seed);
    const heroIds = state.heroes.slice(0, boss.minHeroes).map(h => h.id);
    const pastTime = Date.now() - 10_000;

    const mission: ActiveMission = {
      id: 'boss_test',
      templateId: boss.id,
      heroIds,
      startedAt: pastTime - boss.durationMs,
      finishAt: pastTime,
      isWeeklyBoss: true,
      looping: false,
      scheduledActions: [],
      enemiesState: [],
      precomputedOutcome: {
        reward: boss.rewardMin,
        rounds: 10,
        actions: [],
        log: [],
        success,
        casualties: [],
        enemyCasualties: boss.enemies.reduce((s, e) => s + e.count, 0),
      },
    };

    return {
      ...state,
      heroes: state.heroes.map(h =>
        heroIds.includes(h.id) ? { ...h, currentTask: HeroTask.MISSION } : h
      ),
      activeMissions: [mission],
    };
  }

  test('vitória: bossDefeated torna-se true após tick', () => {
    let state = makeState(5);
    state = makeFinishedBossMission(state, true);

    const now = Date.now();
    const next = handleTick(state, now);

    expect(next.weeklyState?.bossDefeated).toBe(true);
  });

  test('vitória: weeklyBossKills incrementa em 1 após tick', () => {
    let state = makeState(5);
    state = makeFinishedBossMission(state, true);

    const now = Date.now();
    const next = handleTick(state, now);

    expect(next.weeklyState?.progress['weeklyBossKills']).toBe(1);
  });

  test('vitória: gold é concedido após tick', () => {
    let state = makeState(5);
    const boss = getWeeklyBoss(state.weeklyState!.seed);
    state = makeFinishedBossMission(state, true);
    const goldBefore = state.gold;

    const now = Date.now();
    const next = handleTick(state, now);

    expect(next.gold).toBeGreaterThanOrEqual(goldBefore + boss.rewardMin);
  });

  test('derrota: bossDefeated permanece false após tick', () => {
    let state = makeState(5);
    state = makeFinishedBossMission(state, false);

    const now = Date.now();
    const next = handleTick(state, now);

    expect(next.weeklyState?.bossDefeated).toBe(false);
  });

  test('derrota: weeklyBossKills não incrementa', () => {
    let state = makeState(5);
    state = makeFinishedBossMission(state, false);

    const now = Date.now();
    const next = handleTick(state, now);

    expect(next.weeklyState?.progress['weeklyBossKills'] ?? 0).toBe(0);
  });

  test('heróis voltam para IDLE após conclusão (vitória ou derrota)', () => {
    let state = makeState(5);
    const boss = getWeeklyBoss(state.weeklyState!.seed);
    const heroIds = state.heroes.slice(0, boss.minHeroes).map(h => h.id);
    state = makeFinishedBossMission(state, true);

    const now = Date.now();
    const next = handleTick(state, now);

    for (const hid of heroIds) {
      const hero = next.heroes.find(h => h.id === hid)!;
      expect(hero.currentTask).toBe(HeroTask.IDLE);
    }
  });
});

// ── F4-4: gate via handleStartWeeklyBoss após bossDefeated ───────────────────

describe('gate uma-vez-por-semana via handleStartWeeklyBoss', () => {
  test('após bossDefeated=true, segundo dispatch retorna estado inalterado', () => {
    let state = makeState(5);
    // Simular que boss já foi derrotado
    state = {
      ...state,
      weeklyState: { ...state.weeklyState!, bossDefeated: true },
    };
    const heroIds = state.heroes.slice(0, 4).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());
    expect(next).toBe(state);
    expect(next.activeMissions).toHaveLength(0);
  });
});

// ── F4-5: recompensa de equipamento garantida ─────────────────────────────────

describe('tick — recompensa de equipamento do boss', () => {
  function makeFinishedBossMission(
    state: GameState,
    success: boolean,
    boss: typeof WEEKLY_BOSS_POOL[number] = getWeeklyBoss(state.weeklyState!.seed)
  ): GameState {
    const heroIds = state.heroes.slice(0, boss.minHeroes).map(h => h.id);
    const pastTime = Date.now() - 10_000;

    const mission: ActiveMission = {
      id: 'boss_reward_test',
      templateId: boss.id,
      heroIds,
      startedAt: pastTime - boss.durationMs,
      finishAt: pastTime,
      isWeeklyBoss: true,
      looping: false,
      scheduledActions: [],
      enemiesState: [],
      precomputedOutcome: {
        reward: boss.rewardMin,
        rounds: 10,
        actions: [],
        log: [],
        success,
        casualties: [],
        enemyCasualties: boss.enemies.reduce((s, e) => s + e.count, 0),
      },
    };

    return {
      ...state,
      heroes: state.heroes.map(h =>
        heroIds.includes(h.id) ? { ...h, currentTask: HeroTask.MISSION } : h
      ),
      activeMissions: [mission],
    };
  }

  test('vitória com guaranteedRewardTier: item do tier garantido entra no inventário', () => {
    const dragon = WEEKLY_BOSS_POOL.find(b => b.id === 'wb_dragon')!;
    expect(dragon.guaranteedRewardTier).toBe(3);

    const state = makeState(5);
    const inventoryBefore = (state.inventory ?? []).length;
    const next = handleTick(makeFinishedBossMission(state, true, dragon), Date.now());

    expect((next.inventory ?? []).length).toBe(inventoryBefore + 1);
    expect((next.inventory ?? []).at(-1)?.tier).toBe(3);
  });

  test('boss sem guaranteedRewardTier não concede item', () => {
    const lich = WEEKLY_BOSS_POOL.find(b => b.id === 'wb_lich')!;
    expect(lich.guaranteedRewardTier).toBeUndefined();

    const state = makeState(5);
    const inventoryBefore = (state.inventory ?? []).length;
    const next = handleTick(makeFinishedBossMission(state, true, lich), Date.now());

    expect((next.inventory ?? []).length).toBe(inventoryBefore);
  });
});
