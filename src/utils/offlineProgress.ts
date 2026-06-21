import { GameState, HeroTask, OfflineSummaryFull, PerHeroChange } from '../types';
import {
  TICK_INTERVAL_MS,
  BASE_TRAIN_TIME_MS,
  TRAIN_INFLATION_FACTOR,
  MAX_OFFLINE_MS,
} from '../constants/game';
import { MISSIONS } from '../constants/missions';
import { WEEKLY_BOSS_POOL, bossToMissionTemplate } from '../constants/weeklyBosses';
import { calcMissionReward } from './missionMath';
import { computePointsFromMs } from './trainingMath';
import { createGuaranteedEquipment } from '../context/equipmentHandler';

export function calculateOfflineProgress(savedState: GameState): OfflineSummaryFull | null {
  const savedAt = savedState.lastSavedAt || Date.now();
  const elapsedMs = Date.now() - savedAt;

  // Limita o progresso offline a 72 horas
  const cappedMs = Math.min(elapsedMs, MAX_OFFLINE_MS);
  const tickInterval = savedState.tickIntervalMs ?? TICK_INTERVAL_MS;
  const ticks = Math.floor(cappedMs / tickInterval);

  if (ticks <= 0) return null;

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

    const defaultProgress = { hp: 0, atk: 0, mp: 0 };
    const beforeProgress = { ...defaultProgress, ...(h.trainingProgressMs ?? {}) };
    const beforeCount = { ...defaultProgress, ...(h.trainingCount ?? {}) };
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
    gold: (savedState.gold || 0),
    activeMissions: savedState.activeMissions ?? [],
  };

  const perHeroGold = { ...(newState.perHeroGold ?? {}) };
  let additionalGold = 0;

  if (savedState.activeMissions && savedState.activeMissions.length > 0) {
    const nowOffline = savedAt + cappedMs; // "agora" limitado pelo cap de 72h

    savedState.activeMissions.forEach((m: any) => {
      // Resolução de template idêntica ao tick online (missão normal ou boss semanal)
      let template = MISSIONS.find((t) => t.id === m.templateId);
      if (!template && m.isWeeklyBoss) {
        const boss = WEEKLY_BOSS_POOL.find((b) => b.id === m.templateId);
        if (boss) template = bossToMissionTemplate(boss);
      }
      if (!template || template.durationMs <= 0) {
        newActiveMissions.push({ ...m });
        return;
      }

      const startedAt = m.startedAt;
      const endsAt = startedAt + template.durationMs;

      if (nowOffline < endsAt) {
        // ainda em andamento → mantém intacta (startedAt preservado)
        newActiveMissions.push({ ...m });
        return;
      }

      // completou >= 1 ciclo offline — reward espelha o tick online
      const heroesForMission = newHeroes.filter((h) => m.heroIds.includes(h.id));
      const reward = m.precomputedOutcome?.reward
        ?? calcMissionReward(template, heroesForMission, {
          healerBuffMultiplier: m.healerBuffMultiplier,
          rogueRngBonus: m.rogueRngBonus,
        });

      const n = m.heroIds.length || 1;
      const creditPerHero = (total: number) => {
        const per = Math.floor(total / n);
        m.heroIds.forEach((hid: string) => {
          perHeroGold[hid] = (perHeroGold[hid] || 0) + per;
        });
      };

      if (m.looping) {
        const totalElapsed = nowOffline - startedAt;
        const cycles = Math.floor(totalElapsed / template.durationMs); // >= 1
        const total = reward * cycles;
        creditPerHero(total);
        additionalGold += total;
        // re-armar: novo startedAt alinhado ao último ciclo (espelha o tick online)
        const leftover = totalElapsed % template.durationMs;
        newActiveMissions.push({ ...m, startedAt: nowOffline - leftover });
      } else {
        creditPerHero(reward);
        additionalGold += reward;
        // missão não-loop encerra: heróis voltam a IDLE, não re-empurra a missão
        m.heroIds.forEach((hid: string) => {
          const idx = newHeroes.findIndex((hh) => hh.id === hid);
          if (idx >= 0) newHeroes[idx] = { ...newHeroes[idx], currentTask: HeroTask.IDLE };
        });

        // Boss semanal: espelha o tick online — marca bossDefeated e concede equipamento garantido
        if (m.isWeeklyBoss) {
          const defeatedBoss = WEEKLY_BOSS_POOL.find((b) => b.id === m.templateId);
          if (newState.weeklyState) {
            newState.weeklyState = { ...newState.weeklyState, bossDefeated: true };
          }
          if (defeatedBoss?.guaranteedRewardTier != null) {
            const rewardItem = createGuaranteedEquipment(defeatedBoss.guaranteedRewardTier);
            newState.inventory = [...(newState.inventory ?? []), rewardItem];
          }
        }
      }
    });
  }

  newState.gold += additionalGold;
  newState.perHeroGold = perHeroGold;
  newState.activeMissions = newActiveMissions;

  const cappedHours = elapsedMs > MAX_OFFLINE_MS ? Math.floor(MAX_OFFLINE_MS / (1000 * 60 * 60)) : 0;

  return {
    ticks,
    goldGained: Math.floor(additionalGold),
    heroesAffected,
    cappedHours,
    perHeroChanges,
    previousState: savedState,
    newState,
  };
}
