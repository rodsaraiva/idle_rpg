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
    // `now` fixo: handleTick chama refreshActiveEvent, que injeta o evento sazonal do mês corrente.
    // Junho/2026 (seed 202606) → event_forge_festival, que só tem forgeHastePct — assim o evento
    // não multiplica a recompensa e o assert isola o bônus do panteão.
    const now = new Date(2026, 5, 15).getTime();
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

describe('invariante de referência do tick (base para otimização getUnlockedSkills)', () => {
  function makeIdleHeroAtFullHp(id: string) {
    return {
      id,
      name: `Hero ${id}`,
      hpMax: 30,
      hpCurrent: 30, // cheio: processRegeneration não toca (clona só se hpCurrent < hpMax)
      atk: 10,
      mp: 5,
      defense: 5,
      crit: 10,
      agility: 5,
      currentTask: HeroTask.IDLE,
      trainingCount: { hp: 0, atk: 0, mp: 0 },
      trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
      equippedItems: [],
    } as any;
  }

  test('herói IDLE em HP cheio atravessa o tick pela MESMA referência (não treinou nem regenerou)', () => {
    const hero = makeIdleHeroAtFullHp('h1');
    const state = {
      gold: 0,
      heroes: [hero],
      heroesRecruited: 1,
      lastSavedAt: 0,
      inventory: [],
      activeMissions: [],
    } as any;

    const next = handleTick(state, Date.now());
    expect(next.heroes[0]).toBe(hero); // referência idêntica
  });

  test('herói em TRAIN_ATK com progresso suficiente recebe NOVA referência e ganha atk', () => {
    const hero = makeIdleHeroAtFullHp('h2');
    hero.currentTask = HeroTask.TRAIN_ATK;
    // progresso já acumulado alto força >=1 ponto neste tick
    hero.trainingProgressMs = { hp: 0, atk: 10_000_000, mp: 0 };
    const state = {
      gold: 0,
      heroes: [hero],
      heroesRecruited: 1,
      lastSavedAt: 0,
      inventory: [],
      activeMissions: [],
    } as any;

    const next = handleTick(state, Date.now());
    expect(next.heroes[0]).not.toBe(hero); // referência nova
    expect(next.heroes[0].atk).toBeGreaterThan(hero.atk);
  });
});

import * as skills from '../../constants/skills';

describe('otimização getUnlockedSkills no tick', () => {
  afterEach(() => jest.restoreAllMocks());

  test('NÃO chama getUnlockedSkills quando nenhum herói treina', () => {
    const spy = jest.spyOn(skills, 'getUnlockedSkills');
    const hero = {
      id: 'h1', name: 'Idle', hpMax: 30, hpCurrent: 30, atk: 10, mp: 5,
      defense: 5, crit: 10, agility: 5, currentTask: HeroTask.IDLE,
      trainingCount: { hp: 0, atk: 0, mp: 0 },
      trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, equippedItems: [],
    } as any;
    const state = {
      gold: 0, heroes: [hero], heroesRecruited: 1, lastSavedAt: 0,
      inventory: [], activeMissions: [],
    } as any;

    handleTick(state, Date.now());
    expect(spy).toHaveBeenCalledTimes(0);
  });

  test('chama getUnlockedSkills só para o herói que treinou (2 chamadas: antes+depois)', () => {
    const spy = jest.spyOn(skills, 'getUnlockedSkills');
    const trainer = {
      id: 'h1', name: 'Trainer', hpMax: 30, hpCurrent: 30, atk: 10, mp: 5,
      defense: 5, crit: 10, agility: 5, currentTask: HeroTask.TRAIN_ATK,
      trainingCount: { hp: 0, atk: 0, mp: 0 },
      trainingProgressMs: { hp: 0, atk: 10_000_000, mp: 0 }, equippedItems: [],
    } as any;
    const idler = {
      id: 'h2', name: 'Idle', hpMax: 30, hpCurrent: 30, atk: 10, mp: 5,
      defense: 5, crit: 10, agility: 5, currentTask: HeroTask.IDLE,
      trainingCount: { hp: 0, atk: 0, mp: 0 },
      trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, equippedItems: [],
    } as any;
    const state = {
      gold: 0, heroes: [trainer, idler], heroesRecruited: 2, lastSavedAt: 0,
      inventory: [], activeMissions: [],
    } as any;

    handleTick(state, Date.now());
    // só o trainer é reavaliado: getUnlockedSkills(prevHero) + getUnlockedSkills(hero) = 2
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
