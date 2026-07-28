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
import { computeFinalGold } from './rewards';
import { computeCycleDurationMs } from './missionLoop';
import { legacyDurationMultiplier } from '../constants/legacyUpgrades';

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
      if (!template) {
        newActiveMissions.push({ ...m });
        return;
      }

      // Duração real do ciclo: a MESMA fórmula do motor online (computeCycleDurationMs em
      // missionLoop.ts), a partir do nº de ações do combate pré-computado — nunca
      // template.durationMs, que o motor online não lê em lugar nenhum (é um rótulo antigo,
      // dessincronizado do tempo real de execução; ver task-10-brief.md, item I2).
      // Boss semanal não recebe o multiplicador de Legado (mesma regra de missionHandler.ts).
      const durationFactor = m.isWeeklyBoss ? 1 : legacyDurationMultiplier(savedState);
      const actionsCount = m.precomputedOutcome?.actions?.length;
      const cycleDurationMs = actionsCount != null
        ? computeCycleDurationMs(actionsCount, durationFactor)
        : template.durationMs; // sem outcome pré-computado (save legado ou erro de batalha): sem n, cai no fallback antigo

      if (cycleDurationMs <= 0) {
        newActiveMissions.push({ ...m });
        return;
      }

      const startedAt = m.startedAt;
      const endsAt = startedAt + cycleDurationMs;

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
        const possiveis = Math.floor(totalElapsed / cycleDurationMs);
        // Teto do plano: recolhido encerra no ciclo em curso; 'times'/'until' limitam pelo que resta;
        // 'endless' não tem teto — todo o tempo decorrido vira ciclos.
        // 'until': o prazo só impede que um NOVO ciclo comece — o ciclo em voo sempre
        // completa (mesma regra do planAllowsAnotherCycle online). Por isso é ceil, não
        // floor, com mínimo 1: mesmo D <= 0 credita o ciclo que já tinha começado.
        const teto =
          m.loopRecalled ? 1
          : m.loop.mode === 'times' ? m.loop.remaining
          : m.loop.mode === 'until' ? Math.max(1, Math.ceil((m.loop.endsAt - startedAt) / cycleDurationMs))
          : possiveis;
        // Paridade com o online: o outcome pré-computado é o do PRIMEIRO ciclo, e o motor
        // online exige success pra repetir o loop (planAllowsAnotherCycle). Se esse ciclo
        // fracassou, os demais nunca teriam rodado — creditar só 1, não o tempo offline inteiro.
        const outcomeFalhou = m.precomputedOutcome?.success === false;
        // Vitória que esvazia o time é o mesmo fenômeno: o online só repete o loop com
        // sobreviventes >= tpl.minHeroes (missionTickHandler.ts:226); abaixo disso ele para
        // no ciclo que acabou de rodar — que aqui também é sempre o primeiro (mesmo outcome
        // pré-computado reusado pra todos os ciclos, não há dado pra "N-ésimo ciclo").
        // Conta mortos (hpAfter <= 0), não sobreviventes presentes no array: fixtures e o
        // outcome "sem baixas" usam casualties: [] pra dizer "ninguém morreu", não "todos".
        const mortosNoOutcome = new Set(
          (m.precomputedOutcome?.casualties ?? [])
            .filter((c) => c.hpAfter <= 0)
            .map((c) => c.heroId)
        );
        const sobreviventesAposOutcome = m.heroIds.filter((hid) => !mortosNoOutcome.has(hid)).length;
        const vitoriaEsvaziaTime =
          m.precomputedOutcome?.success === true && sobreviventesAposOutcome < template.minHeroes;
        const paraNoPrimeiroCiclo = outcomeFalhou || vitoriaEsvaziaTime;
        const cycles = paraNoPrimeiroCiclo ? 1 : Math.min(possiveis, teto);

        // Mesmo multiplicador do online (pantheon → Legado → Evento), aplicado POR CICLO
        // antes de somar — floor por ciclo diverge de floor do total (ver computeFinalGold).
        const rewardPorCiclo = computeFinalGold(reward, savedState);
        const total = rewardPorCiclo * cycles;
        creditPerHero(total);
        additionalGold += total;

        // 'endless' nunca esgota; nos demais, o plano esgota assim que os ciclos rodados alcançam o
        // teto. Derrota e vitória-que-esvazia esgotam sempre, mesmo 'endless' — sem sobreviventes
        // suficientes não há por que repetir.
        const planoEsgotou = paraNoPrimeiroCiclo || m.loopRecalled || (m.loop.mode !== 'endless' && cycles >= teto);
        if (planoEsgotou) {
          if (paraNoPrimeiroCiclo) {
            // Baixas do ciclo que encerrou o loop: o online aplica isso incondicionalmente antes de
            // decidir se repete (missionTickHandler.ts:172-182). Recolhido (loopRecalled) ou teto
            // batido normalmente não mexem em HP aqui — só derrota e vitória-que-esvazia o fazem.
            m.precomputedOutcome!.casualties.forEach((c) => {
              const idx = newHeroes.findIndex((hh) => hh.id === c.heroId);
              if (idx >= 0) newHeroes[idx] = { ...newHeroes[idx], hpCurrent: c.hpAfter };
            });
          }
          // plano acabou antes do tempo disponível: heróis voltam, como missão avulsa.
          // Nenhum LoopSummary é emitido aqui — decisão 5 da spec: o ouro entra no
          // resumo de progresso offline que já existe.
          m.heroIds.forEach((hid: string) => {
            const idx = newHeroes.findIndex((hh) => hh.id === hid);
            if (idx >= 0) newHeroes[idx] = { ...newHeroes[idx], currentTask: HeroTask.IDLE };
          });
        } else {
          const leftover = totalElapsed % cycleDurationMs;
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
        const rewardFinal = computeFinalGold(reward, savedState);
        creditPerHero(rewardFinal);
        additionalGold += rewardFinal;

        // Baixas do ciclo perdido — mesmo tratamento do ramo em loop (só na derrota).
        if (m.precomputedOutcome?.success === false) {
          m.precomputedOutcome.casualties.forEach((c) => {
            const idx = newHeroes.findIndex((hh) => hh.id === c.heroId);
            if (idx >= 0) newHeroes[idx] = { ...newHeroes[idx], hpCurrent: c.hpAfter };
          });
        }

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
