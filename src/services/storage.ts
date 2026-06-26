import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameState } from '../types';

const STORAGE_KEY = '@idle_rpg_game_state';
const BACKUP_KEY = '@idle_rpg_game_state.bak';
export const CURRENT_VERSION = 12; // Incremented for migrations

interface SaveData extends GameState {
  _version: number;
  lastSavedAt: number;
}

/** Lançada quando um save existe mas não pôde ser lido/validado — distinto de "sem save" (null). */
export class CorruptSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CorruptSaveError';
  }
}

/**
 * Migration functions for different versions.
 * Each function transforms data from version (N-1) to version N.
 */
const migrations: Record<number, (data: any) => any> = {
  2: (data) => {
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
  3: (data) => {
    if (data && Array.isArray(data.heroes)) {
      data.heroes = data.heroes.map((h: any) => ({
        ...h,
        hpCurrent: h.hpCurrent ?? h.hpMax ?? h.hp ?? 0,
        hpRegenProgressMs: h.hpRegenProgressMs ?? 0,
      }));
    }
    return data;
  },
  4: (data) => {
    if (data && Array.isArray(data.heroes)) {
      data.heroes = data.heroes.map((h: any) => ({
        ...h,
        trainingProgressMs: { hp: 0, atk: 0, mp: 0, ...(h.trainingProgressMs ?? {}) },
        trainingCount: { hp: 0, atk: 0, mp: 0, ...(h.trainingCount ?? {}) },
      }));
    }
    return data;
  },
  5: (data) => {
    data.inventory = data.inventory ?? [];
    data.forgingQueue = data.forgingQueue ?? [];
    if (data && Array.isArray(data.heroes)) {
      data.heroes = data.heroes.map((h: any) => ({ ...h, equippedItems: h.equippedItems ?? [] }));
    }
    return data;
  },
  6: (data) => {
    if (data && Array.isArray(data.heroes)) {
      for (const hero of data.heroes) {
        if (hero.stars === undefined) hero.stars = 0;
      }
    }
    if (data.pantheonFusions === undefined) data.pantheonFusions = 0;
    return data;
  },
  7: (data) => data,
  8: (data) => {
    if (data.materials === undefined) data.materials = {};
    return data;
  },
  9: (data) => {
    // Version 9: remove o campo legado remainingMs e garante startedAt nas missões ativas
    if (Array.isArray(data.activeMissions)) {
      data.activeMissions = data.activeMissions.map((m: any) => {
        const { remainingMs, ...rest } = m;
        return { ...rest, startedAt: typeof rest.startedAt === 'number' ? rest.startedAt : Date.now() };
      });
    }
    return data;
  },
  10: (data) => {
    // Version 10: bloco de onboarding. Save antigo = veterano → tutorial concluído (não re-tutorializa).
    if (data.onboarding === undefined) {
      data.onboarding = {
        version: 1,
        step: 'done',
        startedAt: data.lastSavedAt ?? Date.now(),
        hintsSeen: {},
      };
    }
    return data;
  },
  11: (data) => {
    // Version 11: campos de meta-progressão de Legado e eventos sazonais.
    if (data.legacy === undefined) data.legacy = { level: 0, totalExp: 0, sealsEarned: [] };
    if (data.activeEvent === undefined) data.activeEvent = null;
    if (data.legacyUpgrades === undefined) data.legacyUpgrades = {};
    return data;
  },
  12: (data) => {
    // Version 12: campos de retenção SPEC 8. Push opt-out por default (ético).
    if (data.loginStreak === undefined) data.loginStreak = { count: 0, lastClaimedSeed: 0, lastSeenSeed: 0 };
    if (data.keys === undefined) data.keys = { bronze: 0, silver: 0, gold: 0 };
    if (data.cosmetics === undefined) data.cosmetics = { owned: [], equipped: {} };
    if (data.notificationPrefs === undefined) data.notificationPrefs = {
      optedIn: false,
      categories: { missionReady: false, bossReady: false, dailyReset: false, idle: false },
      quietHours: { start: 22, end: 9 },
    };
    return data;
  },
};

/** Exportado para testes: aplica migrações de versão em um save. */
export function migrateState(data: any): GameState {
  return applyMigrations(data);
}

function applyMigrations(data: any): GameState {
  let version = data._version || 1;
  while (version < CURRENT_VERSION) {
    version++;
    if (migrations[version]) {
      if (__DEV__) console.log(`Applying storage migration to version ${version}`);
      data = migrations[version](data);
    }
  }
  data._version = version;
  return data as GameState;
}

/**
 * Validação mínima de shape. Lança se o estado for estruturalmente inválido.
 * Compartilhada entre load() e o LOAD_STATE do reducer.
 */
export function validateShape(state: any): GameState {
  if (!state || typeof state !== 'object') throw new Error('estado não é objeto');
  if (typeof state.gold !== 'number') throw new Error('gold inválido');
  if (!Array.isArray(state.heroes)) throw new Error('heroes não é array');
  for (const h of state.heroes) {
    if (typeof h?.id !== 'string') throw new Error('hero.id inválido');
    if (typeof h.hpMax !== 'number') throw new Error('hero.hpMax inválido');
  }
  return state as GameState;
}

export const StorageService = {
  /** Salva o estado do jogo, mantendo backup do save válido anterior. */
  async save(state: GameState): Promise<void> {
    try {
      const saveData: SaveData = { ...state, _version: CURRENT_VERSION, lastSavedAt: Date.now() };
      const prev = await AsyncStorage.getItem(STORAGE_KEY);
      if (prev) await AsyncStorage.setItem(BACKUP_KEY, prev);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    } catch (error) {
      if (__DEV__) console.error('StorageService: Erro ao salvar estado:', error);
    }
  },

  /**
   * Carrega o estado. Retorna null APENAS quando não há save.
   * Save existente mas ilegível → tenta o backup; se também falhar, lança CorruptSaveError.
   */
  async load(): Promise<GameState | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    try {
      return validateShape(applyMigrations(JSON.parse(raw)));
    } catch (e) {
      const bak = await AsyncStorage.getItem(BACKUP_KEY);
      if (bak) {
        try {
          return validateShape(applyMigrations(JSON.parse(bak)));
        } catch {
          // backup também inválido — segue para lançar
        }
      }
      throw new CorruptSaveError(String(e));
    }
  },

  /** Limpa o estado do jogo salvo (mantém o backup intacto). */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      if (__DEV__) console.error('StorageService: Erro ao limpar estado:', error);
    }
  },
};

// Deprecated functions for backward compatibility with existing imports
export const saveGameState = StorageService.save;
export const loadGameState = StorageService.load;
export const clearGameState = StorageService.clear;
