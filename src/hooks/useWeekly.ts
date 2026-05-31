import { useContext, useMemo } from 'react';
import { GameContext } from '../context/GameContext';
import { pickWeeklyQuests, WeeklyQuestDef } from '../constants/weeklyQuests';
import { getWeeklyBoss, WeeklyBossTemplate } from '../constants/weeklyBosses';
import { GameState } from '../types';

export type WeeklyStateType = NonNullable<GameState['weeklyState']>;

export interface WeeklyQuestState {
  def: WeeklyQuestDef;
  current: number;
  completed: boolean;
  claimed: boolean;
}

export interface UseWeeklyResult {
  weeklyState: WeeklyStateType | null;
  questStates: WeeklyQuestState[];
  boss: WeeklyBossTemplate | null;
  allClaimed: boolean;
  bossDefeated: boolean;
  daysLeft: number;
  hoursLeft: number;
  minutesLeft: number;
  handleClaim: (questId: string) => void;
}

export function useWeekly(): UseWeeklyResult {
  const { state, dispatch } = useContext(GameContext);
  const weeklyState = state.weeklyState ?? null;

  const questDefs = useMemo(() => {
    if (!weeklyState) return [];
    return pickWeeklyQuests(weeklyState.seed);
  }, [weeklyState?.seed]);

  const questStates: WeeklyQuestState[] = useMemo(() => {
    if (!weeklyState) return [];
    return questDefs.map(def => {
      const entry = weeklyState.quests.find(q => q.id === def.id);
      const current = weeklyState.progress[def.tracker] ?? 0;
      const completed = current >= def.targetValue;
      const claimed = entry?.claimed ?? false;
      return { def, current, completed, claimed };
    });
  }, [weeklyState, questDefs]);

  const boss = useMemo((): WeeklyBossTemplate | null => {
    if (!weeklyState) return null;
    return getWeeklyBoss(weeklyState.seed);
  }, [weeklyState?.seed]);

  // Time until next Monday 00:00
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun ... 6=Sat
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday);
  const msUntilReset = nextMonday.getTime() - now.getTime();
  const daysLeft = Math.floor(msUntilReset / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((msUntilReset % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutesLeft = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));

  function handleClaim(questId: string) {
    dispatch({ type: 'CLAIM_WEEKLY_QUEST', questId });
  }

  return {
    weeklyState,
    questStates,
    boss,
    allClaimed: weeklyState?.allClaimed ?? false,
    bossDefeated: weeklyState?.bossDefeated ?? false,
    daysLeft,
    hoursLeft,
    minutesLeft,
    handleClaim,
  };
}
