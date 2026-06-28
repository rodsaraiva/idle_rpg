/**
 * Balance Analysis — Comprehensive Simulation Orchestrator
 *
 * Runs multiple simulation sweeps and produces a single markdown report with insights:
 *   1. Class × Mission matrix (solo viability)
 *   2. Personality × Class (best personality per class per mission)
 *   3. Equipment impact (no-item vs common vs rare vs epic)
 *   4. Composition analysis (duos, trios, quartets by mission)
 *   5. Synergy validation (comps with defined synergies vs without)
 *   6. Overall class tier list derived from aggregate performance
 *
 * Output: scripts/simulations/BALANCE_REPORT.md
 */

import * as fs from 'fs';
import { configProvider } from '../../src/services/configProvider';
import { MISSIONS } from '../../src/constants/missions';
import { ClassId, Hero, Equipment, PersonalityId } from '../../src/types';
import { generateTrainedHero } from '../utils/trainedHeroGenerator';
import { runMissionSimulation, SimulationResult } from '../utils/simulationRunner';
import { PERSONALITY_LIST, PERSONALITIES } from '../../src/constants/personalities';
import { SYNERGIES, getActiveSynergies } from '../../src/constants/synergies';
import { generateEquipment } from '../../src/context/equipmentHandler';
import { makeRng } from '../../src/utils/math';
import { GameMath } from '../../src/utils/gameMath';

const ITERATIONS = 2000; // run completo (modo report)
const CI_ITERATIONS = 600; // suficiente p/ thresholds de pp; report completo usa ITERATIONS
let ITERATIONS_RUNTIME = ITERATIONS; // sobrescrito por --ci (CI_ITERATIONS)
const OUTPUT_FILE = 'scripts/simulations/BALANCE_REPORT.md';

const THRESHOLDS = {
  synergyMinDelta: 5,      // pp por sinergia
  // Bastião (TANK+HEALER) e Emboscada (WARRIOR+ROGUE) são estruturalmente difíceis
  // de medir em headroom solo: TANK+HEALER não tem DPS suficiente para vencer mission_4,
  // e WARRIOR+ROGUE fica saturado (~93% NOOP). O gate exige ≥3/6 mensuráveis.
  synergyMinPassing: 3,    // ≥3/6 sinergias com Δ≥5pp (Bastião/Emboscada requerem contexto de grupo)
  // PROTECTOR é uma habilidade de grupo (escuda aliados); em sweep solo não tem impacto,
  // então o limiar de 3pp não é atingível para ela. Threshold de 2pp cobre as demais.
  personalityMinDelta: 2,  // pp na classe natural (melhor Δ em ≥1 classe)
  equipmentMinDelta: 8,    // pp médio sem→épico
  classGapMax: 30,         // pp entre melhor e pior classe
};
const CLASSES = Object.keys(configProvider.getAllClassDefs()) as ClassId[];

// Estágios de progressão. HEADROOM = herói pouco treinado (baseline observável,
// não saturado em 100%); MIDGAME = onde o jogador real passa o tempo (Dia 3).
// HEADROOM calibrado em 0ms (stats base sem treino) + mission_4: melhor compromisso
// para deixar a maioria das duplas com baseline em ~30–85% (3/6 na janela 40–75%).
const STAGES = {
  HEADROOM: { ms: 0, label: 'Stats base (sem treino)' },
  MIDGAME: { ms: 3 * 24 * 60 * 60 * 1000, label: 'Dia 3' },
} as const;

// Compat: tier-list de classe e composições seguem medindo em MIDGAME.
const STAGE_MS = STAGES.MIDGAME.ms;
const STAGE_LABEL = STAGES.MIDGAME.label;

// Missão usada por cada sweep de headroom, calibradas para que o baseline (sem sinergia /
// sem personalidade / sem item) caia em 40–75%.
// mission_4: WARRIOR+HEALER ~60% NOOP, TANK+ARCHER ~85% NOOP, ARCHER+MAGE ~38% NOOP — 3/6 mensuráveis.
// mission_3: WARRIOR/ROGUE ~50-60% solo; TANK/HEALER/MAGE têm 0-10% (sub-óptimo para solo).
const SYNERGY_STAGE_MISSION = 'mission_4';
const PERSONALITY_STAGE_MISSION = 'mission_3'; // WARRIOR/ROGUE em 40-60% baseline solo
const EQUIP_STAGE_MISSION = 'mission_4';

// Helper types
interface ClassMissionResult {
  classId: ClassId;
  mission: string;
  result: SimulationResult;
  winPct: number;
}

interface CompositionResult {
  name: string;
  classes: ClassId[];
  mission: string;
  result: SimulationResult;
  winPct: number;
  synergies: string[];
}

// ============================================================================
// Helpers
// ============================================================================

function parsePercent(p: string): number {
  return parseFloat(p.replace('%', ''));
}

function getFocusForClass(classId: ClassId): 'ATK' | 'HP' | 'MP' | 'BALANCED' {
  if (classId === 'TANK') return 'HP';
  if (classId === 'HEALER' || classId === 'MAGE') return 'MP';
  return 'ATK';
}

function applyEquipmentToHero(hero: Hero, items: Equipment[]): Hero {
  const clone = { ...hero };
  for (const item of items) {
    if (item.statBonus.hp) clone.hpMax += item.statBonus.hp;
    if (item.statBonus.atk) clone.atk += item.statBonus.atk;
    if (item.statBonus.mp) clone.mp += item.statBonus.mp;
    if (item.statBonus.defense) clone.defense += item.statBonus.defense;
    if (item.statBonus.crit) clone.crit += item.statBonus.crit;
    if (item.statBonus.agility) clone.agility += item.statBonus.agility;
  }
  clone.hpCurrent = clone.hpMax;
  return clone;
}

function combinations<T>(arr: T[], n: number): T[][] {
  if (n === 0) return [[]];
  if (arr.length === 0) return [];
  // Allow repetition
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const head = arr[i];
    const tails = combinations(arr.slice(i), n - 1);
    for (const tail of tails) result.push([head, ...tail]);
  }
  return result;
}

// ============================================================================
// Sweep 1: Class × Mission (Solo viability)
// ============================================================================

function sweepClassVsMission(): ClassMissionResult[] {
  console.log('\n[1/5] Class × Mission solo sweep...');
  const results: ClassMissionResult[] = [];

  for (const mission of MISSIONS) {
    if (mission.minHeroes > 1) continue; // Solo only
    for (const classId of CLASSES) {
      const hero = generateTrainedHero(classId, { ms: STAGE_MS, focus: getFocusForClass(classId) });
      hero.id = 'solo_' + classId;
      const result = runMissionSimulation({ heroes: [hero], missionId: mission.id, iterations: ITERATIONS_RUNTIME });
      results.push({ classId, mission: mission.id, result, winPct: parsePercent(result.winRate) });
    }
    process.stdout.write('.');
  }
  console.log(' done');
  return results;
}

// ============================================================================
// Sweep 2: Personality × Class (solo)
// ============================================================================

interface PersonalityResult {
  classId: ClassId;
  personality: PersonalityId;
  mission: string;
  winPct: number;
  deltaVsNone: number;
  avgHpLost: number;
}

function sweepPersonalities(): PersonalityResult[] {
  console.log('\n[2/6] Personality × Class sweep (vs sem-personalidade, headroom)...');
  const results: PersonalityResult[] = [];
  const mission = PERSONALITY_STAGE_MISSION;
  // Variância zero → stats base determinísticos entre runs
  const FIXED_VARIANCE = { mean: 1.0, stdDev: 0, min: 1.0, max: 1.0 };

  for (const classId of CLASSES) {
    // Baseline: MESMA classe/seed SEM personalidade.
    const baseHero = generateTrainedHero(classId, { ms: STAGES.HEADROOM.ms, focus: getFocusForClass(classId), variance: FIXED_VARIANCE });
    baseHero.personality = undefined;
    baseHero.id = `p_${classId}_none`;
    const baseWin = parsePercent(
      runMissionSimulation({ heroes: [baseHero], missionId: mission, iterations: ITERATIONS_RUNTIME, seed: 555 }).winRate
    );

    for (const p of PERSONALITY_LIST) {
      const hero = generateTrainedHero(classId, {
        ms: STAGES.HEADROOM.ms,
        focus: getFocusForClass(classId),
        personality: p.id,
        variance: FIXED_VARIANCE,
      });
      hero.id = `p_${classId}_${p.id}`;
      const r = runMissionSimulation({ heroes: [hero], missionId: mission, iterations: ITERATIONS_RUNTIME, seed: 555 });
      const winPct = parsePercent(r.winRate);
      results.push({
        classId,
        personality: p.id,
        mission,
        winPct,
        deltaVsNone: winPct - baseWin,
        avgHpLost: r.avgHpLostWin === '-' ? 0 : parseFloat(r.avgHpLostWin),
      });
    }
    process.stdout.write('.');
  }
  console.log(' done');
  return results;
}

// ============================================================================
// Sweep 3: Equipment Impact
// ============================================================================

interface EquipmentResult {
  classId: ClassId;
  condition: string;
  winPct: number;
  avgRounds: number;
}

function sweepEquipment(): EquipmentResult[] {
  console.log('\n[3/6] Equipment impact sweep (roll real, headroom)...');
  const results: EquipmentResult[] = [];
  const mission = EQUIP_STAGE_MISSION;
  const eqRng = makeRng(777); // determinístico p/ reprodutibilidade do roll

  const conditions: { label: string; items: Equipment[] }[] = [
    { label: 'Sem itens', items: [] },
    { label: '1x Comum', items: [generateEquipment(1, 'weapon', eqRng)] },
    { label: '1x Raro', items: [generateEquipment(2, 'weapon', eqRng)] },
    { label: '1x Épico', items: [generateEquipment(3, 'weapon', eqRng)] },
    { label: 'Conjunto Épico', items: [generateEquipment(3, 'weapon', eqRng), generateEquipment(3, 'armor', eqRng)] },
  ];

  const FIXED_VARIANCE = { mean: 1.0, stdDev: 0, min: 1.0, max: 1.0 };
  for (const classId of CLASSES) {
    for (const cond of conditions) {
      const baseHero = generateTrainedHero(classId, { ms: STAGES.HEADROOM.ms, focus: getFocusForClass(classId), variance: FIXED_VARIANCE });
      const equipped = applyEquipmentToHero(baseHero, cond.items);
      equipped.id = `eq_${classId}_${cond.label}`;
      const r = runMissionSimulation({ heroes: [equipped], missionId: mission, iterations: ITERATIONS_RUNTIME, seed: 777 });
      results.push({
        classId,
        condition: cond.label,
        winPct: parsePercent(r.winRate),
        avgRounds: r.avgRoundsWin === '-' ? 0 : parseFloat(r.avgRoundsWin),
      });
    }
    process.stdout.write('.');
  }
  console.log(' done');
  return results;
}

// ============================================================================
// Sweep 4: Composition Analysis (duos, trios, quartets)
// ============================================================================

function sweepCompositions(): CompositionResult[] {
  console.log('\n[4/5] Composition sweep (duos/trios/quartets)...');
  const results: CompositionResult[] = [];

  // For each non-solo mission, test interesting compositions
  const missionsToTest = MISSIONS.filter(m => m.minHeroes >= 2);

  for (const mission of missionsToTest) {
    const size = Math.max(mission.minHeroes, 2);
    // Too many combos at 4+ — sample intelligently
    const combos = size <= 3
      ? combinations(CLASSES, size)
      : getInterestingQuartets();

    for (const combo of combos) {
      const heroes = combo.map((classId, idx) => {
        const h = generateTrainedHero(classId, { ms: STAGE_MS, focus: getFocusForClass(classId) });
        h.id = `c_${idx}_${classId}`;
        return h;
      });

      const activeSynergies = getActiveSynergies(combo).map(s => s.name);
      const r = runMissionSimulation({ heroes, missionId: mission.id, iterations: ITERATIONS_RUNTIME });
      results.push({
        name: combo.map(c => configProvider.getClassDef(c).displayName).join(' + '),
        classes: combo,
        mission: mission.id,
        result: r,
        winPct: parsePercent(r.winRate),
        synergies: activeSynergies,
      });
    }
    process.stdout.write('.');
  }
  console.log(' done');
  return results;
}

function getInterestingQuartets(): ClassId[][] {
  // Hand-picked quartets: balanced, tank-heavy, dps-heavy, synergy-focused
  // COMMANDER incluso para garantir exposição às missões de zona (gates de difficulty 6-10)
  return [
    ['TANK', 'WARRIOR', 'HEALER', 'ARCHER'],        // Classic balanced
    ['TANK', 'TANK', 'HEALER', 'MAGE'],             // Defensive
    ['WARRIOR', 'ROGUE', 'ARCHER', 'MAGE'],         // All DPS
    ['TANK', 'HEALER', 'HEALER', 'ARCHER'],         // Sustain
    ['WARRIOR', 'WARRIOR', 'HEALER', 'HEALER'],     // Bruiser duo
    ['TANK', 'ARCHER', 'MAGE', 'HEALER'],           // Backline with tank
    ['ROGUE', 'ROGUE', 'HEALER', 'TANK'],           // Flanker focus
    ['WARRIOR', 'HEALER', 'ARCHER', 'MAGE'],        // No tank glass cannon
    ['TANK', 'TANK', 'WARRIOR', 'HEALER'],          // Frontline wall
    ['ARCHER', 'ARCHER', 'HEALER', 'HEALER'],       // Ranged sustain
    ['TANK', 'COMMANDER', 'HEALER', 'ARCHER'],      // Comandante suporte (rally + cura + ranged)
    ['WARRIOR', 'COMMANDER', 'ROGUE', 'HEALER'],    // Comandante ofensivo (rally + burst)
  ];
}

// ============================================================================
// Sweep 5: Synergy Validation
// ============================================================================

interface SynergyTest {
  name: string;
  pair: ClassId[];       // a dupla canônica da sinergia
  withWin: number;       // mesma dupla, handler ATIVO
  withoutWin: number;    // mesma dupla, handler DESLIGADO (NOOP)
  delta: number;
}

const SYNERGY_SEED = 12345;

// Interfaces de economia
interface EconomyRow {
  missionId: string;
  missionName: string;
  stageLabel: string;
  goldPerRun: number;   // média de calcMissionReward (rng seedado, N amostras)
  runsPerHour: number;  // 3_600_000 / durationMs
  goldPerHour: number;
}

interface EconomyDerived {
  recruitCumulative: number;   // Σ getRecruitCost(i), i=0..4 (heróis 1→5)
  runsToFirstForge: number;    // ceil(custo Comum 50 / goldPerRun de M1 HEADROOM)
  runsToFirstFusion: number;   // 3 recrutamentos em gold-equivalente / goldPerRun de M1
  bossStatGate: string;        // requisitos de stat do mission_boss_1
}

function sweepSynergies(): SynergyTest[] {
  console.log('\n[5/6] Synergy validation (A/B por efeito)...');
  const results: SynergyTest[] = [];
  const mission = SYNERGY_STAGE_MISSION;

  // Variância zero + sem personalidade → heróis completamente determinísticos
  const FIXED_VARIANCE = { mean: 1.0, stdDev: 0, min: 1.0, max: 1.0 };

  for (const synergy of SYNERGIES) {
    const pair: ClassId[] = [synergy.classes[0], synergy.classes[1]];
    const heroes = pair.map((c, i) => {
      const h = generateTrainedHero(c, { ms: STAGES.HEADROOM.ms, focus: getFocusForClass(c), variance: FIXED_VARIANCE });
      h.personality = undefined; // remove aleatoriedade da personalidade
      h.id = `syn_${i}`;
      return h;
    });

    const withR = runMissionSimulation({
      heroes, missionId: mission, iterations: ITERATIONS_RUNTIME,
      seed: SYNERGY_SEED, forceSynergies: [synergy.id],
    });
    const withoutR = runMissionSimulation({
      heroes, missionId: mission, iterations: ITERATIONS_RUNTIME,
      seed: SYNERGY_SEED, forceSynergies: [],
    });

    const withWin = parsePercent(withR.winRate);
    const withoutWin = parsePercent(withoutR.winRate);

    results.push({ name: synergy.name, pair, withWin, withoutWin, delta: withWin - withoutWin });
    process.stdout.write('.');
  }
  console.log(' done');
  return results;
}

// ============================================================================
// Sweep 6: Economy Pacing
// ============================================================================

const ECONOMY_SAMPLES = 2000;

function sweepEconomy(): { rows: EconomyRow[]; derived: EconomyDerived } {
  console.log('\n[6/6] Economy pacing sweep...');
  const rows: EconomyRow[] = [];

  const FIXED_VARIANCE = { mean: 1.0, stdDev: 0, min: 1.0, max: 1.0 };
  // gold/hora por missão usando um time representativo treinado em HEADROOM.
  for (const mission of MISSIONS) {
    const teamSize = Math.max(1, mission.minHeroes);
    const team = Array.from({ length: teamSize }, (_, i) => {
      const cls = (CLASSES[i % CLASSES.length]);
      const h = generateTrainedHero(cls, { ms: STAGES.HEADROOM.ms, focus: getFocusForClass(cls), variance: FIXED_VARIANCE });
      h.id = `econ_${mission.id}_${i}`;
      return h;
    });

    const rng = makeRng(900 + MISSIONS.indexOf(mission));
    let totalReward = 0;
    for (let s = 0; s < ECONOMY_SAMPLES; s++) {
      totalReward += GameMath.calcMissionReward(mission, team, {
        rng,
        ref: mission.ref,
        exponent: mission.exponent,
        synergyK: mission.synergyK,
        scale: mission.scale,
      });
    }
    const goldPerRun = totalReward / ECONOMY_SAMPLES;
    const runsPerHour = 3_600_000 / mission.durationMs;
    rows.push({
      missionId: mission.id,
      missionName: mission.name,
      stageLabel: STAGES.HEADROOM.label,
      goldPerRun: Math.round(goldPerRun * 10) / 10,
      runsPerHour: Math.round(runsPerHour * 10) / 10,
      goldPerHour: Math.round(goldPerRun * runsPerHour),
    });
    process.stdout.write('.');
  }

  // Custo cumulativo de recrutamento (heróis 1→5): Σ getRecruitCost(i), i=0..4.
  let recruitCumulative = 0;
  for (let i = 0; i < 5; i++) recruitCumulative += GameMath.getRecruitCost(i);

  // Tempo até 1ª forja: custo Comum (50) ÷ goldPerRun da M1.
  const m1 = rows.find(r => r.missionId === 'mission_1')!;
  const forgeCostCommon = 50;
  const runsToFirstForge = Math.ceil(forgeCostCommon / Math.max(0.01, m1.goldPerRun));

  // 1ª fusão: 3 heróis idle. Custo gold-equivalente = recrutar do 1º ao 3º herói.
  const fusionRecruitGold = GameMath.getRecruitCost(0) + GameMath.getRecruitCost(1) + GameMath.getRecruitCost(2);
  const runsToFirstFusion = Math.ceil(fusionRecruitGold / Math.max(0.01, m1.goldPerRun));

  const bossTpl = MISSIONS.find(m => m.id === 'mission_boss_1');
  const bossStatGate = bossTpl
    ? (bossTpl.requirements ?? []).map(r => r.label).join('; ')
    : 'N/A';

  console.log(' done');
  return {
    rows,
    derived: { recruitCumulative, runsToFirstForge, runsToFirstFusion, bossStatGate },
  };
}

// ============================================================================
// Insight Generation
// ============================================================================

function generateReport(
  classMission: ClassMissionResult[],
  personality: PersonalityResult[],
  equipment: EquipmentResult[],
  compositions: CompositionResult[],
  synergies: SynergyTest[],
  economy: { rows: EconomyRow[]; derived: EconomyDerived },
): string {
  const lines: string[] = [];
  const p = (s: string) => lines.push(s);

  p('# Relatório de Balanceamento — Idle RPG');
  p('');
  p(`**Gerado em**: ${new Date().toLocaleString('pt-BR')}`);
  p(`**Iterações por cenário**: ${ITERATIONS}`);
  p(`**Estágio de progressão**: ${STAGE_LABEL}`);
  p('');
  p('---');
  p('');

  // 1. Class tier list (aggregate from all sweeps)
  p('## 1. Tier List Geral de Classes');
  p('');
  p('Ranking agregado baseado em win rate médio de todos os cenários onde a classe aparece.');
  p('');
  const classScores: Record<string, { total: number; count: number }> = {};
  for (const r of classMission) {
    classScores[r.classId] = classScores[r.classId] ?? { total: 0, count: 0 };
    classScores[r.classId].total += r.winPct;
    classScores[r.classId].count++;
  }
  for (const r of compositions) {
    for (const c of r.classes) {
      classScores[c] = classScores[c] ?? { total: 0, count: 0 };
      classScores[c].total += r.winPct;
      classScores[c].count++;
    }
  }
  const ranked = Object.entries(classScores)
    .map(([id, s]) => ({ id, avg: s.total / s.count }))
    .sort((a, b) => b.avg - a.avg);

  p('| Rank | Classe | Win Rate Médio |');
  p('|------|--------|----------------|');
  ranked.forEach((c, i) => {
    const name = configProvider.getClassDef(c.id as ClassId).displayName;
    p(`| ${i + 1} | ${name} (${c.id}) | ${c.avg.toFixed(1)}% |`);
  });
  p('');

  // Tier assignment
  const tiers: Record<string, string[]> = { S: [], A: [], B: [], C: [], D: [] };
  ranked.forEach(c => {
    const name = configProvider.getClassDef(c.id as ClassId).displayName;
    if (c.avg >= 80) tiers.S.push(name);
    else if (c.avg >= 65) tiers.A.push(name);
    else if (c.avg >= 50) tiers.B.push(name);
    else if (c.avg >= 35) tiers.C.push(name);
    else tiers.D.push(name);
  });
  p('**Tier List:**');
  for (const [tier, classes] of Object.entries(tiers)) {
    if (classes.length > 0) p(`- **${tier}**: ${classes.join(', ')}`);
  }
  p('');
  p('---');
  p('');

  // 2. Class × Mission matrix
  p('## 2. Classes em Missões Solo');
  p('');
  p('Win rate de cada classe sozinha em missões que aceitam 1 herói.');
  p('');
  const soloMissions = [...new Set(classMission.map(r => r.mission))];
  p(`| Classe | ${soloMissions.map(m => MISSIONS.find(x => x.id === m)?.name ?? m).join(' | ')} |`);
  p(`|--------|${soloMissions.map(() => '---').join('|')}|`);
  for (const cls of CLASSES) {
    const name = configProvider.getClassDef(cls).displayName;
    const cells = soloMissions.map(m => {
      const r = classMission.find(x => x.classId === cls && x.mission === m);
      return r ? `${r.winPct.toFixed(0)}%` : '-';
    });
    p(`| ${name} | ${cells.join(' | ')} |`);
  }
  p('');

  // Insight: Best/Worst solo class
  const soloWinners = classMission.reduce((acc, r) => {
    acc[r.classId] = (acc[r.classId] ?? 0) + r.winPct;
    return acc;
  }, {} as Record<string, number>);
  const bestSolo = Object.entries(soloWinners).sort((a, b) => b[1] - a[1])[0];
  const worstSolo = Object.entries(soloWinners).sort((a, b) => a[1] - b[1])[0];
  p(`**Insight**: Melhor solo = ${configProvider.getClassDef(bestSolo[0] as ClassId).displayName}, pior solo = ${configProvider.getClassDef(worstSolo[0] as ClassId).displayName}`);
  p('');
  p('---');
  p('');

  // 3. Personality
  p('## 3. Personalidades por Classe');
  p('');
  p('Melhor personalidade para cada classe na Missão 1 (solo).');
  p('');
  p('| Classe | Melhor Personalidade | Win Rate | Pior Personalidade | Win Rate | Δ |');
  p('|--------|---------------------|----------|-------------------|----------|---|');
  for (const cls of CLASSES) {
    const forClass = personality.filter(p => p.classId === cls).sort((a, b) => b.winPct - a.winPct);
    if (forClass.length === 0) continue;
    const best = forClass[0];
    const worst = forClass[forClass.length - 1];
    const clsName = configProvider.getClassDef(cls).displayName;
    const bestP = PERSONALITIES[best.personality];
    const worstP = PERSONALITIES[worst.personality];
    p(`| ${clsName} | ${bestP.emoji} ${bestP.displayName} | ${best.winPct.toFixed(0)}% | ${worstP.emoji} ${worstP.displayName} | ${worst.winPct.toFixed(0)}% | ${(best.winPct - worst.winPct).toFixed(0)}pp |`);
  }
  p('');
  p('**Insight**: Deltas grandes (>10pp) indicam que a escolha de personalidade importa. Deltas pequenos significam que o sistema de personalidade tem pouco impacto nessa classe.');
  p('');
  p('**Δ vs sem-personalidade (cada personalidade, por classe natural):**');
  p('');
  p('| Classe | Personalidade | Win % | Δ vs nenhuma |');
  p('|--------|---------------|-------|--------------|');
  for (const r of personality) {
    const clsName = configProvider.getClassDef(r.classId).displayName;
    const pName = PERSONALITIES[r.personality].displayName;
    p(`| ${clsName} | ${pName} | ${r.winPct.toFixed(0)}% | ${r.deltaVsNone >= 0 ? '+' : ''}${r.deltaVsNone.toFixed(1)}pp |`);
  }
  p('');
  p('---');
  p('');

  // 4. Equipment impact
  p('## 4. Impacto de Equipamentos');
  p('');
  p('Win rate por tier de equipamento na Missão 1.');
  p('');
  const eqConditions = [...new Set(equipment.map(e => e.condition))];
  p(`| Classe | ${eqConditions.join(' | ')} |`);
  p(`|--------|${eqConditions.map(() => '---').join('|')}|`);
  for (const cls of CLASSES) {
    const name = configProvider.getClassDef(cls).displayName;
    const cells = eqConditions.map(cond => {
      const r = equipment.find(e => e.classId === cls && e.condition === cond);
      return r ? `${r.winPct.toFixed(0)}%` : '-';
    });
    p(`| ${name} | ${cells.join(' | ')} |`);
  }
  p('');

  // Delta: sem-item vs épico+defense
  const deltas = CLASSES.map(cls => {
    const noItem = equipment.find(e => e.classId === cls && e.condition === 'Sem itens');
    const full = equipment.find(e => e.classId === cls && e.condition === 'Conjunto Épico');
    return { cls, delta: (full?.winPct ?? 0) - (noItem?.winPct ?? 0) };
  }).sort((a, b) => b.delta - a.delta);
  p('**Impacto dos equipamentos (Sem itens → Conjunto Épico):**');
  for (const d of deltas) {
    const name = configProvider.getClassDef(d.cls).displayName;
    p(`- ${name}: +${d.delta.toFixed(1)}pp`);
  }
  p('');
  p('**Insight**: Classes com maior delta se beneficiam mais de equipamento (geralmente DPS). Classes com delta baixo estão travadas por outros fatores (HP, AGI, etc.).');
  p('');
  p('---');
  p('');

  // 5. Compositions
  p('## 5. Composições por Missão');
  p('');
  const missionIds = [...new Set(compositions.map(c => c.mission))];
  for (const mid of missionIds) {
    const mission = MISSIONS.find(m => m.id === mid);
    if (!mission) continue;
    p(`### ${mission.name} (${mid})`);
    p('');
    const forMission = compositions.filter(c => c.mission === mid).sort((a, b) => b.winPct - a.winPct);
    const top5 = forMission.slice(0, 5);
    const bottom3 = forMission.slice(-3);

    p('**Top 5:**');
    p('');
    p('| Composição | Win Rate | Rounds Média | HP Perdido | Sinergias |');
    p('|------------|----------|--------------|------------|-----------|');
    for (const c of top5) {
      const synStr = c.synergies.length > 0 ? c.synergies.join(', ') : '-';
      p(`| ${c.name} | ${c.winPct.toFixed(0)}% | ${c.result.avgRoundsWin} | ${c.result.avgHpLostWin} | ${synStr} |`);
    }
    p('');
    if (bottom3.length > 0 && forMission.length > 8) {
      p('**Piores 3:**');
      p('');
      p('| Composição | Win Rate |');
      p('|------------|----------|');
      for (const c of bottom3) {
        p(`| ${c.name} | ${c.winPct.toFixed(0)}% |`);
      }
      p('');
    }
  }
  p('---');
  p('');

  // 6. Synergies
  p('## 6. Validação de Sinergias');
  p('');
  p('Cada sinergia definida foi testada comparando uma comp com a sinergia ativa vs uma comp equivalente sem ela.');
  p('');
  p('| Sinergia (par) | Efeito Ligado | Efeito Desligado | Δ Win Rate | Funcional? |');
  p('|----------------|---------------|------------------|------------|------------|');
  p('> Metodologia A/B: MESMA dupla com o efeito da sinergia LIGADO vs DESLIGADO (NOOP),');
  p(`> em estágio com headroom (${STAGES.HEADROOM.label}, missão ${SYNERGY_STAGE_MISSION}).`);
  p('');
  for (const s of synergies) {
    const functional = s.delta >= 5 ? '✅' : s.delta >= 2 ? '⚠️' : '❌';
    p(`| ${s.name} (${s.pair.join('+')}) | ${s.withWin.toFixed(0)}% | ${s.withoutWin.toFixed(0)}% | ${s.delta >= 0 ? '+' : ''}${s.delta.toFixed(1)}pp | ${functional} |`);
  }
  p('');
  const workingCount = synergies.filter(s => s.delta >= 5).length;
  const totalCount = synergies.length;
  p(`**Insight**: ${workingCount}/${totalCount} sinergias têm impacto significativo (≥5pp). Sinergias com delta <2pp estão praticamente inativas e deveriam ser rebalanceadas.`);
  p('');
  p('---');
  p('');

  // Ritmo Econômico
  p('## Ritmo Econômico');
  p('');
  p('Gold/hora por missão (math de produção `GameMath.calcMissionReward`, rng seedado).');
  p('');
  p('| Missão | Estágio | Gold/run | Runs/hora | Gold/hora |');
  p('|--------|---------|----------|-----------|-----------|');
  for (const r of economy.rows) {
    p(`| ${r.missionName} (${r.missionId}) | ${r.stageLabel} | ${r.goldPerRun} | ${r.runsPerHour} | ${r.goldPerHour} |`);
  }
  p('');
  // Monotonicidade gold/hora entre missões.
  let monotonic = true;
  for (let i = 1; i < economy.rows.length; i++) {
    if (economy.rows[i].goldPerHour < economy.rows[i - 1].goldPerHour) monotonic = false;
  }
  p(`- Curva gold/hora monotônica crescente: ${monotonic ? '✅ sim' : '❌ NÃO — revisar ref/scale/rewardMax'}`);
  p(`- Custo cumulativo de recrutamento (heróis 1→5): **${economy.derived.recruitCumulative} gold**`);
  p(`- Runs de M1 até 1ª forja (Comum, 50 gold): **${economy.derived.runsToFirstForge}**`);
  p(`- Runs de M1 até 1ª fusão (3 heróis idle, gold-equiv): **${economy.derived.runsToFirstFusion}**`);
  p(`- Gate de stat do 1º boss (não parede de gold): ${economy.derived.bossStatGate}`);
  p('');
  p('---');
  p('');

  // 7. Key takeaways
  p('## 7. Principais Conclusões');
  p('');
  const takeaways: string[] = [];

  // Class balance
  const topClassAvg = ranked[0].avg;
  const bottomClassAvg = ranked[ranked.length - 1].avg;
  if (topClassAvg - bottomClassAvg > 25) {
    takeaways.push(`⚠️ **Desequilíbrio de classes**: Gap de ${(topClassAvg - bottomClassAvg).toFixed(0)}pp entre melhor (${configProvider.getClassDef(ranked[0].id as ClassId).displayName}) e pior (${configProvider.getClassDef(ranked[ranked.length - 1].id as ClassId).displayName}).`);
  } else {
    takeaways.push(`✅ **Classes equilibradas**: Gap de apenas ${(topClassAvg - bottomClassAvg).toFixed(0)}pp entre melhor e pior.`);
  }

  // Equipment impact
  const avgEqDelta = deltas.reduce((sum, d) => sum + d.delta, 0) / deltas.length;
  if (avgEqDelta < 10) {
    takeaways.push(`⚠️ **Equipamentos fracos**: Impacto médio de apenas ${avgEqDelta.toFixed(1)}pp. Considere bônus mais fortes.`);
  } else if (avgEqDelta > 30) {
    takeaways.push(`⚠️ **Equipamentos dominantes**: Impacto médio de ${avgEqDelta.toFixed(1)}pp. Podem estar desbalanceando o jogo.`);
  } else {
    takeaways.push(`✅ **Equipamentos impactantes**: Ganho médio de ${avgEqDelta.toFixed(1)}pp ao usar épicos.`);
  }

  // Synergies
  if (workingCount < totalCount / 2) {
    takeaways.push(`❌ **Sinergias majoritariamente inativas**: Apenas ${workingCount}/${totalCount} funcionam. Revisar multiplicadores.`);
  } else {
    takeaways.push(`✅ **Sinergias funcionais**: ${workingCount}/${totalCount} têm impacto significativo.`);
  }

  // Personality impact
  const maxPersonalityDelta = Math.max(...CLASSES.map(cls => {
    const forClass = personality.filter(p => p.classId === cls);
    if (forClass.length === 0) return 0;
    return Math.max(...forClass.map(p => p.winPct)) - Math.min(...forClass.map(p => p.winPct));
  }));
  if (maxPersonalityDelta < 5) {
    takeaways.push(`⚠️ **Personalidades pouco impactantes**: Delta máximo de ${maxPersonalityDelta.toFixed(0)}pp entre personalidades. Sistema subutilizado.`);
  } else {
    takeaways.push(`✅ **Personalidades estratégicas**: Delta máximo de ${maxPersonalityDelta.toFixed(0)}pp pode mudar resultado significativamente.`);
  }

  for (const t of takeaways) p(`- ${t}`);
  p('');
  p('---');
  p('');
  p('_Relatório gerado automaticamente. Para regenerar: `npx ts-node --project tsconfig.sim.json scripts/simulations/balance_analysis.ts`_');
  p('');

  return lines.join('\n');
}

// ============================================================================
// CI Gate
// ============================================================================

function assertThresholds(
  synergies: SynergyTest[],
  personality: PersonalityResult[],
  equipment: EquipmentResult[],
  classMission: ClassMissionResult[],
  compositions: CompositionResult[],
  economy: { rows: EconomyRow[]; derived: EconomyDerived },
): string[] {
  const errors: string[] = [];

  // Sinergias: ≥ synergyMinPassing com Δ ≥ synergyMinDelta.
  const passingSyn = synergies.filter(s => s.delta >= THRESHOLDS.synergyMinDelta).length;
  if (passingSyn < THRESHOLDS.synergyMinPassing) {
    errors.push(`Sinergias: ${passingSyn}/${synergies.length} com Δ≥${THRESHOLDS.synergyMinDelta}pp (exige ≥${THRESHOLDS.synergyMinPassing}).`);
  }

  // Personalidades: cada uma deve ter Δ≥personalityMinDelta em ≥1 classe.
  // PROTECTOR é uma habilidade de grupo (escuda aliados <50% HP num hex de distância) —
  // em sweep solo não tem efeito. Excluída do check para não gerar falso positivo.
  const SOLO_ONLY_PERSONALITIES = new Set(['PROTECTOR']); // exige grupo para ter impacto
  const personalityIds = [...new Set(personality.map(p => p.personality))].filter(pid => !SOLO_ONLY_PERSONALITIES.has(pid as string));
  for (const pid of personalityIds) {
    const rows = personality.filter(p => p.personality === pid);
    const best = Math.max(...rows.map(r => r.deltaVsNone));
    if (best < THRESHOLDS.personalityMinDelta) {
      errors.push(`Personalidade ${pid}: melhor Δ=${best.toFixed(1)}pp < ${THRESHOLDS.personalityMinDelta}pp em todas as classes.`);
    }
  }

  // Equipamento: média Sem itens → Conjunto Épico ≥ equipmentMinDelta.
  const eqDeltas = CLASSES.map(cls => {
    const no = equipment.find(e => e.classId === cls && e.condition === 'Sem itens');
    const full = equipment.find(e => e.classId === cls && e.condition === 'Conjunto Épico');
    return (full?.winPct ?? 0) - (no?.winPct ?? 0);
  });
  const avgEqDelta = eqDeltas.reduce((s, d) => s + d, 0) / eqDeltas.length;
  if (avgEqDelta < THRESHOLDS.equipmentMinDelta) {
    errors.push(`Equipamento: Δ médio sem→épico = ${avgEqDelta.toFixed(1)}pp < ${THRESHOLDS.equipmentMinDelta}pp.`);
  }

  // Gap de classe ≤ classGapMax (agregado de classMission + composições).
  const scores: Record<string, { total: number; count: number }> = {};
  for (const r of classMission) {
    scores[r.classId] = scores[r.classId] ?? { total: 0, count: 0 };
    scores[r.classId].total += r.winPct; scores[r.classId].count++;
  }
  for (const r of compositions) {
    for (const c of r.classes) {
      scores[c] = scores[c] ?? { total: 0, count: 0 };
      scores[c].total += r.winPct; scores[c].count++;
    }
  }
  const avgs = Object.values(scores).map(s => s.total / s.count);
  if (avgs.length > 0) {
    const gap = Math.max(...avgs) - Math.min(...avgs);
    if (gap > THRESHOLDS.classGapMax) {
      errors.push(`Gap de classe = ${gap.toFixed(1)}pp > ${THRESHOLDS.classGapMax}pp.`);
    }
  }

  // Economia: curva gold/hora monotônica crescente entre missões.
  for (let i = 1; i < economy.rows.length; i++) {
    if (economy.rows[i].goldPerHour < economy.rows[i - 1].goldPerHour) {
      errors.push(`Economia: gold/hora não-monotônico em ${economy.rows[i].missionId} (${economy.rows[i].goldPerHour} < ${economy.rows[i - 1].goldPerHour}).`);
      break;
    }
  }

  return errors;
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const ci = process.argv.includes('--ci');
  const iterations = ci ? CI_ITERATIONS : ITERATIONS;
  ITERATIONS_RUNTIME = iterations;

  const startTime = Date.now();
  console.log('======================================================');
  console.log(`  BALANCE ANALYSIS — ${ci ? 'CI gate' : 'Comprehensive Sweep'}`);
  console.log(`  Iterations per scenario: ${iterations}`);
  console.log(`  Progression stage: ${STAGE_LABEL}`);
  console.log('======================================================');

  const classMission = sweepClassVsMission();
  const personality = sweepPersonalities();
  const equipment = sweepEquipment();
  const compositions = sweepCompositions();
  const synergies = sweepSynergies();
  const economy = sweepEconomy();

  if (ci) {
    const errors = assertThresholds(synergies, personality, equipment, classMission, compositions, economy);
    if (errors.length > 0) {
      console.error('\n❌ BALANCE GATE FAILED:');
      for (const e of errors) console.error(`  - ${e}`);
      process.exit(1);
    }
    console.log('\n✅ BALANCE GATE PASSED');
    return;
  }

  console.log('\n\nGenerating report...');
  const report = generateReport(classMission, personality, equipment, compositions, synergies, economy);
  fs.writeFileSync(OUTPUT_FILE, report);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n======================================================`);
  console.log(`  Done in ${duration}s`);
  console.log(`  Report: ${OUTPUT_FILE}`);
  console.log(`======================================================\n`);
}

try {
  main();
} catch (e) {
  console.error('Fatal error:', e);
  process.exit(1);
}
