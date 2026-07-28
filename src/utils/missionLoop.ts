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
