import { EQUIPMENT_TIERS } from '../../constants/equipment';
import { rarity, Rarity } from '../../theme/tokens/rarity';

describe('EQUIPMENT_TIERS sem hex literal', () => {
  test('nenhum tier carrega a chave color', () => {
    for (const t of EQUIPMENT_TIERS) {
      expect(t).not.toHaveProperty('color');
    }
  });

  test('cada tier tem uma rarity válida e mapeada', () => {
    for (const t of EQUIPMENT_TIERS) {
      expect(Object.keys(rarity)).toContain((t as { rarity: Rarity }).rarity);
    }
  });

  test('tier1→common, tier2→rare, tier3→epic', () => {
    const byTier = Object.fromEntries(EQUIPMENT_TIERS.map(t => [t.tier, (t as { rarity: Rarity }).rarity]));
    expect(byTier[1]).toBe('common');
    expect(byTier[2]).toBe('rare');
    expect(byTier[3]).toBe('epic');
  });
});
