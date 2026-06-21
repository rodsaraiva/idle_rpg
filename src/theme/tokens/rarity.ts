import { darkColors } from './colors';
import { elevation } from './elevation';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const rarity: Record<Rarity, { color: string; glow: keyof typeof elevation; label: string }> = {
  common: { color: darkColors.rarityCommon, glow: 'e0', label: 'Comum' },
  rare: { color: darkColors.rarityRare, glow: 'e1', label: 'Raro' },
  epic: { color: darkColors.rarityEpic, glow: 'glowEpic', label: 'Épico' },
  legendary: { color: darkColors.rarityLegendary, glow: 'glowLegendary', label: 'Lendário' },
};
