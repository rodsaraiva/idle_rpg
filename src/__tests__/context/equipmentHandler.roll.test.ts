import { generateEquipment } from '../../context/equipmentHandler';

describe('generateEquipment — roll tier-multiplicativo determinístico', () => {
  // rng fixo em 0 → rola sempre o mínimo do range; rng→0.999 → rola o máximo.
  test('tier 1 weapon (atk 2-8): rng=0 dá atk=2; rng→1 dá atk=8', () => {
    const min = generateEquipment(1, 'weapon', () => 0);
    const max = generateEquipment(1, 'weapon', () => 0.999999);
    expect(min.statBonus.atk).toBe(2);
    expect(max.statBonus.atk).toBe(8);
  });

  test('tier 3 weapon (atk 2-8 ×3 = 6-24): rng=0 dá 6; rng→1 dá 24', () => {
    const min = generateEquipment(3, 'weapon', () => 0);
    const max = generateEquipment(3, 'weapon', () => 0.999999);
    expect(min.statBonus.atk).toBe(6);
    expect(max.statBonus.atk).toBe(24);
  });

  test('tier 3 armor (defense 3-10 ×3 = 9-30): rng=0 dá def=9; rng→1 dá def=30', () => {
    const min = generateEquipment(3, 'armor', () => 0);
    const max = generateEquipment(3, 'armor', () => 0.999999);
    expect(min.statBonus.defense).toBe(9);
    expect(max.statBonus.defense).toBe(30);
  });
});
