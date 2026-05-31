import { test, expect } from '@playwright/test';
import { loadWithState, makeHero, makeState } from './helpers';

test.describe('Pantheon Flow', () => {
  test('Panteão card visível na Vila', async ({ page }) => {
    await loadWithState(page, makeState({
      heroes: [makeHero({ id: 'h1' }), makeHero({ id: 'h2', name: 'Hero #2' }), makeHero({ id: 'h3', name: 'Hero #3' })],
      heroesRecruited: 3,
    }));
    const card = page.locator('text=Panteão').first();
    await expect(card).toBeVisible();
  });

  test('PantheonScreen não é mais ComingSoon', async ({ page }) => {
    await loadWithState(page, makeState({
      heroes: [makeHero({ id: 'h1' }), makeHero({ id: 'h2', name: 'Hero #2' }), makeHero({ id: 'h3', name: 'Hero #3' })],
      heroesRecruited: 3,
    }));
    await page.click('text=Panteão');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=/Panteão dos Heróis/').first()).toBeVisible();
    // Deve NÃO mostrar o placeholder ComingSoon ("EM DESENVOLVIMENTO")
    await expect(page.locator('text=/EM DESENVOLVIMENTO/')).not.toBeVisible();
  });

  test('PantheonScreen exibe heróis elegíveis', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 200,
      heroes: [
        makeHero({ id: 'h1', name: 'Aldric' }),
        makeHero({ id: 'h2', name: 'Bruna' }),
        makeHero({ id: 'h3', name: 'Carlos' }),
      ],
      heroesRecruited: 3,
    }));
    await page.click('text=Panteão');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Aldric').first()).toBeVisible();
    await expect(page.locator('text=Bruna').first()).toBeVisible();
    await expect(page.locator('text=Carlos').first()).toBeVisible();
  });

  test('Fusão de 3 heróis: seleção, confirmação, resultado', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 200,
      heroes: [
        makeHero({ id: 'h1', name: 'Aldric' }),
        makeHero({ id: 'h2', name: 'Bruna' }),
        makeHero({ id: 'h3', name: 'Carlos' }),
      ],
      heroesRecruited: 3,
    }));
    await page.click('text=Panteão');
    await page.waitForTimeout(1000);

    // Selecionar 3 heróis
    await page.click('text=Aldric');
    await page.waitForTimeout(300);
    await page.click('text=Bruna');
    await page.waitForTimeout(300);
    await page.click('text=Carlos');
    await page.waitForTimeout(300);

    // Botão de fusão deve estar ativo
    await expect(page.locator('text=Fundir Heróis').first()).toBeVisible();
    await page.click('text=Fundir Heróis');
    await page.waitForTimeout(500);

    // Modal de confirmação
    await expect(page.locator('text=Confirmar Fusão').first()).toBeVisible();
    await page.click('text=Fundir!');
    await page.waitForTimeout(1000);

    // Heróis originais devem ter sumido, novo herói com nome de fusão aparece
    await expect(page.locator('text=Aldric')).not.toBeVisible();
    await expect(page.locator('text=Bruna')).not.toBeVisible();
    await expect(page.locator('text=Carlos')).not.toBeVisible();
  });
});
