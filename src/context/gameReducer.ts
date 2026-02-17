import { GameState, GameAction, HeroTask } from '../types';
import {
  BASE_TRAIN_TIME_MS,
  TRAIN_INFLATION_FACTOR,
} from '../constants/game';
import { TICK_INTERVAL_MS } from '../constants/game';
import { getMissionGoldPerTick, getRecruitCost } from '../utils/math';
import { createHero } from '../utils/heroFactory';

/** Estado inicial quando não há save */
export const initialGameState: GameState = {
  gold: 20,
  heroes: [],
  heroesRecruited: 0,
  lastSavedAt: Date.now(),
};

/** Reducer puro que contém toda a lógica do jogo */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'TICK': {
      let goldEarned = 0;

      const updatedHeroes = state.heroes.map((hero) => {
        // copy hero to modify
        let newHero = { ...hero };
        switch (hero.currentTask) {
          case HeroTask.TRAIN_HP: {
            const progress = (hero.trainingProgressMs?.hp ?? 0) + (TICK_INTERVAL_MS ?? 1000);
            let remaining = progress;
            let count = (hero.trainingCount?.hp ?? 0);
            let hp = hero.hp;
            let timePerPoint = BASE_TRAIN_TIME_MS * Math.pow(1 + TRAIN_INFLATION_FACTOR, count);
            while (remaining >= timePerPoint) {
              remaining -= timePerPoint;
              hp += 1;
              count += 1;
              timePerPoint = BASE_TRAIN_TIME_MS * Math.pow(1 + TRAIN_INFLATION_FACTOR, count);
            }
            newHero.hp = hp;
            newHero.trainingProgressMs = { ...(hero.trainingProgressMs ?? { hp: 0, atk: 0, mp: 0 }), hp: remaining };
            newHero.trainingCount = { ...(hero.trainingCount ?? { hp: 0, atk: 0, mp: 0 }), hp: count };
            return newHero;
          }

          case HeroTask.TRAIN_ATK: {
            const progress = (hero.trainingProgressMs?.atk ?? 0) + (TICK_INTERVAL_MS ?? 1000);
            let remaining = progress;
            let count = (hero.trainingCount?.atk ?? 0);
            let atk = hero.atk;
            let timePerPoint = BASE_TRAIN_TIME_MS * Math.pow(1 + TRAIN_INFLATION_FACTOR, count);
            while (remaining >= timePerPoint) {
              remaining -= timePerPoint;
              atk += 1;
              count += 1;
              timePerPoint = BASE_TRAIN_TIME_MS * Math.pow(1 + TRAIN_INFLATION_FACTOR, count);
            }
            newHero.atk = atk;
            newHero.trainingProgressMs = { ...(hero.trainingProgressMs ?? { hp: 0, atk: 0, mp: 0 }), atk: remaining };
            newHero.trainingCount = { ...(hero.trainingCount ?? { hp: 0, atk: 0, mp: 0 }), atk: count };
            return newHero;
          }

          case HeroTask.TRAIN_MP: {
            const progress = (hero.trainingProgressMs?.mp ?? 0) + (TICK_INTERVAL_MS ?? 1000);
            let remaining = progress;
            let count = (hero.trainingCount?.mp ?? 0);
            let mp = hero.mp;
            let timePerPoint = BASE_TRAIN_TIME_MS * Math.pow(1 + TRAIN_INFLATION_FACTOR, count);
            while (remaining >= timePerPoint) {
              remaining -= timePerPoint;
              mp += 1;
              count += 1;
              timePerPoint = BASE_TRAIN_TIME_MS * Math.pow(1 + TRAIN_INFLATION_FACTOR, count);
            }
            newHero.mp = mp;
            newHero.trainingProgressMs = { ...(hero.trainingProgressMs ?? { hp: 0, atk: 0, mp: 0 }), mp: remaining };
            newHero.trainingCount = { ...(hero.trainingCount ?? { hp: 0, atk: 0, mp: 0 }), mp: count };
            return newHero;
          }

          case HeroTask.MISSION:
            goldEarned += getMissionGoldPerTick(hero.atk);
            return hero;

          default:
            return hero;
        }
      });

      return {
        ...state,
        heroes: updatedHeroes,
        gold: state.gold + goldEarned,
      };
    }

    case 'SET_HERO_TASK': {
      return {
        ...state,
        heroes: state.heroes.map((hero) =>
          hero.id === action.heroId
            ? { ...hero, currentTask: action.task }
            : hero
        ),
      };
    }

    case 'RECRUIT_HERO': {
      const cost = getRecruitCost(state.heroesRecruited);
      if (state.gold < cost) return state;

      const newHero = createHero();

      return {
        ...state,
        gold: state.gold - cost,
        heroes: [...state.heroes, newHero],
        heroesRecruited: state.heroesRecruited + 1,
      };
    }

    case 'LOAD_STATE': {
      return { ...action.state };
    }

    default:
      return state;
  }
}
