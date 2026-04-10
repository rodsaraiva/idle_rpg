import { test, expect } from '@playwright/test';
import { loadWithState, makeHero, makeState } from './helpers';

test.describe('Infirmary Flow', () => {
  test('shows injured heroes in waiting queue', async ({ page }) => {
    await loadWithState(page, makeState({
      heroes: [
        makeHero({ id: 'h1', name: 'Injured #1', hpCurrent: 10 }),
        makeHero({ id: 'h2', name: 'Healthy #2', hpCurrent: 25 }),
        makeHero({ id: 'h3', name: 'Wounded #3', hpCurrent: 5 }),
      ],
      heroesRecruited: 3,
    }));

    await page.click('[role="tab"]:has-text("Saúde")');
    await expect(page.locator('text=Enfermaria Real')).toBeVisible();
    await expect(page.locator('text=Fila de Espera').first()).toBeVisible();
  });

  test('shows empty state when all heroes healthy', async ({ page }) => {
    await loadWithState(page, makeState({
      heroes: [makeHero({ id: 'h1', name: 'Healthy #1' })],
      heroesRecruited: 1,
    }));

    await page.click('[role="tab"]:has-text("Saúde")');
    await expect(page.locator('text=Enfermaria Real')).toBeVisible();
    await expect(page.locator('text=/saudáveis/').first()).toBeVisible();
  });
});
