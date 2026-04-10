import { test, expect } from '@playwright/test';
import { loadClean } from './helpers';

test.describe('Main Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loadClean(page);
  });

  test('default screen is Vila', async ({ page }) => {
    await expect(page.locator('text=Vila de Ouro').first()).toBeVisible();
  });

  test('navigate through bottom tabs', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Treino")');
    await expect(page.getByText('Campo de Treino', { exact: true })).toBeVisible();

    await page.click('[role="tab"]:has-text("Missões")');
    await expect(page.locator('text=Quadro de Missões')).toBeVisible();

    await page.click('[role="tab"]:has-text("Saúde")');
    await expect(page.locator('text=Enfermaria Real')).toBeVisible();

    await page.click('[role="tab"]:has-text("Loja")');
    await expect(page.locator('text=Mercado Real')).toBeVisible();
  });

  test('navigate to Ferreiro from Vila', async ({ page }) => {
    await page.click('text=Ferreiro');
    await expect(page.locator('text=Ferreiro Real').first()).toBeVisible();
    // Ferreiro should not be "Coming Soon" (Pantheon still is, so check specific context)
    await expect(page.locator('text=Forjar').first()).toBeVisible();
  });

  test('navigate to Conquistas from Vila', async ({ page }) => {
    await page.click('text=Conquistas');
    await expect(page.locator('text=Primeiro Recrutamento').first()).toBeVisible();
  });

  test('gold display visible on Treino screen', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Treino")');
    await expect(page.locator('text=💰').first()).toBeVisible();
  });
});
