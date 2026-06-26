import { handleEquipCosmetic } from '../../context/cosmeticHandler';

test('equipa cosmético possuído', () => {
  const s = handleEquipCosmetic(
    { heroes: [], cosmetics: { owned: ['frame_gold'], equipped: {} } } as any,
    'frame',
    'frame_gold',
  );
  expect(s.cosmetics!.equipped.frame).toBe('frame_gold');
});

test('não equipa cosmético não-possuído', () => {
  const base: any = { heroes: [], cosmetics: { owned: [], equipped: {} } };
  expect(handleEquipCosmetic(base, 'frame', 'frame_gold')).toBe(base);
});
