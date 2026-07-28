import { GameState, HeroTask, OfflineSummaryFull, PerHeroChange, ActiveMission, LoopPlan, LoopTally } from '../types';
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

/**
 * O resumo é gerado a partir de 1 tick (500ms) de ausência, então um reload trivial
 * produz "0h 0m / 0 ouro". Só vale interromper o jogador quando há algo a reportar.
 */
export function hasReportableGains(summary: OfflineSummaryFull | null): boolean {
  if (!summary) return false;
  return summary.goldGained > 0 || summary.heroesAffected > 0;
}

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
  const newActiveMissions: ActiveMission[] = [];
  const trainInflation = savedState.trainInflationFactor ?? TRAIN_INFLATION_FACTOR;

  const newHeroes = savedState.heroes.map((h) => {
    const beforeHpMax = h.hpMax;
    const beforeHpCurrent = h.hpCurrent;
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

    savedState.activeMissions.forEach((m: ActiveMission) => {
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

      if (m.loop) {
        const totalElapsed = nowOffline - startedAt;
        const possiveis = Math.floor(totalElapsed / template.durationMs);
        // Teto do plano: recolhido encerra no ciclo em curso; 'times'/'until' limitam pelo que resta;
        // 'endless' não tem teto — todo o tempo decorrido vira ciclos.
        // 'until': o prazo só impede que um NOVO ciclo comece — o ciclo em voo sempre
        // completa (mesma regra do planAllowsAnotherCycle online). Por isso é ceil, não
        // floor, com mínimo 1: mesmo D <= 0 credita o ciclo que já tinha começado.
        const teto =
          m.loopRecalled ? 1
          : m.loop.mode === 'times' ? m.loop.remaining
          : m.loop.mode === 'until' ? Math.max(1, Math.ceil((m.loop.endsAt - startedAt) / template.durationMs))
          : possiveis;
        const cycles = Math.min(possiveis, teto);

        const total = reward * cycles;
        creditPerHero(total);
        additionalGold += total;

        // 'endless' nunca esgota; nos demais, o plano esgota assim que os ciclos rodados alcançam o teto.
        const planoEsgotou = m.loopRecalled || (m.loop.mode !== 'endless' && cycles >= teto);
        if (planoEsgotou) {
          // plano acabou antes do tempo disponível: heróis voltam, como missão avulsa.
          // Nenhum LoopSummary é emitido aqui — decisão 5 da spec: o ouro entra no
          // resumo de progresso offline que já existe.
          m.heroIds.forEach((hid: string) => {
            const idx = newHeroes.findIndex((hh) => hh.id === hid);
            if (idx >= 0) newHeroes[idx] = { ...newHeroes[idx], currentTask: HeroTask.IDLE };
          });
        } else {
          const leftover = totalElapsed % template.durationMs;
          const loopRestante: LoopPlan =
            m.loop.mode === 'times'
              ? { ...m.loop, remaining: Math.max(0, m.loop.remaining - cycles) }
              : m.loop;
          // O loop sobrevive à sessão offline: soma os ciclos e o ouro ao acumulado que a
          // UI mostra ("×N"), senão o jogador vê um número menor do que o ouro recebido.
          // Não fabrica lastResult/materiais novos — não há combate simulado ação a ação
          // aqui, e lastResult alimenta o botão "Ver último combate".
          const loopTallyAtualizado: LoopTally = {
            cycles: (m.loopTally?.cycles ?? 0) + cycles,
            gold: (m.loopTally?.gold ?? 0) + total,
            materials: { ...(m.loopTally?.materials ?? {}) },
            // Clona: sem isso o array ficaria compartilhado por referência entre newState
            // e previousState, igual ao que missionTickHandler.ts:182-184 evita no caminho online.
            casualties: [...(m.loopTally?.casualties ?? [])],
            lastResult: m.loopTally?.lastResult,
          };
          newActiveMissions.push({
            ...m,
            startedAt: nowOffline - leftover,
            loop: loopRestante,
            loopTally: loopTallyAtualizado,
          });
        }
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
