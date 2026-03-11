import { test, expect } from '@playwright/test';

test('recruit new hero updates guilda view', async ({ page }) => {
  // Configura estado com ouro suficiente
  const savedState = {
    gold: 50,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: Date.now(),
  };

  await page.goto('about:blank');
  await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: '@idle_rpg_game_state', v: JSON.stringify(savedState) });

  // Abrir e checar na Guilda
  await page.goto('/');
  await page.waitForSelector('text=Guilda', { timeout: 10000 });
  await page.click('text=Guilda');

  // Checar se não há heróis
  await expect(page.locator('text=0 heróis')).toBeVisible();
  
  // Buscar e clicar botão recrutar (exige 5 ouro geralmente na base)
  const recruitBtn = page.locator('text=Recrutar Herói');
  await expect(recruitBtn).toBeVisible();
  
  await recruitBtn.click();

  // Espera a tela atualizar para 1 herói
  await expect(page.locator('text=1 herói')).toBeVisible();
  
  // Confirma se o ouro diminuiu (assumindo que seja 5)
  await expect(page.locator('text=💰').locator('..').locator('text=45')).toBeVisible();
});
