import { getActiveSynergies, getSynergyMultipliers } from '../../constants/synergies';

describe('Synergies', () => {
  test('detects WARRIOR + HEALER synergy', () => {
    const active = getActiveSynergies(['WARRIOR', 'HEALER']);
    expect(active.length).toBe(1);
    expect(active[0].name).toBe('Linha de Frente');
  });

  test('detects multiple synergies', () => {
    const active = getActiveSynergies(['WARRIOR', 'HEALER', 'TANK', 'ARCHER']);
    expect(active.length).toBeGreaterThanOrEqual(2); // Warrior+Healer and Tank+Archer
  });

  test('no synergies for single class', () => {
    const active = getActiveSynergies(['WARRIOR']);
    expect(active.length).toBe(0);
  });

  test('multipliers stack from multiple synergies', () => {
    // WARRIOR+HEALER = Linha de Frente (+10% ATK), TANK+HEALER = Bastião (+20% heal)
    const mult = getSynergyMultipliers(['WARRIOR', 'HEALER', 'TANK', 'ARCHER']);
    expect(mult.atk).toBeGreaterThan(1); // from Linha de Frente
    expect(mult.defense).toBeGreaterThan(1); // from Muralha e Flecha (TANK+ARCHER)
  });

  test('no synergies returns neutral multipliers', () => {
    const mult = getSynergyMultipliers(['WARRIOR']);
    expect(mult.atk).toBe(1);
    expect(mult.defense).toBe(1);
    expect(mult.heal).toBe(1);
  });
});
