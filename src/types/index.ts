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
  // optional avatar image URL for UI
  avatarUrl?: string;
  // attack style for targeting behavior
  attackType?: 'MELEE' | 'RANGED';
  trainingProgressMs?: TrainingProgress;
  trainingCount?: TrainingCount;
  // if set, hero is incapacitated until this timestamp (ms since epoch)
  incapacitatedUntilMs?: number;
  // accumulated ms toward next HP regen
  hpRegenProgressMs?: number;
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
  // active missions currently running
  activeMissions?: ActiveMission[];
  // total gold earned per hero (accumulated from mission shares)
  perHeroGold?: Record<string, number>;
  // recent mission results to show in UI
  recentMissionResults?: MissionResult[];
}

/** Ação disparada para alterar o estado do jogo */
export type GameAction =
  | { type: 'TICK' }
  | { type: 'START_INFERMARIA'; heroIds: string[] }
  | { type: 'RELEASE_FROM_INFERMARIA'; heroIds: string[] }
  | { type: 'SET_HERO_TASK'; heroId: string; task: HeroTask }
  | { type: 'RECRUIT_HERO' }
  | { type: 'BUY_CHEST'; chestId: string }
  | { type: 'CONFIRM_CHEST_REVEAL'; hero: Hero }
  | { type: 'SET_TICK_INTERVAL'; ms: number }
  | { type: 'SET_TRAIN_INFLATION'; inflation: number }
  | { type: 'START_MISSION'; templateId: string; heroIds: string[] }
  | { type: 'COMPLETE_MISSION'; missionId: string; reward: number }
  | { type: 'DISMISS_MISSION_RESULT'; missionId: string }
  | { type: 'LOAD_STATE'; state: GameState };

export type MissionActorType = 'hero' | 'enemy';
export type MissionActionType = 'hit' | 'miss' | 'heal' | 'defeat' | 'victory';

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
}

export interface ActiveMission {
  id: string;
  templateId: string;
  heroIds: string[];
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
    attackType?: 'MELEE' | 'RANGED' 
  }[];
  // precomputed reward/summary to avoid recomputing on completion
  precomputedOutcome?: MissionOutcome;
}

export interface MissionOutcome {
  reward: number;
  rounds: number;
  actions: MissionAction[];
  log: string[];
  success: boolean;
  casualties: { heroId: string; hpLost: number; hpAfter: number; incapacitatedUntilMs?: number }[];
  enemyCasualties: number;
}

export interface MissionResult extends MissionOutcome {
  missionId: string;
  templateId: string;
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
