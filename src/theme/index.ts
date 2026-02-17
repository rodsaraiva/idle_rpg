/** Tema centralizado — altere aqui para mudar todo o visual do jogo */
export const theme = {
  colors: {
    primary: '#7C3AED',
    primaryLight: '#A78BFA',
    primaryDark: '#5B21B6',

    background: '#0F0D23',
    surface: '#1A1735',
    surfaceLight: '#252248',

    gold: '#F59E0B',
    goldDark: '#D97706',

    hp: '#EF4444',
    atk: '#F97316',
    mp: '#3B82F6',

    success: '#10B981',
    danger: '#EF4444',

    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',

    border: '#334155',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },

  borderRadius: {
    sm: 6,
    md: 12,
    lg: 16,
    xl: 24,
  },

  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
  },

  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

export type Theme = typeof theme;
