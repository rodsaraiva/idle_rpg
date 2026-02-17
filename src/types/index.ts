/** Possíveis tarefas que um herói pode estar executando */
export enum HeroTask {
  IDLE = 'IDLE',
  TRAIN_HP = 'TRAIN_HP',
  TRAIN_ATK = 'TRAIN_ATK',
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
}

/** Estado global do jogo */
export interface GameState {
  gold: number;
  heroes: Hero[];
  heroesRecruited: number;
  lastSavedAt: number;
}

/** Ação disparada para alterar o estado do jogo */
export type GameAction =
  | { type: 'TICK' }
  | { type: 'SET_HERO_TASK'; heroId: string; task: HeroTask }
  | { type: 'RECRUIT_HERO' }
  | { type: 'LOAD_STATE'; state: GameState };
