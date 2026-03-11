import { Hero, MissionAction, MissionActorType } from '../types';
import { MissionTemplate } from '../constants/missions';
import { 
  CRIT_MULTIPLIER,
  ENEMY_ROWS,
  GRID_COLUMNS 
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
            attackType: Math.random() < 0.5 ? 'MELEE' : 'RANGED',
            position: enemyPositions[posIdx++] ?? 0,
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
        });
      }
    }
    return enemies;
  },

  /**
   * Lógica de seleção de alvo.
   * MELEE: Prefere alvos com mais vida (tanking) ou aleatório.
   * RANGED: Prefere alvos com menos vida (sniping).
   */
  selectTarget<T extends { hp?: number; hpCurrent?: number }>(
    attackerType: 'MELEE' | 'RANGED',
    candidates: T[],
    rng: () => number
  ): T | undefined {
    if (!candidates || candidates.length === 0) return undefined;

    const hpOf = (c: T) => (typeof c.hp === 'number' ? c.hp : c.hpCurrent ?? 0);
    const sorted = [...candidates].sort((a, b) => hpOf(a) - hpOf(b));
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const roll = Math.floor(rng() * 100);

    const chooseAmongEquals = (value: number) => {
      const group = candidates.filter((x) => hpOf(x) === value);
      return group[Math.floor(rng() * group.length)];
    };

    if (attackerType === 'MELEE') {
      if (roll < 70) return chooseAmongEquals(hpOf(max));
      if (roll < 90) return chooseAmongEquals(hpOf(min));
      return candidates[Math.floor(rng() * candidates.length)];
    } else {
      if (roll < 60) return chooseAmongEquals(hpOf(min));
      if (roll < 90) return chooseAmongEquals(hpOf(max));
      return candidates[Math.floor(rng() * candidates.length)];
    }
  },

  /**
   * Calcula o resultado de um ataque.
   */
  calculateAttack(
    attacker: { id: string; name?: string; atk: number; crit?: number; classId?: string; attackType?: 'MELEE' | 'RANGED' },
    target: { id: string; name?: string; hp?: number; hpCurrent?: number; defense?: number; agility?: number },
    hitChance: number, // Este valor agora será tratado como a chance base de acerto
    actorType: MissionActorType,
    round: number,
    rng: () => number
  ): { action: MissionAction; dmg: number } | null {
    // Se hitChance for 1.0 (testes), ignoramos a agilidade para garantir o acerto se desejado,
    // mas o ideal é que o hitChance base já venha do GameMath.calcHitChance(attacker.atk)
    // Para manter o comportamento da Agilidade, subtraímos a evasão do hitChance fornecido.
    const evasion = (target.agility ?? 0) * 0.005;
    const effectiveHitChance = Math.max(0.1, hitChance - evasion);

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
