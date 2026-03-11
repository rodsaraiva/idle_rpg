import { test, expect } from '@playwright/test';

test('navigate through main bottom tabs', async ({ page }) => {
  await page.goto('/');

  // Village screen should be default
  await expect(page.locator('text=Vila de Ouro').first()).toBeVisible();

  // Go to Guild
  await page.click('text=Guilda');
  await expect(page.locator('text=Guilda').nth(1)).toBeVisible(); // header title

  // Go to Missions
  await page.click('text=Missões');
  await expect(page.locator('text=Quadro de Missões')).toBeVisible();

  // Go to Village and test deep links (e.g., Blacksmith is soon)
  await page.click('text=Vila');
  await page.click('text=Ferreiro');
  
  // Wait for the "Coming Soon" screen text
  await expect(page.locator('text=Ferreiro Real')).toBeVisible();
  await expect(page.locator('text=Em breve')).toBeVisible();
});
