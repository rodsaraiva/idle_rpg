import { darkColors } from './tokens/colors';
import { typography } from './tokens/typography';
import { elevation } from './tokens/elevation';
import { spacing, borderRadius } from './tokens/spacing';
import { rarity } from './tokens/rarity';

/** Tema centralizado — altere os tokens em src/theme/tokens para mudar o visual do jogo */
export const theme = {
  colors: darkColors,
  type: typography,
  elevation,
  rarity,
  spacing,
  borderRadius,
} as const;

export type Theme = typeof theme;
