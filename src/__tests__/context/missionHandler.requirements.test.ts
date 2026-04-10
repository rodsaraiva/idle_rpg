import { handleStartMission } from '../../context/missionHandler';
import { initialGameState } from '../../context/gameReducer';
import { HeroTask, Hero } from '../../types';
import { MISSIONS } from '../../constants/missions';

// Create a mock mission with requirements
const MOCK_MISSION = {
  id: 'req_mission',
  name: 'Requirement Mission',
  minHeroes: 1,
  durationMs: 1000,
  rewardMin: 10,
  rewardMax: 20,
  requirements: [
    { type: 'class_needed', classId: 'MAGE', label: 'Precisa de um Mago' },
    { type: 'min_stat', stat: 'atk', value: 20, label: 'Ataque alto necessário' },
    { type: 'min_avg_stat', stat: 'hp', value: 50, label: 'Time precisa de HP médio alto' }
  ]
} as any;

// Add it to MISSIONS temporarily or just use it in tests if we can inject it
// Since MISSIONS is a constant, we might need to mock the import or just test the internal logic if exported.
// But handleStartMission uses MISSIONS directly.

// Let's mock MISSIONS
jest.mock('../../constants/missions', () => {
  const actual = jest.requireActual('../../constants/missions');
  return {
    ...actual,
    MISSIONS: [
      ...actual.MISSIONS,
      {
        id: 'req_mission',
        name: 'Requirement Mission',
        minHeroes: 1,
        durationMs: 1000,
        rewardMin: 10,
        rewardMax: 20,
        requirements: [
          { type: 'class_needed', classId: 'MAGE', label: 'Precisa de um Mago' },
          { type: 'min_stat', stat: 'atk', value: 20, label: 'Ataque alto necessário' },
          { type: 'min_avg_stat', stat: 'hp', value: 50, label: 'Time precisa de HP médio alto' }
        ]
      },
      {
        id: 'req_mission_hp',
        name: 'HP Min Stat Mission',
        minHeroes: 1,
        durationMs: 1000,
        rewardMin: 10,
        rewardMax: 20,
        requirements: [
          { type: 'min_stat', stat: 'hp', value: 50, label: 'Precisa HP alto' }
        ]
      },
      {
        id: 'req_mission_multi',
        name: 'Multi Hero Mission',
        minHeroes: 2,
        durationMs: 1000,
        rewardMin: 10,
        rewardMax: 20,
      },
      {
        id: 'req_mission_no_reqs',
        name: 'No Requirements Mission',
        minHeroes: 1,
        durationMs: 1000,
        rewardMin: 10,
        rewardMax: 20,
      },
    ]
  };
});

describe('handleStartMission requirements', () => {
  const baseHero: Hero = {
    id: 'h1',
    name: 'H1',
    hpMax: 10,
    hpCurrent: 10,
    atk: 10,
    mp: 10,
    defense: 5,
    crit: 5,
    agility: 10,
    currentTask: HeroTask.IDLE,
    classId: 'WARRIOR'
  };

  test('rejects if class_needed requirement is not met', () => {
    const state = { ...initialGameState, heroes: [baseHero] };
    const next = handleStartMission(state, 'req_mission', ['h1']);
    expect(next.activeMissions?.length || 0).toBe(0);
  });

  test('rejects if min_stat requirement is not met', () => {
    const mage: Hero = { ...baseHero, id: 'h2', classId: 'MAGE', atk: 10 };
    const state = { ...initialGameState, heroes: [mage] };
    const next = handleStartMission(state, 'req_mission', ['h2']);
    expect(next.activeMissions?.length || 0).toBe(0);
  });

  test('rejects if min_avg_stat requirement is not met', () => {
    const strongMage: Hero = { ...baseHero, id: 'h2', classId: 'MAGE', atk: 25, hpMax: 20 };
    const state = { ...initialGameState, heroes: [strongMage] };
    const next = handleStartMission(state, 'req_mission', ['h2']);
    expect(next.activeMissions?.length || 0).toBe(0);
  });

  test('accepts if all requirements are met', () => {
    const superMage: Hero = { ...baseHero, id: 'h2', classId: 'MAGE', atk: 25, hpMax: 60, hpCurrent: 60 };
    const state = { ...initialGameState, heroes: [superMage] };
    const next = handleStartMission(state, 'req_mission', ['h2']);
    expect(next.activeMissions?.length || 0).toBe(1);
    expect(next.heroes.find(h => h.id === 'h2')?.currentTask).toBe(HeroTask.MISSION);
  });

  test('min_stat with stat=hp maps to hpMax — rejects when hpMax too low', () => {
    const lowHp: Hero = { ...baseHero, id: 'h3', hpMax: 20, hpCurrent: 20 };
    const state = { ...initialGameState, heroes: [lowHp] };
    const next = handleStartMission(state, 'req_mission_hp', ['h3']);
    expect(next.activeMissions?.length || 0).toBe(0);
  });

  test('min_stat with stat=hp maps to hpMax — accepts when hpMax meets requirement', () => {
    const highHp: Hero = { ...baseHero, id: 'h3', hpMax: 60, hpCurrent: 60 };
    const state = { ...initialGameState, heroes: [highHp] };
    const next = handleStartMission(state, 'req_mission_hp', ['h3']);
    expect(next.activeMissions?.length || 0).toBe(1);
  });

  test('min_avg_stat passes when avg >= value (multiple heroes)', () => {
    const mage: Hero = { ...baseHero, id: 'h2', classId: 'MAGE', atk: 25, hpMax: 40, hpCurrent: 40 };
    const ally: Hero = { ...baseHero, id: 'h3', hpMax: 80, hpCurrent: 80 };
    const state = { ...initialGameState, heroes: [mage, ally] };
    // avg HP = (40 + 80) / 2 = 60 >= 50 ✅
    // atk requirement satisfied by mage (25 >= 20)
    // class_needed mage satisfied
    const next = handleStartMission(state, 'req_mission', ['h2', 'h3']);
    expect(next.activeMissions?.length || 0).toBe(1);
  });

  test('mission template with no requirements is accepted (null path)', () => {
    const state = { ...initialGameState, heroes: [baseHero] };
    const next = handleStartMission(state, 'req_mission_no_reqs', ['h1']);
    expect(next.activeMissions?.length || 0).toBe(1);
  });

  test('returns state unchanged if template not found', () => {
    const state = { ...initialGameState, heroes: [baseHero] };
    const next = handleStartMission(state, 'unknown_template', ['h1']);
    expect(next).toBe(state);
  });

  test('returns state unchanged if heroIds.length < minHeroes', () => {
    const state = { ...initialGameState, heroes: [baseHero] };
    // req_mission_multi requires 2 heroes, pass only 1
    const next = handleStartMission(state, 'req_mission_multi', ['h1']);
    expect(next).toBe(state);
  });

  test('returns state unchanged if heroId missing from heroesMap', () => {
    const state = { ...initialGameState, heroes: [baseHero] };
    const next = handleStartMission(state, 'req_mission_no_reqs', ['ghost_hero']);
    expect(next).toBe(state);
  });

  test('returns state unchanged if hero is already on a mission', () => {
    const onMission: Hero = { ...baseHero, id: 'h1', currentTask: HeroTask.MISSION };
    const state = { ...initialGameState, heroes: [onMission] };
    const next = handleStartMission(state, 'req_mission_no_reqs', ['h1']);
    expect(next).toBe(state);
  });

  test('returns state unchanged if hero is incapacitated (hp below threshold)', () => {
    const kod: Hero = { ...baseHero, id: 'h1', hpCurrent: 1 };
    const state = { ...initialGameState, heroes: [kod] };
    const next = handleStartMission(state, 'req_mission_no_reqs', ['h1']);
    expect(next).toBe(state);
  });
});
