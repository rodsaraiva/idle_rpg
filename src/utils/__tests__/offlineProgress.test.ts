import { calculateOfflineProgress } from '../offlineProgress';
import { GameState, HeroTask, Hero } from '../../types';
import { BASE_TRAIN_TIME_MS, TICK_INTERVAL_MS, MAX_OFFLINE_MS } from '../../constants/game';

describe('OfflineProgress - Catch-up Logic', () => {
  const createBaseState = (): GameState => ({
    gold: 100,
    heroes: [],
    heroesRecruited: 1,
    lastSavedAt: Date.now() - 12 * 60 * 60 * 1000, // 12 hours ago
    activeMissions: [],
  });

  const createHero = (id: string, task: HeroTask): Hero => ({
    id,
    name: `Hero ${id}`,
    hpMax: 20,
    hpCurrent: 20,
    atk: 10,
    mp: 5,
    defense: 5,
    crit: 5,
    agility: 10,
    currentTask: task,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    trainingCount: { hp: 0, atk: 0, mp: 0 },
  });

  test('should process multiple training points over 12 hours', () => {
    const state = createBaseState();
    const hero = createHero('h1', HeroTask.TRAIN_ATK);
    state.heroes = [hero];

    const result = calculateOfflineProgress(state);
    
    expect(result).not.toBeNull();
    if (result) {
      const updatedHero = result.newState.heroes[0];
      // 12 hours = 43,200,000 ms
      // Base train time = 10,000 ms
      // Even with inflation, should have gained many points
      expect(updatedHero.atk).toBeGreaterThan(10);
      expect(result.perHeroChanges.length).toBe(1);
      expect(result.perHeroChanges[0].atkAfter).toBeGreaterThan(10);
    }
  });

  test('should complete mission if enough time passed', () => {
    const state = createBaseState();
    const hero = createHero('h1', HeroTask.MISSION);
    state.heroes = [hero];
    state.activeMissions = [
      {
        id: 'm1',
        templateId: 'mission_1',
        heroIds: ['h1'],
        startedAt: Date.now() - 13 * 60 * 60 * 1000, // Started 13h ago
        remainingMs: 1 * 60 * 60 * 1000, // Had 1h left
      } as any
    ];

    const result = calculateOfflineProgress(state);
    
    expect(result).not.toBeNull();
    if (result) {
      expect(result.newState.activeMissions.length).toBe(0);
      expect(result.newState.gold).toBeGreaterThan(100);
      expect(result.newState.heroes[0].currentTask).toBe(HeroTask.IDLE);
    }
  });

  test('should cap offline progress at 72 hours', () => {
    const state = createBaseState();
    // Simulate 10 days ago
    state.lastSavedAt = Date.now() - 10 * 24 * 60 * 60 * 1000;
    
    const result = calculateOfflineProgress(state);
    
    expect(result).not.toBeNull();
    if (result) {
      // 72 hours / 0.5s (TICK_INTERVAL_MS)
      const expectedTicks = MAX_OFFLINE_MS / (state.tickIntervalMs ?? TICK_INTERVAL_MS);
      expect(result.ticks).toBe(Math.floor(expectedTicks));
      expect(result.cappedHours).toBe(72);
    }
  });
});
