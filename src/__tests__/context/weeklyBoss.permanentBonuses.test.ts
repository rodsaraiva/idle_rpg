/**
 * BUG H1 — Boss semanal ignora permanentBonuses e pantheonBonuses
 *
 * Causa raiz: handleStartWeeklyBoss reimplementava o loop de equipamento à mão e
 * ignorava state.permanentBonuses e state.pantheonBonuses.
 *
 * Fix: substituir o bloco manual por getEffectiveStats(h, state) — idêntico ao
 * que handleStartMission já faz em missionHandler.ts:104-107.
 *
 * Estratégia de teste: computeBattleOutcome usa Math.random (não-seeded), tornando
 * a comparação de outcomes não-determinística. A abordagem correta é spy em
 * computeBattleOutcome e verificar os stats dos heróis passados para a batalha.
 */
import { handleStartWeeklyBoss } from '../../context/missionHandler';
import * as battleSim from '../../utils/battleSim';
import { initialGameState } from '../../context/gameReducer';
import { GameState, HeroTask, Hero } from '../../types';
import { getWeeklyBoss } from '../../constants/weeklyBosses';
import { getWeeklySeed } from '../../constants/weeklyQuests';

const FIXED_NOW = 1_700_000_000_000;

function makeHero(id: string, overrides: Partial<Hero> = {}): Hero {
  return {
    id,
    name: `Hero ${id}`,
    // ATK base modesto: com permanentBonuses.atk = 5000, efetivo = 5010 (inequívoco)
    hpMax: 30,
    hpCurrent: 30,
    atk: 10,
    mp: 5,
    defense: 5,
    crit: 5,
    agility: 10,
    currentTask: HeroTask.IDLE,
    classId: 'WARRIOR',
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [], // sem equip → loop de equip atual retorna h diretamente (bug visível)
    ...overrides,
  } as Hero;
}

/**
 * Estado mínimo válido com weeklyState.
 * Seed real (getWeeklySeed()) evita que refreshWeeklyState sobrescreva o estado.
 * Primeiro herói tem stars: 1 para satisfazer o gate de estrela.
 */
function makeBaseState(): GameState {
  const currentSeed = getWeeklySeed();
  const heroes = ['h1', 'h2', 'h3', 'h4', 'h5'].map((id, i) =>
    makeHero(id, { stars: i === 0 ? 1 : 0 })
  );
  return {
    ...initialGameState,
    heroes,
    activeMissions: [],
    weeklyState: {
      seed: currentSeed,
      quests: [],
      progress: {},
      allClaimed: false,
      bossDefeated: false,
    },
  };
}

describe('BUG H1 — Boss semanal deve usar permanentBonuses (RED → GREEN)', () => {
  afterEach(() => jest.restoreAllMocks());

  test('permanentBonuses.atk é aplicado aos heróis antes da batalha do boss semanal', () => {
    const stateBase = makeBaseState();
    const boss = getWeeklyBoss(stateBase.weeklyState!.seed);
    const heroIds = stateBase.heroes.slice(0, boss.minHeroes).map(h => h.id);

    const spy = jest.spyOn(battleSim, 'computeBattleOutcome');

    const stateComBonus: GameState = {
      ...stateBase,
      permanentBonuses: { atk: 5000, hp: 0 },
    };

    handleStartWeeklyBoss(stateComBonus, heroIds, undefined, FIXED_NOW);

    expect(spy).toHaveBeenCalledTimes(1);
    const heroesPassedToBattle = spy.mock.calls[0][1] as Hero[];

    // BUG H1: código atual ignora permanentBonuses → atk permanece 10 (base)
    // Após fix: getEffectiveStats aplica permanentBonuses → atk = 10 + 5000 = 5010
    heroesPassedToBattle.forEach(h => {
      expect(h.atk).toBe(5010);
    });
  });

  test('pantheonBonuses.atkPercent é aplicado aos heróis antes da batalha do boss semanal', () => {
    const stateBase = makeBaseState();
    const boss = getWeeklyBoss(stateBase.weeklyState!.seed);
    const heroIds = stateBase.heroes.slice(0, boss.minHeroes).map(h => h.id);

    const spy = jest.spyOn(battleSim, 'computeBattleOutcome');

    const stateComPantheon: GameState = {
      ...stateBase,
      pantheonBonuses: { atkPercent: 100, hpPercent: 0, goldPercent: 0 },
    };

    handleStartWeeklyBoss(stateComPantheon, heroIds, undefined, FIXED_NOW);

    expect(spy).toHaveBeenCalledTimes(1);
    const heroesPassedToBattle = spy.mock.calls[0][1] as Hero[];

    // BUG H1: código atual ignora pantheonBonuses → atk permanece 10 (base)
    // Após fix: getEffectiveStats aplica atkPercent=100% → atk = floor(10 * 2) = 20
    heroesPassedToBattle.forEach(h => {
      expect(h.atk).toBe(20);
    });
  });

  test('DEF/CRIT/AGI NÃO são afetados por permanentBonuses (invariante)', () => {
    // Apenas atk e hp recebem permanentBonuses; defense/crit/agility só crescem via equip
    const stateBase = makeBaseState();
    const boss = getWeeklyBoss(stateBase.weeklyState!.seed);
    const heroIds = stateBase.heroes.slice(0, boss.minHeroes).map(h => h.id);

    const spy = jest.spyOn(battleSim, 'computeBattleOutcome');

    const stateComBonus: GameState = {
      ...stateBase,
      permanentBonuses: { atk: 5000, hp: 0 },
    };

    handleStartWeeklyBoss(stateComBonus, heroIds, undefined, FIXED_NOW);

    const heroesPassedToBattle = spy.mock.calls[0][1] as Hero[];

    // DEF/CRIT/AGI devem permanecer iguais ao valor base (5, 5, 10)
    heroesPassedToBattle.forEach(h => {
      expect(h.defense).toBe(5);
      expect(h.crit).toBe(5);
      expect(h.agility).toBe(10);
    });
  });
});
