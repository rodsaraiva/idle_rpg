import { GameMath } from '../gameMath';

/**
 * Lógica de seleção de alvo: score por distância, classe, personalidade e
 * modifyScore externo, com tiebreak via rng.
 */
export function selectTarget<T extends { id: string; hp?: number; hpCurrent?: number; position?: number; classId?: string; range?: number }>(
  attacker: { id: string; attackType?: 'MELEE' | 'RANGED'; personality?: string; classId?: string; range?: number },
  attackerPos: number,
  candidates: T[],
  rng: () => number,
  context: {
    lastAttackerId?: string;
    alliesInDanger?: string[];
    threats?: Record<string, string>;
    modifyScore?: (candidate: T, baseScore: number) => number;
  } = {}
): T | undefined {
  if (!candidates || candidates.length === 0) return undefined;

  const hpOf = (c: T) => (typeof c.hp === 'number' ? c.hp : c.hpCurrent ?? 0);
  const maxHpOf = (c: any) => (typeof c.maxHp === 'number' ? c.maxHp : 100);

  const scores = candidates.map(target => {
    let score = 100;
    const dist = GameMath.getHexDistance(attackerPos, target.position ?? 0);
    const targetHpPct = hpOf(target) / maxHpOf(target);

    score -= dist * 10;

    if (attacker.classId === 'TANK' || attacker.classId === 'WARRIOR') {
      if (dist <= 1) score += 20;
    } else if (attacker.classId === 'ROGUE' || attacker.classId === 'ARCHER' || attacker.classId === 'MAGE') {
      if (target.classId !== 'TANK') score += 15;
      if (targetHpPct < 0.5) score += 10;
    }

    switch (attacker.personality) {
      case 'AGGRESSIVE':
        if (targetHpPct < 0.3) score += 40;
        break;
      case 'PROTECTOR':
        if (context.threats && target.id in context.threats) {
          const targetOfEnemy = context.threats[target.id];
          if (context.alliesInDanger?.includes(targetOfEnemy)) {
            score += 100;
          }
        }
        break;
      case 'CAUTIOUS':
        const range = attacker.range ?? 1;
        if (dist <= range) score += 30;
        break;
      case 'VENGEFUL':
        if (target.id === context.lastAttackerId) {
          score += 200;
        }
        break;
      case 'OPPORTUNIST':
        if (target.classId !== 'TANK') score += 20;
        if (targetHpPct < 0.4) score += 30;
        break;
    }

    if (context.modifyScore) {
      score = context.modifyScore(target, score);
    }

    return { target, score };
  });

  scores.sort((a, b) => b.score - a.score);

  const topCandidates = scores.slice(0, 2);
  if (topCandidates.length > 1 && rng() < 0.2) {
    return topCandidates[1].target;
  }

  return topCandidates[0]?.target;
}
