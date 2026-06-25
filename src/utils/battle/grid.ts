import { MissionTemplate } from '../../constants/missions';
import { ENEMY_ROWS, GRID_COLUMNS, GRID_ROWS } from '../../constants/game';
import { GameMath } from '../gameMath';
import { assignEnemySkills } from '../../constants/enemySkills';
import { BattleEnemy } from './types';

/**
 * Cria os inimigos para a batalha baseado no template da missão.
 * @param rng PRNG a usar — default Math.random para retrocompatibilidade
 *            (call sites de produção como missionHandler não passam rng).
 */
export function createEnemies(template: MissionTemplate, rng: () => number = Math.random): BattleEnemy[] {
  const enemies: BattleEnemy[] = [];
  const enemyPositions = [...ENEMY_ROWS].flatMap(r =>
    Array.from({ length: GRID_COLUMNS }, (_, c) => r * GRID_COLUMNS + c)
  );
  // Embaralha posições para colocar inimigos aleatoriamente na zona inimiga
  for (let i = enemyPositions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [enemyPositions[i], enemyPositions[j]] = [enemyPositions[j], enemyPositions[i]];
  }

  let posIdx = 0;

  if (template.enemies && template.enemies.length > 0) {
    template.enemies.forEach((edef, gi) => {
      const cnt = edef.count ?? 1;
      for (let i = 0; i < cnt; i++) {
        const attackType = edef.attackType ?? (rng() < 0.5 ? 'MELEE' : 'RANGED');
        enemies.push({
          id: `enemy_${gi}_${i}`,
          hp: edef.hp,
          maxHp: edef.hp,
          atk: edef.atk,
          mp: edef.mp,
          defense: edef.defense ?? 2,
          crit: edef.crit ?? 5,
          agility: edef.agility ?? 5,
          alive: true,
          attackType,
          position: enemyPositions[posIdx++] ?? 0,
          range: edef.range ?? (attackType === 'RANGED' ? 3 : 1),
          movement: edef.movement ?? 2,
        });
        const difficulty = template.difficulty ?? 1;
        const isBoss = (edef.hp ?? 0) >= 100;
        const assigned = assignEnemySkills(difficulty, isBoss, rng);
        if (assigned.length > 0) enemies[enemies.length - 1].skills = assigned;
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
      const difficulty = template.difficulty ?? 1;
      const isBoss = false;
      const assigned = assignEnemySkills(difficulty, isBoss, rng);
      if (assigned.length > 0) enemies[enemies.length - 1].skills = assigned;
    }
  }
  return enemies;
}

/**
 * Encontra a melhor posição para se mover em direção ao alvo (BFS hexagonal).
 */
export function findMovePath(
  currentPos: number,
  targetPos: number,
  movement: number,
  occupiedPositions: Set<number>
): number {
  if (movement <= 0) return currentPos;

  let bestPos = currentPos;
  let minDistance = GameMath.getHexDistance(currentPos, targetPos);

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
}
