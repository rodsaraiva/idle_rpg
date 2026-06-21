import { darkColors } from './tokens/colors';
import { typography } from './tokens/typography';
import { elevation } from './tokens/elevation';
import { spacing, borderRadius } from './tokens/spacing';
import { rarity } from './tokens/rarity';

// Chaves do tema legado que ainda não existem em darkColors -> equivalente "Reino".
// Removidas em SPEC 3, quando cada consumidor migrar para o token semântico.
const compatAliases = {
  primary: darkColors.gold,
  primaryLight: darkColors.goldBright,
  primaryDark: darkColors.goldDark,
  background: darkColors.bgBase,
  surfaceLight: darkColors.surfaceRaised,
  hp: darkColors.statHp,
  atk: darkColors.statAtk,
  mp: darkColors.statMp,
} as const;

/** Tema centralizado — altere os tokens em src/theme/tokens para mudar o visual do jogo */
export const theme = {
  colors: { ...darkColors, ...compatAliases },
  type: typography,
  elevation,
  rarity,
  spacing,
  borderRadius,
  // Legado: StatBar/EmptyState ainda leem theme.fontSize/fontWeight (migram em SPEC 3)
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export type Theme = typeof theme;
