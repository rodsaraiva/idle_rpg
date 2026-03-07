import { Hero, MissionAction, MissionActorType } from '../types';
import { MissionTemplate } from '../constants/missions';
import { 
  CRIT_MULTIPLIER 
} from '../constants/game';
import { GameMath } from './gameMath';

export interface BattleEnemy {
  id: string;
  hp: number;
  maxHp: number;
  atk: number;
  mp: number;
  alive: boolean;
  attackType: 'MELEE' | 'RANGED';
}

export const BattleEngine = {
  /**
   * Cria os inimigos para a batalha baseado no template da missão.
   */
  createEnemies(template: MissionTemplate): BattleEnemy[] {
    const enemies: BattleEnemy[] = [];
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
            alive: true,
            attackType: Math.random() < 0.5 ? 'MELEE' : 'RANGED',
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
          alive: true,
          attackType: i % 2 === 0 ? 'MELEE' : 'RANGED',
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
    attacker: { id: string; name?: string; atk: number; classId?: string; attackType?: 'MELEE' | 'RANGED' },
    target: { id: string; name?: string; hp?: number; hpCurrent?: number },
    hitChance: number,
    actorType: MissionActorType,
    round: number,
    rng: () => number
  ): { action: MissionAction; dmg: number } | null {
    if (rng() > hitChance) {
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

    const critChance = GameMath.calcCritChance(attacker.classId);
    const isCrit = rng() < critChance;
    const dmg = Math.max(1, Math.floor(attacker.atk * (isCrit ? CRIT_MULTIPLIER : 1)));

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
