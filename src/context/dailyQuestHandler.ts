import { GameState } from '../types';
import { pickDailyQuests, getDailySeed, DAILY_BONUS_REWARD } from '../constants/dailyQuests';

export function refreshDailyQuests(state: GameState): GameState {
  const currentSeed = getDailySeed();
  if (state.dailyQuests?.seed === currentSeed) return state;

  const quests = pickDailyQuests(currentSeed);
  return {
    ...state,
    dailyQuests: {
      seed: currentSeed,
      quests: quests.map(q => ({ id: q.id, claimed: false })),
      progress: {},
      allClaimed: false,
    },
  };
}

export function updateDailyProgress(state: GameState, tracker: string, amount: number): GameState {
  if (!state.dailyQuests || amount <= 0) return state;
  const progress = { ...state.dailyQuests.progress };
  progress[tracker] = (progress[tracker] ?? 0) + amount;
  return {
    ...state,
    dailyQuests: { ...state.dailyQuests, progress },
  };
}

export function claimDailyQuest(state: GameState, questId: string): GameState {
  if (!state.dailyQuests) return state;
  const quest = state.dailyQuests.quests.find(q => q.id === questId);
  if (!quest || quest.claimed) return state;

  // Find quest def to get reward
  const quests = pickDailyQuests(state.dailyQuests.seed);
  const def = quests.find(q => q.id === questId);
  if (!def) return state;

  // Check if target met
  const current = state.dailyQuests.progress[def.tracker] ?? 0;
  if (current < def.targetValue) return state;

  const updatedQuests = state.dailyQuests.quests.map(q =>
    q.id === questId ? { ...q, claimed: true } : q
  );
  const allClaimed = updatedQuests.every(q => q.claimed);
  const bonusGold = allClaimed && !state.dailyQuests.allClaimed ? DAILY_BONUS_REWARD : 0;

  return {
    ...state,
    gold: state.gold + def.reward + bonusGold,
    dailyQuests: { ...state.dailyQuests, quests: updatedQuests, allClaimed },
  };
}
