import { applyTickProgress } from '../../context/progressTrackers';
import { updateDailyProgress } from '../../context/dailyQuestHandler';
import { updateWeeklyProgress } from '../../context/weeklyHandler';

function makeState(): any {
  return {
    gold: 0,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: 0,
    inventory: [],
    dailyQuests: { seed: 1, quests: [], progress: {}, allClaimed: false },
    weeklyState: { seed: 1, quests: [], progress: {}, allClaimed: false, bossDefeated: false },
  };
}

function manualCascade(state: any, m: number, p: number, g: number): any {
  let s = updateDailyProgress(state, 'missionsCompleted', m);
  s = updateDailyProgress(s, 'pointsTrained', p);
  s = updateDailyProgress(s, 'goldEarned', g);
  s = updateWeeklyProgress(s, 'missionsCompleted', m);
  s = updateWeeklyProgress(s, 'pointsTrained', p);
  s = updateWeeklyProgress(s, 'goldEarned', g);
  return s;
}

describe('applyTickProgress', () => {
  test('produz o mesmo GameState que as 6 chamadas manuais (todos os deltas > 0)', () => {
    const state = makeState();
    const out = applyTickProgress(state, { missionsCompleted: 2, pointsTrained: 7, goldEarned: 100 });
    const expected = manualCascade(makeState(), 2, 7, 100);
    expect(out).toEqual(expected);
  });

  test('delta=0 em um tracker mantém no-op (guard amount<=0)', () => {
    const state = makeState();
    const out = applyTickProgress(state, { missionsCompleted: 0, pointsTrained: 5, goldEarned: 0 });
    const expected = manualCascade(makeState(), 0, 5, 0);
    expect(out).toEqual(expected);
    expect((out as any).dailyQuests.progress.missionsCompleted).toBeUndefined();
    expect((out as any).dailyQuests.progress.pointsTrained).toBe(5);
    expect((out as any).weeklyState.progress.goldEarned).toBeUndefined();
  });

  test('todos os deltas 0 retorna estado equivalente ao inicial', () => {
    const state = makeState();
    const out = applyTickProgress(state, { missionsCompleted: 0, pointsTrained: 0, goldEarned: 0 });
    expect(out).toEqual(makeState());
  });
});
