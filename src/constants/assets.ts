/**
 * Contrato de chaves de áudio do app.
 * SOUND_ASSETS permanece vazio até os arquivos licenciados serem adquiridos (débito).
 * O tipo SoundKey fixa o contrato e permite auditoria estática dos call sites.
 */
export type SoundKey =
  | 'chest_suspense'
  | 'chest_open'
  | 'chest_reveal'
  | 'battle_hit'
  | 'death'
  | 'forge_craft'
  | 'mission_reward'
  | 'level_up'
  | 'ambient';

export const SOUND_KEYS: SoundKey[] = [
  'chest_suspense',
  'chest_open',
  'chest_reveal',
  'battle_hit',
  'death',
  'forge_craft',
  'mission_reward',
  'level_up',
  'ambient',
];

export const SOUND_ASSETS: Partial<Record<SoundKey, any>> = {};

export const LOTTIE_ASSETS = {
  CHEST_PULSE: require('../../assets/lottie/chest_pulse.json'),
  CONFETTI: require('../../assets/lottie/confetti.json'),
  SPARKLE_BURST: require('../../assets/lottie/sparkle_burst.json'),
  LEVEL_UP: require('../../assets/lottie/level_up.json'),
  FORGE_COMPLETE: require('../../assets/lottie/forge_complete.json'),
  RECRUIT: require('../../assets/lottie/recruit.json'),
};

export const IMAGE_ASSETS = {
  VILLAGE_MAP: require('../../assets/village_map.png'),
};
