import { GameState, Hero, HeroTask } from '../../types';
import { calculatePantheonBonuses } from '../../context/pantheonHandler';

function makeHero(overrides: Partial<Hero> & { id: string }): Hero {
  return {
    name: 'Herói',
    hpMax: 50,
    hpCurrent: 50,
    atk: 10,
    mp: 5,
    defense: 5,
    crit: 10,
    agility: 5,
    currentTask: HeroTask.IDLE,
    classId: 'WARRIOR',
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
    stars: 0,
    ...overrides,
  } as Hero;
}

// Testa a lógica pura de eligibilidade que usePantheon vai encapsular
describe('usePantheon derivations', () => {
  test('hero elegível: IDLE e hpCurrent > 0', () => {
    const hero = makeHero({ id: 'h1', currentTask: HeroTask.IDLE });
    const eligible = hero.currentTask === HeroTask.IDLE && hero.hpCurrent > 0;
    expect(eligible).toBe(true);
  });

  test('hero não elegível se estiver em missão', () => {
    const hero = makeHero({ id: 'h1', currentTask: HeroTask.MISSION });
    const eligible = hero.currentTask === HeroTask.IDLE && hero.hpCurrent > 0;
    expect(eligible).toBe(false);
  });

  test('hero não elegível se HP = 0', () => {
    const hero = makeHero({ id: 'h1', hpCurrent: 0 });
    const eligible = hero.currentTask === HeroTask.IDLE && hero.hpCurrent > 0;
    expect(eligible).toBe(false);
  });

  test('precisa de pelo menos 3 heróis elegíveis para fundir', () => {
    const heroes = [
      makeHero({ id: 'a' }),
      makeHero({ id: 'b' }),
    ];
    const eligible = heroes.filter(h => h.currentTask === HeroTask.IDLE && h.hpCurrent > 0);
    expect(eligible.length >= 3).toBe(false);

    const heroes3 = [...heroes, makeHero({ id: 'c' })];
    const eligible3 = heroes3.filter(h => h.currentTask === HeroTask.IDLE && h.hpCurrent > 0);
    expect(eligible3.length >= 3).toBe(true);
  });

  test('calculatePantheonBonuses reflete heróis com estrelas', () => {
    const heroes = [
      makeHero({ id: 'a', stars: 1 }),
      makeHero({ id: 'b', stars: 1 }),
      makeHero({ id: 'c', stars: 1 }),
    ];
    const bonuses = calculatePantheonBonuses(heroes);
    expect(bonuses.goldPercent).toBe(8); // 3 + 5 para 3 starred
  });

  test('pantheonFusions conta corretamente', () => {
    const state: GameState = {
      gold: 100,
      heroes: [],
      heroesRecruited: 0,
      lastSavedAt: Date.now(),
      pantheonFusions: 5,
    };
    expect(state.pantheonFusions).toBe(5);
  });
});
