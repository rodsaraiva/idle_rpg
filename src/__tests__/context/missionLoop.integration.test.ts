import { processMissions } from '../../context/missionTickHandler';
import { MISSIONS } from '../../constants/missions';
import { GameState, Hero, HeroTask, ActiveMission, LoopPlan } from '../../types';

const TPL = MISSIONS[0];

function heroi(id: string): Hero {
  return {
    id, name: `Herói ${id}`, hpMax: 500, hpCurrent: 500, atk: 999, mp: 10,
    defense: 50, crit: 10, agility: 10, currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  } as Hero;
}

/** Missão já vencida: finishAt no passado e desfecho pré-computado de vitória. */
function missaoConcluida(loop?: LoopPlan, over: Partial<ActiveMission> = {}): ActiveMission {
  const agora = Date.now();
  return {
    id: 'm1', templateId: TPL.id, heroIds: ['h1'],
    startedAt: agora - TPL.durationMs - 1000, finishAt: agora - 1000,
    scheduledActions: [], enemiesState: [],
    precomputedOutcome: {
      reward: 100, rounds: 1, actions: [], log: [], success: true,
      casualties: [], enemyCasualties: 1,
    },
    loop, ...over,
  } as ActiveMission;
}

function estado(missoes: ActiveMission[]): GameState {
  return {
    gold: 0, heroes: [heroi('h1')], heroesRecruited: 1, lastSavedAt: 0,
    activeMissions: missoes,
  } as GameState;
}

test('missão com loop endless recria o ciclo e mantém os heróis em missão', () => {
  const st = estado([missaoConcluida({ mode: 'endless' })]);
  const r = processMissions(st, st.heroes, Date.now());

  expect(r.activeMissions).toHaveLength(1);
  expect(r.activeMissions[0].loop).toEqual({ mode: 'endless' });
  expect(r.activeMissions[0].id).not.toBe('m1');
  expect(r.newHeroes[0].currentTask).toBe(HeroTask.MISSION);
});

test('missão sem loop encerra e libera o herói', () => {
  const st = estado([missaoConcluida(undefined)]);
  const r = processMissions(st, st.heroes, Date.now());

  expect(r.activeMissions).toHaveLength(0);
  expect(r.newHeroes[0].currentTask).toBe(HeroTask.IDLE);
});
