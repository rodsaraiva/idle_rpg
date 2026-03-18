import * as fs from 'fs';
import * as path from 'path';
import { CLASS_DEFS } from '../../../src/constants/classes';
import { MISSIONS, MissionTemplate } from '../../../src/constants/missions';
import { ClassId } from '../../../src/types/index';
import { generateTrainedHero } from '../../utils/trainedHeroGenerator';
import { runMissionSimulation } from '../../utils/simulationRunner';

const ITERATIONS = 10000;
const OUTPUT_DIR = 'scripts/simulations/missions';
const CLASSES = Object.keys(CLASS_DEFS) as ClassId[];

interface ProgressionStep {
  label: string;
  ms: number;
}

/**
 * Define os passos de progressão para cada missão.
 */
const MISSION_PROGRESSION: Record<string, ProgressionStep[]> = {
  'mission_1': [
    { label: 'Sem Treino (0 min)', ms: 0 },
    { label: '30 Minutos', ms: 30 * 60 * 1000 },
    { label: '1 Hora', ms: 60 * 60 * 1000 },
  ],
  'default': [
    { label: 'Dia 0', ms: 0 },
    { label: 'Dia 1', ms: 1 * 24 * 60 * 60 * 1000 },
    { label: 'Dia 3', ms: 3 * 24 * 60 * 60 * 1000 },
    { label: 'Dia 5', ms: 5 * 24 * 60 * 60 * 1000 },
    { label: 'Dia 7', ms: 7 * 24 * 60 * 60 * 1000 },
  ]
};

function getFocusForClass(classId: ClassId): 'ATK' | 'HP' | 'MP' | 'BALANCED' {
  if (classId === 'TANK') return 'HP';
  if (classId === 'HEALER' || classId === 'MAGE') return 'MP';
  return 'ATK';
}

function getCombinationsWithReplacement<T>(arr: T[], n: number): T[][] {
  if (n === 0) return [[]];
  const results: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const head = arr[i];
    const tailCombos = getCombinationsWithReplacement(arr.slice(i), n - 1);
    for (const tail of tailCombos) {
      results.push([head, ...tail]);
    }
  }
  return results;
}

function formatTable(data: Record<string, any>) {
  const keys = Object.keys(data);
  if (keys.length === 0) return '';
  const columns = Object.keys(data[keys[0]]);
  let table = '';
  table += `| ${'Classe/Grupo'.padEnd(35)} | ` + columns.map(c => c.padEnd(18)).join(' | ') + ' |\n';
  table += `| ${'-'.repeat(35)} | ` + columns.map(c => '-'.repeat(18)).join(' | ') + ' |\n';
  for (const key of keys) {
    table += `| ${key.padEnd(35)} | ` + columns.map(col => String(data[key][col]).padEnd(18)).join(' | ') + ' |\n';
  }
  return table;
}

function runScenarios() {
  console.log(`======================================================`);
  console.log(`  FRAMEWORK DE SIMULAÇÃO DE BALANCEAMENTO (v2)`);
  console.log(`  Iterações: ${ITERATIONS}`);
  console.log(`  Data: ${new Date().toLocaleString()}`);
  console.log(`======================================================\n`);

  const duoCombos = getCombinationsWithReplacement(CLASSES, 2);
  const trioCombos = getCombinationsWithReplacement(CLASSES, 3);

  for (const mission of MISSIONS) {
    let output = '';
    const log = (msg: string) => output += msg + '\n';
    const steps = MISSION_PROGRESSION[mission.id] || MISSION_PROGRESSION['default'];

    log(`======================================================`);
    log(`  RELATÓRIO: ${mission.name.toUpperCase()} (${mission.id})`);
    log(`  Min Heróis: ${mission.minHeroes}`);
    log(`  Inimigos: ${mission.enemies?.map(e => `${e.count}x (HP:${e.hp} ATK:${e.atk})`).join(', ') || 'Template Padrão'}`);
    log(`======================================================\n`);

    for (const step of steps) {
      log(`\n### ESTÁGIO: ${step.label} ###\n`);

      // 1. Solos
      if (mission.minHeroes <= 1) {
        log(`[Solos]`);
        const soloResults: Record<string, any> = {};
        for (const classId of CLASSES) {
          const hero = generateTrainedHero(classId, { ms: step.ms, focus: 'BALANCED' });
          soloResults[CLASS_DEFS[classId].displayName] = runMissionSimulation({
            heroes: [hero],
            missionId: mission.id,
            iterations: ITERATIONS
          });
        }
        log(formatTable(soloResults));
      }

      // 2. Duplas
      if (mission.minHeroes <= 2) {
        log(`[Duplas]`);
        const duoResults: Record<string, any> = {};
        for (const combo of duoCombos) {
          const heroes = combo.map((classId, idx) => {
            const hero = generateTrainedHero(classId, { ms: step.ms, focus: getFocusForClass(classId) });
            hero.id = `hero_${idx}`;
            return hero;
          });
          const name = combo.map(c => CLASS_DEFS[c].displayName).join(' + ');
          duoResults[name] = runMissionSimulation({
            heroes,
            missionId: mission.id,
            iterations: ITERATIONS
          });
        }
        log(formatTable(duoResults));
      }

      // 3. Trios
      if (mission.minHeroes <= 3) {
        log(`[Trios]`);
        const trioResults: Record<string, any> = {};
        for (const combo of trioCombos) {
          const heroes = combo.map((classId, idx) => {
            const hero = generateTrainedHero(classId, { ms: step.ms, focus: getFocusForClass(classId) });
            hero.id = `hero_${idx}`;
            return hero;
          });
          const name = combo.map(c => CLASS_DEFS[c].displayName).join(' + ');
          trioResults[name] = runMissionSimulation({
            heroes,
            missionId: mission.id,
            iterations: ITERATIONS
          });
        }
        log(formatTable(trioResults));
      }
    }

    log(`\nLegenda:`);
    log(`- Win Rate: Taxa de vitória do grupo.`);
    log(`- Loss Rate: Taxa de derrota do grupo.`);
    log(`- Timeout Rate: Batalhas que atingiram o limite de rounds.`);
    log(`- Avg Rounds (Win): Média de rounds para vencer.`);
    log(`- Avg HP Lost (Win): HP total perdido pelo grupo em vitórias.`);
    log(`- Incapacitated Rate: Porcentagem de heróis do grupo com HP < 3 após a missão.`);

    const fileName = path.join(OUTPUT_DIR, `${mission.id}_results.txt`);
    fs.writeFileSync(fileName, output);
    console.log(`Relatório v2 gerado: ${fileName}`);
  }
}

try {
  runScenarios();
} catch (e) {
  console.error("Erro fatal na simulação:", e);
}
