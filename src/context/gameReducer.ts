import { GameState, GameAction, HeroTask } from '../types';
import { BASE_TRAIN_TIME_MS } from '../constants/game';
import { getRecruitCost } from '../utils/math';
import { createHero } from '../utils/heroFactory';
import { MISSIONS } from '../constants/missions';
import { calcMissionReward } from '../utils/missionMath';
import { v4 as uuidv4 } from 'uuid';

/** Estado inicial quando não há save */
export const initialGameState: GameState = {
  gold: 20,
  heroes: [],
  heroesRecruited: 0,
  lastSavedAt: Date.now(),
  tickIntervalMs: 1000, // default, can be overridden by saved state
  trainInflationFactor: 0.1,
  activeMissions: [],
};

/** Reducer puro que contém toda a lógica do jogo */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'TICK': {
      const tickMs = state.tickIntervalMs ?? 1000;
      const inflation = state.trainInflationFactor ?? 0.1;
      let goldEarned = 0;

      const updatedHeroes = state.heroes.map((hero) => {
        // copy hero to modify
        let newHero = { ...hero };
        switch (hero.currentTask) {
          case HeroTask.TRAIN_HP: {
            const progress = (hero.trainingProgressMs?.hp ?? 0) + tickMs;
            let remaining = progress;
            let count = (hero.trainingCount?.hp ?? 0);
            let hp = hero.hp;
            let timePerPoint = BASE_TRAIN_TIME_MS * Math.pow(1 + inflation, count);
            while (remaining >= timePerPoint) {
              remaining -= timePerPoint;
              hp += 1;
              count += 1;
              timePerPoint = BASE_TRAIN_TIME_MS * Math.pow(1 + inflation, count);
            }
            newHero.hp = hp;
            newHero.trainingProgressMs = { ...(hero.trainingProgressMs ?? { hp: 0, atk: 0, mp: 0 }), hp: remaining };
            newHero.trainingCount = { ...(hero.trainingCount ?? { hp: 0, atk: 0, mp: 0 }), hp: count };
            return newHero;
          }

          case HeroTask.TRAIN_ATK: {
            const progress = (hero.trainingProgressMs?.atk ?? 0) + tickMs;
            let remaining = progress;
            let count = (hero.trainingCount?.atk ?? 0);
            let atk = hero.atk;
            let timePerPoint = BASE_TRAIN_TIME_MS * Math.pow(1 + inflation, count);
            while (remaining >= timePerPoint) {
              remaining -= timePerPoint;
              atk += 1;
              count += 1;
              timePerPoint = BASE_TRAIN_TIME_MS * Math.pow(1 + inflation, count);
            }
            newHero.atk = atk;
            newHero.trainingProgressMs = { ...(hero.trainingProgressMs ?? { hp: 0, atk: 0, mp: 0 }), atk: remaining };
            newHero.trainingCount = { ...(hero.trainingCount ?? { hp: 0, atk: 0, mp: 0 }), atk: count };
            return newHero;
          }

          case HeroTask.TRAIN_MP: {
            const progress = (hero.trainingProgressMs?.mp ?? 0) + tickMs;
            let remaining = progress;
            let count = (hero.trainingCount?.mp ?? 0);
            let mp = hero.mp;
            let timePerPoint = BASE_TRAIN_TIME_MS * Math.pow(1 + inflation, count);
            while (remaining >= timePerPoint) {
              remaining -= timePerPoint;
              mp += 1;
              count += 1;
              timePerPoint = BASE_TRAIN_TIME_MS * Math.pow(1 + inflation, count);
            }
            newHero.mp = mp;
            newHero.trainingProgressMs = { ...(hero.trainingProgressMs ?? { hp: 0, atk: 0, mp: 0 }), mp: remaining };
            newHero.trainingCount = { ...(hero.trainingCount ?? { hp: 0, atk: 0, mp: 0 }), mp: count };
            return newHero;
          }

          case HeroTask.MISSION:
            // heroes in missions do not generate per-tick gold anymore;
            // mission rewards are calculated on completion via activeMissions.
            return hero;

          default:
            return hero;
        }
      });

      // process active missions timers
      const active = (state.activeMissions || []).map((m) => ({ ...m }));
      const completed: { mission: typeof active[0]; reward: number }[] = [];
      active.forEach((m) => {
        m.remainingMs -= tickMs;
        if (m.remainingMs <= 0) {
          // compute reward
          const template = MISSIONS.find((t) => t.id === m.templateId);
          if (template) {
            const heroes = state.heroes.filter((h) => m.heroIds.includes(h.id));
            const reward = calcMissionReward(template, heroes);
            completed.push({ mission: m, reward });
          }
        }
      });
      // filter out completed missions
      const remainingMissions = active.filter((m) => m.remainingMs > 0);

      // release heroes from completed missions and add rewards
      let newHeroes = updatedHeroes.map((h) => ({ ...h }));
      completed.forEach((c) => {
        c.mission.heroIds.forEach((hid) => {
          const idx = newHeroes.findIndex((hh) => hh.id === hid);
          if (idx >= 0) {
            newHeroes[idx] = { ...newHeroes[idx], currentTask: HeroTask.IDLE };
          }
        });
      });

      const totalReward = completed.reduce((s, c) => s + c.reward, 0);

      return {
        ...state,
        heroes: newHeroes,
        gold: state.gold + goldEarned + totalReward,
        activeMissions: remainingMissions,
      };
    }

    case 'START_MISSION': {
      const template = MISSIONS.find((t) => t.id === action.templateId);
      if (!template) return state;
      if ((action.heroIds?.length ?? 0) < template.minHeroes) return state;
      // verify heroes exist and are free (not training and not in mission)
      const heroesMap = new Map(state.heroes.map((h) => [h.id, h]));
      for (const hid of action.heroIds) {
        const h = heroesMap.get(hid);
        if (!h) return state; // invalid hero
        if (h.currentTask === HeroTask.TRAIN_ATK || h.currentTask === HeroTask.TRAIN_HP || h.currentTask === HeroTask.TRAIN_MP || h.currentTask === HeroTask.MISSION) {
          return state; // hero busy
        }
      }
      // assign mission id
      const missionId = uuidv4();
      const newMission = {
        id: missionId,
        templateId: template.id,
        heroIds: action.heroIds,
        remainingMs: template.durationMs,
        startedAt: Date.now(),
      };
      // mark heroes as on mission
      const newHeroesState = state.heroes.map((h) =>
        action.heroIds.includes(h.id) ? { ...h, currentTask: HeroTask.MISSION } : h
      );

      return {
        ...state,
        heroes: newHeroesState,
        activeMissions: [...(state.activeMissions || []), newMission],
      };
    }

    case 'COMPLETE_MISSION': {
      // complete mission manually (rare) — release heroes and add reward
      const mission = (state.activeMissions || []).find((m) => m.id === action.missionId);
      if (!mission) return state;
      const newMissions = (state.activeMissions || []).filter((m) => m.id !== action.missionId);
      const newHeroesState = state.heroes.map((h) =>
        mission.heroIds.includes(h.id) ? { ...h, currentTask: HeroTask.IDLE } : h
      );
      return {
        ...state,
        heroes: newHeroesState,
        activeMissions: newMissions,
        gold: state.gold + action.reward,
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
    case 'SET_TICK_INTERVAL': {
      return {
        ...state,
        tickIntervalMs: action.ms,
      };
    }
    case 'SET_TRAIN_INFLATION': {
      return {
        ...state,
        trainInflationFactor: action.inflation,
      };
    }

    case 'LOAD_STATE': {
      return { ...action.state };
    }

    default:
      return state;
  }
}
