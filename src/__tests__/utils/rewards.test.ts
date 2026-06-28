import { computeFinalGold } from '../../utils/rewards';
import { GameState } from '../../types';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    gold: 0,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: 0,
    inventory: [],
    ...overrides,
  } as GameState;
}

describe('computeFinalGold', () => {
  test('sem bônus: retorna reward sem alteração', () => {
    const state = makeState();
    expect(computeFinalGold(100, state)).toBe(100);
  });

  test('pantheon goldPercent 10% aplica bônus via applyGoldBonus', () => {
    // applyGoldBonus: Math.floor(100 * 1.1) = 110
    const state = makeState({ pantheonBonuses: { goldPercent: 10, atkPercent: 0, hpPercent: 0 } });
    expect(computeFinalGold(100, state)).toBe(110);
  });

  test('legacy missionRewardPct 10% multiplica a recompensa', () => {
    // reward_1 perRank=5, rank=2 → +10% → fator 1.1
    const state = makeState({ legacyUpgrades: { reward_1: 2 } });
    expect(computeFinalGold(100, state)).toBe(110);
  });

  test('pantheon + legacy empilham de forma multiplicativa', () => {
    // applyGoldBonus: Math.floor(100 * 1.1) = 110
    // legacyRewardMultiplier: 1.1
    // Math.floor(110 * 1.1) = Math.floor(121) = 121
    const state = makeState({
      pantheonBonuses: { goldPercent: 10, atkPercent: 0, hpPercent: 0 },
      legacyUpgrades: { reward_1: 2 },
    });
    expect(computeFinalGold(100, state)).toBe(121);
  });

  test('Math.floor trunca resultado decimal', () => {
    // legacyRewardMultiplier com reward_1=1 → +5% → fator 1.05
    // Math.floor(10 * 1.05) = Math.floor(10.5) = 10
    const state = makeState({ legacyUpgrades: { reward_1: 1 } });
    expect(computeFinalGold(10, state)).toBe(10);
  });

  test('sem evento ativo: activeEventRewardMultiplier retorna 1 (sem efeito)', () => {
    const state = makeState({ activeEvent: null });
    expect(computeFinalGold(50, state)).toBe(50);
  });
});
