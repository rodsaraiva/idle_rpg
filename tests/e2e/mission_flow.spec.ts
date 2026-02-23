import { test, expect } from '@playwright/test';

test('open missions and open selection modal', async ({ page }) => {
  await page.goto('/');
  // wait for Missions tab text
  await page.waitForSelector('text=Missões', { timeout: 10000 });
  // click the Missions tab (assuming nav visible)
  await page.click('text=Missões');
  // wait for Enviar button and click first
  await page.waitForSelector('text=Enviar', { timeout: 10000 });
  await page.click('text=Enviar');
  // modal title
  await expect(page.locator('text=Posicione os heróis na missão')).toBeVisible();
});

