import { GameState, GameAction, HeroTask } from '../types';
import { HP_TRAIN_PER_TICK, ATK_TRAIN_PER_TICK, MP_TRAIN_PER_TICK } from '../constants/game';
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
        switch (hero.currentTask) {
          case HeroTask.TRAIN_HP:
            return { ...hero, hp: hero.hp + HP_TRAIN_PER_TICK };

          case HeroTask.TRAIN_ATK:
            return { ...hero, atk: hero.atk + ATK_TRAIN_PER_TICK };

          case HeroTask.TRAIN_MP:
            return { ...hero, mp: hero.mp + MP_TRAIN_PER_TICK };

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
