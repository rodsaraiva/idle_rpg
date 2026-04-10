import {
  refreshDailyQuests,
  updateDailyProgress,
  claimDailyQuest,
} from '../../context/dailyQuestHandler';
import {
  getDailySeed,
  pickDailyQuests,
  DAILY_BONUS_REWARD,
} from '../../constants/dailyQuests';
import { initialGameState } from '../../context/gameReducer';
import { GameState } from '../../types';

describe('dailyQuestHandler', () => {
  describe('refreshDailyQuests', () => {
    test('creates new dailyQuests when state has none', () => {
      const next = refreshDailyQuests({ ...initialGameState });
      expect(next.dailyQuests).toBeDefined();
      expect(next.dailyQuests!.seed).toBe(getDailySeed());
      expect(next.dailyQuests!.quests).toHaveLength(3);
      expect(next.dailyQuests!.quests.every(q => q.claimed === false)).toBe(true);
      expect(next.dailyQuests!.progress).toEqual({});
      expect(next.dailyQuests!.allClaimed).toBe(false);
    });

    test('returns same state when seed matches', () => {
      const seed = getDailySeed();
      const state: GameState = {
        ...initialGameState,
        dailyQuests: {
          seed,
          quests: [{ id: 'dq_missions_3', claimed: false }],
          progress: { missionsCompleted: 1 },
          allClaimed: false,
        },
      };
      const next = refreshDailyQuests(state);
      expect(next).toBe(state);
    });

    test('resets dailyQuests when seed differs', () => {
      const state: GameState = {
        ...initialGameState,
        dailyQuests: {
          seed: 1, // old / invalid seed
          quests: [{ id: 'dq_missions_3', claimed: true }],
          progress: { missionsCompleted: 99 },
          allClaimed: true,
        },
      };
      const next = refreshDailyQuests(state);
      expect(next.dailyQuests!.seed).toBe(getDailySeed());
      expect(next.dailyQuests!.progress).toEqual({});
      expect(next.dailyQuests!.allClaimed).toBe(false);
      expect(next.dailyQuests!.quests.every(q => q.claimed === false)).toBe(true);
    });
  });

  describe('updateDailyProgress', () => {
    test('increments the tracker counter', () => {
      const base = refreshDailyQuests({ ...initialGameState });
      const next = updateDailyProgress(base, 'missionsCompleted', 2);
      expect(next.dailyQuests!.progress.missionsCompleted).toBe(2);

      const later = updateDailyProgress(next, 'missionsCompleted', 3);
      expect(later.dailyQuests!.progress.missionsCompleted).toBe(5);
    });

    test('is a no-op when state has no dailyQuests', () => {
      const state: GameState = { ...initialGameState, dailyQuests: undefined };
      const next = updateDailyProgress(state, 'missionsCompleted', 5);
      expect(next).toBe(state);
    });

    test('is a no-op when amount is zero or negative', () => {
      const base = refreshDailyQuests({ ...initialGameState });
      const sameZero = updateDailyProgress(base, 'missionsCompleted', 0);
      expect(sameZero).toBe(base);
      const sameNeg = updateDailyProgress(base, 'missionsCompleted', -3);
      expect(sameNeg).toBe(base);
    });
  });

  describe('claimDailyQuest', () => {
    const seed = getDailySeed();
    const todaysQuests = pickDailyQuests(seed);

    function makeStateWithProgress(progress: Record<string, number>, gold = 100): GameState {
      return {
        ...initialGameState,
        gold,
        dailyQuests: {
          seed,
          quests: todaysQuests.map(q => ({ id: q.id, claimed: false })),
          progress,
          allClaimed: false,
        },
      };
    }

    test('claims quest and awards gold when target is met', () => {
      const quest = todaysQuests[0];
      const state = makeStateWithProgress({ [quest.tracker]: quest.targetValue });
      const next = claimDailyQuest(state, quest.id);
      expect(next.gold).toBe(state.gold + quest.reward);
      const claimedEntry = next.dailyQuests!.quests.find(q => q.id === quest.id)!;
      expect(claimedEntry.claimed).toBe(true);
      expect(next.dailyQuests!.allClaimed).toBe(false);
    });

    test('returns state unchanged when target NOT met', () => {
      const quest = todaysQuests[0];
      const state = makeStateWithProgress({ [quest.tracker]: quest.targetValue - 1 });
      const next = claimDailyQuest(state, quest.id);
      expect(next).toBe(state);
    });

    test('returns state unchanged when progress for tracker is missing (falls back to 0)', () => {
      const quest = todaysQuests[0];
      // Empty progress object — exercises the `?? 0` fallback branch
      const state = makeStateWithProgress({});
      const next = claimDailyQuest(state, quest.id);
      expect(next).toBe(state);
    });

    test('returns state unchanged when target met but quest already claimed', () => {
      const quest = todaysQuests[0];
      const state: GameState = {
        ...initialGameState,
        dailyQuests: {
          seed,
          quests: todaysQuests.map(q => ({
            id: q.id,
            claimed: q.id === quest.id,
          })),
          progress: { [quest.tracker]: quest.targetValue },
          allClaimed: false,
        },
      };
      const next = claimDailyQuest(state, quest.id);
      expect(next).toBe(state);
    });

    test('returns state unchanged when questId is not in current daily quests', () => {
      const state = makeStateWithProgress({});
      const next = claimDailyQuest(state, 'dq_nonexistent_quest');
      expect(next).toBe(state);
    });

    test('returns state unchanged when quest is stored but def not found for seed', () => {
      // Quest id exists in stored quests, but is not returned by pickDailyQuests
      // for this seed -> exercises the `if (!def) return state;` branch.
      const rogueQuestId = 'dq_rogue_phantom';
      const state: GameState = {
        ...initialGameState,
        dailyQuests: {
          seed,
          quests: [{ id: rogueQuestId, claimed: false }],
          progress: {},
          allClaimed: false,
        },
      };
      const next = claimDailyQuest(state, rogueQuestId);
      expect(next).toBe(state);
    });

    test('returns state unchanged when dailyQuests is undefined', () => {
      const state: GameState = { ...initialGameState, dailyQuests: undefined };
      const next = claimDailyQuest(state, 'dq_missions_3');
      expect(next).toBe(state);
    });

    test('gives bonus when all 3 quests are claimed', () => {
      // Make progress meet all targets
      const progress: Record<string, number> = {};
      for (const q of todaysQuests) {
        progress[q.tracker] = q.targetValue;
      }
      let state = makeStateWithProgress(progress, 0);

      // Claim first two (no bonus yet)
      state = claimDailyQuest(state, todaysQuests[0].id);
      state = claimDailyQuest(state, todaysQuests[1].id);
      expect(state.dailyQuests!.allClaimed).toBe(false);

      const beforeFinalGold = state.gold;
      const finalQuest = todaysQuests[2];
      state = claimDailyQuest(state, finalQuest.id);

      expect(state.dailyQuests!.allClaimed).toBe(true);
      expect(state.gold).toBe(beforeFinalGold + finalQuest.reward + DAILY_BONUS_REWARD);
      expect(state.dailyQuests!.quests.every(q => q.claimed)).toBe(true);
    });
  });
});
