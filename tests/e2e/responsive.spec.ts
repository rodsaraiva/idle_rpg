import { test, expect } from '@playwright/test';
import { loadClean } from './helpers';

test.describe('Mobile viewport (iPhone SE)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('renders and navigates all tabs on small screen', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await loadClean(page);

    // Vila de Ouro renders
    await expect(page.locator('text=Vila de Ouro').first()).toBeVisible();

    // Tab bar should be visible (it sits at the bottom on mobile)
    const vilaTab = page.locator('[role="tab"]:has-text("Vila")');
    await expect(vilaTab).toBeVisible();

    // Navigate to Treino
    await page.click('[role="tab"]:has-text("Treino")');
    await expect(page.getByText('Campo de Treino', { exact: true })).toBeVisible();

    // Navigate to Missões
    await page.click('[role="tab"]:has-text("Missões")');
    await expect(page.locator('text=Quadro de Missões')).toBeVisible();

    // Navigate to Saúde
    await page.click('[role="tab"]:has-text("Saúde")');
    await expect(page.locator('text=Enfermaria Real')).toBeVisible();

    // Navigate to Loja
    await page.click('[role="tab"]:has-text("Loja")');
    await expect(page.locator('text=Mercado Real')).toBeVisible();

    // Back to Vila
    await page.click('[role="tab"]:has-text("Vila")');
    await expect(page.locator('text=Vila de Ouro').first()).toBeVisible();

    // Tab bar still visible after navigating
    await expect(vilaTab).toBeVisible();

    // Filter out noise (favicons, network warnings). Keep only critical errors.
    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('Download the React DevTools') &&
        !e.toLowerCase().includes('net::err_'),
    );
    expect(criticalErrors).toEqual([]);
  });
});

test.describe('Tablet viewport (iPad)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('layout adapts on tablet screen', async ({ page }) => {
    await loadClean(page);

    // Vila renders
    await expect(page.locator('text=Vila de Ouro').first()).toBeVisible();

    // Navigate to Treino, cards should be visible
    await page.click('[role="tab"]:has-text("Treino")');
    await expect(page.getByText('Campo de Treino', { exact: true })).toBeVisible();
    // Gold display is a distinctive element rendered with the training screen
    await expect(page.locator('text=💰').first()).toBeVisible();

    // Navigate to Missões, missions section visible
    await page.click('[role="tab"]:has-text("Missões")');
    await expect(page.locator('text=Quadro de Missões')).toBeVisible();
  });
});

test.describe('Tab navigation state management', () => {
  test('click through all tabs in sequence', async ({ page }) => {
    await loadClean(page);

    // Start on Vila
    await expect(page.locator('text=Vila de Ouro').first()).toBeVisible();

    // Vila -> Treino
    await page.click('[role="tab"]:has-text("Treino")');
    await expect(page.getByText('Campo de Treino', { exact: true })).toBeVisible();

    // Treino -> Missões
    await page.click('[role="tab"]:has-text("Missões")');
    await expect(page.locator('text=Quadro de Missões')).toBeVisible();

    // Missões -> Saúde
    await page.click('[role="tab"]:has-text("Saúde")');
    await expect(page.locator('text=Enfermaria Real')).toBeVisible();

    // Saúde -> Loja
    await page.click('[role="tab"]:has-text("Loja")');
    await expect(page.locator('text=Mercado Real')).toBeVisible();

    // Loja -> Vila
    await page.click('[role="tab"]:has-text("Vila")');
    await expect(page.locator('text=Vila de Ouro').first()).toBeVisible();

    // Validate back/forward style navigation via tab clicks
    // Go forward to Loja again, then back to Treino
    await page.click('[role="tab"]:has-text("Loja")');
    await expect(page.locator('text=Mercado Real')).toBeVisible();

    await page.click('[role="tab"]:has-text("Treino")');
    await expect(page.getByText('Campo de Treino', { exact: true })).toBeVisible();

    // Back to Vila one more time to confirm state management is consistent
    await page.click('[role="tab"]:has-text("Vila")');
    await expect(page.locator('text=Vila de Ouro').first()).toBeVisible();
  });
});
