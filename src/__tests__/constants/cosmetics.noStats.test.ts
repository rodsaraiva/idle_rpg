import { COSMETICS } from '../../constants/cosmetics';

test('nenhum cosmético tem campo de stat', () => {
  const banned = ['hp', 'atk', 'mp', 'defense', 'crit', 'agility', 'statBonus'];
  for (const c of COSMETICS) {
    for (const k of banned) {
      expect((c as any)[k]).toBeUndefined();
    }
  }
});
