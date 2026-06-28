import { resolveCosmetic } from '../../utils/cosmeticUtils';

test('resolveCosmetic retorna o cosmético pelo id', () => {
  const c = resolveCosmetic('frame_gold');
  expect(c).toBeDefined();
  expect(c!.id).toBe('frame_gold');
  expect(c!.slot).toBe('frame');
  expect(c!.corner).toBe('gold');
});

test('resolveCosmetic retorna undefined para id inexistente', () => {
  expect(resolveCosmetic('nonexistent_xyz')).toBeUndefined();
});

test('selos e temas também são resolvidos pelo catálogo', () => {
  const seal = resolveCosmetic('seal_flame');
  expect(seal).toBeDefined();
  expect(seal!.slot).toBe('seal');

  const thm = resolveCosmetic('theme_forest');
  expect(thm).toBeDefined();
  expect(thm!.slot).toBe('theme');
});
