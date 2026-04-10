import { test, expect } from '@playwright/test';
import { loadWithState, makeHero, makeState } from './helpers';

test.describe('Blacksmith Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 1000,
      heroes: [makeHero({ id: 'h1', name: 'Aldric #1' })],
      heroesRecruited: 1,
    }));
  });

  test('Ferreiro shows forge tiers', async ({ page }) => {
    await page.click('text=Ferreiro');
    await expect(page.locator('text=Ferreiro Real').first()).toBeVisible();
    await expect(page.locator('text=Comum').first()).toBeVisible();
    await expect(page.locator('text=Raro').first()).toBeVisible();
  });

  test('Ferreiro is not Coming Soon', async ({ page }) => {
    await page.click('text=Ferreiro');
    await expect(page.locator('text=Ferreiro Real').first()).toBeVisible();
    // Verify blacksmith UI is functional (not placeholder)
    await expect(page.locator('text=Forjar').first()).toBeVisible();
    await expect(page.locator('text=Comum').first()).toBeVisible();
  });

  test('forge button visible', async ({ page }) => {
    await page.click('text=Ferreiro');
    await expect(page.locator('text=Forjar').first()).toBeVisible();
  });
});
