import { LoopPlan, LoopTally, MissionResult } from '../types';

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

export function accumulateTally(prev: LoopTally | undefined, cycle: CompletedCycle): LoopTally {
  const materials = { ...(prev?.materials ?? {}) };
  for (const [mat, qty] of Object.entries(cycle.materials)) {
    materials[mat] = (materials[mat] ?? 0) + qty;
  }
  return {
    cycles: (prev?.cycles ?? 0) + 1,
    gold: (prev?.gold ?? 0) + cycle.gold,
    materials,
    casualties: cycle.casualties,
    lastResult: cycle.result,
  };
}
