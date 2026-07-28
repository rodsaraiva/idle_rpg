import { calculateOfflineProgress } from '../../utils/offlineProgress';
import { MISSIONS } from '../../constants/missions';
import { GameState, Hero, HeroTask, LoopPlan, ActiveMission } from '../../types';

const MISSIONS_0 = MISSIONS[0];

/** Recompensa fixada no precomputedOutcome — o estado de teste não tem panteão/legado. */
const REWARD_POR_CICLO = 100;

function heroi(): Hero {
  return {
    id: 'h1', name: 'Herói', hpMax: 500, hpCurrent: 500, atk: 999, mp: 10,
    defense: 50, crit: 10, agility: 10, currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  } as Hero;
}

function estadoComLoop(loop: LoopPlan, decorridoMs: number, over: Partial<ActiveMission> = {}): GameState {
  const agora = Date.now();
  return {
    gold: 0, heroes: [heroi()], heroesRecruited: 1,
    lastSavedAt: agora - decorridoMs,
    activeMissions: [{
      id: 'm1', templateId: MISSIONS_0.id, heroIds: ['h1'],
      startedAt: agora - decorridoMs, scheduledActions: [], enemiesState: [],
      precomputedOutcome: {
        reward: REWARD_POR_CICLO, rounds: 1, actions: [], log: [],
        success: true, casualties: [], enemyCasualties: 1,
      },
      loop, ...over,
    }],
  } as GameState;
}

test('loop de 2 vezes credita no máximo 2 ciclos e libera os heróis', () => {
  const template = MISSIONS[0];
  const decorrido = template.durationMs * 10;
  const estado = estadoComLoop({ mode: 'times', remaining: 2, total: 5 }, decorrido);

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.newState!.activeMissions).toHaveLength(0);
  expect(resumo.newState!.heroes[0].currentTask).toBe(HeroTask.IDLE);
  expect(resumo.goldGained).toBe(REWARD_POR_CICLO * 2);
});

test('loop recolhido credita 1 ciclo e encerra', () => {
  const template = MISSIONS[0];
  const estado = estadoComLoop({ mode: 'endless' }, template.durationMs * 5, { loopRecalled: true });

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.newState!.activeMissions).toHaveLength(0);
  expect(resumo.goldGained).toBe(REWARD_POR_CICLO);
});

test('loop endless continua armado', () => {
  const template = MISSIONS[0];
  const estado = estadoComLoop({ mode: 'endless' }, template.durationMs * 3);

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.newState!.activeMissions).toHaveLength(1);
});

test('loop por tempo (until) respeita o prazo mesmo offline', () => {
  const template = MISSIONS[0];
  const agora = Date.now();
  const decorrido = template.durationMs * 10;
  // prazo cabe só 4 ciclos a partir do início da missão
  const estado = estadoComLoop(
    { mode: 'until', endsAt: (agora - decorrido) + template.durationMs * 4 },
    decorrido
  );

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.goldGained).toBe(REWARD_POR_CICLO * 4);
  expect(resumo.newState!.activeMissions).toHaveLength(0);
  expect(resumo.newState!.heroes[0].currentTask).toBe(HeroTask.IDLE);
});

// --- Requisito adicional: o loopTally precisa incorporar os ciclos offline quando o loop sobrevive ---

test('loop que sobrevive à sessão offline soma os ciclos rodados ao loopTally', () => {
  const template = MISSIONS[0];
  const estado = estadoComLoop({ mode: 'endless' }, template.durationMs * 3);

  const resumo = calculateOfflineProgress(estado)!;

  const missaoContinuada = resumo.newState!.activeMissions![0];
  expect(missaoContinuada.loopTally?.cycles).toBe(3);
  expect(missaoContinuada.loopTally?.gold).toBe(REWARD_POR_CICLO * 3);
});

test('loopTally pré-existente é somado aos ciclos offline, sem inventar lastResult', () => {
  const template = MISSIONS[0];
  const tallyAnterior = {
    cycles: 2,
    gold: 250,
    materials: { couro: 3 },
    casualties: [{ heroId: 'h1', hpAfter: 400 }],
  };
  const estado = estadoComLoop(
    { mode: 'times', remaining: 10, total: 20 },
    template.durationMs * 3,
    { loopTally: tallyAnterior }
  );

  const resumo = calculateOfflineProgress(estado)!;

  const missaoContinuada = resumo.newState!.activeMissions![0];
  expect(missaoContinuada.loopTally?.cycles).toBe(2 + 3);
  expect(missaoContinuada.loopTally?.gold).toBe(250 + REWARD_POR_CICLO * 3);
  // nada de combate simulado offline: não inventa um novo lastResult
  expect(missaoContinuada.loopTally?.lastResult).toBeUndefined();
  // materiais não são creditados offline (fora de escopo) — o acumulado anterior é preservado, não perdido
  expect(missaoContinuada.loopTally?.materials).toEqual({ couro: 3 });
});

test('loop que encerra offline (plano esgota) não precisa carregar loopTally — sem LoopSummary aqui', () => {
  const template = MISSIONS[0];
  const decorrido = template.durationMs * 10;
  const estado = estadoComLoop({ mode: 'times', remaining: 2, total: 5 }, decorrido);

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.newState!.activeMissions).toHaveLength(0);
});
