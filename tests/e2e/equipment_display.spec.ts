import { test, expect } from '@playwright/test';
import { loadWithState, makeHero, makeState } from './helpers';

test.describe('Equipment Display', () => {
  const equippedState = makeState({
    heroes: [makeHero({ id: 'h1', name: 'Aldric #1', equippedItems: ['eq1'] })],
    heroesRecruited: 1,
    inventory: [
      { id: 'eq1', name: 'Espada Comum', type: 'weapon', statBonus: { atk: 4 }, tier: 1 },
      { id: 'eq2', name: 'Escudo Raro', type: 'armor', statBonus: { defense: 8 }, tier: 2 },
    ],
  });

  test('equipped item visible on hero card', async ({ page }) => {
    await loadWithState(page, equippedState);
    await page.click('[role="tab"]:has-text("Treino")');
    await expect(page.locator('text=Aldric #1').first()).toBeVisible();
    await expect(page.locator('text=Espada Comum').first()).toBeVisible();
  });

  test('blacksmith shows inventory items', async ({ page }) => {
    await loadWithState(page, equippedState);
    await page.click('text=Ferreiro');
    await expect(page.locator('text=Espada Comum').first()).toBeVisible();
    await expect(page.locator('text=Escudo Raro').first()).toBeVisible();
  });
});
