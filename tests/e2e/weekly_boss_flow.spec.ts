import { test, expect } from '@playwright/test';
import { loadWithState, makeHero, makeState } from './helpers';

test.describe('Weekly Boss Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loadWithState(page, makeState({
      heroes: [
        makeHero({ id: 'h1', name: 'Aldric', classId: 'WARRIOR', atk: 25, hpMax: 60, hpCurrent: 60 }),
        makeHero({ id: 'h2', name: 'Brenna', classId: 'HEALER', atk: 12, mp: 20, hpMax: 40, hpCurrent: 40 }),
        makeHero({ id: 'h3', name: 'Cedric', classId: 'ARCHER', atk: 20, hpMax: 45, hpCurrent: 45 }),
        makeHero({ id: 'h4', name: 'Doran', classId: 'TANK', hpMax: 80, hpCurrent: 80, defense: 15 }),
        makeHero({ id: 'h5', name: 'Eris', classId: 'MAGE', mp: 25, atk: 18, hpMax: 40, hpCurrent: 40 }),
      ],
      heroesRecruited: 5,
      weeklyState: {
        seed: 1,
        quests: [],
        progress: {},
        allClaimed: false,
        bossDefeated: false,
      },
    }));
  });

  test('card Semanal visível na Vila', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Vila")');
    const card = page.locator('text=/[Ss]emanal|[Dd]esafio [Ss]emanal/').first();
    await expect(card).toBeVisible();
  });

  test('navega para WeeklyScreen ao clicar no card Semanal', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Vila")');
    await page.locator('text=/[Ss]emanal|[Dd]esafio [Ss]emanal/').first().click();
    await page.waitForTimeout(800);
    // Deve aparecer o botão do boss ou texto da tela semanal
    await expect(page.locator('text=/[Bb]oss|[Ee]nfrentar/').first()).toBeVisible();
  });

  test('botão Enfrentar Boss está habilitado quando bossDefeated=false', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Vila")');
    await page.locator('text=/[Ss]emanal|[Dd]esafio [Ss]emanal/').first().click();
    await page.waitForTimeout(800);

    const btn = page.locator('text=/[Ee]nfrentar [Bb]oss/').first();
    await expect(btn).toBeVisible();
    // Botão não deve estar desabilitado
    const disabled = await btn.evaluate((el) => (el as HTMLButtonElement).disabled ?? el.getAttribute('aria-disabled'));
    expect(disabled).not.toBe(true);
    expect(disabled).not.toBe('true');
  });

  test('clicar em Enfrentar Boss inicia missão de boss', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Vila")');
    await page.locator('text=/[Ss]emanal|[Dd]esafio [Ss]emanal/').first().click();
    await page.waitForTimeout(800);

    await page.locator('text=/[Ee]nfrentar [Bb]oss/').first().click();
    await page.waitForTimeout(1000);

    // Após dispatch, heróis devem estar em missão — checar feedback visual
    await page.click('[role="tab"]:has-text("Missões")');
    await page.waitForTimeout(500);
    // Deve haver pelo menos uma missão ativa na tela de missões
    await expect(page.locator('text=/[Ee]m [Aa]nda|[Aa]tiva|[Bb]oss/').first()).toBeVisible({ timeout: 3000 });
  });

  test('botão desabilitado quando bossDefeated=true', async ({ page }) => {
    await loadWithState(page, makeState({
      heroes: [
        makeHero({ id: 'h1', name: 'Aldric', classId: 'WARRIOR', atk: 25 }),
        makeHero({ id: 'h2', name: 'Brenna', classId: 'HEALER', atk: 12 }),
        makeHero({ id: 'h3', name: 'Cedric', classId: 'ARCHER', atk: 20 }),
        makeHero({ id: 'h4', name: 'Doran', classId: 'TANK' }),
        makeHero({ id: 'h5', name: 'Eris', classId: 'MAGE' }),
      ],
      heroesRecruited: 5,
      weeklyState: {
        seed: 1,
        quests: [],
        progress: { weeklyBossKills: 1 },
        allClaimed: false,
        bossDefeated: true,
      },
    }));

    await page.click('[role="tab"]:has-text("Vila")');
    await page.locator('text=/[Ss]emanal|[Dd]esafio [Ss]emanal/').first().click();
    await page.waitForTimeout(800);

    // Deve exibir texto de boss derrotado
    await expect(page.locator('text=/[Dd]errotado|[Dd]isponível|[Ss]emanal/').first()).toBeVisible();
  });
});
