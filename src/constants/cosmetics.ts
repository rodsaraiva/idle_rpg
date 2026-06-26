// Catálogo de cosméticos do jogo — NENHUM campo de stat (invariante anti-P2W)
// Cosméticos são puramente visuais: molduras, selos e temas de interface.
import { Rarity } from '../theme/tokens/rarity';

export interface Cosmetic {
  id: string;
  name: string;
  slot: 'frame' | 'seal' | 'theme';
  rarity: Rarity;
  /** Cor do canto da moldura — mapeia para OrnateFrame do DS */
  corner?: 'gold' | 'wood' | 'silver' | 'obsidian';
}

/** Todos os cosméticos disponíveis no jogo. Nenhum altera stats. */
export const COSMETICS: Cosmetic[] = [
  // --- Molduras (frame) ---
  {
    id: 'frame_bronze',
    name: 'Moldura de Bronze',
    slot: 'frame',
    rarity: 'common',
    corner: 'wood',
  },
  {
    id: 'frame_silver',
    name: 'Moldura de Prata',
    slot: 'frame',
    rarity: 'rare',
    corner: 'silver',
  },
  {
    id: 'frame_gold',
    name: 'Moldura Dourada',
    slot: 'frame',
    rarity: 'epic',
    corner: 'gold',
  },
  {
    id: 'frame_obsidian',
    name: 'Moldura de Obsidiana',
    slot: 'frame',
    rarity: 'legendary',
    corner: 'obsidian',
  },

  // --- Selos (seal) ---
  {
    id: 'seal_iron',
    name: 'Selo de Ferro',
    slot: 'seal',
    rarity: 'common',
  },
  {
    id: 'seal_crystal',
    name: 'Selo de Cristal',
    slot: 'seal',
    rarity: 'rare',
  },
  {
    id: 'seal_flame',
    name: 'Selo da Chama',
    slot: 'seal',
    rarity: 'epic',
  },
  {
    id: 'seal_void',
    name: 'Selo do Vazio',
    slot: 'seal',
    rarity: 'legendary',
  },

  // --- Temas de interface (theme) ---
  {
    id: 'theme_dungeon',
    name: 'Tema Masmorra',
    slot: 'theme',
    rarity: 'common',
  },
  {
    id: 'theme_forest',
    name: 'Tema Floresta',
    slot: 'theme',
    rarity: 'rare',
  },
  {
    id: 'theme_crimson',
    name: 'Tema Carmesim',
    slot: 'theme',
    rarity: 'epic',
  },
];
