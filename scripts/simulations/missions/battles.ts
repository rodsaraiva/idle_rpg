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
    name: 'Duplas - Dia 7 (Treino Especializado)',
    heroes: [] // Marcador para rodar múltiplas combinações
  },
  {
    name: 'Trios - Dia 14 (Treino Especializado)',
    heroes: [] // Marcador para rodar múltiplas combinações
  }
];

const DUO_CONFIGS = [
  { name: 'Tank + Healer (Sustentação)', heroes: [{ classId: 'TANK', focus: 'HP' }, { classId: 'HEALER', focus: 'MP' }] },
  { name: 'Warrior + Rogue (Agressivo Melee)', heroes: [{ classId: 'WARRIOR', focus: 'ATK' }, { classId: 'ROGUE', focus: 'ATK' }] },
  { name: 'Mage + Archer (Dano à Distância)', heroes: [{ classId: 'MAGE', focus: 'MP' }, { classId: 'ARCHER', focus: 'ATK' }] },
  { name: 'Tank + Archer (Equilibrado)', heroes: [{ classId: 'TANK', focus: 'HP' }, { classId: 'ARCHER', focus: 'ATK' }] },
];

const TRIO_CONFIGS = [
  { name: 'Tank + Healer + Mage (Clássico)', heroes: [{ classId: 'TANK', focus: 'HP' }, { classId: 'HEALER', focus: 'MP' }, { classId: 'MAGE', focus: 'MP' }] },
  { name: 'Tank + Warrior + Healer (Linha de Frente)', heroes: [{ classId: 'TANK', focus: 'HP' }, { classId: 'WARRIOR', focus: 'ATK' }, { classId: 'HEALER', focus: 'MP' }] },
  { name: 'Warrior + Rogue + Archer (Dano Total)', heroes: [{ classId: 'WARRIOR', focus: 'ATK' }, { classId: 'ROGUE', focus: 'ATK' }, { classId: 'ARCHER', focus: 'ATK' }] },
  { name: 'Tank + Rogue + Mage (Controle e Dano)', heroes: [{ classId: 'TANK', focus: 'HP' }, { classId: 'ROGUE', focus: 'ATK' }, { classId: 'MAGE', focus: 'MP' }] },
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

      if (stage.name.startsWith('Solo')) {
        // Solo stage: run for all classes
        const days = stage.name.includes('Dia 3') ? 3 : 0;
        for (const classId of Object.keys(CLASS_DEFS) as ClassId[]) {
          const hero = generateTrainedHero(classId, { days, focus: 'BALANCED' });
          results[CLASS_DEFS[classId].displayName] = runMissionSimulation({
            heroes: [hero],
            missionId: mission.id,
            iterations: ITERATIONS
          });
        }
      } else if (stage.name.startsWith('Duplas')) {
        for (const config of DUO_CONFIGS) {
          const heroes = config.heroes.map((h, idx) => {
            const hero = generateTrainedHero(h.classId as ClassId, { days: 7, focus: h.focus as any });
            hero.id = `hero_${idx}`;
            return hero;
          });
          results[config.name] = runMissionSimulation({
            heroes,
            missionId: mission.id,
            iterations: ITERATIONS
          });
        }
      } else if (stage.name.startsWith('Trios')) {
        for (const config of TRIO_CONFIGS) {
          const heroes = config.heroes.map((h, idx) => {
            const hero = generateTrainedHero(h.classId as ClassId, { days: 14, focus: h.focus as any });
            hero.id = `hero_${idx}`;
            return hero;
          });
          results[config.name] = runMissionSimulation({
            heroes,
            missionId: mission.id,
            iterations: ITERATIONS
          });
        }
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
