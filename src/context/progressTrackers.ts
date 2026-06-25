import { GameState } from '../types';
import { updateDailyProgress } from './dailyQuestHandler';
import { updateWeeklyProgress } from './weeklyHandler';

export interface TickProgressDelta {
  missionsCompleted: number;
  pointsTrained: number;
  goldEarned: number;
}

/**
 * Aplica os 3 trackers de tick a daily e weekly num único pass. Equivalente às
 * 6 chamadas sequenciais que ficavam em handleTick: preserva a ordem (daily
 * antes de weekly; missionsCompleted→pointsTrained→goldEarned). updateDaily/
 * updateWeeklyProgress já são no-op para amount<=0, então passar deltas zerados
 * direto produz o mesmo GameState que os antigos `if (n > 0)` externos.
 */
export function applyTickProgress(state: GameState, delta: TickProgressDelta): GameState {
  let s = updateDailyProgress(state, 'missionsCompleted', delta.missionsCompleted);
  s = updateDailyProgress(s, 'pointsTrained', delta.pointsTrained);
  s = updateDailyProgress(s, 'goldEarned', delta.goldEarned);
  s = updateWeeklyProgress(s, 'missionsCompleted', delta.missionsCompleted);
  s = updateWeeklyProgress(s, 'pointsTrained', delta.pointsTrained);
  s = updateWeeklyProgress(s, 'goldEarned', delta.goldEarned);
  return s;
}
