import { GameState, HeroTask, Hero, ActiveMission, MissionOutcome, MissionResult, ClassId } from '../types';
import {
  BASE_TRAIN_TIME_MS,
  HP_REGEN_INTERVAL_MS,
  HP_REGEN_AMOUNT,
  ENFERMARIA_HEALER_MP_K,
  ENFERMARIA_TIME_SCALE,
  ENFERMARIA_MAX_SCALE,
  MISSION_FINISH_DELAY_MS,
  MISSION_START_DELAY_MS,
  MISSION_ACTION_INTERVAL_MS,
  TICK_INTERVAL_MS,
  TRAIN_INFLATION_FACTOR,
  HEALER_BUFF_PER_HERO,
  HEALER_BUFF_CAP,
  ROGUE_RNG_BONUS_PER_HERO,
  ROGUE_RNG_BONUS_CAP,
} from '../constants/game';
import { configProvider } from '../services/configProvider';
import { MISSIONS } from '../constants/missions';
import { computeBattleOutcome } from '../utils/battleSim';
import { getEffectiveStats, applyGoldBonus } from '../utils/heroUtils';
import { BattleEngine } from '../utils/battleEngine';
import { getActiveSynergies } from '../constants/synergies';
import { v4 as uuidv4 } from 'uuid';
import { checkAchievements } from './achievementHandler';
import { createGuaranteedEquipment } from './equipmentHandler';
import { refreshDailyQuests, updateDailyProgress } from './dailyQuestHandler';
import { refreshWeeklyState, updateWeeklyProgress, markWeeklyBossDefeated } from './weeklyHandler';
import { getWeeklyBoss, WeeklyBossTemplate, WEEKLY_BOSS_POOL } from '../constants/weeklyBosses';
import { MissionTemplate } from '../constants/missions';
import { getUnlockedSkills } from '../constants/skills';
import { emitSkillUnlocked, emitRareMaterialDrop } from '../services/milestones';

function bossToMissionTemplate(boss: WeeklyBossTemplate): MissionTemplate {
  return {
    id: boss.id,
    name: boss.bossName,
    minHeroes: boss.minHeroes,
    durationMs: boss.durationMs,
    rewardMin: boss.rewardMin,
    rewardMax: boss.rewardMax,
    statWeights: boss.statWeights,
    difficulty: boss.difficulty,
    enemies: boss.enemies,
  };
}

/** Processa o treinamento de todos os heróis, returns updated heroes and total points trained */
function processTraining(heroes: Hero[], tickMs: number, inflation: number): { heroes: Hero[]; totalPointsTrained: number } {
  let totalPointsTrained = 0;
  const updatedHeroes = heroes.map((hero) => {
    let newHero = { ...hero };
    switch (hero.currentTask) {
      case HeroTask.TRAIN_HP:
      case HeroTask.TRAIN_ATK:
      case HeroTask.TRAIN_MP: {
        const statKey = hero.currentTask === HeroTask.TRAIN_HP ? 'hp' :
                        hero.currentTask === HeroTask.TRAIN_ATK ? 'atk' : 'mp';

        const progress = (hero.trainingProgressMs?.[statKey] ?? 0) + tickMs;
        let remaining = progress;
        let count = (hero.trainingCount?.[statKey] ?? 0);

        const classDef = hero.classId ? configProvider.getClassDef(hero.classId) : undefined;
        const classSpeed = classDef?.trainSpeed?.[statKey] ?? 1;
        let timePerPoint = (BASE_TRAIN_TIME_MS * (1 + inflation * Math.log(count + 1))) / classSpeed;

        let pointsGained = 0;
        while (remaining >= timePerPoint) {
          remaining -= timePerPoint;
          pointsGained += 1;
          count += 1;
          timePerPoint = (BASE_TRAIN_TIME_MS * (1 + inflation * Math.log(count + 1))) / classSpeed;
        }

        if (statKey === 'hp') {
          const oldHpMax = hero.hpMax;
          newHero.hpMax += pointsGained;
          const prevCurrent = newHero.hpCurrent ?? oldHpMax;
          newHero.hpCurrent = pointsGained > 0 ? Math.min(newHero.hpMax, prevCurrent + pointsGained) : Math.min(prevCurrent, newHero.hpMax);
        } else if (statKey === 'atk') {
          newHero.atk += pointsGained;
        } else {
          newHero.mp += pointsGained;
        }

        totalPointsTrained += pointsGained;

        const defaultProgress = { hp: 0, atk: 0, mp: 0 };
        newHero.trainingProgressMs = { ...(hero.trainingProgressMs ?? defaultProgress), [statKey]: remaining };
        newHero.trainingCount = { ...(hero.trainingCount ?? defaultProgress), [statKey]: count };
        return newHero;
      }
      default:
        return hero;
    }
  });
  return { heroes: updatedHeroes, totalPointsTrained };
}

/** Processa a regeneração passiva e enfermaria */
function processRegeneration(heroes: Hero[], tickMs: number): Hero[] {
  const healerMpSum = heroes.reduce((s, hh) => s + (hh.classId === 'HEALER' ? (hh.mp ?? 0) : 0), 0);
  
  return heroes.map((h) => {
    if ((h.currentTask === HeroTask.IDLE || h.currentTask === HeroTask.INFIRMARY) && h.hpCurrent < h.hpMax) {
      let timeScale = 1;
      if (h.currentTask === HeroTask.INFIRMARY) {
        const healerBoost = 1 + healerMpSum * ENFERMARIA_HEALER_MP_K;
        timeScale = Math.min(ENFERMARIA_TIME_SCALE * healerBoost, ENFERMARIA_MAX_SCALE);
      }
      
      const progIncrement = Math.floor(tickMs * timeScale);
      const prog = (h.hpRegenProgressMs ?? 0) + progIncrement;
      let remaining = prog;

      let intervals = 0;
      while (remaining >= HP_REGEN_INTERVAL_MS) {
        remaining -= HP_REGEN_INTERVAL_MS;
        intervals += 1;
      }
      
      const gain = intervals * HP_REGEN_AMOUNT;
      return {
        ...h,
        hpRegenProgressMs: remaining,
        hpCurrent: Math.min(h.hpMax, h.hpCurrent + gain)
      };
    }
    return h;
  });
}

/** Processa o progresso das missões ativas */
function processMissions(state: GameState, heroes: Hero[], now: number): {
  newHeroes: Hero[],
  activeMissions: ActiveMission[],
  goldGained: number,
  newResults: MissionResult[],
  materialDrops: Record<string, number>,
  weeklyBossDefeated: boolean,
  weeklyBossTemplateId: string | undefined,
} {
  const active = (state.activeMissions || []).map((m) => ({ ...m }));
  const completed: { mission: ActiveMission; reward: number; outcome: MissionOutcome }[] = [];
  let currentHeroes = [...heroes];

  for (let mi = 0; mi < active.length; mi++) {
    const m = active[mi];
    let tpl: MissionTemplate | undefined = MISSIONS.find((t) => t.id === m.templateId);
    if (!tpl && m.isWeeklyBoss) {
      const bossFromPool = WEEKLY_BOSS_POOL.find(b => b.id === m.templateId);
      if (bossFromPool) tpl = bossToMissionTemplate(bossFromPool);
    }
    if (!tpl) continue;

    const startedAt = m.startedAt ?? 0;
    const elapsed = Math.max(0, now - startedAt);

    if (m.scheduledActions && Array.isArray(m.scheduledActions)) {
      let ai = 0;
      let prevWasMiss = false;
      while (ai < m.scheduledActions.length) {
        const sched = m.scheduledActions[ai];
        if (sched.applied) {
          ai++;
          continue;
        }

        if ((sched.atMsFromStart ?? 0) <= elapsed || prevWasMiss) {
          const act = sched.action;

          if (act.actorType === 'enemy' && act.actionType === 'hit' && act.targetId) {
            const idx = currentHeroes.findIndex((hh) => hh.id === act.targetId);
            if (idx >= 0) {
              currentHeroes[idx] = { 
                ...currentHeroes[idx], 
                hpCurrent: Math.max(0, currentHeroes[idx].hpCurrent - (act.amount ?? 0)) 
              };
            }
          }

          if (act.actorType === 'hero' && act.actionType === 'hit' && act.targetId && m.enemiesState) {
            const eidx = m.enemiesState.findIndex((ee) => ee.id === act.targetId);
            if (eidx >= 0) {
              const newHp = Math.max(0, (m.enemiesState[eidx].hp ?? 0) - (act.amount ?? 0));
              m.enemiesState[eidx] = { ...m.enemiesState[eidx], hp: newHp, alive: newHp > 0 };
            }
          }

          if (act.actionType === 'move' && act.toPosition !== undefined) {
            if (act.actorType === 'enemy' && m.enemiesState) {
              const eidx = m.enemiesState.findIndex((ee) => ee.id === act.actorId);
              if (eidx >= 0) {
                m.enemiesState[eidx] = { ...m.enemiesState[eidx], position: act.toPosition };
              }
            } else if (act.actorType === 'hero' && m.heroPositions) {
              m.heroPositions[act.actorId] = act.toPosition;
            }
          }

          sched.applied = true;
          prevWasMiss = act.actionType === 'miss';

          if (act.actionType === 'defeat') {
            const aliveEnemiesNow = (m.enemiesState || []).filter((e: any) => (e.hp ?? 0) > 0);
            const aliveHeroesNow = currentHeroes.filter((h) => m.heroIds.includes(h.id) && h.hpCurrent > 0);
            if (aliveEnemiesNow.length === 0 || aliveHeroesNow.length === 0) {
              if (!m.finishAt) m.finishAt = now + MISSION_FINISH_DELAY_MS;
            }
            prevWasMiss = false;
          }
          ai++;
        } else {
          break;
        }
      }
    }

    const aliveEnemies = (m.enemiesState || []).filter((e: any) => (e.hp ?? 0) > 0);
    const aliveHeroes = currentHeroes.filter((h) => m.heroIds.includes(h.id) && h.hpCurrent > 0);
    if ((aliveEnemies.length === 0 || aliveHeroes.length === 0) && !m.finishAt) {
      m.finishAt = now + MISSION_FINISH_DELAY_MS;
    }

    if (m.finishAt && now >= m.finishAt) {
      let outcome: MissionOutcome;
      if (m.precomputedOutcome) {
        outcome = m.precomputedOutcome;
      } else {
        const heroesForOutcome = state.heroes.filter((h) => m.heroIds.includes(h.id));
        const battleOutcome = computeBattleOutcome(tpl, heroesForOutcome, {
          healerBuffMultiplier: m.healerBuffMultiplier,
          rogueRngBonus: m.rogueRngBonus,
          ref: tpl.ref,
          exponent: tpl.exponent,
          synergyK: tpl.synergyK,
          scale: tpl.scale,
        });
        outcome = battleOutcome;
      }
      completed.push({ mission: m, reward: outcome.reward, outcome });
    }
    active[mi] = m;
  }

  const remainingMissions = active.filter((m) => !completed.find((c) => c.mission.id === m.id));
  const perHeroGold = { ...(state.perHeroGold ?? {}) };
  let goldGained = 0;
  const materialDrops: Record<string, number> = {};
  let weeklyBossCompletedThisTick = false;
  let weeklyBossTemplateId: string | undefined;

  completed.forEach((c) => {
    const n = c.mission.heroIds.length || 1;
    const per = Math.floor(c.reward / n);

    // Apply casualties to hero HP regardless of looping
    c.mission.heroIds.forEach((hid: string) => {
      const idx = currentHeroes.findIndex((hh) => hh.id === hid);
      if (idx >= 0) {
        const caus = c.outcome.casualties.find((x: any) => x.heroId === hid);
        if (caus) {
          currentHeroes[idx] = { ...currentHeroes[idx], hpCurrent: caus.hpAfter };
        }
      }
      perHeroGold[hid] = (perHeroGold[hid] || 0) + per;
    });

    // Accumulate material drops from this mission outcome
    if (c.outcome.materialDrops) {
      for (const [mat, qty] of Object.entries(c.outcome.materialDrops)) {
        materialDrops[mat] = (materialDrops[mat] ?? 0) + qty;
      }
    }

    // Check if looping mission should restart
    if (c.mission.looping && c.outcome.success) {
      goldGained += applyGoldBonus(c.reward, state);
      const tpl = MISSIONS.find(t => t.id === c.mission.templateId);
      if (tpl) {
        // Get the surviving heroes for the next cycle
        const heroesForNext = currentHeroes.filter(h => c.mission.heroIds.includes(h.id) && h.hpCurrent > 0);
        if (heroesForNext.length >= tpl.minHeroes) {
          // Apply all stat bonuses via central helper
          const heroesWithEquipment = heroesForNext.map(h => {
            const eff = getEffectiveStats(h, state);
            return { ...h, hpMax: eff.hpMax, hpCurrent: eff.hpCurrent, atk: eff.atk, mp: eff.mp, defense: eff.defense, crit: eff.crit, agility: eff.agility };
          });

          const countHealers = heroesForNext.filter(h => h.classId === 'HEALER').length;
          const countRogues = heroesForNext.filter(h => h.classId === 'ROGUE').length;
          const healerBuffMultiplier = 1 + Math.min(HEALER_BUFF_CAP, countHealers * HEALER_BUFF_PER_HERO);
          const rogueRngBonus = Math.min(ROGUE_RNG_BONUS_CAP, countRogues * ROGUE_RNG_BONUS_PER_HERO);

          const teamClassIds = heroesForNext.map(h => h.classId).filter(Boolean) as ClassId[];
          const activeSynergyNames = getActiveSynergies(teamClassIds).map(s => s.name);

          try {
            const newOutcome = computeBattleOutcome(tpl, heroesWithEquipment, {
              healerBuffMultiplier,
              rogueRngBonus,
              heroPositions: c.mission.heroPositions,
            });
            const newScheduled = (newOutcome.actions || []).map((a, i) => ({
              atMsFromStart: MISSION_START_DELAY_MS + i * MISSION_ACTION_INTERVAL_MS,
              action: a,
              applied: false,
            }));
            remainingMissions.push({
              id: uuidv4(),
              templateId: c.mission.templateId,
              heroIds: c.mission.heroIds,
              heroPositions: c.mission.heroPositions,
              startedAt: now,
              looping: true,
              healerBuffMultiplier,
              rogueRngBonus,
              activeSynergies: activeSynergyNames.length > 0 ? activeSynergyNames : undefined,
              scheduledActions: newScheduled,
              enemiesState: BattleEngine.createEnemies(tpl),
              precomputedOutcome: newOutcome,
            });
          } catch {
            // If battle computation fails, stop looping and release heroes
            c.mission.heroIds.forEach((hid: string) => {
              const idx = currentHeroes.findIndex((hh) => hh.id === hid);
              if (idx >= 0) {
                currentHeroes[idx] = { ...currentHeroes[idx], currentTask: HeroTask.IDLE };
              }
            });
          }
        } else {
          // Not enough surviving heroes to continue — release them
          c.mission.heroIds.forEach((hid: string) => {
            const idx = currentHeroes.findIndex((hh) => hh.id === hid);
            if (idx >= 0) {
              currentHeroes[idx] = { ...currentHeroes[idx], currentTask: HeroTask.IDLE };
            }
          });
        }
      }
    } else {
      // Boss semanal vitorioso: sinalizar para aplicar bossDefeated fora do loop
      if (c.mission.isWeeklyBoss && c.outcome.success) {
        weeklyBossCompletedThisTick = true;
        weeklyBossTemplateId = c.mission.templateId;
      }

      // Normal completion: release heroes to IDLE
      goldGained += applyGoldBonus(c.reward, state);
      c.mission.heroIds.forEach((hid: string) => {
        const idx = currentHeroes.findIndex((hh) => hh.id === hid);
        if (idx >= 0) {
          currentHeroes[idx] = { ...currentHeroes[idx], currentTask: HeroTask.IDLE };
        }
      });
    }
  });

  const newResults: MissionResult[] = completed.map(c => {
    let tpl: MissionTemplate | undefined = MISSIONS.find(m => m.id === c.mission.templateId);
    if (!tpl && c.mission.isWeeklyBoss) {
      const bossFromPool = WEEKLY_BOSS_POOL.find(b => b.id === c.mission.templateId);
      if (bossFromPool) tpl = bossToMissionTemplate(bossFromPool);
    }
    const totalEnemies = tpl?.enemies?.reduce((sum, e) => sum + (e.count ?? 1), 0) ?? 0;
    return {
      ...c.outcome,
      missionId: c.mission.id,
      templateId: c.mission.templateId,
      totalEnemies,
      activeSynergies: c.mission.activeSynergies,
    };
  });

  return {
    newHeroes: currentHeroes,
    activeMissions: remainingMissions,
    goldGained,
    newResults,
    materialDrops,
    weeklyBossDefeated: weeklyBossCompletedThisTick,
    weeklyBossTemplateId,
  };
}

export function handleTick(state: GameState, now: number): GameState {
  const tickMs = state.tickIntervalMs ?? TICK_INTERVAL_MS;
  const inflation = state.trainInflationFactor ?? TRAIN_INFLATION_FACTOR;

  // 0. Refresh daily quests if seed changed (new day) + weekly state
  let currentState = refreshDailyQuests(state);
  currentState = refreshWeeklyState(currentState);

  // 1. Process Training
  const prevSkills: Record<string, string[]> = {};
  for (const hero of currentState.heroes) {
    prevSkills[hero.id] = getUnlockedSkills(hero).map(s => s.id);
  }
  const { heroes: heroesAfterTraining, totalPointsTrained } = processTraining(currentState.heroes, tickMs, inflation);
  for (const hero of heroesAfterTraining) {
    const newSkills = getUnlockedSkills(hero);
    const prev = prevSkills[hero.id] ?? [];
    for (const skill of newSkills) {
      if (!prev.includes(skill.id)) {
        emitSkillUnlocked(hero.name, skill.icon, skill.name);
      }
    }
  }

  // 2. Process Passive Regeneration / Infirmary
  const heroesAfterRegen = processRegeneration(heroesAfterTraining, tickMs);

  // 3. Process Active Missions
  const {
    newHeroes,
    activeMissions,
    goldGained,
    newResults,
    materialDrops,
    weeklyBossDefeated,
    weeklyBossTemplateId,
  } = processMissions(currentState, heroesAfterRegen, now);

  const existingResults = currentState.recentMissionResults ? [...currentState.recentMissionResults] : [];
  const updatedResults = [...newResults, ...existingResults].slice(0, 10);

  // Track completed mission count and unique template IDs for achievements
  const completedMissionCount = (currentState.completedMissionCount ?? 0) + newResults.length;
  const completedMissionIds = [
    ...new Set([
      ...(currentState.completedMissionIds ?? []),
      ...newResults.filter(r => r.success).map(r => r.templateId),
    ]),
  ];

  let stateAfterTick: GameState = {
    ...currentState,
    heroes: newHeroes,
    gold: currentState.gold + goldGained,
    activeMissions,
    recentMissionResults: updatedResults,
    completedMissionCount,
    completedMissionIds,
  };

  if (Object.keys(materialDrops).length > 0) {
    const merged = { ...(stateAfterTick.materials ?? {}) };
    for (const [mat, qty] of Object.entries(materialDrops)) {
      merged[mat] = (merged[mat] ?? 0) + qty;
    }
    stateAfterTick = { ...stateAfterTick, materials: merged };
  }
  if (materialDrops['starstone'] && materialDrops['starstone'] > 0) {
    emitRareMaterialDrop('Pedra Estelar');
  }

  // Boss semanal derrotado neste tick: marcar, incrementar tracker e conceder equipamento garantido
  if (weeklyBossDefeated && weeklyBossTemplateId) {
    stateAfterTick = markWeeklyBossDefeated(stateAfterTick);
    stateAfterTick = updateWeeklyProgress(stateAfterTick, 'weeklyBossKills', 1);
    const defeatedBoss = WEEKLY_BOSS_POOL.find(b => b.id === weeklyBossTemplateId);
    if (defeatedBoss?.guaranteedRewardTier != null) {
      const rewardItem = createGuaranteedEquipment(defeatedBoss.guaranteedRewardTier);
      stateAfterTick = {
        ...stateAfterTick,
        inventory: [...(stateAfterTick.inventory ?? []), rewardItem],
      };
    }
  }

  // 4. Update daily quest progress trackers
  const missionsCompletedCount = newResults.length;
  if (missionsCompletedCount > 0) {
    stateAfterTick = updateDailyProgress(stateAfterTick, 'missionsCompleted', missionsCompletedCount);
  }
  if (totalPointsTrained > 0) {
    stateAfterTick = updateDailyProgress(stateAfterTick, 'pointsTrained', totalPointsTrained);
  }
  if (goldGained > 0) {
    stateAfterTick = updateDailyProgress(stateAfterTick, 'goldEarned', goldGained);
  }

  // 5. Update weekly quest progress trackers
  if (missionsCompletedCount > 0) {
    stateAfterTick = updateWeeklyProgress(stateAfterTick, 'missionsCompleted', missionsCompletedCount);
  }
  if (totalPointsTrained > 0) {
    stateAfterTick = updateWeeklyProgress(stateAfterTick, 'pointsTrained', totalPointsTrained);
  }
  if (goldGained > 0) {
    stateAfterTick = updateWeeklyProgress(stateAfterTick, 'goldEarned', goldGained);
  }

  // Check and award achievements
  return checkAchievements(stateAfterTick);
}
