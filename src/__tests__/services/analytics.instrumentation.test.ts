/**
 * Task 5 — Instrumentação de marcos via analytics.track (consent-gated).
 * Verifica que cada "ponto de disparo" emite o evento correto ao sink
 * quando o consentimento está ativo, e permanece silencioso sem ele.
 */
import { setAnalyticsConsent, setAnalyticsSink, trackAppOpen, resetAnalytics } from '../../services/analytics';
import { handleRecruitHero } from '../../context/heroHandler';
import { handleFuseHeroes } from '../../context/pantheonHandler';
import { handleForgeEquipment } from '../../context/equipmentHandler';
import { markWeeklyBossDefeated } from '../../context/weeklyHandler';
import { trackMissionCompletions } from '../../context/missionTickHandler';
import { GameState, Hero, HeroTask, MissionResult } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHero(overrides: Partial<Hero>): Hero {
  return {
    id: 'h1',
    name: 'Herói',
    hpMax: 50,
    hpCurrent: 50,
    atk: 10,
    mp: 5,
    defense: 5,
    crit: 10,
    agility: 5,
    currentTask: HeroTask.IDLE,
    classId: 'WARRIOR',
    personality: 'AGGRESSIVE',
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
    stars: 0,
    ...overrides,
  } as Hero;
}

const baseState: GameState = {
  gold: 500,
  heroes: [],
  heroesRecruited: 0,
  lastSavedAt: Date.now(),
};

const forgeState: GameState = {
  ...baseState,
  materials: { iron: 20, crystal: 20, essence: 20, starstone: 5 },
  inventory: [],
  forgingQueue: [],
};

const weeklyState = {
  seed: 12345,
  quests: [],
  progress: {},
  allClaimed: false,
  bossDefeated: false,
};

const successResult: MissionResult = {
  missionId: 'm1',
  templateId: 'forest_easy',
  reward: 50,
  rounds: 3,
  actions: [],
  log: [],
  success: true,
  casualties: [],
  enemyCasualties: 2,
};

const failResult: MissionResult = {
  ...successResult,
  missionId: 'm2',
  success: false,
  reward: 0,
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let calls: string[] = [];

beforeEach(() => {
  calls = [];
  setAnalyticsSink((e) => calls.push(e));
  setAnalyticsConsent(false);
});

afterEach(() => {
  resetAnalytics(); // restaura sink default + consent off — não vaza sink/consent a outros arquivos
});

// ---------------------------------------------------------------------------
// Consent bloqueado (default)
// ---------------------------------------------------------------------------

describe('sem consentimento — nenhum evento', () => {
  test('hero_recruited não emite', () => {
    handleRecruitHero(baseState);
    expect(calls).toEqual([]);
  });

  test('hero_fused não emite', () => {
    const h1 = makeHero({ id: 'f1' });
    const h2 = makeHero({ id: 'f2' });
    const h3 = makeHero({ id: 'f3' });
    handleFuseHeroes({ ...baseState, heroes: [h1, h2, h3] }, ['f1', 'f2', 'f3']);
    expect(calls).toEqual([]);
  });

  test('equipment_crafted não emite', () => {
    handleForgeEquipment(forgeState, 1, 'weapon', Date.now());
    expect(calls).toEqual([]);
  });

  test('boss_defeated não emite', () => {
    markWeeklyBossDefeated({ ...baseState, weeklyState });
    expect(calls).toEqual([]);
  });

  test('mission_completed não emite', () => {
    trackMissionCompletions([successResult]);
    expect(calls).toEqual([]);
  });

  test('app_open não emite', () => {
    trackAppOpen();
    expect(calls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Com consentimento — eventos emitidos
// ---------------------------------------------------------------------------

describe('com consentimento — emite eventos corretos', () => {
  beforeEach(() => {
    setAnalyticsConsent(true);
  });

  test('handleRecruitHero emite hero_recruited', () => {
    handleRecruitHero(baseState);
    expect(calls).toContain('hero_recruited');
  });

  test('handleFuseHeroes emite hero_fused', () => {
    const h1 = makeHero({ id: 'f1' });
    const h2 = makeHero({ id: 'f2' });
    const h3 = makeHero({ id: 'f3' });
    handleFuseHeroes({ ...baseState, heroes: [h1, h2, h3] }, ['f1', 'f2', 'f3']);
    expect(calls).toContain('hero_fused');
  });

  test('handleForgeEquipment emite equipment_crafted', () => {
    handleForgeEquipment(forgeState, 1, 'weapon', Date.now());
    expect(calls).toContain('equipment_crafted');
  });

  test('markWeeklyBossDefeated emite boss_defeated', () => {
    markWeeklyBossDefeated({ ...baseState, weeklyState });
    expect(calls).toContain('boss_defeated');
  });

  test('trackMissionCompletions emite mission_completed para missões bem-sucedidas', () => {
    trackMissionCompletions([successResult]);
    expect(calls).toContain('mission_completed');
  });

  test('trackMissionCompletions NÃO emite para missões fracassadas', () => {
    trackMissionCompletions([failResult]);
    expect(calls).not.toContain('mission_completed');
  });

  test('trackMissionCompletions emite goldEarned correto', () => {
    const emittedProps: Array<Record<string, unknown>> = [];
    setAnalyticsSink((e, p) => { calls.push(e); if (p) emittedProps.push(p); });
    trackMissionCompletions([successResult]);
    expect(emittedProps[0]).toMatchObject({ goldEarned: 50 });
  });

  test('trackAppOpen emite app_open', () => {
    trackAppOpen();
    expect(calls).toContain('app_open');
  });
});
