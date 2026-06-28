import { GameState } from '../types';
import { LEGACY_SEALS, legacyExpThreshold } from '../constants/legacy';
import { availableLegacyPoints, LEGACY_UPGRADES } from '../constants/legacyUpgrades';

/**
 * Verifica os Selos de Legado e promove o nível quando o limiar de exp é cruzado.
 * Invariante: nunca altera state.gold (Selos são meta-moeda própria, não gold).
 */
export function checkLegacySeals(state: GameState): GameState {
  const legacy = state.legacy ?? { level: 0, totalExp: 0, sealsEarned: [] };
  const earned = legacy.sealsEarned ?? []; // defensivo: estados legados sem sealsEarned
  const newSeals: string[] = [];
  let addedExp = 0;

  for (const seal of LEGACY_SEALS) {
    if (earned.includes(seal.id)) continue;
    if (seal.condition(state)) {
      newSeals.push(seal.id);
      addedExp += seal.exp;
    }
  }

  if (newSeals.length === 0) return state;

  let { level } = legacy;
  let totalExp = legacy.totalExp + addedExp;

  // Promove nível enquanto exp cruzar o limiar
  while (totalExp >= legacyExpThreshold(level)) {
    totalExp -= legacyExpThreshold(level);
    level++;
  }

  return {
    ...state,
    legacy: {
      level,
      totalExp,
      sealsEarned: [...earned, ...newSeals],
    },
    // gold intencionalmente preservado — Selos não creditam gold
  };
}

/**
 * Compra um upgrade da árvore de Legado, gastando 1 ponto disponível.
 * Guarda: nunca altera state.gold (upgrade é meta-progressão, não economia direta).
 */
export function buyLegacyUpgrade(state: GameState, upgradeId: string): GameState {
  if (availableLegacyPoints(state) <= 0) return state;

  const upg = LEGACY_UPGRADES.find(u => u.id === upgradeId);
  if (!upg) return state;

  const currentRank = (state.legacyUpgrades ?? {})[upgradeId] ?? 0;
  if (currentRank >= upg.maxRank) return state;

  return {
    ...state,
    legacyUpgrades: {
      ...(state.legacyUpgrades ?? {}),
      [upgradeId]: currentRank + 1,
    },
    // gold intencionalmente preservado — compra de upgrade não credita nem debita gold
  };
}
