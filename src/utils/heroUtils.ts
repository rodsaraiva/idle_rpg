import { Hero, HeroTask } from '../types';
import { INCAPACITATED_HP_THRESHOLD } from '../constants/game';

/** HP is below the incapacitation threshold (< 3). */
export function isHeroIncapacitated(hero: Hero): boolean {
  return hero.hpCurrent < INCAPACITATED_HP_THRESHOLD;
}

/** Hero is currently on a mission. */
export function isHeroInMission(hero: Hero): boolean {
  return hero.currentTask === HeroTask.MISSION;
}

/** Hero is not on a mission and not incapacitated — can be sent on a new mission. */
export function isHeroAvailableForMission(hero: Hero): boolean {
  return !isHeroInMission(hero) && !isHeroIncapacitated(hero);
}

/** Hero's current HP is below max — eligible for infirmary healing. */
export function isHeroInjured(hero: Hero): boolean {
  return hero.hpCurrent < hero.hpMax;
}
