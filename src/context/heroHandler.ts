import { GameState, HeroTask, ClassId, Hero } from '../types';
import { getRecruitCost } from '../utils/math';
import { createHero } from '../utils/heroFactory';
import { CLASS_DEFS } from '../constants/classes';
import { isHeroInMission, isHeroInjured } from '../utils/heroUtils';
import { SHOP_ITEMS } from '../constants/shop';
import { updateDailyProgress } from './dailyQuestHandler';
import { KEY_CHEST_REWARDS, ChestTier } from '../constants/keyChests';
import { generateEquipment } from './equipmentHandler';

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

/**
 * Abre um baú consumindo 1 chave do tier indicado.
 * Concede materiais e/ou equipamento — NUNCA gold (invariante anti-P2W).
 * No-op se o jogador não tiver chave suficiente.
 */
export function handleOpenKeyChest(
  state: GameState,
  tier: ChestTier,
  rng: () => number = Math.random,
): GameState {
  const keys = state.keys ?? { bronze: 0, silver: 0, gold: 0 };
  if (keys[tier] <= 0) return state;

  const pool = KEY_CHEST_REWARDS[tier];
  const entry = pool[Math.floor(rng() * pool.length)];

  let next: GameState = {
    ...state,
    keys: { ...keys, [tier]: keys[tier] - 1 },
  };

  if (entry.kind === 'material') {
    const materials = { ...(next.materials ?? {}) };
    materials[entry.id] = (materials[entry.id] ?? 0) + entry.qty;
    next = { ...next, materials };
  } else if (entry.kind === 'equipment') {
    const equipment = generateEquipment(entry.tier, undefined, rng);
    next = {
      ...next,
      inventory: [...(next.inventory ?? []), equipment],
    };
  }

  return next;
}
