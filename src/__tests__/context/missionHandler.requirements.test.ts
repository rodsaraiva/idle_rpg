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
      }
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
});
