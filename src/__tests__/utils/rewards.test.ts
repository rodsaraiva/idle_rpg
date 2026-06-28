import { computeFinalGold } from '../../utils/rewards';
import { GameState } from '../../types';
import { getEventSeed } from '../../constants/events';

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

  test('pantheon × legacy × evento ativo empilham multiplicativamente e truncam', () => {
    // event_goblin_invasion: missionRewardPct = 0.20 → fator 1.20
    // seed deve bater com o Date.now() interno de activeEventRewardMultiplier
    const seed = getEventSeed(Date.now());
    const state = makeState({
      pantheonBonuses: { goldPercent: 10, atkPercent: 0, hpPercent: 0 },
      legacyUpgrades: { reward_1: 2 },
      activeEvent: { id: 'event_goblin_invasion', seed, startedAt: 0, endsAt: Date.now() + 60_000 },
    });
    // applyGoldBonus:          Math.floor(100 * 1.1)  = 110
    // legacyRewardMultiplier:  1 + (2*5)/100           = 1.1
    // activeEventRewardMultiplier: 1 + 0.20            = 1.2
    // Math.floor(110 * 1.1 * 1.2) = Math.floor(145.2) = 145
    expect(computeFinalGold(100, state)).toBe(145);
  });
});
