import { LoopPlan, LoopTally, MissionResult } from '../types';
import {
  MISSION_START_DELAY_MS,
  MISSION_ACTION_INTERVAL_MS,
  MISSION_FINISH_DELAY_MS,
} from '../constants/game';

/** Um ciclo já concluído, na forma que o acumulador consome. */
export interface CompletedCycle {
  gold: number;
  materials: Record<string, number>;
  casualties: { heroId: string; hpAfter: number }[];
  result: MissionResult;
}

/**
 * O plano é avaliado DEPOIS do ciclo terminar — por isso `remaining: 0` barra.
 * Um plano criado com `remaining: 3` roda exatamente 3 ciclos.
 */
export function planAllowsAnotherCycle(plan: LoopPlan, now: number): boolean {
  switch (plan.mode) {
    case 'times': return plan.remaining > 0;
    case 'until': return now < plan.endsAt;
    case 'endless': return true;
  }
}

export function advanceLoopPlan(plan: LoopPlan): LoopPlan {
  if (plan.mode !== 'times') return plan;
  return { ...plan, remaining: Math.max(0, plan.remaining - 1) };
}

/**
 * Timestamp (ms desde o início do ciclo) em que a i-ésima ação (0-indexed) do combate
 * pré-computado deve ser aplicada. É a MESMA expressão que missionHandler.ts (início da
 * missão) e missionTickHandler.ts (continuação de loop) usavam cada um por conta própria —
 * extraída aqui pra não duplicar de novo (essa duplicação é o que causou a I2).
 */
export function actionTimestampMs(actionIndex: number, durationFactor: number = 1): number {
  return Math.floor((MISSION_START_DELAY_MS + actionIndex * MISSION_ACTION_INTERVAL_MS) * durationFactor);
}

/**
 * Duração real de um ciclo de missão: da primeira ação ao encerramento do combate
 * (última ação agendada + o delay de encerramento, sem fator — MISSION_FINISH_DELAY_MS não
 * escala com Legado). É o tempo que o motor ONLINE de fato leva, dado o número de ações do
 * combate pré-computado — nunca `template.durationMs`, que não é lido em lugar nenhum do
 * motor online (só existia no caminho offline antigo, dessincronizado da execução real).
 */
export function computeCycleDurationMs(actionsCount: number, durationFactor: number = 1): number {
  const n = Math.max(1, actionsCount);
  return actionTimestampMs(n - 1, durationFactor) + MISSION_FINISH_DELAY_MS;
}

export function accumulateTally(prev: LoopTally | undefined, cycle: CompletedCycle): LoopTally {
  const materials = { ...(prev?.materials ?? {}) };
  for (const [mat, qty] of Object.entries(cycle.materials)) {
    materials[mat] = (materials[mat] ?? 0) + qty;
  }

  // União por heroId: um herói baixado num ciclo anterior não pode sumir do resumo só
  // porque um ciclo posterior correu limpo. Mantém a ordem de primeira aparição (heróis
  // já conhecidos primeiro) pro modal não embaralhar linhas entre renders; quando o mesmo
  // herói aparece nos dois lados, vence o hpAfter do ciclo novo.
  const casualties = (prev?.casualties ?? []).map((c) => {
    const atualizado = cycle.casualties.find((novo) => novo.heroId === c.heroId);
    return atualizado ?? c;
  });
  for (const novo of cycle.casualties) {
    if (!casualties.some((c) => c.heroId === novo.heroId)) {
      casualties.push(novo);
    }
  }

  return {
    cycles: (prev?.cycles ?? 0) + 1,
    gold: (prev?.gold ?? 0) + cycle.gold,
    materials,
    casualties,
    lastResult: cycle.result,
  };
}
