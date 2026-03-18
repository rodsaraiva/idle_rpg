import * as fs from 'fs';
import * as path from 'path';
import { CLASS_DEFS } from '../../../src/constants/classes';
import { MISSIONS } from '../../../src/constants/missions';
import { ClassId } from '../../../src/types/index';
import { generateTrainedHero } from '../../utils/trainedHeroGenerator';
import { runMissionSimulation } from '../../utils/simulationRunner';

const ITERATIONS = 1000;
const OUTPUT_DIR = 'scripts/simulations/missions';

interface ProgressionStage {
  name: string;
  heroes: { classId: ClassId; focus: 'ATK' | 'HP' | 'MP' | 'BALANCED'; days: number }[];
}

const STAGES: ProgressionStage[] = [
  {
    name: 'Solo - Dia 0 (Recém Recrutado)',
    heroes: [{ classId: 'WARRIOR', focus: 'BALANCED', days: 0 }]
  },
  {
    name: 'Solo - Dia 3 (Treino Balanceado)',
    heroes: [{ classId: 'WARRIOR', focus: 'BALANCED', days: 3 }]
  },
  {
    name: 'Duo - Dia 7 (Sinergia Básica)',
    heroes: [
      { classId: 'TANK', focus: 'HP', days: 7 },
      { classId: 'ARCHER', focus: 'ATK', days: 7 }
    ]
  },
  {
    name: 'Trio - Dia 14 (Sinergia Clássica)',
    heroes: [
      { classId: 'TANK', focus: 'HP', days: 14 },
      { classId: 'HEALER', focus: 'MP', days: 14 },
      { classId: 'MAGE', focus: 'MP', days: 14 }
    ]
  }
];

function runScenarios() {
  console.log(`======================================================`);
  console.log(`  FRAMEWORK DE SIMULAÇÃO DE BALANCEAMENTO`);
  console.log(`  Iterações por cenário: ${ITERATIONS}`);
  console.log(`  Data: ${new Date().toLocaleString()}`);
  console.log(`======================================================\n`);

  for (const mission of MISSIONS) {
    let output = '';
    const logToMission = (msg: string) => output += msg + '\n';

    logToMission(`======================================================`);
    logToMission(`  RELATÓRIO DE BALANCEAMENTO: ${mission.name.toUpperCase()} (${mission.id})`);
    logToMission(`  Dificuldade: ${mission.difficulty}`);
    logToMission(`  Min Heróis: ${mission.minHeroes}`);
    logToMission(`======================================================\n`);

    for (const stage of STAGES) {
      logToMission(`\n[ESTÁGIO] ${stage.name}`);
      const results: Record<string, any> = {};

      if (stage.heroes.length === 1) {
        // Solo stage: run for all classes
        for (const classId of Object.keys(CLASS_DEFS) as ClassId[]) {
          const hero = generateTrainedHero(classId, { days: stage.heroes[0].days, focus: stage.heroes[0].focus });
          results[CLASS_DEFS[classId].displayName] = runMissionSimulation({
            heroes: [hero],
            missionId: mission.id,
            iterations: ITERATIONS
          });
        }
      } else {
        // Group stage: run defined composition
        const heroes = stage.heroes.map((h, idx) => {
          const hero = generateTrainedHero(h.classId, { days: h.days, focus: h.focus });
          hero.id = `hero_${idx}`; // Unique IDs
          return hero;
        });

        const groupName = stage.heroes.map(h => CLASS_DEFS[h.classId].displayName).join(' + ');
        results[groupName] = runMissionSimulation({
          heroes,
          missionId: mission.id,
          iterations: ITERATIONS
        });
      }

      logToMission(formatTable(results));
    }

    logToMission(`\nLegenda:`);
    logToMission(`- Win Rate: Taxa de vitória do grupo.`);
    logToMission(`- Loss Rate: Taxa de derrota do grupo.`);
    logToMission(`- Timeout Rate: Batalhas que atingiram o limite de rounds.`);
    logToMission(`- Avg Rounds (Win): Média de rounds para vencer.`);
    logToMission(`- Avg HP Lost (Win): HP total perdido pelo grupo em vitórias.`);
    logToMission(`- Incapacitated Rate: Porcentagem de heróis do grupo com HP < 3 após a missão.`);

    const fileName = path.join(OUTPUT_DIR, `${mission.id}_results.txt`);
    fs.writeFileSync(fileName, output);
    console.log(`Relatório gerado: ${fileName}`);
  }
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

try {
  runScenarios();
} catch (e) {
  console.error("Erro ao rodar simulações:", e);
}
