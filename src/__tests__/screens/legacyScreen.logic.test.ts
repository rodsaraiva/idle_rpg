import { availableLegacyPoints, canBuy, LEGACY_UPGRADES } from '../../constants/legacyUpgrades';
import type { GameState } from '../../types';

function makeState(
  level: number,
  upgrades: Record<string, number> = {},
): GameState {
  return {
    gold: 0,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: 0,
    legacy: { level, totalExp: 0, sealsEarned: [] },
    legacyUpgrades: upgrades,
  } as unknown as GameState;
}

describe('availableLegacyPoints', () => {
  test('sem upgrades, pontos = nível', () => {
    expect(availableLegacyPoints(makeState(3))).toBe(3);
  });

  test('pontos = level − Σ ranks comprados', () => {
    // reward_1 rank 2 + haste_1 rank 1 = 3 ranks gastos, level 5 → 2 disponíveis
    const s = makeState(5, { reward_1: 2, haste_1: 1 });
    expect(availableLegacyPoints(s)).toBe(2);
  });

  test('sem nível (legacy ausente) retorna 0', () => {
    const s = { gold: 0, heroes: [], heroesRecruited: 0, lastSavedAt: 0 } as unknown as GameState;
    expect(availableLegacyPoints(s)).toBe(0);
  });
});

describe('canBuy', () => {
  test('retorna false sem pontos disponíveis', () => {
    // level 0 = 0 pontos
    expect(canBuy(makeState(0), 'reward_1')).toBe(false);
  });

  test('retorna false ao atingir maxRank', () => {
    const maxRank = LEGACY_UPGRADES.find(u => u.id === 'reward_1')!.maxRank;
    const s = makeState(maxRank + 1, { reward_1: maxRank });
    expect(canBuy(s, 'reward_1')).toBe(false);
  });

  test('retorna true com ponto disponível e rank abaixo do máximo', () => {
    expect(canBuy(makeState(1), 'reward_1')).toBe(true);
  });

  test('retorna false para upgradeId inexistente', () => {
    expect(canBuy(makeState(5), 'upgrade_nao_existe')).toBe(false);
  });
});
