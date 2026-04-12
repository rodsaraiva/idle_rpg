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
import * as path from 'path';
import { configProvider } from '../../src/services/configProvider';
import { MISSIONS, MissionTemplate } from '../../src/constants/missions';
import { ClassId, Hero, Equipment, PersonalityId } from '../../src/types';
import { generateTrainedHero } from '../utils/trainedHeroGenerator';
import { runMissionSimulation, SimulationResult } from '../utils/simulationRunner';
import { PERSONALITY_LIST, PERSONALITIES } from '../../src/constants/personalities';
import { SYNERGIES, getActiveSynergies } from '../../src/constants/synergies';
import { EQUIPMENT_TIERS } from '../../src/constants/equipment';

const ITERATIONS = 2000; // Fast but still statistically meaningful
const OUTPUT_FILE = 'scripts/simulations/BALANCE_REPORT.md';
const CLASSES = Object.keys(configProvider.getAllClassDefs()) as ClassId[];

// Progression stage — all tests use the same stage for fair comparison
const STAGE_MS = 3 * 24 * 60 * 60 * 1000; // Day 3
const STAGE_LABEL = 'Dia 3';

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

function makeEquipment(tier: number, stat: 'atk' | 'defense' | 'hp' | 'crit', value: number): Equipment {
  return {
    id: `sim_eq_${tier}_${stat}`,
    name: `Sim ${stat} T${tier}`,
    type: stat === 'defense' || stat === 'hp' ? 'armor' : stat === 'crit' ? 'accessory' : 'weapon',
    statBonus: { [stat]: value } as any,
    tier,
  };
}

function uniqueHeroes<T extends Hero>(heroes: T[]): T[] {
  // Clone and give unique IDs so simulationRunner doesn't deduplicate by id
  return heroes.map((h, i) => ({ ...h, id: `${h.id}_${i}` }));
}

function combinations<T>(arr: T[], n: number): T[][] {
  if (n === 0) return [[]];
  if (arr.length === 0) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(arr, n - 1).map(c => [first, ...c]).filter(c => c.length === n);
  const withoutFirst = combinations(rest, n);
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
      const result = runMissionSimulation({ heroes: [hero], missionId: mission.id, iterations: ITERATIONS });
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
  avgHpLost: number;
}

function sweepPersonalities(): PersonalityResult[] {
  console.log('\n[2/5] Personality × Class sweep...');
  const results: PersonalityResult[] = [];
  const mission = 'mission_1'; // Solo mission

  for (const classId of CLASSES) {
    for (const p of PERSONALITY_LIST) {
      const hero = generateTrainedHero(classId, {
        ms: STAGE_MS,
        focus: getFocusForClass(classId),
        personality: p.id,
      });
      hero.id = `p_${classId}_${p.id}`;
      const r = runMissionSimulation({ heroes: [hero], missionId: mission, iterations: ITERATIONS });
      results.push({
        classId,
        personality: p.id,
        mission,
        winPct: parsePercent(r.winRate),
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
  console.log('\n[3/5] Equipment impact sweep...');
  const results: EquipmentResult[] = [];
  const mission = 'mission_1';

  // Representative items per tier: weapon (+atk) and armor (+defense)
  const conditions: { label: string; items: Equipment[] }[] = [
    { label: 'Sem itens', items: [] },
    { label: '1x Comum ATK', items: [makeEquipment(1, 'atk', 5)] },
    { label: '1x Raro ATK', items: [makeEquipment(2, 'atk', 10)] },
    { label: '1x Épico ATK', items: [makeEquipment(3, 'atk', 15)] },
    { label: 'ATK+DEF Épico', items: [makeEquipment(3, 'atk', 15), makeEquipment(3, 'defense', 20)] },
  ];

  for (const classId of CLASSES) {
    for (const cond of conditions) {
      const baseHero = generateTrainedHero(classId, { ms: STAGE_MS, focus: getFocusForClass(classId) });
      const equipped = applyEquipmentToHero(baseHero, cond.items);
      equipped.id = `eq_${classId}_${cond.label}`;
      const r = runMissionSimulation({ heroes: [equipped], missionId: mission, iterations: ITERATIONS });
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
      const r = runMissionSimulation({ heroes, missionId: mission.id, iterations: ITERATIONS });
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
  return [
    ['TANK', 'WARRIOR', 'HEALER', 'ARCHER'],     // Classic balanced
    ['TANK', 'TANK', 'HEALER', 'MAGE'],          // Defensive
    ['WARRIOR', 'ROGUE', 'ARCHER', 'MAGE'],      // All DPS
    ['TANK', 'HEALER', 'HEALER', 'ARCHER'],      // Sustain
    ['WARRIOR', 'WARRIOR', 'HEALER', 'HEALER'],  // Bruiser duo
    ['TANK', 'ARCHER', 'MAGE', 'HEALER'],        // Backline with tank
    ['ROGUE', 'ROGUE', 'HEALER', 'TANK'],        // Flanker focus
    ['WARRIOR', 'HEALER', 'ARCHER', 'MAGE'],     // No tank glass cannon
    ['TANK', 'TANK', 'WARRIOR', 'HEALER'],       // Frontline wall
    ['ARCHER', 'ARCHER', 'HEALER', 'HEALER'],    // Ranged sustain
  ];
}

// ============================================================================
// Sweep 5: Synergy Validation
// ============================================================================

interface SynergyTest {
  name: string;
  withSynergy: ClassId[];
  withoutSynergy: ClassId[];
  withWin: number;
  withoutWin: number;
  delta: number;
}

function sweepSynergies(): SynergyTest[] {
  console.log('\n[5/5] Synergy validation...');
  const results: SynergyTest[] = [];
  const mission = 'mission_4';

  // For each defined synergy, compare comp WITH synergy vs WITHOUT (swap one class)
  for (const synergy of SYNERGIES) {
    const withClasses: ClassId[] = [synergy.classes[0], synergy.classes[1]];
    // "Without" version: swap second class for a neutral WARRIOR (unless synergy already has Warrior)
    const neutral: ClassId = withClasses.includes('WARRIOR') ? 'ARCHER' : 'WARRIOR';
    const withoutClasses: ClassId[] = [synergy.classes[0], neutral];

    const withHeroes = withClasses.map((c, i) => {
      const h = generateTrainedHero(c, { ms: STAGE_MS, focus: getFocusForClass(c) });
      h.id = `syn_w_${i}`;
      return h;
    });
    const withoutHeroes = withoutClasses.map((c, i) => {
      const h = generateTrainedHero(c, { ms: STAGE_MS, focus: getFocusForClass(c) });
      h.id = `syn_wo_${i}`;
      return h;
    });

    const withR = runMissionSimulation({ heroes: withHeroes, missionId: mission, iterations: ITERATIONS });
    const withoutR = runMissionSimulation({ heroes: withoutHeroes, missionId: mission, iterations: ITERATIONS });

    const withWin = parsePercent(withR.winRate);
    const withoutWin = parsePercent(withoutR.winRate);

    results.push({
      name: synergy.name,
      withSynergy: withClasses,
      withoutSynergy: withoutClasses,
      withWin,
      withoutWin,
      delta: withWin - withoutWin,
    });
    process.stdout.write('.');
  }
  console.log(' done');
  return results;
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
    const full = equipment.find(e => e.classId === cls && e.condition === 'ATK+DEF Épico');
    return { cls, delta: (full?.winPct ?? 0) - (noItem?.winPct ?? 0) };
  }).sort((a, b) => b.delta - a.delta);
  p('**Impacto dos equipamentos (Sem itens → Épico ATK+DEF):**');
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
  p('| Sinergia | Com Sinergia | Sem Sinergia | Δ Win Rate | Funcional? |');
  p('|----------|--------------|--------------|------------|------------|');
  for (const s of synergies) {
    const functional = s.delta >= 5 ? '✅' : s.delta >= 2 ? '⚠️' : '❌';
    p(`| ${s.name} | ${s.withWin.toFixed(0)}% | ${s.withoutWin.toFixed(0)}% | ${s.delta >= 0 ? '+' : ''}${s.delta.toFixed(1)}pp | ${functional} |`);
  }
  p('');
  const workingCount = synergies.filter(s => s.delta >= 5).length;
  const totalCount = synergies.length;
  p(`**Insight**: ${workingCount}/${totalCount} sinergias têm impacto significativo (≥5pp). Sinergias com delta <2pp estão praticamente inativas e deveriam ser rebalanceadas.`);
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
// Main
// ============================================================================

function main() {
  const startTime = Date.now();
  console.log('======================================================');
  console.log('  BALANCE ANALYSIS — Comprehensive Sweep');
  console.log(`  Iterations per scenario: ${ITERATIONS}`);
  console.log(`  Progression stage: ${STAGE_LABEL}`);
  console.log('======================================================');

  const classMission = sweepClassVsMission();
  const personality = sweepPersonalities();
  const equipment = sweepEquipment();
  const compositions = sweepCompositions();
  const synergies = sweepSynergies();

  console.log('\n\nGenerating report...');
  const report = generateReport(classMission, personality, equipment, compositions, synergies);
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
