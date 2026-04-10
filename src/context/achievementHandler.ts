import { GameState } from '../types';
import { ACHIEVEMENTS } from '../constants/achievements';

export function checkAchievements(state: GameState): GameState {
  const unlocked = state.unlockedAchievements ?? [];
  const newUnlocks: string[] = [];
  let goldReward = 0;
  let atkBonus = 0;
  let hpBonus = 0;

  for (const achievement of ACHIEVEMENTS) {
    if (unlocked.includes(achievement.id)) continue;
    if (achievement.condition(state)) {
      newUnlocks.push(achievement.id);
      goldReward += achievement.reward.gold ?? 0;
      atkBonus += achievement.reward.permanentAtkBonus ?? 0;
      hpBonus += achievement.reward.permanentHpBonus ?? 0;
    }
  }

  if (newUnlocks.length === 0) return state;

  const currentBonuses = state.permanentBonuses ?? { atk: 0, hp: 0 };
  return {
    ...state,
    unlockedAchievements: [...unlocked, ...newUnlocks],
    gold: state.gold + goldReward,
    permanentBonuses: {
      atk: currentBonuses.atk + atkBonus,
      hp: currentBonuses.hp + hpBonus,
    },
  };
}
