import { calculateOfflineProgress } from '../../utils/offlineProgress';
import { MISSIONS } from '../../constants/missions';
import { computeCycleDurationMs } from '../../utils/missionLoop';
import { GameState, Hero, HeroTask, LoopPlan, ActiveMission } from '../../types';

const MISSIONS_0 = MISSIONS[0];

/** Recompensa fixada no precomputedOutcome — o estado de teste não tem panteão/legado. */
const REWARD_POR_CICLO = 100;
// I2: a fixture (estadoComLoop) usa precomputedOutcome.actions: [] (n=0) — a duração real de
// um ciclo é a mesma que a produção calcula (computeCycleDurationMs), não MISSIONS_0.durationMs.
const CICLO = computeCycleDurationMs(0);

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
  const decorrido = CICLO * 10;
  const estado = estadoComLoop({ mode: 'times', remaining: 2, total: 5 }, decorrido);

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.newState!.activeMissions).toHaveLength(0);
  expect(resumo.newState!.heroes[0].currentTask).toBe(HeroTask.IDLE);
  expect(resumo.goldGained).toBe(REWARD_POR_CICLO * 2);
});

test('loop recolhido credita 1 ciclo e encerra', () => {
  const estado = estadoComLoop({ mode: 'endless' }, CICLO * 5, { loopRecalled: true });

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.newState!.activeMissions).toHaveLength(0);
  expect(resumo.goldGained).toBe(REWARD_POR_CICLO);
});

test('loop endless continua armado', () => {
  const estado = estadoComLoop({ mode: 'endless' }, CICLO * 3);

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.newState!.activeMissions).toHaveLength(1);
});

test('loop "times" esgota o plano exatamente na janela offline (cycles === teto, sem sobra)', () => {
  // Caso mais comum pra planos curtos: o jogador volta logo depois de o plano ter
  // terminado (decorrido cai em [remaining*d, (remaining+1)*d), sem ciclo extra "de graça").
  const decorrido = CICLO * 3.5;
  const estado = estadoComLoop({ mode: 'times', remaining: 3, total: 3 }, decorrido);

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.newState!.activeMissions).toHaveLength(0);
  expect(resumo.newState!.heroes[0].currentTask).toBe(HeroTask.IDLE);
  expect(resumo.goldGained).toBe(REWARD_POR_CICLO * 3);
});

test('loop "until" continua armado quando o prazo cobre mais ciclos do que o tempo offline gerou', () => {
  const agora = Date.now();
  const decorrido = CICLO * 2; // só 2 ciclos possíveis no tempo offline
  const startedAt = agora - decorrido;
  const estado = estadoComLoop(
    { mode: 'until', endsAt: startedAt + CICLO * 4.3 }, // prazo cobre 5 ciclos (ceil)
    decorrido
  );

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.newState!.activeMissions).toHaveLength(1);
  expect(resumo.goldGained).toBe(REWARD_POR_CICLO * 2);
});

test('loop "until" com prazo não-múltiplo credita o teto arredondado pra cima (ceil), não floor', () => {
  // D = 4.3x a duração: o ciclo em voo quando o prazo vence sempre completa,
  // então o teto real é ceil(D/d) = 5, não floor(D/d) = 4.
  const agora = Date.now();
  const decorrido = CICLO * 6; // tempo offline sobra além do prazo
  const startedAt = agora - decorrido;
  const estado = estadoComLoop(
    { mode: 'until', endsAt: startedAt + CICLO * 4.3 },
    decorrido
  );

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.goldGained).toBe(REWARD_POR_CICLO * 5);
  expect(resumo.newState!.activeMissions).toHaveLength(0);
  expect(resumo.newState!.heroes[0].currentTask).toBe(HeroTask.IDLE);
});

test('loop "until" com prazo múltiplo exato da duração credita ceil(D/d), não floor(D/d) + 1', () => {
  // D = 4×duração é o caso mais comum na prática: os chips de "até" (15m/1h/4h/8h)
  // dividem quase toda duração de missão exatamente, e endsAt/startedAt nascem na
  // mesma call stack síncrona (useMissions.ts). Aqui ceil e floor+1 discordam por 1
  // ciclo — é o vizinho off-by-one que o teste "não-múltiplo" sozinho não pega.
  const agora = Date.now();
  const decorrido = CICLO * 10; // tempo offline sobra além do prazo
  const startedAt = agora - decorrido;
  const estado = estadoComLoop(
    { mode: 'until', endsAt: startedAt + CICLO * 4 },
    decorrido
  );

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.goldGained).toBe(REWARD_POR_CICLO * 4);
  expect(resumo.newState!.activeMissions).toHaveLength(0);
  expect(resumo.newState!.heroes[0].currentTask).toBe(HeroTask.IDLE);
});

test('loop "until" credita o ciclo em voo mesmo com o prazo vencendo no meio dele (0 < D < duração)', () => {
  // Formato mais comum do último ciclo de qualquer loop "until": o prazo nunca
  // interrompe o ciclo em andamento, só impede que um novo comece.
  const agora = Date.now();
  const decorrido = CICLO; // exatamente 1 ciclo decorrido
  const startedAt = agora - decorrido;
  const estado = estadoComLoop(
    { mode: 'until', endsAt: startedAt + CICLO * 0.5 },
    decorrido
  );

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.goldGained).toBe(REWARD_POR_CICLO); // 1 ciclo, não 0
  expect(resumo.newState!.activeMissions).toHaveLength(0);
  expect(resumo.newState!.heroes[0].currentTask).toBe(HeroTask.IDLE);
});

// --- Requisito adicional: o loopTally precisa incorporar os ciclos offline quando o loop sobrevive ---

test('loop que sobrevive à sessão offline soma os ciclos rodados ao loopTally', () => {
  const estado = estadoComLoop({ mode: 'endless' }, CICLO * 3);

  const resumo = calculateOfflineProgress(estado)!;

  const missaoContinuada = resumo.newState!.activeMissions![0];
  expect(missaoContinuada.loopTally?.cycles).toBe(3);
  expect(missaoContinuada.loopTally?.gold).toBe(REWARD_POR_CICLO * 3);
});

test('loopTally pré-existente é somado aos ciclos offline, sem inventar lastResult', () => {
  const tallyAnterior = {
    cycles: 2,
    gold: 250,
    materials: { couro: 3 },
    casualties: [{ heroId: 'h1', hpAfter: 400 }],
  };
  const estado = estadoComLoop(
    { mode: 'times', remaining: 10, total: 20 },
    CICLO * 3,
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
  const decorrido = CICLO * 10;
  const estado = estadoComLoop({ mode: 'times', remaining: 2, total: 5 }, decorrido);

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.newState!.activeMissions).toHaveLength(0);
});
