import { GameState } from '../types';

export interface LegacyUpgrade {
  id: string;
  name: string;
  maxRank: number;
  effect: 'missionRewardPct' | 'missionDurationPct' | 'trainSpeedPct' | 'missionSlot';
  perRank: number;
}

export const LEGACY_UPGRADES: LegacyUpgrade[] = [
  { id: 'reward_1', name: 'Recompensa Ampliada', maxRank: 5, effect: 'missionRewardPct', perRank: 5 },
  { id: 'haste_1',  name: 'Ritmo Acelerado',     maxRank: 3, effect: 'missionDurationPct', perRank: 10 },
  { id: 'train_1',  name: 'Ritmo de Treino',     maxRank: 3, effect: 'trainSpeedPct',      perRank: 10 },
  { id: 'slot_1',   name: 'Missão Extra',         maxRank: 2, effect: 'missionSlot',        perRank: 1 },
];

/** Soma dos ranks comprados por tipo de efeito (helper interno). */
function sumEffect(state: GameState, effect: LegacyUpgrade['effect']): number {
  const upgrades = state.legacyUpgrades ?? {};
  let total = 0;
  for (const upg of LEGACY_UPGRADES) {
    if (upg.effect !== effect) continue;
    total += (upgrades[upg.id] ?? 0) * upg.perRank;
  }
  return total;
}

/**
 * Multiplicador aplicado à recompensa de missão concluída.
 * Nunca aplicado sobre saldo ocioso — apenas sobre atividade do jogador.
 */
export function legacyRewardMultiplier(state: GameState): number {
  return 1 + sumEffect(state, 'missionRewardPct') / 100;
}

/**
 * Fator de redução de duração de missão (piso de 0.5 para não tornar instantânea).
 */
export function legacyDurationMultiplier(state: GameState): number {
  return Math.max(0.5, 1 - sumEffect(state, 'missionDurationPct') / 100);
}

/**
 * Fator multiplicador de velocidade de treino (≥1).
 * Usado em processTraining (tickHandler) para dividir timePerPoint efetivo.
 */
export function legacyTrainSpeedFactor(state: GameState): number {
  return 1 + sumEffect(state, 'trainSpeedPct') / 100;
}

/**
 * Número de slots de missão extra concedidos pelo Legado.
 * Some ao BASE_MISSION_SLOTS (game.ts) para definir o limite de missões ativas.
 */
export function legacyMissionSlotBonus(state: GameState): number {
  return sumEffect(state, 'missionSlot');
}

/** Pontos de Legado disponíveis para gastar (nível − Σ ranks já comprados). */
export function availableLegacyPoints(state: GameState): number {
  const level = state.legacy?.level ?? 0;
  const spent = Object.values(state.legacyUpgrades ?? {}).reduce((acc, r) => acc + r, 0);
  return Math.max(0, level - spent);
}

/** Retorna true se o upgrade pode ser comprado agora (ponto disponível + rank < maxRank). */
export function canBuy(state: GameState, upgradeId: string): boolean {
  if (availableLegacyPoints(state) <= 0) return false;
  const upg = LEGACY_UPGRADES.find(u => u.id === upgradeId);
  if (!upg) return false;
  const current = (state.legacyUpgrades ?? {})[upgradeId] ?? 0;
  return current < upg.maxRank;
}
