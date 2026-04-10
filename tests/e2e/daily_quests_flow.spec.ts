import { test, expect } from '@playwright/test';
import { loadClean } from './helpers';

test.describe('Daily Quests Flow', () => {
  test('daily quests accessible from Vila', async ({ page }) => {
    await loadClean(page);
    const card = page.locator('text=/[Mm]iss[õo]es [Dd]i[áa]rias/').first();
    await expect(card).toBeVisible();
    await card.click();
    await page.waitForTimeout(1000);
    // Screen should load without errors
  });
});
