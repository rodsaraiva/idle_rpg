import { test, expect } from '@playwright/test';
import { loadClean, loadWithState, makeHero, makeState } from './helpers';

test.describe('Achievements Flow', () => {
  test('achievements screen accessible from Vila', async ({ page }) => {
    await loadClean(page);
    await page.click('text=Conquistas');
    await expect(page.locator('text=Primeiro Recrutamento').first()).toBeVisible();
  });

  test('shows unlocked achievements', async ({ page }) => {
    await loadWithState(page, makeState({
      heroes: [makeHero()],
      heroesRecruited: 5,
      unlockedAchievements: ['recruit_1', 'recruit_5'],
      permanentBonuses: { atk: 0, hp: 0 },
    }));

    await page.click('text=Conquistas');
    await expect(page.locator('text=Primeiro Recrutamento').first()).toBeVisible();
    await expect(page.locator('text=Formação de Guilda').first()).toBeVisible();
  });

  test('boss achievement visible', async ({ page }) => {
    await loadClean(page);
    await page.click('text=Conquistas');
    await expect(page.locator('text=/Mata-Drag/').first()).toBeVisible();
  });
});
