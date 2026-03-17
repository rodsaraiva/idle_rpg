import { v4 as uuidv4 } from 'uuid';
import { Hero, HeroTask, ClassId } from '../types';
import { HERO_NAMES, INITIAL_HERO_STATS } from '../constants/game';
import { CLASS_DEFS } from '../constants/classes';
import { PERSONALITY_LIST } from '../constants/personalities';
import { getGaussianVariance } from './math';

/** Cria um novo herói com stats iniciais e nome aleatório */
export function createHero(classId?: ClassId): Hero {
  const randomName = HERO_NAMES[Math.floor(Math.random() * HERO_NAMES.length)];
  const suffix = Math.floor(Math.random() * 99) + 1;
  const classDef = classId ? CLASS_DEFS[classId] : undefined;

  // Aplica variância Gaussiana de ±50% nos atributos base ANTES dos deltas de classe
  const hpBase = Math.floor(INITIAL_HERO_STATS.hp * getGaussianVariance());
  const atkBase = Math.floor(INITIAL_HERO_STATS.atk * getGaussianVariance());
  const mpBase = Math.floor(INITIAL_HERO_STATS.mp * getGaussianVariance());
  const defBase = Math.floor(INITIAL_HERO_STATS.defense * getGaussianVariance());
  const critBase = Math.floor(INITIAL_HERO_STATS.crit * getGaussianVariance());
  const agiBase = Math.floor(INITIAL_HERO_STATS.agility * getGaussianVariance());

  const hp = hpBase + (classDef?.baseStatDelta?.hp ?? 0);
  const atk = atkBase + (classDef?.baseStatDelta?.atk ?? 0);
  const mp = mpBase + (classDef?.baseStatDelta?.mp ?? 0);
  const defense = defBase + (classDef?.baseStatDelta?.defense ?? 0);
  const crit = critBase + (classDef?.baseStatDelta?.crit ?? 0);
  const agility = agiBase + (classDef?.baseStatDelta?.agility ?? 0);

  const personality = PERSONALITY_LIST[Math.floor(Math.random() * PERSONALITY_LIST.length)].id;

  return {
    id: uuidv4(),
    name: `${randomName} #${suffix}`,
    hpMax: hp,
    hpCurrent: hp,
    atk,
    mp,
    defense,
    crit,
    agility,
    currentTask: HeroTask.IDLE,
    classId,
    personality,
    attackType: classDef?.attackType ?? 'MELEE',
    range: classDef?.range ?? 1,
    // training progress in milliseconds and counts for inflation
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    trainingCount: { hp: 0, atk: 0, mp: 0 },
  };
}
