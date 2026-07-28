import { handleTick } from '../../context/tickHandler';
import { initialGameState } from '../../context/gameReducer';
import { MISSIONS } from '../../constants/missions';
import { GameState, Hero, HeroTask, LoopPlan } from '../../types';

// Fixo em junho/2026: handleTick injeta o evento sazonal do mês corrente e o
// multiplicador de recompensa entraria na conta se rodássemos com Date.now().
const AGORA = new Date(2026, 5, 15).getTime();
const TPL = MISSIONS[0];

function heroi(): Hero {
  return {
    id: 'h1', name: 'Herói', hpMax: 500, hpCurrent: 500, atk: 999, mp: 10,
    defense: 50, crit: 10, agility: 10, currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  } as Hero;
}

function estadoCom(loop?: LoopPlan): GameState {
  return {
    ...initialGameState,
    gold: 0,
    heroes: [heroi()],
    recentMissionResults: [],
    completedMissionCount: 0,
    // conquistas pré-creditadas: o tick não pode somar ouro por marco nesse teste
    unlockedAchievements: [
      'recruit_1', 'recruit_5', 'recruit_10', 'gold_100', 'gold_1000',
      'mission_first', 'mission_10', 'mission_50', 'forge_1', 'forge_5', 'boss_slayer',
    ],
    activeMissions: [{
      id: 'm1', templateId: TPL.id, heroIds: ['h1'],
      startedAt: AGORA - TPL.durationMs - 1000, finishAt: AGORA - 1000,
      scheduledActions: [], enemiesState: [],
      precomputedOutcome: {
        reward: 100, rounds: 1, actions: [], log: [], success: true,
        casualties: [], enemyCasualties: 1,
      },
      loop,
    }],
  } as GameState;
}

const estadoComLoopConcluido = () => estadoCom({ mode: 'times', remaining: 1, total: 1 });
const estadoComMissaoAvulsaConcluida = () => estadoCom(undefined);

describe('tickHandler — ciclo de loop não abre modal de resultado', () => {
  test('ciclo de loop não entra em recentMissionResults mas conta para conquistas', () => {
    const next = handleTick(estadoComLoopConcluido(), AGORA);

    expect(next.recentMissionResults ?? []).toHaveLength(0);
    expect(next.completedMissionCount).toBe(1);
  });

  test('missão avulsa continua abrindo o resultado', () => {
    const next = handleTick(estadoComMissaoAvulsaConcluida(), AGORA);

    expect(next.recentMissionResults).toHaveLength(1);
  });
});
