import { Hero, MissionAction, MissionActorType } from '../types';
import { MissionTemplate } from '../constants/missions';
import { 
  CRIT_MULTIPLIER,
  ENEMY_ROWS,
  GRID_COLUMNS,
  GRID_ROWS 
} from '../constants/game';
import { GameMath } from './gameMath';

export interface BattleEnemy {
  id: string;
  hp: number;
  maxHp: number;
  atk: number;
  mp: number;
  defense: number;
  crit: number;
  agility: number;
    alive: boolean;
    attackType: 'MELEE' | 'RANGED';
    position?: number;
    range: number;
    movement: number;
  }

export const BattleEngine = {
  /**
   * Cria os inimigos para a batalha baseado no template da missão.
   */
  createEnemies(template: MissionTemplate): BattleEnemy[] {
    const enemies: BattleEnemy[] = [];
    const enemyPositions = [...ENEMY_ROWS].flatMap(r => 
      Array.from({ length: GRID_COLUMNS }, (_, c) => r * GRID_COLUMNS + c)
    );
    // Shuffle positions to place enemies randomly in the enemy zone
    for (let i = enemyPositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [enemyPositions[i], enemyPositions[j]] = [enemyPositions[j], enemyPositions[i]];
    }

    let posIdx = 0;

    if (template.enemies && template.enemies.length > 0) {
      template.enemies.forEach((edef, gi) => {
        const cnt = edef.count ?? 1;
        for (let i = 0; i < cnt; i++) {
          const attackType = edef.attackType ?? (Math.random() < 0.5 ? 'MELEE' : 'RANGED');
          enemies.push({
            id: `enemy_${gi}_${i}`,
            hp: edef.hp,
            maxHp: edef.hp,
            atk: edef.atk,
            mp: edef.mp,
            defense: (edef as any).defense ?? 2,
            crit: (edef as any).crit ?? 5,
            agility: (edef as any).agility ?? 5,
            alive: true,
            attackType,
            position: enemyPositions[posIdx++] ?? 0,
            range: edef.range ?? (attackType === 'RANGED' ? 3 : 1),
            movement: edef.movement ?? 2,
          });
        }
      });
    } else {
      const enemyCount = template.minHeroes;
      for (let i = 0; i < enemyCount; i++) {
        enemies.push({
          id: `orc_${i}`,
          hp: 5,
          maxHp: 5,
          atk: 2,
          mp: 1,
          defense: 1,
          crit: 2,
          agility: 2,
          alive: true,
          attackType: i % 2 === 0 ? 'MELEE' : 'RANGED',
          position: enemyPositions[posIdx++] ?? 0,
          range: i % 2 === 0 ? 1 : 3,
          movement: 2,
        });
      }
    }
    return enemies;
  },

  /**
   * Encontra a melhor posição para se mover em direção ao alvo.
   */
  findMovePath(
    currentPos: number,
    targetPos: number,
    movement: number,
    occupiedPositions: Set<number>
  ): number {
    if (movement <= 0) return currentPos;
    
    let bestPos = currentPos;
    let minDistance = GameMath.getHexDistance(currentPos, targetPos);

    // BFS simplificada para encontrar a célula dentro do alcance de movimento que está mais próxima do alvo
    const queue: { pos: number; dist: number }[] = [{ pos: currentPos, dist: 0 }];
    const visited = new Set<number>([currentPos]);

    while (queue.length > 0) {
      const { pos, dist } = queue.shift()!;

      if (dist < movement) {
        const neighbors = GameMath.getHexNeighbors(pos, GRID_ROWS, GRID_COLUMNS);
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && !occupiedPositions.has(neighbor)) {
            visited.add(neighbor);
            const dToTarget = GameMath.getHexDistance(neighbor, targetPos);
            if (dToTarget < minDistance) {
              minDistance = dToTarget;
              bestPos = neighbor;
            }
            queue.push({ pos: neighbor, dist: dist + 1 });
          }
        }
      }
    }

    return bestPos;
  },

  /**
   * Lógica de seleção de alvo.
   * Agora considera a distância, classe e personalidade.
   */
  selectTarget<T extends { id: string; hp?: number; hpCurrent?: number; position?: number; classId?: string; range?: number }>(
    attacker: { id: string; attackType?: 'MELEE' | 'RANGED'; personality?: string; classId?: string; range?: number },
    attackerPos: number,
    candidates: T[],
    rng: () => number,
    context: {
      lastAttackerId?: string;
      alliesInDanger?: string[];
      threats?: Record<string, string>; // enemyId -> targetAllyId
    } = {}
  ): T | undefined {
    if (!candidates || candidates.length === 0) return undefined;

    const hpOf = (c: T) => (typeof c.hp === 'number' ? c.hp : c.hpCurrent ?? 0);
    const maxHpOf = (c: any) => (typeof c.maxHp === 'number' ? c.maxHp : 100); // Default fallback

    const scores = candidates.map(target => {
      let score = 100; // Base score
      const dist = GameMath.getHexDistance(attackerPos, target.position ?? 0);
      const targetHpPct = hpOf(target) / maxHpOf(target);
      
      // 1. Distância (Penalidade base)
      score -= dist * 10;

      // 2. Lógica por Classe do Atacante
      if (attacker.classId === 'TANK' || attacker.classId === 'WARRIOR') {
        // Preferem alvos próximos
        if (dist <= 1) score += 20;
      } else if (attacker.classId === 'ROGUE' || attacker.classId === 'ARCHER' || attacker.classId === 'MAGE') {
        // Preferem alvos frágeis (não TANK)
        if (target.classId !== 'TANK') score += 15;
        if (targetHpPct < 0.5) score += 10;
      }

      // 3. Lógica por Personalidade
      switch (attacker.personality) {
        case 'AGGRESSIVE':
          // Prioriza quem pode morrer
          if (targetHpPct < 0.3) score += 40;
          // Se puder matar com o dano médio, ignora distância (no simulador isso será refletido no score alto)
          break;
        case 'PROTECTOR':
          // Prioriza quem atacou aliados em perigo
          if (context.threats && target.id in context.threats) {
            const targetOfEnemy = context.threats[target.id];
            if (context.alliesInDanger?.includes(targetOfEnemy)) {
              score += 100;
            }
          }
          break;
        case 'CAUTIOUS':
          // Prefere alvos no alcance sem mover
          const range = attacker.range ?? 1;
          if (dist <= range) score += 30;
          // Alvos isolados (menos vizinhos inimigos - simplificado para: prefere quem está longe do centro do grid inimigo)
          break;
        case 'VENGEFUL':
          // Bônus imenso contra quem o atacou
          if (target.id === context.lastAttackerId) {
            score += 200;
          }
          break;
        case 'OPPORTUNIST':
          // Alvos fáceis e HP baixo
          if (target.classId !== 'TANK') score += 20;
          if (targetHpPct < 0.4) score += 30;
          break;
      }

      return { target, score };
    });

    // Ordena por score descendente e pega o melhor
    scores.sort((a, b) => b.score - a.score);
    
    // Adiciona uma pequena aleatoriedade para não ser 100% determinístico
    const topCandidates = scores.slice(0, 2);
    if (topCandidates.length > 1 && rng() < 0.2) {
      return topCandidates[1].target;
    }

    return topCandidates[0]?.target;
  },

  /**
   * Calcula o resultado de um ataque.
   */
  calculateAttack(
    attacker: { id: string; name?: string; atk: number; crit?: number; classId?: string; attackType?: 'MELEE' | 'RANGED' },
    target: { id: string; name?: string; hp?: number; hpCurrent?: number; defense?: number; agility?: number },
    baseHitChance: number, // Este valor agora será tratado como a chance base de acerto (antes da agilidade)
    actorType: MissionActorType,
    round: number,
    rng: () => number
  ): { action: MissionAction; dmg: number } | null {
    // Agilidade fornece uma curva de esquiva com retornos decrescentes
    const evasion = (target.agility ?? 0) / ((target.agility ?? 0) + 50);
    const effectiveHitChance = Math.max(0.05, baseHitChance - evasion);

    if (rng() > effectiveHitChance) {
      return {
        action: {
          round,
          actorType,
          actorId: attacker.id,
          actorName: attacker.name ?? attacker.id,
          actionType: 'miss',
          targetId: target.id,
          text: `${attacker.name ?? attacker.id} errou o ataque em ${target.name ?? target.id}`,
        },
        dmg: 0,
      };
    }

    const critChance = GameMath.calcCritChance(attacker.classId, attacker.crit);
    const isCrit = rng() < critChance;
    const dmg = GameMath.calcDamage(attacker.atk, target.defense, isCrit);

    return {
      action: {
        round,
        actorType,
        actorId: attacker.id,
        actorName: attacker.name ?? attacker.id,
        actionType: 'hit',
        targetId: target.id,
        amount: dmg,
        isCrit,
        text: `${attacker.name ?? attacker.id} causou ${dmg} de dano em ${target.name ?? target.id}${isCrit ? ' (CRÍTICO!)' : ''}`,
      },
      dmg,
    };
  },
};
