import * as fs from 'fs';
import * as path from 'path';
import { CLASS_DEFS } from '../../../src/constants/classes';
import { MISSIONS } from '../../../src/constants/missions';
import { ClassId } from '../../../src/types/index';
import { generateTrainedHero } from '../../utils/trainedHeroGenerator';
import { runMissionSimulation } from '../../utils/simulationRunner';

const ITERATIONS = 1000;
const OUTPUT_DIR = 'scripts/simulations/missions';
const DAYS = [0, 1, 3, 5, 7];
const CLASSES = Object.keys(CLASS_DEFS) as ClassId[];

function getFocusForClass(classId: ClassId): 'ATK' | 'HP' | 'MP' | 'BALANCED' {
  if (classId === 'TANK') return 'HP';
  if (classId === 'HEALER' || classId === 'MAGE') return 'MP';
  return 'ATK';
}

/**
 * Gera todas as combinações de N elementos com repetição.
 */
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
  
  // Header
  table += `| ${'Classe/Grupo'.padEnd(20)} | ` + columns.map(c => c.padEnd(18)).join(' | ') + ' |\n';
  table += `| ${'-'.repeat(20)} | ` + columns.map(c => '-'.repeat(18)).join(' | ') + ' |\n';
  
  // Rows
  for (const key of keys) {
    table += `| ${key.padEnd(20)} | ` + columns.map(col => String(data[key][col]).padEnd(18)).join(' | ') + ' |\n';
  }
  return table;
}

function runScenarios() {
  console.log(`======================================================`);
  console.log(`  FRAMEWORK DE SIMULAÇÃO MASSIVA DE BALANCEAMENTO`);
  console.log(`  Iterações por cenário: ${ITERATIONS}`);
  console.log(`  Classes: ${CLASSES.join(', ')}`);
  console.log(`  Data: ${new Date().toLocaleString()}`);
  console.log(`======================================================\n`);

  const duoCombos = getCombinationsWithReplacement(CLASSES, 2);
  const trioCombos = getCombinationsWithReplacement(CLASSES, 3);

  for (const mission of MISSIONS) {
    let output = '';
    const logToMission = (msg: string) => output += msg + '\n';

    logToMission(`======================================================`);
    logToMission(`  RELATÓRIO MASSIVO: ${mission.name.toUpperCase()} (${mission.id})`);
    logToMission(`  Inimigos: ${mission.enemies?.map(e => `${e.count}x (HP:${e.hp} ATK:${e.atk})`).join(', ') || 'Template Padrão'}`);
    logToMission(`======================================================\n`);

    for (const day of DAYS) {
      logToMission(`\n\n### PROGRESSÃO: DIA ${day} ###\n`);

      // 1. Solos
      logToMission(`[ESTÁGIO] Solos - Dia ${day}`);
      const soloResults: Record<string, any> = {};
      for (const classId of CLASSES) {
        const hero = generateTrainedHero(classId, { days: day, focus: 'BALANCED' });
        soloResults[CLASS_DEFS[classId].displayName] = runMissionSimulation({
          heroes: [hero],
          missionId: mission.id,
          iterations: ITERATIONS
        });
      }
      logToMission(formatTable(soloResults));

      // 2. Duplas
      logToMission(`[ESTÁGIO] Todas as Duplas Possíveis - Dia ${day}`);
      const duoResults: Record<string, any> = {};
      for (const combo of duoCombos) {
        const heroes = combo.map((classId, idx) => {
          const hero = generateTrainedHero(classId, { days: day, focus: getFocusForClass(classId) });
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
      logToMission(formatTable(duoResults));

      // 3. Trios
      logToMission(`[ESTÁGIO] Todos os Trios Possíveis - Dia ${day}`);
      const trioResults: Record<string, any> = {};
      for (const combo of trioCombos) {
        const heroes = combo.map((classId, idx) => {
          const hero = generateTrainedHero(classId, { days: day, focus: getFocusForClass(classId) });
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
      logToMission(formatTable(trioResults));
    }

    logToMission(`\n\nLegenda:`);
    logToMission(`- Win Rate: Taxa de vitória do grupo.`);
    logToMission(`- Loss Rate: Taxa de derrota do grupo.`);
    logToMission(`- Timeout Rate: Batalhas que atingiram o limite de rounds.`);
    logToMission(`- Avg Rounds (Win): Média de rounds para vencer.`);
    logToMission(`- Avg HP Lost (Win): HP total perdido pelo grupo em vitórias.`);
    logToMission(`- Incapacitated Rate: Porcentagem de heróis do grupo com HP < 3 após a missão.`);

    const fileName = path.join(OUTPUT_DIR, `${mission.id}_results.txt`);
    fs.writeFileSync(fileName, output);
    console.log(`Relatório massivo gerado: ${fileName}`);
  }
}

try {
  runScenarios();
} catch (e) {
  console.error("Erro ao rodar simulações:", e);
}
