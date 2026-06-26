import { COSMETICS, Cosmetic } from '../constants/cosmetics';

/** Localiza um cosmético pelo id no catálogo. Retorna undefined se não encontrado. */
export function resolveCosmetic(id: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.id === id);
}

/** Retorna o valor de `corner` do cosmético — undefined se id inválido ou sem corner. */
export function cornerForFrame(id: string): Cosmetic['corner'] | undefined {
  return resolveCosmetic(id)?.corner;
}

/**
 * Mapeia o corner do catálogo de cosméticos para o tipo aceito por OrnateFrame.
 * OrnateFrame suporta apenas 'gold' | 'wood'; silver/obsidian mapeiam para 'wood'.
 * Sem cores hardcoded — usa tokens do DS via a prop corner do componente.
 */
export function toOrnateFrameCorner(corner: Cosmetic['corner']): 'gold' | 'wood' {
  return corner === 'gold' ? 'gold' : 'wood';
}
