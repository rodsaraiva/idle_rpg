import {
  planAllowsAnotherCycle, advanceLoopPlan, accumulateTally,
  actionTimestampMs, computeCycleDurationMs,
} from '../../utils/missionLoop';
import {
  MISSION_START_DELAY_MS, MISSION_ACTION_INTERVAL_MS, MISSION_FINISH_DELAY_MS,
} from '../../constants/game';
import { LoopPlan, MissionResult } from '../../types';

const AGORA = 1_000_000;

function resultado(over: Partial<MissionResult> = {}): MissionResult {
  return {
    missionId: 'm1', templateId: 'mission_1', success: true, reward: 100,
    rounds: 3, actions: [], log: [], casualties: [], enemyCasualties: 2, ...over,
  } as MissionResult;
}

describe('planAllowsAnotherCycle', () => {
  test('endless sempre permite', () => {
    expect(planAllowsAnotherCycle({ mode: 'endless' }, AGORA)).toBe(true);
  });

  test('times permite enquanto restar ciclo', () => {
    expect(planAllowsAnotherCycle({ mode: 'times', remaining: 1, total: 3 }, AGORA)).toBe(true);
    expect(planAllowsAnotherCycle({ mode: 'times', remaining: 0, total: 3 }, AGORA)).toBe(false);
  });

  test('until barra quando o prazo já passou', () => {
    expect(planAllowsAnotherCycle({ mode: 'until', endsAt: AGORA + 1 }, AGORA)).toBe(true);
    expect(planAllowsAnotherCycle({ mode: 'until', endsAt: AGORA }, AGORA)).toBe(false);
  });
});

describe('advanceLoopPlan', () => {
  test('times decrementa remaining e preserva total', () => {
    expect(advanceLoopPlan({ mode: 'times', remaining: 3, total: 3 }))
      .toEqual({ mode: 'times', remaining: 2, total: 3 });
  });

  test('times não desce abaixo de zero', () => {
    expect(advanceLoopPlan({ mode: 'times', remaining: 0, total: 3 }))
      .toEqual({ mode: 'times', remaining: 0, total: 3 });
  });

  test('until e endless passam intactos', () => {
    const until: LoopPlan = { mode: 'until', endsAt: AGORA };
    expect(advanceLoopPlan(until)).toEqual(until);
    expect(advanceLoopPlan({ mode: 'endless' })).toEqual({ mode: 'endless' });
  });
});

describe('accumulateTally', () => {
  test('parte do zero quando não há acumulado anterior', () => {
    const t = accumulateTally(undefined, {
      gold: 120, materials: { couro: 2 },
      casualties: [{ heroId: 'h1', hpAfter: 5 }], result: resultado(),
    });
    expect(t.cycles).toBe(1);
    expect(t.gold).toBe(120);
    expect(t.materials).toEqual({ couro: 2 });
    expect(t.casualties).toEqual([{ heroId: 'h1', hpAfter: 5 }]);
    expect(t.lastResult?.missionId).toBe('m1');
  });

  test('soma ouro, funde materiais, une baixas e substitui o último resultado', () => {
    const primeiro = accumulateTally(undefined, {
      gold: 100, materials: { couro: 2, ferro: 1 }, casualties: [{ heroId: 'h1', hpAfter: 0 }], result: resultado(),
    });
    const segundo = accumulateTally(primeiro, {
      gold: 50, materials: { couro: 3 }, casualties: [{ heroId: 'h2', hpAfter: 0 }],
      result: resultado({ missionId: 'm2' }),
    });
    expect(segundo.cycles).toBe(2);
    expect(segundo.gold).toBe(150);
    expect(segundo.materials).toEqual({ couro: 5, ferro: 1 });
    expect(segundo.casualties).toEqual([{ heroId: 'h1', hpAfter: 0 }, { heroId: 'h2', hpAfter: 0 }]);
    expect(segundo.lastResult?.missionId).toBe('m2');
  });

  test('herói caído num ciclo anterior sobrevive no acumulado quando o ciclo seguinte não tem baixas', () => {
    const primeiro = accumulateTally(undefined, {
      gold: 10, materials: {}, casualties: [{ heroId: 'h1', hpAfter: 0 }], result: resultado(),
    });
    const segundo = accumulateTally(primeiro, {
      gold: 10, materials: {}, casualties: [], result: resultado(),
    });
    expect(segundo.casualties).toEqual([{ heroId: 'h1', hpAfter: 0 }]);
  });

  test('mesmo herói baixado em dois ciclos mantém o hpAfter mais recente, sem duplicar', () => {
    const primeiro = accumulateTally(undefined, {
      gold: 10, materials: {}, casualties: [{ heroId: 'h1', hpAfter: 20 }], result: resultado(),
    });
    const segundo = accumulateTally(primeiro, {
      gold: 10, materials: {}, casualties: [{ heroId: 'h1', hpAfter: 5 }], result: resultado(),
    });
    expect(segundo.casualties).toEqual([{ heroId: 'h1', hpAfter: 5 }]);
  });

  test('união preserva baixas de heróis diferentes em ciclos diferentes', () => {
    const primeiro = accumulateTally(undefined, {
      gold: 10, materials: {}, casualties: [{ heroId: 'h1', hpAfter: 0 }], result: resultado(),
    });
    const segundo = accumulateTally(primeiro, {
      gold: 10, materials: {}, casualties: [{ heroId: 'h2', hpAfter: 12 }], result: resultado(),
    });
    expect(segundo.casualties).toEqual([{ heroId: 'h1', hpAfter: 0 }, { heroId: 'h2', hpAfter: 12 }]);
  });

  test('não muta o acumulado anterior', () => {
    const primeiro = accumulateTally(undefined, {
      gold: 10, materials: { couro: 1 }, casualties: [{ heroId: 'h1', hpAfter: 0 }], result: resultado(),
    });
    accumulateTally(primeiro, {
      gold: 10, materials: { couro: 1 }, casualties: [{ heroId: 'h1', hpAfter: 7 }], result: resultado(),
    });
    expect(primeiro.gold).toBe(10);
    expect(primeiro.materials).toEqual({ couro: 1 });
    expect(primeiro.casualties).toEqual([{ heroId: 'h1', hpAfter: 0 }]);
  });
});

// I2 — fonte única da duração de um ciclo de missão (online e offline chamam a mesma função).
describe('actionTimestampMs', () => {
  test('ação 0 cai em MISSION_START_DELAY_MS (sem fator)', () => {
    expect(actionTimestampMs(0)).toBe(MISSION_START_DELAY_MS);
  });

  test('ação i soma i intervalos de ação a partir do delay inicial', () => {
    expect(actionTimestampMs(3)).toBe(MISSION_START_DELAY_MS + 3 * MISSION_ACTION_INTERVAL_MS);
  });

  test('durationFactor escala o timestamp inteiro (Legado train_duration)', () => {
    expect(actionTimestampMs(3, 0.5)).toBe(Math.floor((MISSION_START_DELAY_MS + 3 * MISSION_ACTION_INTERVAL_MS) * 0.5));
  });
});

describe('computeCycleDurationMs', () => {
  test('n ações: última ação + delay de encerramento (sem fator no encerramento)', () => {
    const n = 5;
    const esperado = actionTimestampMs(n - 1) + MISSION_FINISH_DELAY_MS;
    expect(computeCycleDurationMs(n)).toBe(esperado);
  });

  test('0 ações cai no piso de 1 (nunca duração negativa ou zero)', () => {
    expect(computeCycleDurationMs(0)).toBe(computeCycleDurationMs(1));
  });

  test('durationFactor reduz o trecho agendado, mas não o delay de encerramento', () => {
    const n = 4;
    const factor = 0.5;
    const esperado = actionTimestampMs(n - 1, factor) + MISSION_FINISH_DELAY_MS;
    expect(computeCycleDurationMs(n, factor)).toBe(esperado);
  });
});
