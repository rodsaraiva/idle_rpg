import { test, expect } from '@playwright/test';
import { loadWithState, makeHero, makeState } from './helpers';

test.describe('Mission Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loadWithState(page, makeState({
      heroes: [
        makeHero({ id: 'h1', name: 'Aldric #1', classId: 'WARRIOR', atk: 15 }),
        makeHero({ id: 'h2', name: 'Brenna #2', classId: 'HEALER', atk: 8 }),
        makeHero({ id: 'h3', name: 'Cedric #3', classId: 'ARCHER', atk: 12, attackType: 'RANGED', range: 3 }),
      ],
      heroesRecruited: 3,
    }));
  });

  test('missions screen shows available missions', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Missões")');
    await expect(page.locator('text=Quadro de Missões')).toBeVisible();
    await expect(page.locator('text=Primeira Patrulha').first()).toBeVisible();
  });

  test('shows hero count', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Missões")');
    await expect(page.locator('text=3 heróis prontos')).toBeVisible();
  });

  test('clicking Enviar opens hero selection modal', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Missões")');
    await page.locator('text=Enviar').first().click();
    await expect(page.locator('text=/[Pp]osicione|heróis na missão/').first()).toBeVisible();
  });

  test('hero selection modal shows loop toggle', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Missões")');
    await page.locator('text=Enviar').first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=/[Ll]oop|auto-repetir/').first()).toBeVisible();
  });
});
