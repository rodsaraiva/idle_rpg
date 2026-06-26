import { GameState } from '../types';
import { LEGACY_SEALS, legacyExpThreshold } from '../constants/legacy';

/**
 * Verifica os Selos de Legado e promove o nível quando o limiar de exp é cruzado.
 * Invariante: nunca altera state.gold (Selos são meta-moeda própria, não gold).
 */
export function checkLegacySeals(state: GameState): GameState {
  const legacy = state.legacy ?? { level: 0, totalExp: 0, sealsEarned: [] };
  const earned = legacy.sealsEarned;
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
