import { calculatePantheonBonuses, createFusedHero, handleFuseHeroes } from '../../context/pantheonHandler';
import { Hero, HeroTask, GameState } from '../../types';
import { refreshWeeklyState } from '../../context/weeklyHandler';

function makeHero(overrides: Partial<Hero>): Hero {
  return {
    id: 'h1', name: 'Test', hpMax: 50, hpCurrent: 50,
    atk: 10, mp: 5, defense: 5, crit: 10, agility: 5,
    currentTask: HeroTask.IDLE,
    classId: 'WARRIOR',
    personality: 'AGGRESSIVE',
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
    stars: 0,
    ...overrides,
  } as Hero;
}

describe('pantheonHandler', () => {
  describe('calculatePantheonBonuses', () => {
    test('no starred heroes = no bonuses', () => {
      const bonuses = calculatePantheonBonuses([makeHero({})]);
      expect(bonuses).toEqual({ goldPercent: 0, atkPercent: 0, hpPercent: 0 });
    });

    test('1 starred hero = +3% gold', () => {
      const bonuses = calculatePantheonBonuses([makeHero({ stars: 1 })]);
      expect(bonuses.goldPercent).toBe(3);
    });

    test('3 starred heroes = +8% gold', () => {
      const heroes = [
        makeHero({ id: 'a', stars: 1 }),
        makeHero({ id: 'b', stars: 1 }),
        makeHero({ id: 'c', stars: 1 }),
      ];
      expect(calculatePantheonBonuses(heroes).goldPercent).toBe(8);
    });

    test('1 hero with 3 stars = +3% ATK', () => {
      const bonuses = calculatePantheonBonuses([makeHero({ stars: 3 })]);
      expect(bonuses.atkPercent).toBe(3);
    });

    test('5 starred heroes = +5% HP', () => {
      const heroes = Array.from({ length: 5 }, (_, i) => makeHero({ id: `h${i}`, stars: 1 }));
      expect(calculatePantheonBonuses(heroes).hpPercent).toBe(5);
    });
  });

  describe('createFusedHero', () => {
    test('creates hero with stars = max(sources) + 1', () => {
      const sources: [Hero, Hero, Hero] = [
        makeHero({ id: 'a', stars: 0 }),
        makeHero({ id: 'b', stars: 2 }),
        makeHero({ id: 'c', stars: 1 }),
      ];
      const fused = createFusedHero(sources);
      expect(fused.stars).toBe(3);
    });

    test('fusion bonus is 10% of total training', () => {
      const sources: [Hero, Hero, Hero] = [
        makeHero({ id: 'a', trainingCount: { hp: 30, atk: 20, mp: 10 } }),
        makeHero({ id: 'b', trainingCount: { hp: 20, atk: 30, mp: 20 } }),
        makeHero({ id: 'c', trainingCount: { hp: 50, atk: 50, mp: 70 } }),
      ];
      const fused = createFusedHero(sources);
      expect(fused.fusionBonus).toEqual({ hp: 10, atk: 10, mp: 10 });
    });

    test('training counts are zeroed', () => {
      const sources: [Hero, Hero, Hero] = [
        makeHero({ id: 'a', trainingCount: { hp: 100, atk: 100, mp: 100 } }),
        makeHero({ id: 'b' }),
        makeHero({ id: 'c' }),
      ];
      const fused = createFusedHero(sources);
      expect(fused.trainingCount).toEqual({ hp: 0, atk: 0, mp: 0 });
    });

    test('class is one of the source classes', () => {
      const sources: [Hero, Hero, Hero] = [
        makeHero({ id: 'a', classId: 'MAGE' }),
        makeHero({ id: 'b', classId: 'ARCHER' }),
        makeHero({ id: 'c', classId: 'HEALER' }),
      ];
      const fused = createFusedHero(sources);
      expect(['MAGE', 'ARCHER', 'HEALER']).toContain(fused.classId);
    });
  });

  describe('handleFuseHeroes', () => {
    test('removes 3 heroes and adds 1 fused hero', () => {
      const state: GameState = {
        gold: 100, heroes: [
          makeHero({ id: 'a' }),
          makeHero({ id: 'b' }),
          makeHero({ id: 'c' }),
          makeHero({ id: 'd' }),
        ],
        heroesRecruited: 4, lastSavedAt: Date.now(),
      };
      const newState = handleFuseHeroes(state, ['a', 'b', 'c']);
      expect(newState.heroes).toHaveLength(2);
      expect(newState.pantheonFusions).toBe(1);
    });

    test('rejects if hero not IDLE', () => {
      const state: GameState = {
        gold: 100, heroes: [
          makeHero({ id: 'a', currentTask: HeroTask.MISSION }),
          makeHero({ id: 'b' }),
          makeHero({ id: 'c' }),
        ],
        heroesRecruited: 3, lastSavedAt: Date.now(),
      };
      const newState = handleFuseHeroes(state, ['a', 'b', 'c']);
      expect(newState.heroes).toHaveLength(3);
    });

    test('pantheonBonuses updated after fusion', () => {
      const state: GameState = {
        gold: 100, heroes: [
          makeHero({ id: 'a' }),
          makeHero({ id: 'b' }),
          makeHero({ id: 'c' }),
        ],
        heroesRecruited: 3, lastSavedAt: Date.now(),
      };
      const newState = handleFuseHeroes(state, ['a', 'b', 'c']);
      expect(newState.pantheonBonuses?.goldPercent).toBe(3);
    });

    test('handleFuseHeroes incrementa fusionsCompleted no weeklyState', () => {
      const baseStateWithWeekly = refreshWeeklyState({
        gold: 100,
        heroes: [
          makeHero({ id: 'a' }),
          makeHero({ id: 'b' }),
          makeHero({ id: 'c' }),
        ],
        heroesRecruited: 3,
        lastSavedAt: Date.now(),
      });
      const newState = handleFuseHeroes(baseStateWithWeekly, ['a', 'b', 'c'] as [string, string, string]);
      expect(newState.weeklyState?.progress['fusionsCompleted']).toBe(1);
    });
  });
});
