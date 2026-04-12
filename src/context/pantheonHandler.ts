import { GameState, Hero, HeroTask } from '../types';
import { CLASS_DEFS } from '../constants/classes';
import { emitFirstFusion, emitFusionResult } from '../services/milestones';
import { PERSONALITY_LIST } from '../constants/personalities';
import { ClassId } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Calculate pantheon bonuses based on heroes with stars.
 */
export function calculatePantheonBonuses(heroes: Hero[]): { goldPercent: number; atkPercent: number; hpPercent: number } {
  const starredHeroes = heroes.filter(h => (h.stars ?? 0) > 0);
  const starredCount = starredHeroes.length;
  const has3Stars = starredHeroes.some(h => (h.stars ?? 0) >= 3);

  let goldPercent = 0;
  let atkPercent = 0;
  let hpPercent = 0;

  if (starredCount >= 1) goldPercent += 3;
  if (starredCount >= 3) goldPercent += 5;
  if (has3Stars) atkPercent += 3;
  if (starredCount >= 5) hpPercent += 5;

  return { goldPercent, atkPercent, hpPercent };
}

/**
 * Create a fused hero from 3 source heroes.
 */
export function createFusedHero(sourceHeroes: [Hero, Hero, Hero]): Hero {
  const classIds = sourceHeroes.map(h => h.classId).filter(Boolean) as ClassId[];
  const randomIdx = Math.floor(Math.random() * classIds.length);
  const resultClassId = classIds[randomIdx] ?? 'WARRIOR';

  const classDef = CLASS_DEFS[resultClassId];
  const baseHp = 50 + (classDef.baseStatDelta?.hp ?? 0);
  const baseAtk = 10 + (classDef.baseStatDelta?.atk ?? 0);
  const baseMp = 5 + (classDef.baseStatDelta?.mp ?? 0);
  const baseDef = 5 + (classDef.baseStatDelta?.defense ?? 0);
  const baseCrit = 10 + (classDef.baseStatDelta?.crit ?? 0);
  const baseAgi = 5 + (classDef.baseStatDelta?.agility ?? 0);

  const totalTraining = sourceHeroes.reduce(
    (acc, h) => ({
      hp: acc.hp + (h.trainingCount?.hp ?? 0),
      atk: acc.atk + (h.trainingCount?.atk ?? 0),
      mp: acc.mp + (h.trainingCount?.mp ?? 0),
    }),
    { hp: 0, atk: 0, mp: 0 }
  );
  const fusionBonus = {
    hp: Math.floor(totalTraining.hp * 0.1),
    atk: Math.floor(totalTraining.atk * 0.1),
    mp: Math.floor(totalTraining.mp * 0.1),
  };

  const maxStars = Math.max(...sourceHeroes.map(h => h.stars ?? 0));
  const stars = maxStars + 1;
  const starMul = 1 + stars * 0.05;

  const hp = Math.floor((baseHp + fusionBonus.hp) * starMul);
  const atk = Math.floor((baseAtk + fusionBonus.atk) * starMul);
  const mp = Math.floor((baseMp + fusionBonus.mp) * starMul);
  const defense = Math.floor(baseDef * starMul);
  const crit = Math.floor(baseCrit * starMul);
  const agility = Math.floor(baseAgi * starMul);

  const personality = PERSONALITY_LIST[Math.floor(Math.random() * PERSONALITY_LIST.length)].id;

  const names = ['Fenix', 'Ascendido', 'Renascido', 'Forjado', 'Primordial', 'Eterno', 'Lendário'];
  const suffixes = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const name = `${names[Math.floor(Math.random() * names.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;

  return {
    id: uuidv4(),
    name,
    hpMax: hp,
    hpCurrent: hp,
    atk,
    mp,
    defense,
    crit,
    agility,
    currentTask: HeroTask.IDLE,
    classId: resultClassId,
    personality,
    attackType: classDef.attackType,
    range: classDef.range,
    movement: 2,
    stars,
    fusionBonus,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  };
}

/**
 * Handle FUSE_HEROES action. Validates, creates fused hero, updates state.
 */
export function handleFuseHeroes(state: GameState, heroIds: [string, string, string]): GameState {
  const sourceHeroes = heroIds.map(id => state.heroes.find(h => h.id === id)).filter(Boolean) as Hero[];
  if (sourceHeroes.length !== 3) return state;

  if (sourceHeroes.some(h => h.currentTask !== HeroTask.IDLE)) return state;

  const fusedHero = createFusedHero(sourceHeroes as [Hero, Hero, Hero]);

  if ((state.pantheonFusions ?? 0) === 0) {
    emitFirstFusion();
  }
  emitFusionResult(fusedHero.name, fusedHero.stars ?? 1);

  const remainingHeroes = state.heroes.filter(h => !heroIds.includes(h.id));

  const newState = {
    ...state,
    heroes: [...remainingHeroes, fusedHero],
    pantheonFusions: (state.pantheonFusions ?? 0) + 1,
  };

  newState.pantheonBonuses = calculatePantheonBonuses(newState.heroes);

  return newState;
}
