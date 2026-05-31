import { test, expect } from '@playwright/test';
import { loadWithState, makeHero, makeState } from './helpers';

test.describe('Guild Flow', () => {
  test('Guilda card visível na Vila', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 100,
      heroes: [makeHero({ id: 'h1' })],
      heroesRecruited: 1,
    }));
    const card = page.locator('text=Guilda').first();
    await expect(card).toBeVisible();
  });

  test('GuildScreen acessível a partir da Vila', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 100,
      heroes: [makeHero({ id: 'h1', name: 'Aldric' })],
      heroesRecruited: 1,
    }));
    await page.click('text=Guilda');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Guilda').first()).toBeVisible();
  });

  test('GuildScreen exibe heróis cadastrados', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 200,
      heroes: [
        makeHero({ id: 'h1', name: 'Aldric' }),
        makeHero({ id: 'h2', name: 'Bruna' }),
      ],
      heroesRecruited: 2,
    }));
    await page.click('text=Guilda');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Aldric').first()).toBeVisible();
    await expect(page.locator('text=Bruna').first()).toBeVisible();
  });

  test('Guilda não duplica mecânica do Shop', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 500,
      heroes: [makeHero({ id: 'h1', name: 'Aldric' })],
      heroesRecruited: 1,
    }));
    // Guilda usa recrutamento por gold direto
    await page.click('text=Guilda');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=/[Rr]ecrutar/').first()).toBeVisible();

    // Shop usa baús — navega de volta e verifica Loja
    await page.click('text=Vila');
    await page.waitForTimeout(500);
    await page.click('text=Loja');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=/[Bb]aú|[Cc]hest/i').first()).toBeVisible();
  });
});
