import { GameState, HeroTask, Hero } from '../types';
import {
  BASE_TRAIN_TIME_MS,
  HP_REGEN_INTERVAL_MS,
  HP_REGEN_AMOUNT,
  ENFERMARIA_HEALER_MP_K,
  ENFERMARIA_TIME_SCALE,
  ENFERMARIA_MAX_SCALE,
  TICK_INTERVAL_MS,
  TRAIN_INFLATION_FACTOR,
} from '../constants/game';
import { configProvider } from '../services/configProvider';
import { legacyTrainSpeedFactor } from '../utils/heroUtils';
import { checkAchievements } from './achievementHandler';
import { createGuaranteedEquipment } from './equipmentHandler';
import { refreshDailyQuests } from './dailyQuestHandler';
import { refreshWeeklyState, updateWeeklyProgress, markWeeklyBossDefeated } from './weeklyHandler';
import { WEEKLY_BOSS_POOL } from '../constants/weeklyBosses';
import { applyTickProgress } from './progressTrackers';
import { processMissions } from './missionTickHandler';
import { getUnlockedSkills } from '../constants/skills';
import { emitSkillUnlocked, emitRareMaterialDrop } from '../services/milestones';


/** Processa o treinamento de todos os heróis, returns updated heroes and total points trained */
function processTraining(heroes: Hero[], tickMs: number, inflation: number, trainFactor: number): { heroes: Hero[]; totalPointsTrained: number } {
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
        // trainFactor (Legado train_1): multiplica a velocidade efetiva de treino
        const classSpeed = (classDef?.trainSpeed?.[statKey] ?? 1) * trainFactor;
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

export function handleTick(state: GameState, now: number): GameState {
  const tickMs = state.tickIntervalMs ?? TICK_INTERVAL_MS;
  const inflation = state.trainInflationFactor ?? TRAIN_INFLATION_FACTOR;

  // 0. Refresh daily quests if seed changed (new day) + weekly state
  let currentState = refreshDailyQuests(state);
  currentState = refreshWeeklyState(currentState);

  // 1. Process Training
  const trainFactor = legacyTrainSpeedFactor(currentState);
  const { heroes: heroesAfterTraining, totalPointsTrained } = processTraining(currentState.heroes, tickMs, inflation, trainFactor);
  // Skills só mudam quando algum trainingCount sobe → totalPointsTrained > 0.
  // processTraining retorna o herói pela MESMA referência quando não treina
  // (case default), então só reavalia quem mudou de referência.
  if (totalPointsTrained > 0) {
    const before = new Map(currentState.heroes.map(h => [h.id, h]));
    for (const hero of heroesAfterTraining) {
      const prevHero = before.get(hero.id);
      if (prevHero === hero) continue; // não treinou → skills idênticas
      const prevSkills = getUnlockedSkills(prevHero!).map(s => s.id);
      for (const skill of getUnlockedSkills(hero)) {
        if (!prevSkills.includes(skill.id)) {
          emitSkillUnlocked(hero.name, skill.icon, skill.name);
        }
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

  // 4+5. Progresso de daily e weekly num único pass (no-op para deltas zerados)
  const missionsCompletedCount = newResults.length;
  stateAfterTick = applyTickProgress(stateAfterTick, {
    missionsCompleted: missionsCompletedCount,
    pointsTrained: totalPointsTrained,
    goldEarned: goldGained,
  });

  // Check and award achievements
  return checkAchievements(stateAfterTick);
}
