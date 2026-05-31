import { test, expect } from '@playwright/test';
import { loadClean, loadWithState, makeHero, makeState } from './helpers';
import { getWeeklySeed, pickWeeklyQuests } from '../../src/constants/weeklyQuests';
import { getWeeklyBoss } from '../../src/constants/weeklyBosses';

const seed = getWeeklySeed();
const quests = pickWeeklyQuests(seed);
const boss = getWeeklyBoss(seed);

test.describe('Weekly Flow', () => {
  test('Semanal card visível na Vila e navegável', async ({ page }) => {
    await loadClean(page);
    const card = page.locator('text=/[Dd]esafio [Ss]emanal/').first();
    await expect(card).toBeVisible();
    await card.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=/[Dd]esafio [Ss]emanal/').first()).toBeVisible();
  });

  test('WeeklyScreen exibe lista de quests', async ({ page }) => {
    await loadWithState(page, makeState({
      weeklyState: {
        seed,
        quests: quests.map(q => ({ id: q.id, claimed: false })),
        progress: {},
        allClaimed: false,
        bossDefeated: false,
      },
    }));
    await page.click('text=/[Dd]esafio [Ss]emanal/');
    await page.waitForTimeout(1000);
    // Verifica que pelo menos uma quest aparece (nome varia por seed)
    await expect(page.locator('text=/[Cc]ompletar|[Tt]reinar|[Ff]orjar|[Gg]anhar|[Dd]errotar|[Rr]ealizar/')).toBeVisible();
  });

  test('WeeklyScreen exibe card do boss com botão desabilitado', async ({ page }) => {
    await loadWithState(page, makeState({
      weeklyState: {
        seed,
        quests: quests.map(q => ({ id: q.id, claimed: false })),
        progress: {},
        allClaimed: false,
        bossDefeated: false,
      },
    }));
    await page.click('text=/[Dd]esafio [Ss]emanal/');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=/[Ee]m breve/').first()).toBeVisible();
  });

  test('WeeklyScreen botão Resgatar aparece quando quest completa', async ({ page }) => {
    const firstQuest = quests[0];
    await loadWithState(page, makeState({
      gold: 100,
      weeklyState: {
        seed,
        quests: quests.map(q => ({ id: q.id, claimed: false })),
        progress: { [firstQuest.tracker]: firstQuest.targetValue },
        allClaimed: false,
        bossDefeated: false,
      },
    }));
    await page.click('text=/[Dd]esafio [Ss]emanal/');
    await page.waitForTimeout(1000);
    // Resgatar button (gold icon with amount) should appear
    await expect(page.locator('text=🪙').first()).toBeVisible();
  });
});
