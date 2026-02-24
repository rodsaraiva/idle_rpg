import { GameState, GameAction, HeroTask, ClassId } from '../types';
import { BASE_TRAIN_TIME_MS, HP_REGEN_INTERVAL_MS, HP_REGEN_AMOUNT, ENFERMARIA_MULTIPLIER_BASE, ENFERMARIA_HEALER_MP_K, ENFERMARIA_TIME_SCALE, ENFERMARIA_MAX_SCALE } from '../constants/game';
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
          // accumulate progress: scale the amount of "equivalent time" added per tick when in infirmary.
          // This makes contributions order-independent: time spent in infirmary counts proportionally more.
          // compute timeScale: base infirmary scale optionally boosted by total healer MP
          let timeScale = 1;
          if (h.currentTask === HeroTask.INFIRMARY) {
            const healerBoost = 1 + healerMpSum * ENFERMARIA_HEALER_MP_K;
            timeScale = Math.min(ENFERMARIA_TIME_SCALE * healerBoost, ENFERMARIA_MAX_SCALE);
          }
          // multiply tickMs by timeScale to compute how much equivalent ms to add
          const progIncrement = Math.floor(tickMs * timeScale);
          const prog = (h.hpRegenProgressMs ?? 0) + progIncrement;
          let remaining = prog;

          let intervals = 0;
          while (remaining >= HP_REGEN_INTERVAL_MS) {
            remaining -= HP_REGEN_INTERVAL_MS;
            intervals += 1;
          }
          h.hpRegenProgressMs = remaining;

          if (intervals > 0) {
            const gain = intervals * HP_REGEN_AMOUNT;
            h.hpCurrent = Math.min(h.hpMax ?? 0, (h.hpCurrent ?? 0) + gain);
          }
        }
      }

      // process active missions: apply scheduled actions over time and finish when a team is defeated
      const active = (state.activeMissions || []).map((m) => ({ ...m }));
      const completed: { mission: typeof active[0]; reward: number }[] = [];
      let newHeroes = updatedHeroes.map((h) => ({ ...h }));

      for (let mi = 0; mi < active.length; mi++) {
        const m = active[mi] as any;
        const tpl = MISSIONS.find((t) => t.id === m.templateId);
        if (!tpl) continue;

        // compute elapsed playback time since mission started
        const startedAt = m.startedAt ?? 0;
        const elapsed = Math.max(0, Date.now() - startedAt);

        // apply scheduled actions whose time has arrived
        if (m.scheduledActions && Array.isArray(m.scheduledActions)) {
          // process scheduled actions sequentially; if an action is a "miss", allow the next action
          // to be executed immediately in the same tick (no delay).
          let ai = 0;
          let prevWasMiss = false;
          while (ai < m.scheduledActions.length) {
            const sched = m.scheduledActions[ai];
            if (sched.applied) {
              ai++;
              continue;
            }

            // allow execution if scheduled time reached OR previous action was a miss
            if ((sched.atMsFromStart ?? 0) <= elapsed || prevWasMiss) {
              const act = sched.action;

              // apply enemy -> hero hits
              if (act.actorType === 'enemy' && act.actionType === 'hit' && act.targetId) {
                const hid = act.targetId;
                const idx = newHeroes.findIndex((hh) => hh.id === hid);
                if (idx >= 0) {
                  newHeroes[idx] = { ...newHeroes[idx], hpCurrent: Math.max(0, (newHeroes[idx].hpCurrent ?? 0) - (act.amount ?? 0)) };
                }
              }

              // apply hero -> enemy hits to mission enemy state if present
              if (act.actorType === 'hero' && act.actionType === 'hit' && act.targetId && m.enemiesState) {
                const eid = act.targetId;
                const eidx = (m.enemiesState as any[]).findIndex((ee) => ee.id === eid);
                if (eidx >= 0) {
                  const newHp = Math.max(0, ((m.enemiesState as any[])[eidx].hp ?? 0) - (act.amount ?? 0));
                  (m.enemiesState as any[])[eidx] = { ...(m.enemiesState as any[])[eidx], hp: newHp, alive: newHp > 0 };
                }
              }

              // mark applied
              sched.applied = true;

              // update prevWasMiss for next iteration
              prevWasMiss = act.actionType === 'miss';

              // if this action indicates a defeat, schedule mission finish after delay (2000ms)
              // only schedule finish if this defeat results in no remaining alive units on one side
              if (act.actionType === 'defeat') {
                const aliveEnemiesNow = (m.enemiesState || []).filter((e: any) => (e.hp ?? 0) > 0);
                const aliveHeroesNow = newHeroes.filter((h) => m.heroIds.includes(h.id) && (h.hpCurrent ?? 0) > 0);
                if (aliveEnemiesNow.length === 0 || aliveHeroesNow.length === 0) {
                  if (!m.finishAt) {
                    m.finishAt = Date.now() + 2000;
                  }
                }
                prevWasMiss = false;
              }

              ai++;
              continue;
            } else {
              // neither time reached nor prevWasMiss => can't apply this action now; stop processing further actions this tick
              break;
            }
          }
        }

        // after applying actions, check if one side has no alive units; finish mission if so
        const aliveEnemies = (m.enemiesState || []).filter((e: any) => (e.hp ?? 0) > 0);
        const aliveHeroes = newHeroes.filter((h) => m.heroIds.includes(h.id) && (h.hpCurrent ?? 0) > 0);
        if (aliveEnemies.length === 0 || aliveHeroes.length === 0) {
          // schedule finish after delay (2000ms) if not already scheduled
          if (!m.finishAt) {
            m.finishAt = Date.now() + 2000;
          }
        }

        // if finishAt was scheduled and the time has arrived, finalize mission now
        if (m.finishAt && Date.now() >= m.finishAt) {
          if ((m as any).precomputedOutcome && (m as any).precomputedOutcome.reward !== undefined) {
            completed.push({ mission: m, reward: (m as any).precomputedOutcome.reward });
            (m as any).__outcome = { ...(m as any).precomputedOutcome, log: (m as any).precomputedOutcome.log ?? [] };
          } else {
            const heroesForOutcome = state.heroes.filter((h) => m.heroIds.includes(h.id));
            const outcome = computeBattleOutcome(tpl, heroesForOutcome, {
              healerBuffMultiplier: (m as any).healerBuffMultiplier,
              rogueRngBonus: (m as any).rogueRngBonus,
              ref: tpl.ref,
              exponent: tpl.exponent,
              synergyK: tpl.synergyK,
              scale: tpl.scale,
            });
            completed.push({ mission: m, reward: outcome.reward });
            (m as any).__outcome = outcome;
          }
        }

        active[mi] = m;
      }
      const remainingMissions = active.filter((m) => !completed.find((c) => c.mission.id === m.id));
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
        // prefer __outcome, but if missing fallback to precomputedOutcome
        const finalOutcome = outcome || (c.mission as any).precomputedOutcome;
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log('[gameReducer] pushing mission result', { missionId: c.mission.id, outcome: finalOutcome, __outcome_raw: outcome, precomputed: (c.mission as any).precomputedOutcome });
        }
        if (finalOutcome) {
          existingResults.unshift({
            missionId: c.mission.id,
            templateId: c.mission.templateId,
            success: Boolean(finalOutcome.success),
            reward: finalOutcome.reward,
            casualties: finalOutcome.casualties,
            enemyCasualties: finalOutcome.enemyCasualties,
            rounds: finalOutcome.rounds,
            log: finalOutcome.log,
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
        startedAt: Date.now(),
        healerBuffMultiplier,
        rogueRngBonus,
      } as any;

      // Precompute mission outcome actions and schedule them for live playback (2s delay + 1s per action)
      try {
        const outcome = computeBattleOutcome(template, heroesForMission, {
          healerBuffMultiplier,
          rogueRngBonus,
        });
        // build initial enemies state similar to battleSim creation
        const missionEnemies: any[] = [];
        if (template.enemies && template.enemies.length > 0) {
          template.enemies.forEach((edef, gi) => {
            const cnt = edef.count ?? 1;
            for (let i = 0; i < cnt; i++) {
              missionEnemies.push({
                id: `enemy_${gi}_${i}`,
                hp: edef.hp,
                maxHp: edef.hp,
                atk: edef.atk,
                mp: edef.mp,
                alive: true,
                attackType: Math.random() < 0.5 ? 'MELEE' : 'RANGED',
              });
            }
          });
        } else {
          const enemyCount = template.minHeroes;
          for (let i = 0; i < enemyCount; i++) {
            missionEnemies.push({
              id: `orc_${i}`,
              hp: 5,
              maxHp: 5,
              atk: 2,
              mp: 1,
              alive: true,
              attackType: i % 2 === 0 ? 'MELEE' : 'RANGED',
            });
          }
        }
        // schedule actions: 2000ms delay before first action, 1800ms between actions (slower playback)
        const scheduled = (outcome.actions || []).map((a: any, i: number) => ({
          atMsFromStart: 2000 + i * 1800,
          action: a,
          applied: false,
        }));
        newMission.scheduledActions = scheduled;
        newMission.enemiesState = missionEnemies;
        newMission.precomputedOutcome = {
          reward: outcome.reward,
          rounds: outcome.rounds,
          actions: outcome.actions,
          log: outcome.log,
          success: outcome.success,
          casualties: outcome.casualties,
          enemyCasualties: outcome.enemyCasualties,
        };
      } catch (err) {
        newMission.scheduledActions = [];
      }

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
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[gameReducer] BUY_CHEST before:', { gold: state.gold, cost });
      }
      const newState = {
        ...state,
        gold: state.gold - cost,
      };
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[gameReducer] BUY_CHEST after:', { gold: newState.gold });
      }
      return newState;
    }

    case 'CONFIRM_CHEST_REVEAL': {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[gameReducer] CONFIRM_CHEST_REVEAL adding hero', action.hero?.id);
    }
      const newHeroes = [...state.heroes, action.hero];
      return {
        ...state,
        heroes: newHeroes,
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
