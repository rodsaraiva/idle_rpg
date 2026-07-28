import { GameState, HeroTask, Hero, ActiveMission, MissionOutcome, MissionResult, ClassId, LoopSummary } from '../types';
import { analytics } from '../services/analytics';
import {
  MISSION_FINISH_DELAY_MS,
  HEALER_BUFF_PER_HERO,
  HEALER_BUFF_CAP,
  ROGUE_RNG_BONUS_PER_HERO,
  ROGUE_RNG_BONUS_CAP,
} from '../constants/game';
import { MISSIONS, MissionTemplate } from '../constants/missions';
import { WEEKLY_BOSS_POOL } from '../constants/weeklyBosses';
import { computeBattleOutcome } from '../utils/battleSim';
import { BattleEngine } from '../utils/battleEngine';
import { getEffectiveStats } from '../utils/heroUtils';
import { legacyDurationMultiplier } from '../constants/legacyUpgrades';
import { computeFinalGold } from '../utils/rewards';
import { getActiveSynergies } from '../constants/synergies';
import { bossToMissionTemplate } from './bossTemplate';
import { planAllowsAnotherCycle, advanceLoopPlan, accumulateTally, actionTimestampMs } from '../utils/missionLoop';
import { v4 as uuidv4 } from 'uuid';

/** Resolve o template de uma missão pelo id — normal ou boss semanal do pool. */
function resolveMissionTemplate(templateId: string, isWeeklyBoss?: boolean): MissionTemplate | undefined {
  let tpl: MissionTemplate | undefined = MISSIONS.find((t) => t.id === templateId);
  if (!tpl && isWeeklyBoss) {
    const bossFromPool = WEEKLY_BOSS_POOL.find((b) => b.id === templateId);
    if (bossFromPool) tpl = bossToMissionTemplate(bossFromPool);
  }
  return tpl;
}

/** Total de inimigos do template — usado no "N/M derrotados" da tela de resultado. */
function countTotalEnemies(tpl: MissionTemplate | undefined): number {
  return tpl?.enemies?.reduce((sum, e) => sum + (e.count ?? 1), 0) ?? 0;
}

export interface ProcessMissionsResult {
  newHeroes: Hero[];
  activeMissions: ActiveMission[];
  goldGained: number;
  newResults: MissionResult[];
  materialDrops: Record<string, number>;
  weeklyBossDefeated: boolean;
  weeklyBossTemplateId: string | undefined;
  completedLoops: LoopSummary[];
  perHeroGold: Record<string, number>;
}

/** Processa o progresso das missões ativas. */
export function processMissions(state: GameState, heroes: Hero[], now: number): ProcessMissionsResult {
  const active = (state.activeMissions || []).map((m) => ({
    ...m,
    enemiesState: m.enemiesState ? m.enemiesState.map((e) => ({ ...e })) : m.enemiesState,
    heroPositions: m.heroPositions ? { ...m.heroPositions } : m.heroPositions,
  }));
  const completed: { mission: ActiveMission; reward: number; outcome: MissionOutcome }[] = [];
  let currentHeroes = [...heroes];

  for (let mi = 0; mi < active.length; mi++) {
    const m = active[mi];
    const tpl = resolveMissionTemplate(m.templateId, m.isWeeklyBoss);
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
  const completedLoops: LoopSummary[] = [];

  completed.forEach((c) => {
    const n = c.mission.heroIds.length || 1;
    // Ouro final (pantheon → Legado → Evento) — a MESMA base que a carteira (goldGained) e
    // o tally do loop (ouroDoCiclo) já usam. O contador por herói (perHeroGold) tinha ficado
    // pra trás usando o reward cru: o offline (I3) já credita o valor final por herói, e essa
    // divergência é justamente o que quebrava a paridade que esta task existe pra fechar
    // (task 10, Important 1 — contador de exibição, sem efeito de gameplay, mas errado).
    const rewardFinal = computeFinalGold(c.reward, state);
    const per = Math.floor(rewardFinal / n);

    // Aplica as baixas ao HP dos heróis independente de a missão estar em loop
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

    // Acumula os drops de material deste desfecho de missão
    if (c.outcome.materialDrops) {
      for (const [mat, qty] of Object.entries(c.outcome.materialDrops)) {
        materialDrops[mat] = (materialDrops[mat] ?? 0) + qty;
      }
    }

    // O acumulado do loop é montado antes de decidir se ele continua — o resumo final
    // (em qualquer desfecho) precisa do tally já com o ciclo atual dentro.
    const ouroDoCiclo = c.mission.loop ? rewardFinal : 0;
    const tally = c.mission.loop
      ? accumulateTally(c.mission.loopTally, {
          gold: ouroDoCiclo,
          materials: c.outcome.materialDrops ?? {},
          // Clona os objetos de baixa aqui: accumulateTally guarda o array por referência,
          // e casualties do outcome não deve ficar acoplado a nada que o motor mexa depois.
          casualties: c.outcome.casualties.map((x) => ({ heroId: x.heroId, hpAfter: x.hpAfter })),
          result: {
            ...c.outcome,
            missionId: c.mission.id,
            templateId: c.mission.templateId,
            totalEnemies: countTotalEnemies(resolveMissionTemplate(c.mission.templateId, c.mission.isWeeklyBoss)),
            activeSynergies: c.mission.activeSynergies,
          },
        })
      : undefined;

    // O plano só é avaliado depois do ciclo terminar: avança primeiro, decide depois.
    // Assim um plano criado com remaining: 3 roda exatamente 3 ciclos (sem off-by-one).
    const planoAvancado = c.mission.loop ? advanceLoopPlan(c.mission.loop) : undefined;
    const podeRepetir =
      !!planoAvancado &&
      c.outcome.success &&
      !c.mission.loopRecalled &&
      planAllowsAnotherCycle(planoAvancado, now);

    if (podeRepetir) {
      goldGained += rewardFinal;
      const tpl = MISSIONS.find(t => t.id === c.mission.templateId);
      if (tpl) {
        // Pega os heróis sobreviventes para o próximo ciclo
        const heroesForNext = currentHeroes.filter(h => c.mission.heroIds.includes(h.id) && h.hpCurrent > 0);
        if (heroesForNext.length >= tpl.minHeroes) {
          // Aplica todos os bônus de stat via helper central
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
            const loopDurationFactor = legacyDurationMultiplier(state);
            const newScheduled = (newOutcome.actions || []).map((a, i) => ({
              atMsFromStart: actionTimestampMs(i, loopDurationFactor),
              action: a,
              applied: false,
            }));
            remainingMissions.push({
              id: uuidv4(),
              templateId: c.mission.templateId,
              heroIds: c.mission.heroIds,
              heroPositions: c.mission.heroPositions,
              startedAt: now,
              loop: planoAvancado,
              loopTally: tally,
              healerBuffMultiplier,
              rogueRngBonus,
              activeSynergies: activeSynergyNames.length > 0 ? activeSynergyNames : undefined,
              scheduledActions: newScheduled,
              enemiesState: BattleEngine.createEnemies(tpl),
              precomputedOutcome: newOutcome,
            });
          } catch {
            // Se o cálculo da batalha falhar, encerra o loop e libera os heróis
            if (c.mission.loop && tally) {
              completedLoops.push({
                missionId: c.mission.id,
                templateId: c.mission.templateId,
                heroIds: c.mission.heroIds,
                tally,
                plannedCycles: c.mission.loop.mode === 'times' ? c.mission.loop.total : undefined,
                reason: 'error',
              });
            }
            c.mission.heroIds.forEach((hid: string) => {
              const idx = currentHeroes.findIndex((hh) => hh.id === hid);
              if (idx >= 0) {
                currentHeroes[idx] = { ...currentHeroes[idx], currentTask: HeroTask.IDLE };
              }
            });
          }
        } else {
          // Sobreviventes insuficientes para continuar — libera os heróis
          if (c.mission.loop && tally) {
            completedLoops.push({
              missionId: c.mission.id,
              templateId: c.mission.templateId,
              heroIds: c.mission.heroIds,
              tally,
              plannedCycles: c.mission.loop.mode === 'times' ? c.mission.loop.total : undefined,
              reason: 'casualties',
            });
          }
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

      if (c.mission.loop && tally) {
        completedLoops.push({
          missionId: c.mission.id,
          templateId: c.mission.templateId,
          heroIds: c.mission.heroIds,
          tally,
          plannedCycles: c.mission.loop.mode === 'times' ? c.mission.loop.total : undefined,
          reason: !c.outcome.success ? 'failed' : c.mission.loopRecalled ? 'recalled' : 'completed',
        });
      }

      // Conclusão normal: libera os heróis para IDLE
      goldGained += rewardFinal;
      c.mission.heroIds.forEach((hid: string) => {
        const idx = currentHeroes.findIndex((hh) => hh.id === hid);
        if (idx >= 0) {
          currentHeroes[idx] = { ...currentHeroes[idx], currentTask: HeroTask.IDLE };
        }
      });
    }
  });

  const newResults: MissionResult[] = completed.map(c => ({
    ...c.outcome,
    missionId: c.mission.id,
    templateId: c.mission.templateId,
    totalEnemies: countTotalEnemies(resolveMissionTemplate(c.mission.templateId, c.mission.isWeeklyBoss)),
    activeSynergies: c.mission.activeSynergies,
    fromLoop: !!c.mission.loop,
  }));

  return {
    newHeroes: currentHeroes,
    activeMissions: remainingMissions,
    goldGained,
    newResults,
    materialDrops,
    weeklyBossDefeated: weeklyBossCompletedThisTick,
    weeklyBossTemplateId,
    completedLoops,
    perHeroGold,
  };
}

/**
 * Emite analytics.track('mission_completed') para cada resultado bem-sucedido.
 * Consent-gated via o gate de módulo de analytics — no-op sem aceite.
 * Chamado pelo tickHandler após processMissions.
 */
export function trackMissionCompletions(results: MissionResult[]): void {
  for (const r of results) {
    if (r.success) {
      analytics.track('mission_completed', { goldEarned: r.reward });
    }
  }
}
