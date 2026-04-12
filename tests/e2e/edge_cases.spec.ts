import { test, expect } from '@playwright/test';
import { loadWithState, makeHero, makeState } from './helpers';

const STORAGE_KEY = '@idle_rpg_game_state';

test.describe('Edge Cases', () => {
  test('migration from v1 save works', async ({ page }) => {
    // Navigate first so localStorage is accessible
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // Old v1 format: no _version, simple heroes without equippedItems, no inventory
    const v1State = {
      gold: 100,
      heroes: [
        {
          id: 'old1',
          name: 'OldHero',
          hpMax: 10,
          hpCurrent: 10,
          atk: 5,
          mp: 0,
          currentTask: 'IDLE',
        },
      ],
      heroesRecruited: 1,
      lastSavedAt: Date.now() + 60_000, // future to skip offline modal
    };

    await page.evaluate(
      ({ k, v }) => {
        localStorage.setItem(k, v);
      },
      { k: STORAGE_KEY, v: JSON.stringify(v1State) },
    );

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // App should not crash — Vila should still be visible
    await expect(page.locator('text=Vila de Ouro').first()).toBeVisible();

    // Navigate to Treino to verify the migrated hero shows up
    await page.click('[role="tab"]:has-text("Treino")');
    await expect(page.locator('text=OldHero').first()).toBeVisible();

    // Auto-save runs every 5s; wait long enough to catch at least one save cycle.
    await page.waitForTimeout(6500);

    const stored = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string);
    expect(parsed._version).toBe(8);
  });

  test('corrupted save does not crash app', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // Write invalid JSON directly
    await page.evaluate((k) => {
      localStorage.setItem(k, 'not-json{invalid');
    }, STORAGE_KEY);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // App should fallback to the default initial state and show Vila
    await expect(page.locator('text=Vila de Ouro').first()).toBeVisible();
  });

  test('many heroes (20+) renders correctly', async ({ page }) => {
    // Collect any console errors during the test
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(String(err));
    });

    const heroes = Array.from({ length: 20 }, (_, i) =>
      makeHero({
        id: `h${i + 1}`,
        name: `Hero#${i + 1}`,
        classId: i % 2 === 0 ? 'WARRIOR' : 'HEALER',
      }),
    );

    await loadWithState(
      page,
      makeState({
        heroes,
        heroesRecruited: 20,
      }),
    );

    await page.click('[role="tab"]:has-text("Treino")');

    // Check at least 5 heroes are visible
    await expect(page.locator('text=Hero#1').first()).toBeVisible();
    await expect(page.locator('text=Hero#2').first()).toBeVisible();
    await expect(page.locator('text=Hero#3').first()).toBeVisible();
    await expect(page.locator('text=Hero#4').first()).toBeVisible();
    await expect(page.locator('text=Hero#5').first()).toBeVisible();

    // Filter out any noise unrelated to rendering (e.g. network warnings).
    const renderErrors = consoleErrors.filter(
      (e) => !/favicon|ResizeObserver|net::ERR_/i.test(e),
    );
    expect(renderErrors).toEqual([]);
  });

  test('reload preserves hero task state', async ({ page }) => {
    await loadWithState(
      page,
      makeState({
        heroes: [
          makeHero({ id: 'h1', name: 'Aldric #1', currentTask: 'TRAIN_HP' }),
        ],
        heroesRecruited: 1,
      }),
    );

    await page.click('[role="tab"]:has-text("Treino")');

    // HeroCard task badge shows "Treinando HP" when task is TRAIN_HP
    await expect(page.locator('text=/Treinando HP/').first()).toBeVisible();

    // Reload and re-check
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.click('[role="tab"]:has-text("Treino")');
    await expect(page.locator('text=/Treinando HP/').first()).toBeVisible();
  });

  test('multiple active missions (simultaneous) display', async ({ page }) => {
    const now = Date.now();
    await loadWithState(
      page,
      makeState({
        heroes: [
          makeHero({ id: 'h1', name: 'Aldric #1', currentTask: 'MISSION' }),
          makeHero({ id: 'h2', name: 'Brenna #2', currentTask: 'MISSION' }),
          makeHero({ id: 'h3', name: 'Cedric #3', currentTask: 'MISSION' }),
          makeHero({ id: 'h4', name: 'Dorian #4', currentTask: 'MISSION' }),
          makeHero({ id: 'h5', name: 'Elara #5', currentTask: 'MISSION' }),
          makeHero({ id: 'h6', name: 'Faye #6', currentTask: 'MISSION' }),
        ],
        heroesRecruited: 6,
        activeMissions: [
          {
            id: 'm1',
            templateId: 'mission_1',
            heroIds: ['h1', 'h2', 'h3'],
            startedAt: now,
            scheduledActions: [],
            enemiesState: [],
          },
          {
            id: 'm2',
            templateId: 'mission_2',
            heroIds: ['h4', 'h5', 'h6'],
            startedAt: now,
            scheduledActions: [],
            enemiesState: [],
          },
        ],
      }),
    );

    await page.click('[role="tab"]:has-text("Missões")');

    // Section header should be visible
    await expect(page.locator('text=Missões em Andamento')).toBeVisible();

    // Both missions should appear — the heroes belonging to each mission are
    // rendered inside each MissionActiveItem, so all six hero names show up.
    await expect(page.locator('text=Aldric #1').first()).toBeVisible();
    await expect(page.locator('text=Brenna #2').first()).toBeVisible();
    await expect(page.locator('text=Cedric #3').first()).toBeVisible();
    await expect(page.locator('text=Dorian #4').first()).toBeVisible();
    await expect(page.locator('text=Elara #5').first()).toBeVisible();
    await expect(page.locator('text=Faye #6').first()).toBeVisible();

    // Each mission has its own "Assistir" watch button — verify there are two.
    const watchButtons = page.locator('text=/Assistir/');
    await expect(watchButtons).toHaveCount(2);
  });
});
