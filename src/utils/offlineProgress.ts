import { GameState, HeroTask, OfflineSummaryFull, PerHeroChange } from '../types';
import { 
  TICK_INTERVAL_MS, 
  BASE_TRAIN_TIME_MS, 
  TRAIN_INFLATION_FACTOR,
  MAX_OFFLINE_MS
} from '../constants/game';
import { MISSIONS } from '../constants/missions';
import { calcMissionReward } from './missionMath';
import { computePointsFromMs } from './trainingMath';

export function calculateOfflineProgress(savedState: GameState): OfflineSummaryFull | null {
  const savedAt = savedState.lastSavedAt || Date.now();
  const elapsedMs = Date.now() - savedAt;

  // Limita o progresso offline a 72 horas
  const cappedMs = Math.min(elapsedMs, MAX_OFFLINE_MS);
  const tickInterval = savedState.tickIntervalMs ?? TICK_INTERVAL_MS;
  const ticks = Math.floor(cappedMs / tickInterval);

  if (ticks <= 0) return null;

  let offlineGold = 0;
  let heroesAffected = 0;
  const perHeroChanges: PerHeroChange[] = [];
  const newActiveMissions: any[] = [];
  const trainInflation = savedState.trainInflationFactor ?? TRAIN_INFLATION_FACTOR;

  const newHeroes = savedState.heroes.map((h) => {
    const beforeHpMax = (h as any).hpMax ?? (h as any).hp ?? 0;
    const beforeHpCurrent = (h as any).hpCurrent ?? (h as any).hp ?? beforeHpMax;
    const beforeAtk = h.atk;
    const beforeMp = h.mp;

    let afterHpMax = beforeHpMax;
    let afterHpCurrent = beforeHpCurrent;
    let afterAtk = beforeAtk;
    let afterMp = beforeMp;

    const beforeProgress = h.trainingProgressMs ?? { hp: 0, atk: 0, mp: 0 };
    const beforeCount = h.trainingCount ?? { hp: 0, atk: 0, mp: 0 };
    let afterProgress = { ...beforeProgress };
    let afterCount = { ...beforeCount };

    switch (h.currentTask) {
      case HeroTask.TRAIN_HP: {
        heroesAffected += 1;
        const available = (h.trainingProgressMs?.hp ?? 0) + ticks * tickInterval;
        const { points, leftoverMs } = computePointsFromMs(
          BASE_TRAIN_TIME_MS,
          trainInflation,
          available
        );
        afterHpMax += points;
        afterHpCurrent = Math.min(afterHpMax, afterHpCurrent + points);
        afterProgress.hp = leftoverMs;
        afterCount.hp = (h.trainingCount?.hp ?? 0) + points;
        break;
      }

      case HeroTask.TRAIN_ATK: {
        heroesAffected += 1;
        const available = (h.trainingProgressMs?.atk ?? 0) + ticks * tickInterval;
        const { points, leftoverMs } = computePointsFromMs(
          BASE_TRAIN_TIME_MS,
          trainInflation,
          available
        );
        afterAtk += points;
        afterProgress.atk = leftoverMs;
        afterCount.atk = (h.trainingCount?.atk ?? 0) + points;
        break;
      }

      case HeroTask.TRAIN_MP: {
        heroesAffected += 1;
        const available = (h.trainingProgressMs?.mp ?? 0) + ticks * tickInterval;
        const { points, leftoverMs } = computePointsFromMs(
          BASE_TRAIN_TIME_MS,
          trainInflation,
          available
        );
        afterMp += points;
        afterProgress.mp = leftoverMs;
        afterCount.mp = (h.trainingCount?.mp ?? 0) + points;
        break;
      }

      case HeroTask.MISSION:
        heroesAffected += 1;
        break;

      default:
        break;
    }

    if (
      beforeHpMax !== afterHpMax ||
      beforeHpCurrent !== afterHpCurrent ||
      beforeAtk !== afterAtk ||
      beforeMp !== afterMp
    ) {
      perHeroChanges.push({
        id: h.id,
        name: h.name,
        hpMaxBefore: beforeHpMax,
        hpMaxAfter: afterHpMax,
        hpCurrentBefore: beforeHpCurrent,
        hpCurrentAfter: afterHpCurrent,
        atkBefore: beforeAtk,
        atkAfter: afterAtk,
        mpBefore: beforeMp,
        mpAfter: afterMp,
      });
    }

    return {
      ...h,
      hpMax: afterHpMax,
      hpCurrent: afterHpCurrent,
      atk: afterAtk,
      mp: afterMp,
      trainingProgressMs: afterProgress,
      trainingCount: afterCount,
    };
  });

  const newState: GameState = {
    ...savedState,
    heroes: newHeroes,
    gold: (savedState.gold || 0) + offlineGold,
    activeMissions: savedState.activeMissions ?? [],
  };

  const perHeroGold = { ...(newState.perHeroGold ?? {}) };
  let additionalGold = 0;

  if (savedState.activeMissions && savedState.activeMissions.length > 0) {
    savedState.activeMissions.forEach((m: any) => {
      const remaining = typeof m.remainingMs === 'number' ? m.remainingMs - ticks * tickInterval : undefined;
      
      if (typeof remaining === 'number' && remaining <= 0) {
        const template = MISSIONS.find((t) => t.id === m.templateId);
        if (template) {
          const heroesForMission = newHeroes.filter((h) => m.heroIds.includes(h.id));
          const reward = calcMissionReward(template, heroesForMission, {
            healerBuffMultiplier: m.healerBuffMultiplier,
            rogueRngBonus: m.rogueRngBonus,
          });
          additionalGold += reward;
          
          const n = m.heroIds.length || 1;
          const per = Math.floor(reward / n);
          m.heroIds.forEach((hid: string) => {
            const idx = newHeroes.findIndex((hh) => hh.id === hid);
            if (idx >= 0) newHeroes[idx] = { ...newHeroes[idx], currentTask: HeroTask.IDLE };
            perHeroGold[hid] = (perHeroGold[hid] || 0) + per;
          });
        }
      } else {
        newActiveMissions.push(typeof remaining === 'number' ? { ...m, remainingMs: remaining } : { ...m });
      }
    });
  }

  newState.gold += additionalGold;
  newState.perHeroGold = perHeroGold;
  newState.activeMissions = newActiveMissions;

  const cappedHours = elapsedMs > MAX_OFFLINE_MS ? Math.floor(MAX_OFFLINE_MS / (1000 * 60 * 60)) : 0;

  return {
    ticks,
    goldGained: Math.floor(offlineGold + additionalGold),
    heroesAffected,
    cappedHours,
    perHeroChanges,
    previousState: savedState,
    newState,
  };
}
