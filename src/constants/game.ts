/** Intervalo do game loop em milissegundos */
export const TICK_INTERVAL_MS = 1000;

/** Intervalo de auto-save em milissegundos */
export const AUTO_SAVE_INTERVAL_MS = 5000;

/** Tempo base (ms) por ponto treinado (5s) */
export const BASE_TRAIN_TIME_MS = 5000;

/** Fator de inflação por ponto (10% = 0.1) */
export const TRAIN_INFLATION_FACTOR = 0.1;

/** (compat) Ganho por tick - mantido para compatibilidade de testes antigos (equiv. a 1 ponto por 1s) */
export const HP_TRAIN_PER_TICK = 1;
export const ATK_TRAIN_PER_TICK = 1;
/** Ganho de MP por segundo ao treinar MP */
export const MP_TRAIN_PER_TICK = 0.3;

/** Multiplicador base de ouro por ponto de ATK em missão */
export const GOLD_PER_ATK = 0.3;

/** Ouro base ganho por tick em missão (antes do bônus de ATK) */
export const MISSION_BASE_GOLD = 1;

/** Custo base para recrutar o primeiro herói */
export const RECRUIT_BASE_COST = 10;

/** Fator de inflação para cada herói recrutado */
export const RECRUIT_COST_MULTIPLIER = 1.5;

/** Stats iniciais de um herói recém-recrutado */
export const INITIAL_HERO_STATS = {
  hp: 10,
  atk: 5,
  mp: 3,
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
