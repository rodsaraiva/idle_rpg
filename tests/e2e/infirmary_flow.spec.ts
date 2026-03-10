import { test, expect } from '@playwright/test';

test('navigate to infirmary and see heroes', async ({ page }) => {
  await page.goto('/');
  // Wait for and click the Infirmary tab
  await page.waitForSelector('text=Enfermaria', { timeout: 10000 });
  await page.click('text=Enfermaria');
  
  // Wait for the infirmary screen to load
  await page.waitForSelector('text=Leitos:', { timeout: 10000 });
  
  // Basic check that the infirmary screen renders
  await expect(page.locator('text=Enfermaria')).toBeVisible();
});
