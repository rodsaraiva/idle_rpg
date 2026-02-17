import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameState } from '../types';

const STORAGE_KEY = '@idle_rpg_game_state';

/** Salva o estado do jogo no armazenamento local */
export async function saveGameState(state: GameState): Promise<void> {
  try {
    const data = JSON.stringify({ ...state, lastSavedAt: Date.now() });
    await AsyncStorage.setItem(STORAGE_KEY, data);
  } catch (error) {
    console.error('Erro ao salvar estado do jogo:', error);
  }
}

/** Carrega o estado do jogo do armazenamento local */
export async function loadGameState(): Promise<GameState | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as GameState;
  } catch (error) {
    console.error('Erro ao carregar estado do jogo:', error);
    return null;
  }
}

/** Limpa o estado do jogo salvo (útil para debug/reset) */
export async function clearGameState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Erro ao limpar estado do jogo:', error);
  }
}
