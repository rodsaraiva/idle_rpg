import { getWeeklySeed, pickWeeklyQuests } from '../../constants/weeklyQuests';
import { getWeeklyBoss } from '../../constants/weeklyBosses';
import { GameState } from '../../types';

const seed = getWeeklySeed();
const quests = pickWeeklyQuests(seed);

function makeWeeklyState(
  overrides: Partial<NonNullable<GameState['weeklyState']>> = {}
): NonNullable<GameState['weeklyState']> {
  return {
    seed,
    quests: quests.map(q => ({ id: q.id, claimed: false })),
    progress: {},
    allClaimed: false,
    bossDefeated: false,
    ...overrides,
  };
}

function makeGameState(
  weeklyOverrides?: Partial<NonNullable<GameState['weeklyState']>>
): GameState {
  return {
    gold: 100,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: Date.now(),
    weeklyState: makeWeeklyState(weeklyOverrides),
  };
}

describe('useWeekly derivations', () => {
  test('questStates: completed=true when progress >= targetValue', () => {
    const def = quests[0];
    const progress = { [def.tracker]: def.targetValue };
    const state = makeGameState({ progress });
    const ws = state.weeklyState!;
    const questStates = quests.map(q => {
      const entry = ws.quests.find(e => e.id === q.id)!;
      const current = ws.progress[q.tracker] ?? 0;
      return { def: q, current, completed: current >= q.targetValue, claimed: entry.claimed };
    });
    expect(questStates[0].completed).toBe(true);
    expect(questStates[0].claimed).toBe(false);
  });

  test('questStates: claimed=true when quest was claimed', () => {
    const def = quests[0];
    const state = makeGameState({
      progress: { [def.tracker]: def.targetValue },
      quests: quests.map((q, i) => ({ id: q.id, claimed: i === 0 })),
    });
    const ws = state.weeklyState!;
    const questStates = quests.map(q => {
      const entry = ws.quests.find(e => e.id === q.id)!;
      const current = ws.progress[q.tracker] ?? 0;
      return { def: q, current, completed: current >= q.targetValue, claimed: entry.claimed };
    });
    expect(questStates[0].claimed).toBe(true);
  });

  test('getWeeklyBoss returns boss for seed', () => {
    const boss = getWeeklyBoss(seed);
    expect(boss).toBeDefined();
    expect(boss.bossName).toBeTruthy();
    expect(Array.isArray(boss.enemies)).toBe(true);
  });

  test('timeUntilReset: next Monday is within 7 days', () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday);
    const msUntilReset = nextMonday.getTime() - now.getTime();
    expect(msUntilReset).toBeGreaterThan(0);
    expect(msUntilReset).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });
});
