import { handleTick } from '../../context/tickHandler';
import { initialGameState } from '../../context/gameReducer';
import { HeroTask, Hero } from '../../types';

function createHero(overrides: Partial<Hero> = {}): Hero {
  const hpVal = overrides.hpMax ?? 10;
  return {
    id: overrides.id || 'h1',
    name: overrides.name || 'Hero',
    hpMax: hpVal,
    hpCurrent: overrides.hpCurrent ?? hpVal,
    atk: overrides.atk ?? 5,
    mp: overrides.mp ?? 3,
    defense: overrides.defense ?? 5,
    crit: overrides.crit ?? 5,
    agility: overrides.agility ?? 10,
    currentTask: overrides.currentTask ?? HeroTask.IDLE,
    trainingProgressMs: overrides.trainingProgressMs ?? { hp: 0, atk: 0, mp: 0 },
    trainingCount: overrides.trainingCount ?? { hp: 0, atk: 0, mp: 0 },
  } as Hero;
}

describe('tickHandler', () => {
  test('handleTick should process training for heroes', () => {
    const hero = createHero({ currentTask: HeroTask.TRAIN_HP });
    const state = { ...initialGameState, heroes: [hero] };
    
    const next = handleTick(state, Date.now());
    
    expect(next.heroes[0].trainingProgressMs?.hp).toBeGreaterThan(0);
  });

  test('handleTick should handle regeneration for heroes', () => {
    const hero = createHero({ hpCurrent: 5, hpMax: 10, currentTask: HeroTask.IDLE });
    // tick for longer than regen interval
    const state = { ...initialGameState, heroes: [hero], tickIntervalMs: 20 * 60 * 1000 };

    const next = handleTick(state, Date.now());

    expect(next.heroes[0].hpCurrent).toBeGreaterThan(5);
  });
});

describe('gold bonus via pantheonBonuses', () => {
  test('handleTick aplica goldPercent do panteão sobre reward da missão', () => {
    // Configurar missão já concluída (finishAt no passado) com precomputedOutcome.reward = 100
    const now = Date.now();
    const missionId = 'test-mission';
    const hero = createHero({ id: 'h1', currentTask: HeroTask.MISSION });
    // Pre-unlocar todas as conquistas para evitar gold extra de achievements no tick
    const allAchievementIds = [
      'recruit_1', 'recruit_5', 'recruit_10',
      'gold_100', 'gold_1000',
      'mission_first', 'mission_10', 'mission_50',
      'forge_1', 'forge_5',
      'boss_slayer',
    ];
    const state = {
      ...initialGameState,
      gold: 0,
      heroes: [hero],
      unlockedAchievements: allAchievementIds,
      pantheonBonuses: { goldPercent: 10, atkPercent: 0, hpPercent: 0 },
      activeMissions: [
        {
          id: missionId,
          templateId: 'mission_1', // deve casar com um id real de MISSIONS
          heroIds: ['h1'],
          startedAt: now - 100000,
          finishAt: now - 1000,
          looping: false,
          scheduledActions: [],
          enemiesState: [],
          precomputedOutcome: {
            reward: 100,
            rounds: 5,
            actions: [],
            log: [],
            success: true,
            casualties: [],
            enemyCasualties: 2,
          },
        },
      ],
    } as any;

    const next = handleTick(state, now);
    // 100 * 1.10 = 110
    expect(next.gold).toBe(110);
  });
});
