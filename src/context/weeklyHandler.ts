import { GameState } from '../types';
import { getWeeklySeed, pickWeeklyQuests, WEEKLY_QUEST_POOL, WEEKLY_BONUS_REWARD } from '../constants/weeklyQuests';
import { emitWeeklyQuestComplete, emitWeeklyBossDefeated } from '../services/milestones';

export function refreshWeeklyState(state: GameState): GameState {
  const currentSeed = getWeeklySeed();
  if (state.weeklyState?.seed === currentSeed) return state;

  const quests = pickWeeklyQuests(currentSeed);
  return {
    ...state,
    weeklyState: {
      seed: currentSeed,
      quests: quests.map(q => ({ id: q.id, claimed: false })),
      progress: {},
      allClaimed: false,
      bossDefeated: false,
    },
  };
}

export function updateWeeklyProgress(state: GameState, tracker: string, amount: number): GameState {
  if (!state.weeklyState || amount <= 0) return state;

  const progress = { ...state.weeklyState.progress };
  progress[tracker] = (progress[tracker] ?? 0) + amount;

  return {
    ...state,
    weeklyState: { ...state.weeklyState, progress },
  };
}

export function claimWeeklyQuest(state: GameState, questId: string): GameState {
  if (!state.weeklyState) return state;

  const questIdx = state.weeklyState.quests.findIndex(q => q.id === questId);
  if (questIdx < 0) return state;

  const quest = state.weeklyState.quests[questIdx];
  if (quest.claimed) return state;

  const def = WEEKLY_QUEST_POOL.find(q => q.id === questId);
  if (!def) return state;

  const current = state.weeklyState.progress[def.tracker] ?? 0;
  if (current < def.targetValue) return state;

  const quests = [...state.weeklyState.quests];
  quests[questIdx] = { ...quest, claimed: true };
  emitWeeklyQuestComplete();

  let bonusGold = def.reward;

  const allClaimed = quests.every(q => q.claimed);
  if (allClaimed && !state.weeklyState.allClaimed) {
    bonusGold += WEEKLY_BONUS_REWARD;
  }

  return {
    ...state,
    gold: state.gold + bonusGold,
    weeklyState: {
      ...state.weeklyState,
      quests,
      allClaimed,
    },
  };
}

export function markWeeklyBossDefeated(state: GameState): GameState {
  if (!state.weeklyState) return state;
  emitWeeklyBossDefeated();
  return {
    ...state,
    weeklyState: { ...state.weeklyState, bossDefeated: true },
  };
}
