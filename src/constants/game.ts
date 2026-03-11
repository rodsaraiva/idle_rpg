/** Intervalo do game loop em milissegundos */
export const TICK_INTERVAL_MS = 500;

/** Intervalo de auto-save em milissegundos */
export const AUTO_SAVE_INTERVAL_MS = 5000;

/** Tempo base (ms) por ponto treinado (30s) */
export const BASE_TRAIN_TIME_MS = 10000;

/** Fator de inflação por ponto (10% = 0.1) */
export const TRAIN_INFLATION_FACTOR = 0.1;

/** HP regen: amount and interval */
export const HP_REGEN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
export const HP_REGEN_AMOUNT = 1;

/** Enfermaria (infirmary) regeneration multipliers */
export const ENFERMARIA_MULTIPLIER_BASE = 2; // base x2 regen
export const ENFERMARIA_HEALER_MP_K = 0.02; // per MP of healers add 2% to multiplier
/** Enfermaria time scale: how much faster regen time runs in infirmary (2 = 2x faster) */
export const ENFERMARIA_TIME_SCALE = 2;
/** Max allowed infirmary time scale (safety cap) */
export const ENFERMARIA_MAX_SCALE = 6;

/** (compat) Ganho por tick - mantido para compatibilidade de testes antigos (equiv. a 1 ponto por 1s) */
export const HP_TRAIN_PER_TICK = 1;
export const ATK_TRAIN_PER_TICK = 1;
/** Ganho de MP por segundo ao treinar MP */
export const MP_TRAIN_PER_TICK = 0.3;

/** Battle related constants */
export const MAX_BATTLE_ROUNDS = 12;
export const CRIT_BASE_CHANCE = 0.05;
export const CRIT_MULTIPLIER = 1.5;
export const BASE_HIT_CHANCE = 0.75;
export const HIT_CHANCE_PER_ATK = 0.02;
export const ENEMY_HIT_CHANCE = 0.8;
export const TANK_MITIGATION_PER_HERO = 0.15;
export const TANK_MITIGATION_CAP = 0.5;
export const INCAPACITATED_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/** Mission related constants */
export const MISSION_START_DELAY_MS = 2000;
export const MISSION_ACTION_INTERVAL_MS = 1800;
export const MISSION_FINISH_DELAY_MS = 2000;

/** Grid constants for mission positioning */
export const GRID_COLUMNS = 5;
export const GRID_ROWS = 10;
export const TOTAL_GRID_SLOTS = GRID_COLUMNS * GRID_ROWS;
export const ENEMY_ROWS = [0, 1, 2];
export const HERO_ROWS = [7, 8, 9];

export const HEALER_BUFF_PER_HERO = 0.1;
export const HEALER_BUFF_CAP = 0.3;
export const ROGUE_RNG_BONUS_PER_HERO = 0.02;
export const ROGUE_RNG_BONUS_CAP = 0.08;

/** Multiplicador base de ouro por ponto de ATK em missão */
export const GOLD_PER_ATK = 0.3;

/** Ouro base ganho por tick em missão (antes do bônus de ATK) */
export const MISSION_BASE_GOLD = 1;

/** Reward calculation constants */
export const REWARD_REF_STAT_SUM = 250;
export const REWARD_CURVE_EXPONENT = 2;
export const TEAM_SYNERGY_COEFFICIENT = 0.05;
export const MIN_TEAM_SCALE_MULTIPLIER = 0.1;
export const TEAM_SIZE_SCALE_IMPACT = 0.1;

/** Custo base para recrutar o primeiro herói */
export const RECRUIT_BASE_COST = 10;

/** Offline progress constants */
export const MAX_OFFLINE_MS = 1000 * 60 * 60 * 24 * 3; // 72h

/** Fator de inflação para cada herói recrutado */
export const RECRUIT_COST_MULTIPLIER = 1.5;

/** UI related constants */
export const BATTLE_HIGHLIGHT_DURATION_MS = 800;
export const FEEDBACK_GOLD_COLOR = '#ffd34d';
export const FEEDBACK_HP_GAIN_COLOR = '#7ed957';
export const FEEDBACK_HP_LOSS_COLOR = '#ff7a7a';
export const FEEDBACK_ATK_GAIN_COLOR = '#ff8a65';
export const FEEDBACK_MP_GAIN_COLOR = '#66b2ff';

/** Stats iniciais de um herói recém-recrutado */
export const INITIAL_HERO_STATS = {
  hp: 10,
  atk: 5,
  mp: 3,
  defense: 5,
  crit: 5,
  agility: 10,
};

/** Nomes aleatórios para heróis */
export const HERO_NAMES = [
  'Aldric', 'Brenna', 'Cedric', 'Daria', 'Elric',
  'Fiona', 'Gareth', 'Helena', 'Igor', 'Jasmine',
  'Kael', 'Luna', 'Magnus', 'Nyx', 'Orion',
  'Petra', 'Quinn', 'Rowan', 'Selene', 'Theron',
  'Ursa', 'Valen', 'Wren', 'Xander', 'Yara',
  'Zephyr', 'Astrid', 'Bjorn', 'Cleo', 'Dorian',
  'Elowen', 'Fenris', 'Gwen', 'Hector', 'Isolde',
  'Jareth', 'Kira', 'Leander', 'Mira', 'Nolan',
];
