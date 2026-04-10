import { GameState, HeroTask, ClassId, Hero } from '../types';
import { getRecruitCost } from '../utils/math';
import { createHero } from '../utils/heroFactory';
import { CLASS_DEFS } from '../constants/classes';
import { isHeroInMission, isHeroInjured } from '../utils/heroUtils';
import { SHOP_ITEMS } from '../constants/shop';
import { updateDailyProgress } from './dailyQuestHandler';

export function handleRecruitHero(state: GameState): GameState {
  const cost = getRecruitCost(state.heroesRecruited);
  if (state.gold < cost) return state;

  const classKeys = Object.keys(CLASS_DEFS) as ClassId[];
  const randClass = classKeys[Math.floor(Math.random() * classKeys.length)];
  const newHero = createHero(randClass);

  const newState = {
    ...state,
    gold: state.gold - cost,
    heroes: [...state.heroes, newHero],
    heroesRecruited: state.heroesRecruited + 1,
  };
  return updateDailyProgress(newState, 'heroesRecruited', 1);
}

export function handleBuyChest(state: GameState, chestId: string): GameState {
  const chest = SHOP_ITEMS.find((item) => item.id === chestId);
  if (!chest) return state;

  const cost = getRecruitCost(state.heroesRecruited) * chest.costMultiplier;
  if (state.gold < cost) return state;

  return {
    ...state,
    gold: state.gold - cost,
  };
}

export function handleConfirmChestReveal(state: GameState, hero: Hero): GameState {
  return {
    ...state,
    heroes: [...state.heroes, hero],
    heroesRecruited: state.heroesRecruited + 1,
  };
}

export function handleStartInfirmary(state: GameState, heroIds: string[]): GameState {
  const heroesMap = new Map(state.heroes.map((h) => [h.id, h]));
  const validHeroIds = heroIds.filter((id) => {
    const h = heroesMap.get(id);
    return !!h && !isHeroInMission(h) && isHeroInjured(h);
  });

  if (validHeroIds.length === 0) return state;

  return {
    ...state,
    heroes: state.heroes.map((h) =>
      validHeroIds.includes(h.id) ? { ...h, currentTask: HeroTask.INFIRMARY } : h
    ),
  };
}

export function handleReleaseFromInfirmary(state: GameState, heroIds: string[]): GameState {
  const validHeroIds = heroIds || [];
  return {
    ...state,
    heroes: state.heroes.map((h) =>
      validHeroIds.includes(h.id) ? { ...h, currentTask: HeroTask.IDLE } : h
    ),
  };
}

export function handleSetHeroTask(state: GameState, heroId: string, task: HeroTask): GameState {
  const target = state.heroes.find((h) => h.id === heroId);
  if (!target || isHeroInMission(target)) return state;

  return {
    ...state,
    heroes: state.heroes.map((hero) =>
      hero.id === heroId ? { ...hero, currentTask: task } : hero
    ),
  };
}
