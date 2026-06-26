import { GameState } from '../types';

/**
 * Equipa um cosmético no slot indicado.
 * No-op se o cosmético não estiver na lista de possuídos (cosmetics.owned).
 * Nunca altera stats nem gold — cosméticos são puramente visuais.
 */
export function handleEquipCosmetic(
  state: GameState,
  slot: 'frame' | 'seal' | 'theme',
  cosmeticId: string,
): GameState {
  const owned = state.cosmetics?.owned ?? [];

  // Guarda de posse: não equipa o que o jogador não tem
  if (!owned.includes(cosmeticId)) return state;

  return {
    ...state,
    cosmetics: {
      owned,
      equipped: {
        ...(state.cosmetics?.equipped ?? {}),
        [slot]: cosmeticId,
      },
    },
  };
}
