import * as fs from 'fs';
import { CLASS_DEFS } from '../../../src/constants/classes';
import { ClassId } from '../../../src/types/index';
import { generateTrainedHero } from '../../utils/trainedHeroGenerator';
import { runMissionSimulation } from '../../utils/simulationRunner';

const ITERATIONS = 1000;
const OUTPUT_FILE = 'scripts/simulations/missions/results.txt';

function runScenarios() {
  let output = '';
  const log = (msg: string) => {
    output += msg + '\n';
  };

  log(`======================================================`);
  log(`  SIMULADOR DE BALANCEAMENTO: MISSÕES E CENÁRIOS`);
  log(`  Iterações por cenário: ${ITERATIONS}`);
  log(`  Data: ${new Date().toLocaleString()}`);
  log(`======================================================\n`);

  // Helper para formatar tabelas em texto
  const formatTable = (data: Record<string, any>) => {
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
    return table + '\n';
  };

  // --- CENÁRIO 1: Missão 1 ---
  log(`\n[CENÁRIO 1] Missão 1 - Solo Dia 1 (Heróis Recém Recrutados)`);
  const resultsScenario1: Record<string, any> = {};
  const classes = Object.keys(CLASS_DEFS) as ClassId[];

  for (const classId of classes) {
    const hero = generateTrainedHero(classId, { days: 0, focus: 'BALANCED' });
    resultsScenario1[CLASS_DEFS[classId].displayName] = runMissionSimulation({
      heroes: [hero],
      missionId: 'mission_1',
      iterations: ITERATIONS
    });
  }
  log(formatTable(resultsScenario1));

  // --- CENÁRIO 2: Missão 2 ---
  log(`\n[CENÁRIO 2] Missão 2 - Solo Dia 3 (3 Dias de Treino Balanceado)`);
  const resultsScenario2: Record<string, any> = {};

  for (const classId of classes) {
    const hero = generateTrainedHero(classId, { days: 3, focus: 'BALANCED' });
    resultsScenario2[CLASS_DEFS[classId].displayName] = runMissionSimulation({
      heroes: [hero],
      missionId: 'mission_2',
      iterations: ITERATIONS
    });
  }
  log(formatTable(resultsScenario2));

  // --- CENÁRIO 3: Missão 3 ---
  log(`\n[CENÁRIO 3] Missão 3 - Duplas Sinergéticas Dia 7`);
  const resultsScenario3: Record<string, any> = {};

  const duos: { name: string, h1: ClassId, f1: any, h2: ClassId, f2: any }[] = [
    { name: "Tank + Healer", h1: 'TANK', f1: 'HP', h2: 'HEALER', f2: 'MP' },
    { name: "Warrior + Mage", h1: 'WARRIOR', f1: 'ATK', h2: 'MAGE', f2: 'MP' },
    { name: "Duplo Rogue", h1: 'ROGUE', f1: 'ATK', h2: 'ROGUE', f2: 'ATK' },
  ];

  for (const duo of duos) {
    const hero1 = generateTrainedHero(duo.h1, { days: 7, focus: duo.f1 });
    const hero2 = generateTrainedHero(duo.h2, { days: 7, focus: duo.f2 });
    hero2.id = 'h2_sim';

    resultsScenario3[duo.name] = runMissionSimulation({
      heroes: [hero1, hero2],
      missionId: 'mission_3',
      iterations: ITERATIONS
    });
  }
  log(formatTable(resultsScenario3));

  log(`\nLegenda:`);
  log(`- Incapacitated Rate: Porcentagem de heróis do grupo que terminaram a missão com HP < 3.`);
  log(`- Timeout Rate: Porcentagem de batalhas que bateram o limite máximo de rounds (empate).`);

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`\nSimulação concluída! Resultados salvos em: ${OUTPUT_FILE}`);
}

try {
  runScenarios();
} catch (e) {
  console.error("Erro ao rodar simulações de cenário:", e);
}
