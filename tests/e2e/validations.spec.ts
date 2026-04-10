import { test, expect, Page } from '@playwright/test';
import { loadWithState, makeHero, makeState } from './helpers';

const STORAGE_KEY = '@idle_rpg_game_state';

/**
 * Helper: navigate to the Missões tab.
 */
async function goToMissions(page: Page) {
  await page.click('[role="tab"]:has-text("Missões")');
  await expect(page.locator('text=Quadro de Missões')).toBeVisible();
}

/**
 * Helper: click Enviar on the mission card that matches missionName.
 * MissionListItem renders Enviar as a native RN <Button>, which becomes
 * a <button> in RN Web. We filter by the card container containing the
 * mission name.
 */
async function clickEnviarFor(page: Page, missionName: string) {
  const card = page
    .locator('div')
    .filter({ hasText: missionName })
    .filter({ has: page.locator('text=Enviar') })
    .last();
  await card.locator('text=Enviar').first().click();
  await expect(page.locator('text=Posicione os heróis').first()).toBeVisible();
}

/**
 * Helper: place a hero by tapping their card in the horizontal FlatList.
 * The hero name uniquely identifies each card within the modal.
 */
async function tapHeroInModal(page: Page, heroName: string) {
  // Hero rows in the modal have accessibilityLabel starting with "Herói ...".
  // Use that to uniquely target the hero card (avoids matching the grid slot
  // that may later also show the hero name).
  const btn = page.getByRole('button', { name: new RegExp(`^Herói ${escapeRegex(heroName)}`) }).first();
  await btn.click();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('Validation & Constraint Tests', () => {
  test('Test 1: boss mission blocked when no TANK in party', async ({ page }) => {
    await loadWithState(
      page,
      makeState({
        gold: 1000,
        heroes: [
          makeHero({
            id: 'h1',
            name: 'Aldric #1',
            classId: 'WARRIOR',
            hpMax: 30,
            hpCurrent: 30,
            atk: 15,
          }),
          makeHero({
            id: 'h2',
            name: 'Brenna #2',
            classId: 'HEALER',
            hpMax: 25,
            hpCurrent: 25,
            atk: 13,
          }),
          makeHero({
            id: 'h3',
            name: 'Cedric #3',
            classId: 'ARCHER',
            hpMax: 28,
            hpCurrent: 28,
            atk: 14,
            attackType: 'RANGED',
            range: 3,
          }),
          makeHero({
            id: 'h4',
            name: 'Dorian #4',
            classId: 'MAGE',
            hpMax: 26,
            hpCurrent: 26,
            atk: 13,
          }),
        ],
        heroesRecruited: 4,
      })
    );

    await goToMissions(page);

    // Sanity check: the boss mission should be listed.
    await expect(page.locator('text=Covil do Dragão').first()).toBeVisible();

    await clickEnviarFor(page, 'Covil do Dragão');

    // Place all four heroes (none is a TANK).
    await tapHeroInModal(page, 'Aldric #1');
    await tapHeroInModal(page, 'Brenna #2');
    await tapHeroInModal(page, 'Cedric #3');
    await tapHeroInModal(page, 'Dorian #4');

    // Click Iniciar missão — reducer will silently reject due to missing Tank,
    // but the modal closes anyway (useMissions.handleConfirmMission calls
    // closeSelectionModal after dispatch).
    const start = page.getByRole('button', { name: /Iniciar missão/i }).first();
    await start.click();

    // Wait for the modal to actually close.
    await expect(page.locator('text=Posicione os heróis')).toHaveCount(0);

    // After the attempt, no "Missões em Andamento" section should appear,
    // because the reducer rejected the invalid mission start.
    await expect(page.locator('text=Missões em Andamento')).toHaveCount(0);

    // Confirm via saved state: no active missions, heroes still IDLE.
    // Auto-save runs every 5s; just read once here.
    const saved = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved as string);
    // Active missions should be empty.
    expect(parsed.activeMissions || []).toEqual([]);
  });

  test('Test 2: incapacitated hero cannot start mission', async ({ page }) => {
    await loadWithState(
      page,
      makeState({
        gold: 500,
        heroes: [
          makeHero({
            id: 'h1',
            name: 'Weakhero #1',
            classId: 'WARRIOR',
            hpMax: 25,
            hpCurrent: 2, // below threshold (3)
          }),
        ],
        heroesRecruited: 1,
      })
    );

    await goToMissions(page);

    // Sanity: mission_1 is listed, and 0 heroes prontos.
    await expect(page.locator('text=Primeira Patrulha').first()).toBeVisible();
    await expect(page.locator('text=0 heróis prontos')).toBeVisible();

    // Enviar button is disabled (availableCount < minHeroes). Force-click
    // attempts to trigger the button anyway — it should be a no-op.
    await page
      .locator('text=Enviar')
      .first()
      .click({ force: true })
      .catch(() => {});

    // No active mission should exist and no hero selection modal should open.
    await expect(page.locator('text=Missões em Andamento')).toHaveCount(0);
    await expect(page.locator('text=Posicione os heróis')).toHaveCount(0);

    // Hero's currentTask remains IDLE in saved state.
    const saved = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved as string);
    const hero = parsed.heroes.find((h: any) => h.id === 'h1');
    expect(hero).toBeTruthy();
    expect(hero.currentTask).toBe('IDLE');
    expect(parsed.activeMissions || []).toEqual([]);
  });

  test('Test 3: hero with 2 equipped items shows "Cheio" badge and cannot take a 3rd', async ({
    page,
  }) => {
    await loadWithState(
      page,
      makeState({
        gold: 0,
        heroes: [
          makeHero({
            id: 'h1',
            name: 'Fullhero #1',
            equippedItems: ['eq1', 'eq2'],
          }),
        ],
        heroesRecruited: 1,
        inventory: [
          { id: 'eq1', name: 'Espada Comum', type: 'weapon', statBonus: { atk: 4 }, tier: 1 },
          { id: 'eq2', name: 'Escudo Raro', type: 'armor', statBonus: { defense: 8 }, tier: 2 },
          { id: 'eq3', name: 'Anel Épico', type: 'accessory', statBonus: { crit: 6 }, tier: 3 },
        ],
      })
    );

    await page.click('text=Ferreiro');
    await expect(page.locator('text=Ferreiro Real').first()).toBeVisible();
    await expect(page.locator('text=Anel Épico').first()).toBeVisible();

    // Only eq3 has an Equipar button (eq1, eq2 show Desequipar).
    // Use exact-text match so "Desequipar" does not match.
    const equiparExact = page.getByText('Equipar', { exact: true });
    await expect(equiparExact).toHaveCount(1);
    await equiparExact.first().click();

    // Modal opens: "Equipar Anel Épico" — "Escolha um herói" is the subtitle.
    await expect(page.locator('text=Escolha um herói')).toBeVisible();

    // The hero row should show the "Cheio" badge (2/2 slots used).
    await expect(page.locator('text=Cheio').first()).toBeVisible();

    // The hero row is disabled — clicking it does nothing.
    await page.locator('text=Fullhero #1').first().click({ force: true }).catch(() => {});

    // Close the modal.
    const cancel = page.getByText('Cancelar', { exact: true }).first();
    if (await cancel.isVisible().catch(() => false)) {
      await cancel.click();
    }
    await page.waitForTimeout(300);

    // Verify eq3 still not equipped: exactly 2 Desequipar rows (eq1, eq2)
    // and exactly 1 Equipar row (eq3 remains equippable).
    const desequiparCount = await page.getByText('Desequipar', { exact: true }).count();
    expect(desequiparCount).toBe(2);
    const equiparCountAfter = await page.getByText('Equipar', { exact: true }).count();
    expect(equiparCountAfter).toBe(1);

    // Confirm via saved state too.
    const saved = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
    const parsed = JSON.parse(saved as string);
    const hero = parsed.heroes.find((h: any) => h.id === 'h1');
    expect(hero.equippedItems).toEqual(['eq1', 'eq2']);
  });

  test('Test 4: item exclusivity — cannot equip the same item to two heroes', async ({
    page,
  }) => {
    await loadWithState(
      page,
      makeState({
        gold: 0,
        heroes: [
          makeHero({ id: 'h1', name: 'Owner #1', equippedItems: ['eq1'] }),
          makeHero({ id: 'h2', name: 'Other #2', equippedItems: [] }),
        ],
        heroesRecruited: 2,
        inventory: [
          { id: 'eq1', name: 'Espada Comum', type: 'weapon', statBonus: { atk: 4 }, tier: 1 },
        ],
      })
    );

    await page.click('text=Ferreiro');
    await expect(page.locator('text=Ferreiro Real').first()).toBeVisible();

    // eq1 is equipped by Owner — the blacksmith inventory row shows "Equipado por Owner #1"
    // and offers only a Desequipar button (no Equipar), so the UI makes it
    // impossible to equip the item on a second hero.
    await expect(page.locator('text=Equipado por Owner #1')).toBeVisible();

    const desequiparCount = await page.getByText('Desequipar', { exact: true }).count();
    expect(desequiparCount).toBe(1);
    const equiparCount = await page.getByText('Equipar', { exact: true }).count();
    expect(equiparCount).toBe(0);

    // Saved state confirms exclusivity.
    const saved = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
    const parsed = JSON.parse(saved as string);
    const owner = parsed.heroes.find((h: any) => h.id === 'h1');
    const other = parsed.heroes.find((h: any) => h.id === 'h2');
    expect(owner.equippedItems).toContain('eq1');
    expect(other.equippedItems || []).not.toContain('eq1');
  });

  test('Test 5: insufficient gold blocks forging Épico tier', async ({ page }) => {
    await loadWithState(
      page,
      makeState({
        gold: 10, // well below any tier cost (50 / 150 / 400)
        heroes: [makeHero({ id: 'h1', name: 'Poor #1' })],
        heroesRecruited: 1,
      })
    );

    await page.click('text=Ferreiro');
    await expect(page.locator('text=Ferreiro Real').first()).toBeVisible();

    // Sanity: Épico tier is visible with cost 400 ouro.
    await expect(page.locator('text=Épico').first()).toBeVisible();
    await expect(page.locator('text=400 ouro').first()).toBeVisible();

    // Click the Épico tier card — handleForge is a no-op because the
    // TouchableOpacity is disabled={!canAfford}.
    const epicoCard = page
      .locator('div')
      .filter({ hasText: 'Épico' })
      .filter({ has: page.locator('text=400 ouro') })
      .first();
    await epicoCard.click({ force: true }).catch(() => {});

    // No "Forjando..." section means nothing was added to forgingQueue.
    await expect(page.locator('text=Forjando...')).toHaveCount(0);

    // Confirm via saved state: forgingQueue is empty and no items added.
    // Note: gold may tick up from other sources (daily quests, etc.), so we
    // only assert the forging state, which is the actual constraint under test.
    const saved = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
    const parsed = JSON.parse(saved as string);
    expect(parsed.forgingQueue || []).toEqual([]);
    expect(parsed.inventory || []).toEqual([]);
    // Gold should not be 400+ (which would indicate something strange).
    expect(parsed.gold).toBeLessThan(50);
  });

  test('Test 6: offline progress modal appears after returning from past save', async ({
    page,
  }) => {
    // Manually seed with a past lastSavedAt so the offline progress calculator
    // produces a non-null summary (bypasses loadWithState, which sets a
    // future timestamp).
    const state = makeState({
      gold: 500,
      heroes: [
        makeHero({
          id: 'h1',
          name: 'Sleeper #1',
          currentTask: 'TRAIN_HP',
        }),
      ],
      heroesRecruited: 1,
      lastSavedAt: Date.now() - 20 * 60 * 1000, // 20 minutes ago
    });

    await page.goto('/');
    await page.evaluate(
      ({ k, v }) => localStorage.setItem(k, v),
      { k: STORAGE_KEY, v: JSON.stringify(state) }
    );
    await page.reload();
    await page.waitForLoadState('networkidle');

    // The OfflineSummaryModal is rendered inside TrainingScreen; navigate
    // there so it mounts (React Navigation lazily mounts tabs).
    await page.click('[role="tab"]:has-text("Treino")');

    // Offline Summary Modal title.
    await expect(page.locator('text=Progresso Offline')).toBeVisible({ timeout: 10000 });

    // Elapsed-time label is shown.
    await expect(page.locator('text=Tempo simulado:').first()).toBeVisible();

    // The Aplicar and Descartar action buttons are present.
    await expect(page.locator('text=Aplicar').first()).toBeVisible();
    await expect(page.locator('text=Descartar').first()).toBeVisible();
  });
});
