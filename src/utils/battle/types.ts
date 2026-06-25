import { Hero, MissionAction } from '../../types';

export type SynergyId =
  | 'LINHA_DE_FRENTE'
  | 'MURALHA_E_FLECHA'
  | 'BASTIAO'
  | 'CAOS_ARCANO'
  | 'EMBOSCADA'
  | 'ARTILHARIA';

export type BuffType =
  | 'atkMul'
  | 'critFlat'
  | 'rangeFlat'
  | 'defDebuffMul'
  | 'taunt'
  | 'dot'
  | 'shield'
  | 'defMul'
  | 'revive';

export interface Buff {
  source: string;
  type: BuffType;
  value: number;
  expiresAfterRound: number;
}

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
  skills?: import('../../constants/enemySkills').EnemySkillDef[];
  skillCooldowns?: Record<string, number>;
  skillOnceUsed?: Record<string, boolean>;
}

export interface SynergyHandlers {
  onBattleStart: (state: BattleState) => void;
  onHealApplied: (state: BattleState, healer: Hero, target: Hero, amount: number) => void;
  onHeroDamaged: (state: BattleState, hero: Hero, hpAfter: number) => void;
  onAttackResolved: (
    state: BattleState,
    attacker: Hero | BattleEnemy,
    target: Hero | BattleEnemy,
    dmg: number,
    distance: number
  ) => void;
  shouldIgnoreDefense: (state: BattleState, attacker: Hero | BattleEnemy) => boolean;
  modifyTargetScore: (
    state: BattleState,
    enemy: BattleEnemy,
    candidate: Hero,
    baseScore: number
  ) => number;
}

export interface BattleState {
  heroes: Hero[];
  enemies: BattleEnemy[];
  heroPositions: Record<string, number>;
  enemyPositions: Record<string, number>;
  lastAttacker: Record<string, string>;
  threats: Record<string, string>;
  log: string[];
  actions: MissionAction[];
  rounds: number;
  activeSynergies: SynergyId[];
  buffs: Record<string, Buff[]>;
  flags: Record<string, boolean | number>;
  handlers: SynergyHandlers;
  skillCooldowns: Record<string, number>;
  skillOnceUsed: Record<string, boolean>;
  rng: () => number;
}
