import { rarity, Rarity } from '../../theme/tokens/rarity';
import { elevation } from '../../theme/tokens/elevation';
import { darkColors } from '../../theme/tokens/colors';

describe('tokens de raridade', () => {
  const all: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

  test('cada raridade tem cor não-vazia e label pt-BR', () => {
    for (const r of all) {
      expect(rarity[r].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(rarity[r].label.length).toBeGreaterThan(0);
    }
    expect(rarity.common.label).toBe('Comum');
    expect(rarity.legendary.label).toBe('Lendário');
  });

  test('cada glow é uma chave válida de elevation', () => {
    for (const r of all) {
      expect(elevation).toHaveProperty(rarity[r].glow);
    }
  });

  test('cores derivam dos tokens de raridade da paleta', () => {
    expect(rarity.common.color).toBe(darkColors.rarityCommon);
    expect(rarity.legendary.color).toBe(darkColors.rarityLegendary);
  });
});
