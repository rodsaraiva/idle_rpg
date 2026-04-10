import { Page } from '@playwright/test';

const STORAGE_KEY = '@idle_rpg_game_state';

/**
 * Load the app with a specific saved state injected into localStorage.
 * Must navigate to the app URL first to access localStorage.
 * Sets lastSavedAt to the future to bypass offline progress modal.
 */
export async function loadWithState(page: Page, state: Record<string, any>) {
  await page.goto('/');
  // Set lastSavedAt to future so offline progress calc returns null (no modal)
  const stateWithFutureTime = { ...state, lastSavedAt: Date.now() + 60_000 };
  await page.evaluate(({ k, v }) => {
    localStorage.setItem(k, v);
  }, { k: STORAGE_KEY, v: JSON.stringify(stateWithFutureTime) });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // allow initialization
}

/**
 * Load the app with a clean state (no saved data).
 */
export async function loadClean(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('networkidle');
}

/**
 * Create a base hero object with all required fields.
 */
export function makeHero(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'h1',
    name: overrides.name ?? 'Hero #1',
    hpMax: overrides.hpMax ?? 25,
    hpCurrent: overrides.hpCurrent ?? 25,
    atk: overrides.atk ?? 10,
    mp: overrides.mp ?? 3,
    defense: overrides.defense ?? 5,
    crit: overrides.crit ?? 5,
    agility: overrides.agility ?? 10,
    currentTask: overrides.currentTask ?? 'IDLE',
    classId: overrides.classId ?? 'WARRIOR',
    personality: overrides.personality ?? 'AGGRESSIVE',
    attackType: overrides.attackType ?? 'MELEE',
    range: overrides.range ?? 1,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: overrides.equippedItems ?? [],
    ...overrides,
  };
}

/**
 * Create a base saved state with all required fields.
 */
export function makeState(overrides: Record<string, any> = {}) {
  return {
    _version: 5,
    gold: 500,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: Date.now(),
    tickIntervalMs: 500,
    trainInflationFactor: 0.5,
    activeMissions: [],
    inventory: [],
    forgingQueue: [],
    ...overrides,
  };
}
