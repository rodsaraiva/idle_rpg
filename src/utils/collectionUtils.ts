import { COSMETICS, type Cosmetic } from '../constants/cosmetics';
import type { GameState } from '../types';

/** Separa o catálogo de cosméticos entre possuídos e bloqueados. */
export function collectionView(state: GameState): { owned: Cosmetic[]; locked: Cosmetic[] } {
  const ownedIds = state.cosmetics?.owned ?? [];
  const owned: Cosmetic[] = [];
  const locked: Cosmetic[] = [];

  for (const cosmetic of COSMETICS) {
    if (ownedIds.includes(cosmetic.id)) {
      owned.push(cosmetic);
    } else {
      locked.push(cosmetic);
    }
  }

  return { owned, locked };
}
