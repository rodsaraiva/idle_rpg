import { gameReducer, initialGameState } from '../../context/gameReducer';
import { HeroTask } from '../../types';
import { createHero } from '../../utils/heroFactory';
import { MISSIONS } from '../../constants/missions';

describe('gameReducer mission integration', () => {
  test('start mission and process ticks leads to mission result', () => {
    // arrange initial state with one strong hero
    const hero = createHero('WARRIOR');
    const state = {
      ...initialGameState,
      heroes: [{ ...hero, hp: 30, atk: 12, currentTask: HeroTask.IDLE }],
      heroesRecruited: 1,
      activeMissions: [],
    };
    const missionTemplate = MISSIONS.find((m) => m.id === 'mission_1')!;

    // start mission
    const afterStart = gameReducer(state as any, { type: 'START_MISSION', templateId: missionTemplate.id, heroIds: [hero.id] });
    expect(afterStart.activeMissions && afterStart.activeMissions.length).toBeGreaterThanOrEqual(1);

    // run ticks until missions complete (safety cap)
    let s = afterStart;
    let steps = 0;
    while ((s.activeMissions?.length ?? 0) > 0 && steps < 50) {
      s = gameReducer(s as any, { type: 'TICK' });
      steps++;
    }

    expect((s.recentMissionResults ?? []).length).toBeGreaterThanOrEqual(1);
    const res = s.recentMissionResults![0];
    expect(typeof res.success).toBe('boolean');
    expect(typeof res.reward).toBe('number');
  });
});

