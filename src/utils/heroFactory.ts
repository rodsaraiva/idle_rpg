import { v4 as uuidv4 } from 'uuid';
import { Hero, HeroTask, ClassId } from '../types';
import { HERO_NAMES, INITIAL_HERO_STATS } from '../constants/game';
import { CLASS_DEFS } from '../constants/classes';
import { PERSONALITY_LIST } from '../constants/personalities';

/** Cria um novo herói com stats iniciais e nome aleatório */
export function createHero(classId?: ClassId): Hero {
  const randomName = HERO_NAMES[Math.floor(Math.random() * HERO_NAMES.length)];
  const suffix = Math.floor(Math.random() * 99) + 1;
  const classDef = classId ? CLASS_DEFS[classId] : undefined;
  const hp = INITIAL_HERO_STATS.hp + (classDef?.baseStatDelta?.hp ?? 0);
  const atk = INITIAL_HERO_STATS.atk + (classDef?.baseStatDelta?.atk ?? 0);
  const mp = INITIAL_HERO_STATS.mp + (classDef?.baseStatDelta?.mp ?? 0);
  const defense = INITIAL_HERO_STATS.defense + (classDef?.baseStatDelta?.defense ?? 0);
  const crit = INITIAL_HERO_STATS.crit + (classDef?.baseStatDelta?.crit ?? 0);
  const agility = INITIAL_HERO_STATS.agility + (classDef?.baseStatDelta?.agility ?? 0);

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
