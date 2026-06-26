import { GameState } from '../types';
import { getDailySeed } from '../constants/dailyQuests';
import { rewardForStreakDay } from '../constants/loginRewards';

/** Seed YYYYMMDD de ontem, usando a mesma lógica de getDailySeed(). */
function getYesterdaySeed(): number {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/**
 * Idempotente por dia: registra o dia como "visto" e avança/reseta o streak.
 * Não credita gold em nenhuma circunstância.
 */
export function refreshLoginStreak(state: GameState): GameState {
  const todaySeed = getDailySeed();
  const streak = state.loginStreak ?? { count: 0, lastClaimedSeed: 0, lastSeenSeed: 0 };

  // No-op se o dia já foi registrado
  if (streak.lastSeenSeed === todaySeed) return state;

  const yesterdaySeed = getYesterdaySeed();
  const newCount =
    streak.lastSeenSeed === yesterdaySeed
      ? streak.count + 1 // dia consecutivo
      : 1;               // primeiro login ou dia pulado → resetar

  return {
    ...state,
    loginStreak: {
      ...streak,
      count: newCount,
      lastSeenSeed: todaySeed,
    },
  };
}

/**
 * Concede a recompensa do dia ao slot correto (materials / keys / cosmetics).
 * NUNCA altera state.gold (invariante sem gold passivo).
 * No-op se já reclamado hoje ou se lastSeenSeed != hoje.
 */
export function claimLoginReward(state: GameState): GameState {
  const todaySeed = getDailySeed();
  const streak = state.loginStreak;

  if (!streak || streak.lastSeenSeed !== todaySeed || streak.lastClaimedSeed === todaySeed) {
    return state;
  }

  const reward = rewardForStreakDay(streak.count);
  let next: GameState = { ...state, loginStreak: { ...streak, lastClaimedSeed: todaySeed } };

  if (reward.kind === 'material') {
    const materials = { ...(next.materials ?? {}) };
    materials[reward.id] = (materials[reward.id] ?? 0) + reward.qty;
    next = { ...next, materials };
  } else if (reward.kind === 'key') {
    const keys = { ...(next.keys ?? { bronze: 0, silver: 0, gold: 0 }) };
    keys[reward.tier] = (keys[reward.tier] ?? 0) + reward.qty;
    next = { ...next, keys };
  } else if (reward.kind === 'cosmetic') {
    const cosmetics = next.cosmetics ?? { owned: [], equipped: {} };
    if (!cosmetics.owned.includes(reward.id)) {
      next = {
        ...next,
        cosmetics: { ...cosmetics, owned: [...cosmetics.owned, reward.id] },
      };
    }
  }

  return next;
}
