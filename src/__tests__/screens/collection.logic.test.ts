import { collectionView } from '../../utils/collectionUtils';
import { COSMETICS, type Cosmetic } from '../../constants/cosmetics';
import type { GameState } from '../../types';

function makeState(ownedIds: string[]): GameState {
  return {
    gold: 0,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: 0,
    cosmetics: { owned: ownedIds, equipped: {} },
  } as unknown as GameState;
}

describe('collectionView', () => {
  test('sem cosméticos: tudo bloqueado', () => {
    const { owned, locked } = collectionView(makeState([]));
    expect(owned).toHaveLength(0);
    expect(locked.length).toBeGreaterThan(0);
  });

  test('cosmético possuído aparece em owned e não em locked', () => {
    const { owned, locked } = collectionView(makeState(['frame_gold']));
    expect(owned.map((c: Cosmetic) => c.id)).toContain('frame_gold');
    expect(locked.map((c: Cosmetic) => c.id)).not.toContain('frame_gold');
  });

  test('cosmético não-possuído aparece em locked e não em owned', () => {
    const { owned, locked } = collectionView(makeState([]));
    expect(locked.map((c: Cosmetic) => c.id)).toContain('frame_gold');
    expect(owned.map((c: Cosmetic) => c.id)).not.toContain('frame_gold');
  });

  test('owned + locked = catálogo completo (sem duplicatas)', () => {
    const ownedIds = ['frame_bronze', 'seal_iron'];
    const { owned, locked } = collectionView(makeState(ownedIds));
    const allIds = [...owned.map((c: Cosmetic) => c.id), ...locked.map((c: Cosmetic) => c.id)];
    // Sem duplicatas
    expect(new Set(allIds).size).toBe(allIds.length);
    // Cobrem o catálogo inteiro
    expect(allIds.sort()).toEqual(COSMETICS.map((c: Cosmetic) => c.id).sort());
  });

  test('estado sem cosmetics: tudo bloqueado (salvo antigo)', () => {
    const state = { gold: 0, heroes: [] } as unknown as GameState;
    const { owned, locked } = collectionView(state);
    expect(owned).toHaveLength(0);
    expect(locked.length).toBeGreaterThan(0);
  });
});
