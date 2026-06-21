import { theme } from '../../theme';

describe('theme composto', () => {
  test('expõe os tokens do Reino nas cores', () => {
    const tokens = [
      'bgDeep', 'bgBase', 'surface', 'surfaceRaised',
      'gold', 'goldBright', 'goldDark',
      'statHp', 'statAtk', 'statMp', 'statDef',
      'textPrimary', 'textSecondary', 'textMuted', 'border',
      'success', 'danger',
    ] as const;
    for (const k of tokens) {
      expect(typeof theme.colors[k]).toBe('string');
      expect(theme.colors[k]).toMatch(/^#/);
    }
  });

  test('tokens semânticos do Reino têm valores corretos', () => {
    expect(theme.colors.bgBase).toBe('#1E1710');
    expect(theme.colors.surface).toBe('#2A2018');
    expect(theme.colors.gold).toBe('#C9A227');
    expect(theme.colors.statHp).toBe('#C0392B');
    expect(theme.colors.statAtk).toBe('#C8772E');
    expect(theme.colors.statMp).toBe('#3E6E8E');
  });

  test('expõe os novos grupos de tokens', () => {
    expect(theme.colors.bgBase).toBe('#1E1710');
    expect(theme.colors.gold).toBe('#C9A227');
    expect(theme.colors.rarityLegendary).toBe('#E8C45A');
    expect(theme.colors.statHp).toBe('#C0392B');
    expect(theme.rarity.legendary.glow).toBe('glowLegendary');
    expect(theme.elevation.e1.elevation).toBe(2);
  });

  test('theme.type tem os 8 estilos compostos com âncoras do §3.3', () => {
    const keys = ['display', 'h1', 'h2', 'bodyLg', 'body', 'label', 'caption', 'stat'] as const;
    for (const k of keys) {
      expect(theme.type[k]).toHaveProperty('fontFamily');
      expect(theme.type[k]).toHaveProperty('fontSize');
      expect(theme.type[k]).toHaveProperty('lineHeight');
      expect(theme.type[k]).toHaveProperty('letterSpacing');
      expect(theme.type[k]).toHaveProperty('fontWeight');
    }
    expect(theme.type.display.fontSize).toBe(32);
    expect(theme.type.display.lineHeight).toBe(40);
    expect(theme.type.display.letterSpacing).toBe(0.5);
    expect(theme.type.h1.fontSize).toBe(24);
    expect(theme.type.body.fontSize).toBe(14);
  });

  test('borderRadius medieval e espaçamentos presentes', () => {
    expect(theme.borderRadius.sm).toBe(4); // medieval (era 6)
    expect(typeof theme.spacing.md).toBe('number');
  });
});
