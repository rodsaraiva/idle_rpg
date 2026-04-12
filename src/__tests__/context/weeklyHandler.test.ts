import { refreshWeeklyState, updateWeeklyProgress, claimWeeklyQuest } from '../../context/weeklyHandler';
import { GameState } from '../../types';

const baseState: GameState = {
  gold: 100,
  heroes: [],
  heroesRecruited: 0,
  lastSavedAt: Date.now(),
};

describe('weeklyHandler', () => {
  test('refreshWeeklyState initializes weekly state', () => {
    const state = refreshWeeklyState(baseState);
    expect(state.weeklyState).toBeDefined();
    expect(state.weeklyState!.quests).toHaveLength(3);
    expect(state.weeklyState!.bossDefeated).toBe(false);
  });

  test('refreshWeeklyState is idempotent within same week', () => {
    const state1 = refreshWeeklyState(baseState);
    const state2 = refreshWeeklyState(state1);
    expect(state2).toBe(state1);
  });

  test('updateWeeklyProgress increments tracker', () => {
    let state = refreshWeeklyState(baseState);
    state = updateWeeklyProgress(state, 'missionsCompleted', 5);
    expect(state.weeklyState!.progress['missionsCompleted']).toBe(5);
    state = updateWeeklyProgress(state, 'missionsCompleted', 3);
    expect(state.weeklyState!.progress['missionsCompleted']).toBe(8);
  });

  test('claimWeeklyQuest awards gold when target met', () => {
    let state = refreshWeeklyState(baseState);
    const questId = state.weeklyState!.quests[0].id;

    const { WEEKLY_QUEST_POOL } = require('../../constants/weeklyQuests');
    const def = WEEKLY_QUEST_POOL.find((q: any) => q.id === questId);

    state = updateWeeklyProgress(state, def.tracker, def.targetValue);
    const goldBefore = state.gold;
    state = claimWeeklyQuest(state, questId);

    expect(state.gold).toBe(goldBefore + def.reward);
    expect(state.weeklyState!.quests.find(q => q.id === questId)!.claimed).toBe(true);
  });

  test('claimWeeklyQuest rejects if target not met', () => {
    let state = refreshWeeklyState(baseState);
    const questId = state.weeklyState!.quests[0].id;
    state = claimWeeklyQuest(state, questId);
    expect(state.weeklyState!.quests.find(q => q.id === questId)!.claimed).toBe(false);
  });

  test('bonus reward when all 3 quests claimed', () => {
    let state = refreshWeeklyState(baseState);
    const { WEEKLY_QUEST_POOL } = require('../../constants/weeklyQuests');

    for (const quest of state.weeklyState!.quests) {
      const def = WEEKLY_QUEST_POOL.find((q: any) => q.id === quest.id);
      state = updateWeeklyProgress(state, def.tracker, def.targetValue);
      state = claimWeeklyQuest(state, quest.id);
    }

    expect(state.weeklyState!.allClaimed).toBe(true);
  });
});
