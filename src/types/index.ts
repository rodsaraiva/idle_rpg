/** Possíveis tarefas que um herói pode estar executando */
export enum HeroTask {
  IDLE = 'IDLE',
  TRAIN_HP = 'TRAIN_HP',
  TRAIN_ATK = 'TRAIN_ATK',
  TRAIN_MP = 'TRAIN_MP',
  INFIRMARY = 'INFIRMARY',
  MISSION = 'MISSION',
}

export type ClassId = 'WARRIOR' | 'TANK' | 'ROGUE' | 'ARCHER' | 'MAGE' | 'HEALER';

export interface Equipment {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'accessory';
  statBonus: { hp?: number; atk?: number; mp?: number; defense?: number; crit?: number; agility?: number };
  tier: number; // 1-3
}

export type PersonalityId = 'AGGRESSIVE' | 'PROTECTOR' | 'CAUTIOUS' | 'VENGEFUL' | 'OPPORTUNIST';

/** Representação de um herói da guilda */
export interface Hero {
  id: string;
  name: string;
  hpMax: number;
  hpCurrent: number;
  atk: number;
  mp: number;
  defense: number;
  crit: number; // Percentual base ou flat valor convertido para % no combate
  agility: number; // Agilidade, pode influenciar em esquiva
  currentTask: HeroTask;
  classId?: ClassId;
  personality?: PersonalityId;
  // optional avatar image URL for UI
  avatarUrl?: string;
  equippedItems?: string[]; // equipment IDs
  // attack style for targeting behavior
  attackType?: 'MELEE' | 'RANGED';
  range?: number; // Distance in hex grid
  movement?: number; // Cells per round
  trainingProgressMs?: TrainingProgress;
  trainingCount?: TrainingCount;
  hpRegenProgressMs?: number;
  stars?: number;                     // 0 = normal, 1+ = fusionado
  fusionBonus?: { hp: number; atk: number; mp: number };
}
 
export interface TrainingProgress {
  hp: number; // ms
  atk: number;
  mp: number;
}

export interface TrainingCount {
  hp: number; // points gained via training
  atk: number;
  mp: number;
}

/** Estado global do jogo */
export interface GameState {
  gold: number;
  heroes: Hero[];
  heroesRecruited: number;
  lastSavedAt: number;
  // runtime-configurable pacing and inflation (for experiments)
  tickIntervalMs?: number;
  trainInflationFactor?: number;
  // equipment inventory and forging
  inventory?: Equipment[];
  forgingQueue?: { equipmentId: string; finishAt: number }[];
  // active missions currently running
  activeMissions?: ActiveMission[];
  // total gold earned per hero (accumulated from mission shares)
  perHeroGold?: Record<string, number>;
  // recent mission results to show in UI
  recentMissionResults?: MissionResult[];
  // achievements system
  unlockedAchievements?: string[]; // achievement IDs
  completedMissionCount?: number; // total missions completed (for achievement tracking)
  completedMissionIds?: string[]; // unique template IDs completed at least once
  permanentBonuses?: { atk: number; hp: number }; // from achievements
  // daily quests system
  dailyQuests?: {
    seed: number; // date-based seed to determine which quests are active
    quests: { id: string; claimed: boolean }[];
    progress: Record<string, number>; // tracker -> current value
    allClaimed: boolean;
  };
  // pantheon / fusion system
  pantheonFusions?: number;
  pantheonBonuses?: { goldPercent: number; atkPercent: number; hpPercent: number };
  // weekly cycle
  weeklyState?: {
    seed: number;
    quests: { id: string; claimed: boolean }[];
    progress: Record<string, number>;
    allClaimed: boolean;
    bossDefeated: boolean;
  };
}

/** Ação disparada para alterar o estado do jogo */
export type GameAction =
  | { type: 'TICK'; now: number }
  | { type: 'START_INFERMARIA'; heroIds: string[] }
  | { type: 'RELEASE_FROM_INFERMARIA'; heroIds: string[] }
  | { type: 'SET_HERO_TASK'; heroId: string; task: HeroTask }
  | { type: 'RECRUIT_HERO' }
  | { type: 'BUY_CHEST'; chestId: string }
  | { type: 'CONFIRM_CHEST_REVEAL'; hero: Hero }
  | { type: 'SET_TICK_INTERVAL'; ms: number }
  | { type: 'SET_TRAIN_INFLATION'; inflation: number }
  | { type: 'START_MISSION'; templateId: string; heroIds: string[]; heroPositions?: Record<string, number>; now: number; looping?: boolean }
  | { type: 'COMPLETE_MISSION'; missionId: string; reward: number }
  | { type: 'DISMISS_MISSION_RESULT'; missionId: string }
  | { type: 'FORGE_EQUIPMENT'; tier: number; now: number }
  | { type: 'COLLECT_EQUIPMENT'; equipmentId: string }
  | { type: 'EQUIP_ITEM'; heroId: string; equipmentId: string }
  | { type: 'UNEQUIP_ITEM'; heroId: string; equipmentId: string }
  | { type: 'CLAIM_DAILY_QUEST'; questId: string }
  | { type: 'FUSE_HEROES'; heroIds: [string, string, string] }
  | { type: 'CLAIM_WEEKLY_QUEST'; questId: string }
  | { type: 'LOAD_STATE'; state: GameState };

export type MissionActorType = 'hero' | 'enemy';
export type MissionActionType = 'hit' | 'miss' | 'heal' | 'defeat' | 'victory' | 'move';

export interface MissionAction {
  round?: number;
  actorType: MissionActorType;
  actionType: MissionActionType;
  actorId: string;
  actorName?: string;
  targetId?: string;
  amount?: number;
  isCrit?: boolean;
  text: string;
  fromPosition?: number;
  toPosition?: number;
}

export interface ActiveMission {
  id: string;
  templateId: string;
  heroIds: string[];
  heroPositions?: Record<string, number>; // Mapping from heroId to grid index (0-49)
  remainingMs?: number;
  startedAt: number;
  finishAt?: number;
  // modifiers computed at mission start
  healerBuffMultiplier?: number;
  rogueRngBonus?: number;
  // scheduled actions for live playback
  scheduledActions?: { atMsFromStart: number; action: MissionAction; applied?: boolean }[];
  // track mission enemies state for visualization (hp, id)
  enemiesState?: { 
    id: string; 
    hp: number; 
    maxHp?: number; 
    atk: number; 
    mp: number; 
    defense?: number;
    crit?: number;
    agility?: number;
    alive?: boolean; 
    attackType?: 'MELEE' | 'RANGED';
    position?: number; // Grid index (0-14 for enemies)
  }[];
  // active class synergy names for UI display
  activeSynergies?: string[];
  // precomputed reward/summary to avoid recomputing on completion
  precomputedOutcome?: MissionOutcome;
  // whether this mission auto-repeats on completion
  looping?: boolean;
}

export interface MissionOutcome {
  reward: number;
  rounds: number;
  actions: MissionAction[];
  log: string[];
  success: boolean;
  casualties: { heroId: string; hpLost: number; hpAfter: number }[];
  enemyCasualties: number;
}

export interface MissionResult extends MissionOutcome {
  missionId: string;
  templateId: string;
  totalEnemies?: number;
  activeSynergies?: string[];
}

/** Resumo do progresso offline aplicado ao carregar o save */ 
export interface OfflineSummary {
  ticks: number;
  goldGained: number;
  heroesAffected: number;
  cappedHours: number; // horas de cap aplicadas (se houver)
}

export interface PerHeroChange {
  id: string;
  name: string;
  hpMaxBefore: number;
  hpMaxAfter: number;
  hpCurrentBefore: number;
  hpCurrentAfter: number;
  atkBefore: number;
  atkAfter: number;
  mpBefore: number;
  mpAfter: number;
  // A princípio, defense/crit/agility não mudam via treinamento base, mas adicionamos para consistência se no futuro mudarem.
  defenseBefore?: number;
  defenseAfter?: number;
  critBefore?: number;
  critAfter?: number;
  agilityBefore?: number;
  agilityAfter?: number;
}

export interface OfflineSummaryFull extends OfflineSummary {
  perHeroChanges: PerHeroChange[];
  previousState?: GameState;
  newState?: GameState;
}
