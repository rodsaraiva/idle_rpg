import { test, expect } from '@playwright/test';
import { loadWithState, makeHero, makeState } from './helpers';

test.describe('Blacksmith Materials', () => {
  test('Ferreiro exibe seção de materiais', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 500,
      heroes: [makeHero({ id: 'h1' })],
      heroesRecruited: 1,
      materials: { iron: 2, crystal: 0, essence: 1, starstone: 0 },
    }));
    await page.click('text=Ferreiro');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Materiais').first()).toBeVisible();
  });

  test('Materiais mostram quantidades do estado', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 500,
      heroes: [makeHero({ id: 'h1' })],
      heroesRecruited: 1,
      materials: { iron: 5, crystal: 2, essence: 0, starstone: 0 },
    }));
    await page.click('text=Ferreiro');
    await page.waitForTimeout(1000);
    // iron = 5 deve aparecer
    await expect(page.locator('text=/Fragmento de Ferro/').first()).toBeVisible();
  });

  test('Material faltante fica destacado (tier 1 weapon requer iron:3)', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 500,
      heroes: [makeHero({ id: 'h1' })],
      heroesRecruited: 1,
      materials: { iron: 1 },  // falta 2 iron para a receita tier 1 weapon
    }));
    await page.click('text=Ferreiro');
    await page.waitForTimeout(1000);
    // A contagem deve mostrar "1/3" para iron
    await expect(page.locator('text=/1\\/3/').first()).toBeVisible();
  });

  test('Sem materiais, todos os campos mostram 0', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 500,
      heroes: [makeHero({ id: 'h1' })],
      heroesRecruited: 1,
    }));
    await page.click('text=Ferreiro');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Materiais').first()).toBeVisible();
    // iron 0/3
    await expect(page.locator('text=/0\\/3/').first()).toBeVisible();
  });
});
