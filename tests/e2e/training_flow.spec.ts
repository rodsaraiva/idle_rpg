import { test, expect } from '@playwright/test';
import { loadWithState, makeHero, makeState } from './helpers';

test.describe('Training Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loadWithState(page, makeState({
      heroes: [
        makeHero({ id: 'h1', name: 'Aldric #1', classId: 'WARRIOR', personality: 'AGGRESSIVE' }),
        makeHero({ id: 'h2', name: 'Brenna #2', classId: 'HEALER', personality: 'PROTECTOR' }),
      ],
      heroesRecruited: 2,
    }));
  });

  test('training screen shows heroes and batch buttons', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Treino")');
    await expect(page.locator('text=Campo de Treino')).toBeVisible();
    await expect(page.locator('text=HP').first()).toBeVisible();
    await expect(page.locator('text=ATK').first()).toBeVisible();
    await expect(page.locator('text=MP').first()).toBeVisible();
  });

  test('heroes show personality', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Treino")');
    await expect(page.locator('text=/Sanguinário/').first()).toBeVisible();
  });

  test('hero names visible', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Treino")');
    await expect(page.locator('text=Aldric #1').first()).toBeVisible();
    await expect(page.locator('text=Brenna #2').first()).toBeVisible();
  });
});
