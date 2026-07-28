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

  test('resumo novo entra no fim de completedLoops — não troca o card que o jogador está vendo', () => {
    const estadoComPendente: GameState = {
      ...estadoComLoopConcluido(),
      completedLoops: [{
        missionId: 'antigo', templateId: TPL.id, heroIds: ['hOld'],
        tally: { cycles: 1, gold: 10, materials: {}, casualties: [] },
        reason: 'completed',
      }],
    };

    const next = handleTick(estadoComPendente, AGORA);

    expect(next.completedLoops?.map((r) => r.missionId)).toEqual(['antigo', 'm1']);
  });

  test('overflow: com 5 resumos pendentes, o 6º entra e o mais ANTIGO sai (cap pelo início, não pelo fim)', () => {
    // Regressão: slice(0, 5) cortava pelo fim e descartava o resumo NOVO — o 6º loop
    // concluído nunca aparecia (o ouro entrava, só o card se perdia). O cap certo é slice(-5).
    const antigos = Array.from({ length: 5 }, (_, i) => ({
      missionId: `antigo_${i}`, templateId: TPL.id, heroIds: ['hOld'],
      tally: { cycles: 1, gold: 10, materials: {}, casualties: [] },
      reason: 'completed' as const,
    }));
    const estadoComPendente: GameState = {
      ...estadoComLoopConcluido(),
      completedLoops: antigos,
    };

    const next = handleTick(estadoComPendente, AGORA);

    expect(next.completedLoops).toHaveLength(5);
    // antigo_0 é o mais antigo — sai. m1 (o novo) entra no fim.
    expect(next.completedLoops?.map((r) => r.missionId)).toEqual([
      'antigo_1', 'antigo_2', 'antigo_3', 'antigo_4', 'm1',
    ]);
  });
});
