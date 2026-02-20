import { GameState, GameAction, HeroTask, ClassId } from '../types';
import { BASE_TRAIN_TIME_MS, HP_REGEN_INTERVAL_MS, HP_REGEN_AMOUNT, ENFERMARIA_MULTIPLIER_BASE, ENFERMARIA_HEALER_MP_K } from '../constants/game';
import { getRecruitCost } from '../utils/math';
import { createHero } from '../utils/heroFactory';
import { CLASS_DEFS } from '../constants/classes';
import { MISSIONS } from '../constants/missions';
import { calcMissionReward } from '../utils/missionMath';
import { computeBattleOutcome } from '../utils/battleSim';
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
            let hpMax = hero.hpMax;
            const classSpeedHp = hero.classId ? (CLASS_DEFS[hero.classId]?.trainSpeed?.hp ?? 1) : 1;
            let timePerPoint = (BASE_TRAIN_TIME_MS * Math.pow(1 + inflation, count)) / classSpeedHp;
            while (remaining >= timePerPoint) {
              remaining -= timePerPoint;
              hpMax += 1;
              count += 1;
              timePerPoint = (BASE_TRAIN_TIME_MS * Math.pow(1 + inflation, count)) / classSpeedHp;
            }
            const oldHpMax = hero.hpMax ?? 0;
            const pointsGained = hpMax - oldHpMax;
            newHero.hpMax = hpMax;
            // increase hpCurrent by the same gained points (keeps hero full if was full)
            const prevCurrent = newHero.hpCurrent ?? oldHpMax;
            if (pointsGained > 0) {
              newHero.hpCurrent = Math.min(hpMax, prevCurrent + pointsGained);
            } else {
              newHero.hpCurrent = Math.min(prevCurrent, hpMax);
            }
            newHero.trainingProgressMs = { ...(hero.trainingProgressMs ?? { hp: 0, atk: 0, mp: 0 }), hp: remaining };
            newHero.trainingCount = { ...(hero.trainingCount ?? { hp: 0, atk: 0, mp: 0 }), hp: count };
            return newHero;
          }

          case HeroTask.TRAIN_ATK: {
            const progress = (hero.trainingProgressMs?.atk ?? 0) + tickMs;
            let remaining = progress;
            let count = (hero.trainingCount?.atk ?? 0);
            let atk = hero.atk;
            const classSpeedAtk = hero.classId ? (CLASS_DEFS[hero.classId]?.trainSpeed?.atk ?? 1) : 1;
            let timePerPoint = (BASE_TRAIN_TIME_MS * Math.pow(1 + inflation, count)) / classSpeedAtk;
            while (remaining >= timePerPoint) {
              remaining -= timePerPoint;
              atk += 1;
              count += 1;
              timePerPoint = (BASE_TRAIN_TIME_MS * Math.pow(1 + inflation, count)) / classSpeedAtk;
            }
            newHero.atk = atk;
            newHero.trainingProgressMs = { ...(hero.trainingProgressMs ?? { hp: 0, atk: 0, mp: 0 }), atk: remaining };
            newHero.trainingCount = { ...(hero.trainingCount ?? { hp: 0, atk: 0, mp: 0 }), atk: count };
            return newHero;
          }
        // continue to other cases

          case HeroTask.TRAIN_MP: {
            const progress = (hero.trainingProgressMs?.mp ?? 0) + tickMs;
            let remaining = progress;
            let count = (hero.trainingCount?.mp ?? 0);
            let mp = hero.mp;
            const classSpeedMp = hero.classId ? (CLASS_DEFS[hero.classId]?.trainSpeed?.mp ?? 1) : 1;
            let timePerPoint = (BASE_TRAIN_TIME_MS * Math.pow(1 + inflation, count)) / classSpeedMp;
            while (remaining >= timePerPoint) {
              remaining -= timePerPoint;
              mp += 1;
              count += 1;
              timePerPoint = (BASE_TRAIN_TIME_MS * Math.pow(1 + inflation, count)) / classSpeedMp;
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

      // apply passive HP regen for idle heroes (mutate updatedHeroes in place)
      // compute healer total MP in guild (affects infirmary regen)
      const healerMpSum = (updatedHeroes || []).reduce((s, hh) => {
        return s + ((hh.classId === 'HEALER' ? (hh.mp ?? 0) : 0) as number);
      }, 0);

      for (let i = 0; i < updatedHeroes.length; i++) {
        const h = updatedHeroes[i];
        if ((h.currentTask === HeroTask.IDLE || h.currentTask === HeroTask.INFIRMARY) && (h.hpCurrent ?? 0) < (h.hpMax ?? 0)) {
          const prog = (h.hpRegenProgressMs ?? 0) + tickMs;
          let remaining = prog;
          let intervals = 0;
          while (remaining >= HP_REGEN_INTERVAL_MS) {
            remaining -= HP_REGEN_INTERVAL_MS;
            intervals += 1;
          }
          h.hpRegenProgressMs = remaining;

          if (intervals > 0) {
            // base gain
            let gain = intervals * HP_REGEN_AMOUNT;
            // infirmary multiplier
            if (h.currentTask === HeroTask.INFIRMARY) {
              const baseMul = ENFERMARIA_MULTIPLIER_BASE;
              const healerBoost = 1 + healerMpSum * ENFERMARIA_HEALER_MP_K;
              const effectiveMul = baseMul * healerBoost;
              gain = Math.floor(gain * effectiveMul);
            }
            h.hpCurrent = Math.min(h.hpMax ?? 0, (h.hpCurrent ?? 0) + gain);
          }
        }
      }

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
            // run a battle simulation (RPG-style single-run)
            const outcome = computeBattleOutcome(template, heroes, {
              healerBuffMultiplier: (m as any).healerBuffMultiplier,
              rogueRngBonus: (m as any).rogueRngBonus,
              ref: template.ref,
              exponent: template.exponent,
              synergyK: template.synergyK,
              scale: template.scale,
            });
            // attach outcome.reward as mission reward (penalty if failed)
            completed.push({ mission: m, reward: outcome.reward });
            // attach casualties info to mission object for reducer later use
            (m as any).__outcome = outcome;
          }
        }
      });
      // filter out completed missions
      const remainingMissions = active.filter((m) => m.remainingMs > 0);

      // release heroes from completed missions and add rewards
      let newHeroes = updatedHeroes.map((h) => ({ ...h }));
      const perHeroGold = { ...(state.perHeroGold ?? {}) };
      completed.forEach((c) => {
        const n = c.mission.heroIds.length || 1;
        const per = Math.floor(c.reward / n);
        c.mission.heroIds.forEach((hid) => {
          const idx = newHeroes.findIndex((hh) => hh.id === hid);
          if (idx >= 0) {
            // release hero from mission
            newHeroes[idx] = { ...newHeroes[idx], currentTask: HeroTask.IDLE };
            // apply battle casualties if present
            const outcome = (c.mission as any).__outcome;
            if (outcome && Array.isArray(outcome.casualties)) {
              const caus = outcome.casualties.find((x: any) => x.heroId === hid);
              if (caus) {
                newHeroes[idx].hpCurrent = caus.hpAfter;
                if (caus.incapacitatedUntilMs) {
                  newHeroes[idx].incapacitatedUntilMs = caus.incapacitatedUntilMs;
                } else {
                  // clear incapacitation if healed
                  delete newHeroes[idx].incapacitatedUntilMs;
                }
              }
            }
          }
          perHeroGold[hid] = (perHeroGold[hid] || 0) + per;
        });
      });

      const totalReward = completed.reduce((s, c) => s + c.reward, 0);
      // collect mission results to push to recentMissionResults
      const existingResults = state.recentMissionResults ? [...state.recentMissionResults] : [];
      completed.forEach((c) => {
        const outcome = (c.mission as any).__outcome;
        if (outcome) {
          existingResults.unshift({
            missionId: c.mission.id,
            templateId: c.mission.templateId,
            success: outcome.success,
            reward: outcome.reward,
            casualties: outcome.casualties,
            enemyCasualties: outcome.enemyCasualties,
            rounds: outcome.rounds,
            log: outcome.log,
          });
        }
      });

      return {
        ...state,
        heroes: newHeroes,
        gold: state.gold + goldEarned + totalReward,
        activeMissions: remainingMissions,
        perHeroGold,
        recentMissionResults: existingResults.slice(0, 10), // keep last 10
      };
    }

    case 'START_MISSION': {
      const template = MISSIONS.find((t) => t.id === action.templateId);
      if (!template) return state;
      if ((action.heroIds?.length ?? 0) < template.minHeroes) return state;

      // build map of heroes
      const heroesMap = new Map(state.heroes.map((h) => [h.id, h]));

      // validate heroes exist and are not currently already in a mission or incapacitated
      const now = Date.now();
      for (const hid of action.heroIds) {
        const h = heroesMap.get(hid);
        if (!h) return state; // invalid hero id
        if (h.currentTask === HeroTask.MISSION) return state; // already in mission
        if (h.incapacitatedUntilMs && h.incapacitatedUntilMs > now) return state; // cannot send incapacitated hero
      }

      // assign mission id
      const missionId = uuidv4();

      // compute modifiers: healer buff and rogue rng bonus using the heroes at the time of start
      const heroesForMission = action.heroIds.map((id) => heroesMap.get(id)!).filter(Boolean) as any[];
      const countHealers = heroesForMission.filter((h) => h.classId === 'HEALER').length;
      const countRogues = heroesForMission.filter((h) => h.classId === 'ROGUE').length;
      const healerBuffMultiplier = 1 + Math.min(0.3, countHealers * 0.1); // +10% per healer, cap 30%
      const rogueRngBonus = Math.min(0.08, countRogues * 0.02); // +0.02 per rogue, cap 0.08

      const newMission = {
        id: missionId,
        templateId: template.id,
        heroIds: action.heroIds,
        remainingMs: template.durationMs,
        startedAt: Date.now(),
        healerBuffMultiplier,
        rogueRngBonus,
      };

      // mark heroes as on mission and immediately cancel any training/infirmary state
      const newHeroesState = state.heroes.map((h) =>
        action.heroIds.includes(h.id)
          ? {
              ...h,
              currentTask: HeroTask.MISSION,
              // discard training progress/count when sent to mission (simpler behavior)
              trainingProgressMs: undefined,
              trainingCount: undefined,
            }
          : h
      );

      return {
        ...state,
        heroes: newHeroesState,
        activeMissions: [...(state.activeMissions || []), newMission],
      };
    }

    case 'DISMISS_MISSION_RESULT': {
      return {
        ...state,
        recentMissionResults: (state.recentMissionResults || []).filter((r) => r.missionId !== action.missionId),
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
      // do not allow changing a hero's task if they are currently on a mission
      const target = state.heroes.find((h) => h.id === action.heroId);
      if (!target) return state;
      if (target.currentTask === HeroTask.MISSION) {
        // ignore attempts to interrupt heroes on missions
        return state;
      }
      return {
        ...state,
        heroes: state.heroes.map((hero) =>
          hero.id === action.heroId ? { ...hero, currentTask: action.task } : hero
        ),
      };
    }

    case 'RECRUIT_HERO': {
      const cost = getRecruitCost(state.heroesRecruited);
      if (state.gold < cost) return state;
      // pick a random class equiprobably
      const classKeys = Object.keys(CLASS_DEFS) as ClassId[];
      const randClass = classKeys[Math.floor(Math.random() * classKeys.length)];
      const newHero = createHero(randClass);

      return {
        ...state,
        gold: state.gold - cost,
        heroes: [...state.heroes, newHero],
        heroesRecruited: state.heroesRecruited + 1,
      };
    }
    case 'BUY_CHEST': {
      const cost = getRecruitCost(state.heroesRecruited);
      if (state.gold < cost) return state;
      return {
        ...state,
        gold: state.gold - cost,
      };
    }

    case 'CONFIRM_CHEST_REVEAL': {
      return {
        ...state,
        heroes: [...state.heroes, action.hero],
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
    case 'START_INFERMARIA': {
      const heroesMap = new Map(state.heroes.map((h) => [h.id, h]));
      // allow sending to infirmary even if the hero is training, but never if on a mission
      const heroIds = action.heroIds.filter((id) => {
        const h = heroesMap.get(id);
        return !!h && h.currentTask !== HeroTask.MISSION && (h.hpCurrent ?? 0) < (h.hpMax ?? 0);
      });
      if (heroIds.length === 0) return state;
      const newHeroesState = state.heroes.map((h) =>
        heroIds.includes(h.id) ? { ...h, currentTask: HeroTask.INFIRMARY } : h
      );
      return { ...state, heroes: newHeroesState };
    }
    case 'RELEASE_FROM_INFERMARIA': {
      const heroIds = action.heroIds || [];
      const newHeroesState = state.heroes.map((h) =>
        heroIds.includes(h.id) ? { ...h, currentTask: HeroTask.IDLE } : h
      );
      return { ...state, heroes: newHeroesState };
    }

    case 'LOAD_STATE': {
      return { ...action.state };
    }

    default:
      return state;
  }
}
