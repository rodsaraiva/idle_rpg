import { v4 as uuidv4 } from 'uuid';
import { Hero, HeroTask } from '../types';
import { HERO_NAMES, INITIAL_HERO_STATS } from '../constants/game';

/** Cria um novo herói com stats iniciais e nome aleatório */
export function createHero(): Hero {
  const randomName = HERO_NAMES[Math.floor(Math.random() * HERO_NAMES.length)];
  const suffix = Math.floor(Math.random() * 99) + 1;

  return {
    id: uuidv4(),
    name: `${randomName} #${suffix}`,
    hp: INITIAL_HERO_STATS.hp,
    atk: INITIAL_HERO_STATS.atk,
    mp: INITIAL_HERO_STATS.mp,
    currentTask: HeroTask.IDLE,
  };
}
