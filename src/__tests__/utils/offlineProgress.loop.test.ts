import { calculateOfflineProgress } from '../../utils/offlineProgress';
import { processMissions } from '../../context/missionTickHandler';
import { computeFinalGold } from '../../utils/rewards';
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

// --- Task 11: derrota fecha o loop no ciclo que fracassou, igual ao online ---

test('loop "endless" com combate de derrota credita 1 ciclo (não os N que o tempo offline caberia), aplica baixas e libera o herói', () => {
  // 'endless' é o pior caso: sem outcomeFalhou, nunca esgotaria — e 10 ciclos possíveis
  // tornam a diferença "ordem de grandeza", não off-by-one (ver brief, verificação por mutação).
  const decorrido = CICLO * 10;
  const estado = estadoComLoop({ mode: 'endless' }, decorrido, {
    precomputedOutcome: {
      reward: REWARD_POR_CICLO, rounds: 1, actions: [], log: [],
      success: false, casualties: [{ heroId: 'h1', hpLost: 500, hpAfter: 0 }], enemyCasualties: 0,
    },
  });

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.goldGained).toBe(REWARD_POR_CICLO); // 1 ciclo, igual ao online — não 10
  expect(resumo.newState!.activeMissions).toHaveLength(0); // loop não é re-armado
  expect(resumo.newState!.heroes[0].currentTask).toBe(HeroTask.IDLE);
  expect(resumo.newState!.heroes[0].hpCurrent).toBe(0); // baixa do ciclo perdido aplicada
});

test('loop "times" com combate de derrota também credita só 1 ciclo, mesmo com remaining alto', () => {
  const decorrido = CICLO * 8;
  const estado = estadoComLoop({ mode: 'times', remaining: 5, total: 5 }, decorrido, {
    precomputedOutcome: {
      reward: REWARD_POR_CICLO, rounds: 1, actions: [], log: [],
      success: false, casualties: [{ heroId: 'h1', hpLost: 200, hpAfter: 300 }], enemyCasualties: 0,
    },
  });

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.goldGained).toBe(REWARD_POR_CICLO);
  expect(resumo.newState!.activeMissions).toHaveLength(0);
  expect(resumo.newState!.heroes[0].currentTask).toBe(HeroTask.IDLE);
  expect(resumo.newState!.heroes[0].hpCurrent).toBe(300);
});

test('loop com combate de derrota (paridade): offline credita exatamente o que a única conclusão online creditaria, com panteão aplicado — não o reward cru', () => {
  // Review da Task 11: os dois testes acima afirmam contra REWARD_POR_CICLO num estado sem
  // multiplicador — provam "1 ciclo, não N", mas não que o ouro daquele ciclo passa por
  // computeFinalGold no caminho de derrota. Mesmo padrão de offlineProgress.goldMultipliers.test.ts
  // (Task 10): roda os dois motores sobre o MESMO estado e compara, em vez de número mágico.
  const REWARD = 9; // floor(9*1.4) = 12 ≠ 9 — só discrimina um mutante se o multiplicador de fato mexer no valor
  const now = Date.now();
  const heroi1 = heroi();
  const outcomeFalho = {
    reward: REWARD, rounds: 1, actions: [], log: [],
    success: false, casualties: [{ heroId: 'h1', hpLost: 380, hpAfter: 120 }], enemyCasualties: 0,
  };
  const estadoComPanteao = (over: Partial<GameState>): GameState => ({
    gold: 0, heroes: [], heroesRecruited: 1, lastSavedAt: Date.now(), activeMissions: [],
    pantheonBonuses: { goldPercent: 40, atkPercent: 0, hpPercent: 0 },
    activeEvent: null,
    ...over,
  } as GameState);

  // ONLINE: 1 conclusão com outcome de derrota — mesmo com loop 'endless' no plano,
  // processMissions não repete porque exige outcome.success (missionTickHandler.ts:214-218).
  const missaoOnline: ActiveMission = {
    id: 'm1', templateId: MISSIONS_0.id, heroIds: ['h1'],
    startedAt: now - 1000, finishAt: now - 1, scheduledActions: [], enemiesState: [],
    precomputedOutcome: outcomeFalho, loop: { mode: 'endless' },
  };
  const estadoOnline = estadoComPanteao({ heroes: [heroi1], activeMissions: [missaoOnline] });
  const resultadoOnline = processMissions(estadoOnline, [heroi1], now);

  // OFFLINE: mesma missão, mesmo outcome, mas decorrido cobre 10 ciclos possíveis — sem a
  // checagem de success, offline creditaria 10x; a paridade só vale se ele parar em 1.
  const decorrido = CICLO * 10;
  const missaoOffline: ActiveMission = {
    id: 'm1', templateId: MISSIONS_0.id, heroIds: ['h1'],
    startedAt: now - decorrido, scheduledActions: [], enemiesState: [],
    precomputedOutcome: outcomeFalho, loop: { mode: 'endless' },
  };
  const estadoOffline = estadoComPanteao({
    heroes: [heroi1], lastSavedAt: now - decorrido, activeMissions: [missaoOffline],
  });
  const resumoOffline = calculateOfflineProgress(estadoOffline)!;

  // Confirma que o bônus realmente está em jogo (não passaria com mult=1 por acidente).
  expect(computeFinalGold(REWARD, estadoOnline)).toBe(12);
  expect(resultadoOnline.goldGained).toBe(12);
  expect(resumoOffline.goldGained).toBe(resultadoOnline.goldGained);

  expect(resumoOffline.newState!.activeMissions).toHaveLength(0);
  expect(resumoOffline.newState!.heroes[0].currentTask).toBe(HeroTask.IDLE);
  expect(resumoOffline.newState!.heroes[0].hpCurrent).toBe(resultadoOnline.newHeroes[0].hpCurrent);
});

// --- Task 12: vitória com baixas que esvaziam o time também fecha o loop no 1º ciclo ---

const MISSIONS_1 = MISSIONS[1]; // minHeroes: 2 — precisa de 2 heróis pra o critério de sobreviventes fazer sentido

function heroi2(): Hero {
  return {
    id: 'h2', name: 'Herói 2', hpMax: 500, hpCurrent: 500, atk: 999, mp: 10,
    defense: 50, crit: 10, agility: 10, currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  } as Hero;
}

test('loop "endless" com vitória que derruba o time abaixo de minHeroes credita 1 ciclo (não os N que o tempo offline caberia), aplica a baixa e libera os heróis', () => {
  // Mesmo raciocínio da derrota: o outcome pré-computado é do 1º ciclo. Se ele já deixa
  // sobreviventes (1) abaixo de minHeroes (2), o online nunca rodaria um 2º ciclo.
  const decorrido = CICLO * 10;
  const agora = Date.now();
  const estado: GameState = {
    gold: 0, heroes: [heroi(), heroi2()], heroesRecruited: 2,
    lastSavedAt: agora - decorrido,
    activeMissions: [{
      id: 'm1', templateId: MISSIONS_1.id, heroIds: ['h1', 'h2'],
      startedAt: agora - decorrido, scheduledActions: [], enemiesState: [],
      precomputedOutcome: {
        reward: REWARD_POR_CICLO, rounds: 1, actions: [], log: [],
        success: true,
        casualties: [
          { heroId: 'h1', hpLost: 500, hpAfter: 0 },
          { heroId: 'h2', hpLost: 100, hpAfter: 400 },
        ],
        enemyCasualties: 2,
      },
      loop: { mode: 'endless' },
    }],
  } as GameState;

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.goldGained).toBe(REWARD_POR_CICLO); // 1 ciclo, igual ao online — não 10
  expect(resumo.newState!.activeMissions).toHaveLength(0); // loop não é re-armado
  expect(resumo.newState!.heroes.find((h) => h.id === 'h1')!.currentTask).toBe(HeroTask.IDLE);
  expect(resumo.newState!.heroes.find((h) => h.id === 'h2')!.currentTask).toBe(HeroTask.IDLE);
  expect(resumo.newState!.heroes.find((h) => h.id === 'h1')!.hpCurrent).toBe(0); // baixa aplicada
  expect(resumo.newState!.heroes.find((h) => h.id === 'h2')!.hpCurrent).toBe(400); // baixa aplicada
});

test('loop "endless" com vitória que NÃO derruba o time abaixo de minHeroes continua armado, sem aplicar baixas (limite de escopo mantido)', () => {
  const decorrido = CICLO * 3;
  const agora = Date.now();
  const estado: GameState = {
    gold: 0, heroes: [heroi(), heroi2()], heroesRecruited: 2,
    lastSavedAt: agora - decorrido,
    activeMissions: [{
      id: 'm1', templateId: MISSIONS_1.id, heroIds: ['h1', 'h2'],
      startedAt: agora - decorrido, scheduledActions: [], enemiesState: [],
      precomputedOutcome: {
        reward: REWARD_POR_CICLO, rounds: 1, actions: [], log: [],
        success: true,
        casualties: [
          { heroId: 'h1', hpLost: 100, hpAfter: 400 },
          { heroId: 'h2', hpLost: 0, hpAfter: 500 },
        ],
        enemyCasualties: 2,
      },
      loop: { mode: 'endless' },
    }],
  } as GameState;

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.newState!.activeMissions).toHaveLength(1); // 2 sobreviventes >= minHeroes(2) — loop segue
  expect(resumo.goldGained).toBe(REWARD_POR_CICLO * 3);
  // Fora de escopo (decisão do dono, ver brief): enquanto o loop continua, baixa não é aplicada offline.
  expect(resumo.newState!.heroes.find((h) => h.id === 'h1')!.hpCurrent).toBe(500);
});

test('loop com vitória que esvazia o time (paridade): offline credita exatamente o que a única conclusão online creditaria, com panteão aplicado, HP e missões restantes idênticos', () => {
  const REWARD = 9; // floor(9*1.4) = 12 ≠ 9 — só discrimina um mutante se o multiplicador de fato mexer no valor
  const now = Date.now();
  const heroi1 = heroi();
  const heroiDois = heroi2();
  const outcomeVitoriaEsvazia = {
    reward: REWARD, rounds: 1, actions: [], log: [],
    success: true,
    casualties: [
      { heroId: 'h1', hpLost: 500, hpAfter: 0 },
      { heroId: 'h2', hpLost: 50, hpAfter: 450 },
    ],
    enemyCasualties: 2,
  };
  const estadoComPanteao = (over: Partial<GameState>): GameState => ({
    gold: 0, heroes: [], heroesRecruited: 2, lastSavedAt: Date.now(), activeMissions: [],
    pantheonBonuses: { goldPercent: 40, atkPercent: 0, hpPercent: 0 },
    activeEvent: null,
    ...over,
  } as GameState);

  // ONLINE: 1 conclusão vitoriosa com 1 sobrevivente — heroesForNext.length(1) < tpl.minHeroes(2),
  // então processMissions não repete (missionTickHandler.ts:226), mesmo com loop 'endless'.
  const missaoOnline: ActiveMission = {
    id: 'm1', templateId: MISSIONS_1.id, heroIds: ['h1', 'h2'],
    startedAt: now - 1000, finishAt: now - 1, scheduledActions: [], enemiesState: [],
    precomputedOutcome: outcomeVitoriaEsvazia, loop: { mode: 'endless' },
  };
  const estadoOnline = estadoComPanteao({ heroes: [heroi1, heroiDois], activeMissions: [missaoOnline] });
  const resultadoOnline = processMissions(estadoOnline, [heroi1, heroiDois], now);

  // OFFLINE: mesma missão, mesmo outcome, mas decorrido cobre 10 ciclos possíveis — sem a
  // checagem de sobreviventes, offline creditaria 10x.
  const decorrido = CICLO * 10;
  const missaoOffline: ActiveMission = {
    id: 'm1', templateId: MISSIONS_1.id, heroIds: ['h1', 'h2'],
    startedAt: now - decorrido, scheduledActions: [], enemiesState: [],
    precomputedOutcome: outcomeVitoriaEsvazia, loop: { mode: 'endless' },
  };
  const estadoOffline = estadoComPanteao({
    heroes: [heroi1, heroiDois], lastSavedAt: now - decorrido, activeMissions: [missaoOffline],
  });
  const resumoOffline = calculateOfflineProgress(estadoOffline)!;

  expect(computeFinalGold(REWARD, estadoOnline)).toBe(12);
  expect(resultadoOnline.goldGained).toBe(12);
  expect(resumoOffline.goldGained).toBe(resultadoOnline.goldGained);

  expect(resultadoOnline.activeMissions).toHaveLength(0);
  expect(resumoOffline.newState!.activeMissions).toHaveLength(0);

  const h1Online = resultadoOnline.newHeroes.find((h) => h.id === 'h1')!;
  const h2Online = resultadoOnline.newHeroes.find((h) => h.id === 'h2')!;
  const h1Offline = resumoOffline.newState!.heroes.find((h) => h.id === 'h1')!;
  const h2Offline = resumoOffline.newState!.heroes.find((h) => h.id === 'h2')!;

  expect(h1Offline.hpCurrent).toBe(h1Online.hpCurrent);
  expect(h2Offline.hpCurrent).toBe(h2Online.hpCurrent);
  expect(h1Offline.currentTask).toBe(HeroTask.IDLE);
  expect(h2Offline.currentTask).toBe(HeroTask.IDLE);
});

test('review Critical: herói já morto num ciclo anterior (ausente do casualties do outcome atual) conta como morto, não como vivo por omissão', () => {
  // Cenário de dois passos que o próprio online produz: h1 morreu num ciclo anterior; o online
  // re-arma a missão com heroIds completo (missionTickHandler.ts:257) mas computa o outcome só
  // com os sobreviventes daquele momento (h2, h3) — h1 não é combatente e por isso não aparece
  // no casualties deste outcome. Neste ciclo h2 também morre; só h3 sobrevive. sobreviventes(1)
  // < minHeroes(2): o online para aqui. Tratar "ausente do array" como "vivo" (bug do Critical)
  // deixaria h1 vivo por omissão e o loop seguiria de graça.
  function heroi3(): Hero {
    return {
      id: 'h3', name: 'Herói 3', hpMax: 500, hpCurrent: 500, atk: 999, mp: 10,
      defense: 50, crit: 10, agility: 10, currentTask: HeroTask.MISSION,
      trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
      equippedItems: [],
    } as Hero;
  }

  const decorrido = CICLO * 10;
  const agora = Date.now();
  const h1Morto = { ...heroi(), hpCurrent: 0 }; // já morto num ciclo anterior; segue em MISSION (não regenera)
  const estado: GameState = {
    gold: 0, heroes: [h1Morto, heroi2(), heroi3()], heroesRecruited: 3,
    lastSavedAt: agora - decorrido,
    activeMissions: [{
      id: 'm1', templateId: MISSIONS_1.id, heroIds: ['h1', 'h2', 'h3'], // heroIds original, h1 incluso
      startedAt: agora - decorrido, scheduledActions: [], enemiesState: [],
      precomputedOutcome: {
        reward: REWARD_POR_CICLO, rounds: 1, actions: [], log: [],
        success: true,
        // h1 NÃO participou deste combate (já estava fora) — sem entrada aqui, de propósito.
        casualties: [
          { heroId: 'h2', hpLost: 500, hpAfter: 0 },
          { heroId: 'h3', hpLost: 10, hpAfter: 490 },
        ],
        enemyCasualties: 2,
      },
      loop: { mode: 'endless' },
    }],
  } as GameState;

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.goldGained).toBe(REWARD_POR_CICLO); // 1 ciclo, não 10 — sobrevivente único (h3) < minHeroes(2)
  expect(resumo.newState!.activeMissions).toHaveLength(0); // loop não é re-armado
  const h1 = resumo.newState!.heroes.find((h) => h.id === 'h1')!;
  const h2 = resumo.newState!.heroes.find((h) => h.id === 'h2')!;
  const h3 = resumo.newState!.heroes.find((h) => h.id === 'h3')!;
  expect(h1.hpCurrent).toBe(0); // continua morto — não é tocado pelo casualties deste outcome
  expect(h2.hpCurrent).toBe(0);
  expect(h3.hpCurrent).toBe(490);
  expect(h1.currentTask).toBe(HeroTask.IDLE);
  expect(h2.currentTask).toBe(HeroTask.IDLE);
  expect(h3.currentTask).toBe(HeroTask.IDLE);
});
