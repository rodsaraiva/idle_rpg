import { test, expect } from '@playwright/test';
import { loadWithState, makeState } from './helpers';

test.describe('Guild & Shop', () => {
  test('shop shows all 3 chest tiers', async ({ page }) => {
    await loadWithState(page, makeState({ gold: 1000 }));
    await page.click('[role="tab"]:has-text("Loja")');
    await expect(page.locator('text=Mercado Real')).toBeVisible();
    await expect(page.locator('text=Baú Herói Bronze').first()).toBeVisible();
    await expect(page.locator('text=Baú Herói Prata').first()).toBeVisible();
    await expect(page.locator('text=Baú Herói Ouro').first()).toBeVisible();
  });

  test('shop shows gold display', async ({ page }) => {
    await loadWithState(page, makeState({ gold: 1000 }));
    await page.click('[role="tab"]:has-text("Loja")');
    await expect(page.locator('text=💰').first()).toBeVisible();
  });
});
