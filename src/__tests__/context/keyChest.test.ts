import { handleOpenKeyChest } from '../../context/heroHandler';

const withKeys = (k: any): any => ({ gold: 50, heroes: [], materials: {}, inventory: [], keys: k });

test('abre baú consome 1 chave e não mexe em gold', () => {
  const s = handleOpenKeyChest(withKeys({ bronze: 1, silver: 0, gold: 0 }), 'bronze');
  expect(s.keys!.bronze).toBe(0);
  expect(s.gold).toBe(50);
});

test('no-op sem chave', () => {
  const base = withKeys({ bronze: 0, silver: 0, gold: 0 });
  expect(handleOpenKeyChest(base, 'bronze')).toBe(base);
});
