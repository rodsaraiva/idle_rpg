import { test, expect } from '@playwright/test';

test('drag hero from list into matrix and start mission', async ({ page }) => {
  // prepare saved state with one hero so modal has selectable hero
  const savedState = {
    gold: 100,
    heroes: [
      {
        id: 'h1',
        name: 'Alpha',
        hpMax: 10,
        hpCurrent: 10,
        atk: 5,
        mp: 0,
        currentTask: 'IDLE',
        classId: 'WARRIOR',
      },
    ],
    heroesRecruited: 1,
    lastSavedAt: Date.now(),
  };

  // write to localStorage before app loads
  await page.goto('about:blank');
  await page.evaluate((k, v) => localStorage.setItem(k, v), '@idle_rpg_game_state', JSON.stringify(savedState));

  // open app
  await page.goto('/');
  await page.waitForSelector('text=Missões', { timeout: 15000 });

  // navigate to Missões tab
  await page.click('text=Missões');

  // wait for Enviar button and click first
  await page.waitForSelector('text=Enviar', { timeout: 10000 });
  await page.click('text=Enviar');

  // wait for modal title
  const modalTitle = page.locator('text=Posicione os heróis na missão');
  await expect(modalTitle).toBeVisible();

  // find hero item in the modal (Alpha)
  const modal = modalTitle.locator('..').first();
  // hero item by text
  const heroItem = modal.locator('text=Alpha').first();
  await expect(heroItem).toBeVisible();

  // find first empty cell '+' inside the modal
  const targetCell = modal.locator('text=+').first();
  await expect(targetCell).toBeVisible();

  // perform drag and drop using bounding boxes
  const srcBox = await heroItem.boundingBox();
  const dstBox = await targetCell.boundingBox();
  if (!srcBox || !dstBox) {
    throw new Error('Could not find bounding boxes for drag/drop elements');
  }

  const srcX = srcBox.x + srcBox.width / 2;
  const srcY = srcBox.y + srcBox.height / 2;
  const dstX = dstBox.x + dstBox.width / 2;
  const dstY = dstBox.y + dstBox.height / 2;

  await page.mouse.move(srcX, srcY);
  await page.mouse.down();
  await page.mouse.move(dstX, dstY, { steps: 15 });
  await page.mouse.up();

  // after drop, press "Iniciar missão" (button text)
  const startBtn = modal.locator('text=Iniciar missão').first();
  await expect(startBtn).toBeVisible();
  await startBtn.click();

  // modal should close; ensure title not visible
  await expect(modalTitle).not.toBeVisible();

  // optionally, check that a mission active item appears on screen
  await expect(page.locator('text=Missões ativas').first()).toBeVisible();
});

