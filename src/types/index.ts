/** Possíveis tarefas que um herói pode estar executando */
export enum HeroTask {
  IDLE = 'IDLE',
  TRAIN_HP = 'TRAIN_HP',
  TRAIN_ATK = 'TRAIN_ATK',
  TRAIN_MP = 'TRAIN_MP',
  MISSION = 'MISSION',
}

/** Representação de um herói da guilda */
export interface Hero {
  id: string;
  name: string;
  hp: number;
  atk: number;
  mp: number;
  currentTask: HeroTask;
  trainingProgressMs?: TrainingProgress;
  trainingCount?: TrainingCount;
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
}

/** Ação disparada para alterar o estado do jogo */
export type GameAction =
  | { type: 'TICK' }
  | { type: 'SET_HERO_TASK'; heroId: string; task: HeroTask }
  | { type: 'RECRUIT_HERO' }
  | { type: 'SET_TICK_INTERVAL'; ms: number }
  | { type: 'SET_TRAIN_INFLATION'; inflation: number }
  | { type: 'START_MISSION'; templateId: string; heroIds: string[] }
  | { type: 'COMPLETE_MISSION'; missionId: string; reward: number }
  | { type: 'LOAD_STATE'; state: GameState };

export interface ActiveMission {
  id: string;
  templateId: string;
  heroIds: string[];
  remainingMs: number;
  startedAt: number;
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
  hpBefore: number;
  hpAfter: number;
  atkBefore: number;
  atkAfter: number;
  mpBefore: number;
  mpAfter: number;
}

export interface OfflineSummaryFull extends OfflineSummary {
  perHeroChanges: PerHeroChange[];
  previousState?: GameState;
  newState?: GameState;
}
