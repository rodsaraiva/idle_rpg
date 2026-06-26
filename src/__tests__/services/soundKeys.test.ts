import { SOUND_KEYS } from '../../constants/assets';

test('toda chave referenciada no app está declarada em SOUND_KEYS', () => {
  // chaves usadas hoje em ChestRevealModal e demais call sites
  const referenced = ['chest_suspense', 'chest_open', 'chest_reveal'];
  for (const k of referenced) expect(SOUND_KEYS).toContain(k);
});

test('SOUND_KEYS cobre todos os marcos de gameplay planejados', () => {
  const planned = ['battle_hit', 'death', 'forge_craft', 'mission_reward', 'level_up', 'ambient'];
  for (const k of planned) expect(SOUND_KEYS).toContain(k);
});
