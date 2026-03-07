import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameState } from '../types';

const STORAGE_KEY = '@idle_rpg_game_state';
const CURRENT_VERSION = 2; // Incremented for migrations

interface SaveData extends GameState {
  _version: number;
  lastSavedAt: number;
}

/**
 * Migration functions for different versions.
 * Each function transforms data from version (N-1) to version N.
 */
const migrations: Record<number, (data: any) => any> = {
  2: (data) => {
    // Version 2 Migration: Ensure training fields and perHeroGold exist
    if (data && Array.isArray(data.heroes)) {
      data.heroes = data.heroes.map((h: any) => ({
        trainingProgressMs: h.trainingProgressMs ?? { hp: 0, atk: 0, mp: 0 },
        trainingCount: h.trainingCount ?? { hp: 0, atk: 0, mp: 0 },
        ...h,
      }));
    }
    data.perHeroGold = data.perHeroGold ?? {};
    return data;
  },
};

/**
 * Applies migrations to the data based on its version.
 */
function applyMigrations(data: any): GameState {
  let version = data._version || 1;

  while (version < CURRENT_VERSION) {
    version++;
    if (migrations[version]) {
      console.log(`Applying storage migration to version ${version}`);
      data = migrations[version](data);
    }
  }

  data._version = version;
  return data as GameState;
}

export const StorageService = {
  /** Salva o estado do jogo no armazenamento local */
  async save(state: GameState): Promise<void> {
    try {
      const saveData: SaveData = {
        ...state,
        _version: CURRENT_VERSION,
        lastSavedAt: Date.now(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    } catch (error) {
      console.error('StorageService: Erro ao salvar estado:', error);
    }
  },

  /** Carrega o estado do jogo do armazenamento local */
  async load(): Promise<GameState | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (!data) return null;

      let parsed = JSON.parse(data);
      parsed = applyMigrations(parsed);
      
      return parsed as GameState;
    } catch (error) {
      console.error('StorageService: Erro ao carregar estado:', error);
      return null;
    }
  },

  /** Limpa o estado do jogo salvo */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('StorageService: Erro ao limpar estado:', error);
    }
  },
};

// Deprecated functions for backward compatibility with existing imports
export const saveGameState = StorageService.save;
export const loadGameState = StorageService.load;
export const clearGameState = StorageService.clear;
