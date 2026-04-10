import { test, expect } from '@playwright/test';
import { loadWithState, makeHero, makeState } from './helpers';

test.describe('UI Interactions', () => {
  test('HeroDetailsModal shows complete info', async ({ page }) => {
    await loadWithState(page, makeState({
      heroes: [
        makeHero({
          id: 'h1',
          name: 'Aldric #1',
          classId: 'WARRIOR',
          personality: 'AGGRESSIVE',
          hpMax: 30,
          hpCurrent: 30,
          atk: 12,
          mp: 4,
          defense: 6,
          crit: 7,
          agility: 11,
        }),
      ],
      heroesRecruited: 1,
    }));

    await page.click('[role="tab"]:has-text("Treino")');
    await expect(page.locator('text=Aldric #1').first()).toBeVisible();

    // Click on the hero card itself (not a task button) to open details modal.
    await page.locator('text=Aldric #1').first().click();

    // Modal header: hero name + class
    await expect(page.locator('text=Aldric #1').first()).toBeVisible();
    await expect(page.locator('text=Guerreiro').first()).toBeVisible();

    // Personality section with emoji + displayName
    await expect(page.locator('text=/🩸\\s*Sanguinário/').first()).toBeVisible();

    // Stats labels
    await expect(page.locator('text=Pontos de Vida')).toBeVisible();
    await expect(page.getByText('Ataque', { exact: true })).toBeVisible();
    await expect(page.locator('text=Mana')).toBeVisible();
    await expect(page.locator('text=Defesa')).toBeVisible();
    await expect(page.locator('text=Crítico')).toBeVisible();
    await expect(page.locator('text=Agilidade')).toBeVisible();

    // Equipment section header
    await expect(page.getByText('Equipamentos', { exact: true })).toBeVisible();

    // Close modal via Fechar button
    await page.locator('text=Fechar').first().click();
    await expect(page.locator('text=Pontos de Vida')).not.toBeVisible();
  });

  test('HeroDetailsModal with equipped items', async ({ page }) => {
    await loadWithState(page, makeState({
      heroes: [
        makeHero({
          id: 'h1',
          name: 'Aldric #1',
          classId: 'WARRIOR',
          personality: 'AGGRESSIVE',
          equippedItems: ['eq1'],
        }),
      ],
      heroesRecruited: 1,
      inventory: [
        { id: 'eq1', name: 'Espada Comum', type: 'weapon', statBonus: { atk: 4 }, tier: 1 },
      ],
    }));

    await page.click('[role="tab"]:has-text("Treino")');
    await expect(page.locator('text=Aldric #1').first()).toBeVisible();

    // Open hero details
    await page.locator('text=Aldric #1').first().click();

    // Equipment section header inside the modal
    await expect(page.getByText('Equipamentos', { exact: true })).toBeVisible();
    // Item appears both on the card pill and inside the modal.
    await expect(page.locator('text=Espada Comum').last()).toBeVisible();

    // Stat bonus displayed: "+4 ATK"
    await expect(page.locator('text=/\\+4\\s*ATK/').first()).toBeVisible();
  });

  test('Mission result modal shows detailed info', async ({ page }) => {
    await loadWithState(page, makeState({
      heroes: [
        makeHero({
          id: 'h1',
          name: 'Aldric #1',
          classId: 'WARRIOR',
          hpMax: 25,
          hpCurrent: 20,
        }),
      ],
      heroesRecruited: 1,
      recentMissionResults: [
        {
          missionId: 'm1',
          templateId: 'mission_1',
          success: true,
          reward: 5,
          rounds: 3,
          casualties: [{ heroId: 'h1', hpLost: 5, hpAfter: 20 }],
          enemyCasualties: 2,
          totalEnemies: 2,
          actions: [],
          log: [],
        },
      ],
    }));

    await page.click('[role="tab"]:has-text("Missões")');

    // Victory header and summary
    await expect(page.locator('text=/Vitoria/i').first()).toBeVisible();
    await expect(page.locator('text=/Vitoria em 3 rounds/i')).toBeVisible();

    // Enemy count in summary ("2/2 inimigos derrotados")
    await expect(page.locator('text=/2\\/2 inimigos derrotados/')).toBeVisible();

    // Reward: 5 gold (exact match to avoid mission list previews like "💰 5–50")
    await expect(page.locator('text=Ouro Ganho')).toBeVisible();
    await expect(page.getByText('💰 5', { exact: true })).toBeVisible();

    // Hero casualty: name + HP change
    await expect(page.locator('text=Aldric #1').first()).toBeVisible();
    await expect(page.locator('text=/-5\\s*HP/')).toBeVisible();
    await expect(page.locator('text=/20\\/25/')).toBeVisible();
  });

  test('Hero on mission cannot change task', async ({ page }) => {
    const missionStartedAt = Date.now();
    await loadWithState(page, makeState({
      heroes: [
        makeHero({
          id: 'h1',
          name: 'Aldric #1',
          classId: 'WARRIOR',
          currentTask: 'MISSION',
        }),
      ],
      heroesRecruited: 1,
      activeMissions: [
        {
          id: 'm1',
          templateId: 'mission_1',
          heroIds: ['h1'],
          startedAt: missionStartedAt,
          finishAt: missionStartedAt + 10 * 60 * 1000,
          remainingMs: 10 * 60 * 1000,
        },
      ],
    }));

    await page.click('[role="tab"]:has-text("Treino")');
    await expect(page.locator('text=Aldric #1').first()).toBeVisible();

    // Hero should display "Em Missão" badge
    await expect(page.locator('text=/Em Missão/i').first()).toBeVisible();

    // Try to click the "Treinar HP" action on the hero card
    await page.locator('text=Treinar HP').first().click();
    await page.waitForTimeout(300);

    // Hero should still be in MISSION task — verify via persisted state
    const task = await page.evaluate(() => {
      const raw = localStorage.getItem('@idle_rpg_game_state');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.heroes?.[0]?.currentTask ?? null;
    });
    expect(task).toBe('MISSION');

    // Badge still says Em Missão
    await expect(page.locator('text=/Em Missão/i').first()).toBeVisible();
  });
});
