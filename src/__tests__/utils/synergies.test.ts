import { getActiveSynergies } from '../../constants/synergies';

describe('Synergies', () => {
  test('detects WARRIOR + HEALER synergy', () => {
    const active = getActiveSynergies(['WARRIOR', 'HEALER']);
    expect(active.length).toBe(1);
    expect(active[0].name).toBe('Linha de Frente');
  });

  test('detects multiple synergies', () => {
    const active = getActiveSynergies(['WARRIOR', 'HEALER', 'TANK', 'ARCHER']);
    expect(active.length).toBeGreaterThanOrEqual(2);
  });

  test('no synergies for single class', () => {
    const active = getActiveSynergies(['WARRIOR']);
    expect(active.length).toBe(0);
  });
});
