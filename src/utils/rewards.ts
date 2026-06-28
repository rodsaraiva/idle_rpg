// rewards.ts — helpers de recompensa de missão
import { GameState } from '../types';
import { applyGoldBonus } from './heroUtils';
import { legacyRewardMultiplier } from '../constants/legacyUpgrades';
import { activeEventRewardMultiplier } from '../context/eventHandler';

/**
 * Calcula o gold final de uma recompensa aplicando os multiplicadores em ordem:
 * pantheon (applyGoldBonus) → Legado → Evento ativo → Math.floor
 */
export function computeFinalGold(reward: number, state: GameState): number {
  return Math.floor(
    applyGoldBonus(reward, state) *
    legacyRewardMultiplier(state) *
    activeEventRewardMultiplier(state)
  );
}
