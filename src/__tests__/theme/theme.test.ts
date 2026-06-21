import { theme } from '../../theme';

describe('theme composto', () => {
  test('mantém as chaves legadas resolvendo para string (compat — nenhuma tela quebra)', () => {
    const legacy = [
      'background', 'surface', 'surfaceLight', 'primary', 'primaryLight', 'primaryDark',
      'hp', 'atk', 'mp', 'gold', 'goldDark', 'success', 'danger',
      'textPrimary', 'textSecondary', 'textMuted', 'border',
    ] as const;
    for (const k of legacy) {
      expect(typeof (theme.colors as Record<string, string>)[k]).toBe('string');
      expect((theme.colors as Record<string, string>)[k]).toMatch(/^#/);
    }
  });

  test('aliases legados apontam para os tokens do Reino', () => {
    expect(theme.colors.background).toBe('#1E1710'); // bgBase
    expect(theme.colors.surface).toBe('#2A2018');
    expect(theme.colors.primary).toBe('#C9A227'); // gold
    expect(theme.colors.hp).toBe('#C0392B'); // statHp
    expect(theme.colors.atk).toBe('#C8772E'); // statAtk
    expect(theme.colors.mp).toBe('#3E6E8E'); // statMp
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

  test('mantém fontSize/fontWeight legados e borderRadius medieval', () => {
    expect(theme.fontSize.md).toBe(14);
    expect(theme.fontWeight.bold).toBe('700');
    expect(theme.borderRadius.sm).toBe(4); // medieval (era 6)
  });
});
