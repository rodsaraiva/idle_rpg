import * as fs from 'fs';
import * as path from 'path';
import { configProvider } from '../../../src/services/configProvider';
import { MISSIONS, MissionTemplate } from '../../../src/constants/missions';
import { ClassId } from '../../../src/types/index';
import { generateTrainedHero } from '../../utils/trainedHeroGenerator';
import { runMissionSimulation } from '../../utils/simulationRunner';
import { PERSONALITY_LIST } from '../../../src/constants/personalities';

// --- CONFIGURAÇÃO DO SANDBOX ---
configProvider.overrideConfig({
  classes: {
    ARCHER: {
      baseStatDelta: { hp: -5, atk: 3, defense: -3, crit: 20, agility: 10 }
    },
    HEALER: {
      baseStatDelta: { hp: 5, mp: 8, defense: 5, crit: 5, agility: 12, atk: -2 }
    },
    WARRIOR: {
      baseStatDelta: { hp: 8, atk: 6, defense: 10, crit: 10, agility: 5 }
    },
    MAGE: {
      baseStatDelta: { hp: -5, mp: 12, defense: 0, crit: 15, agility: 10, atk: 1 }
    }
  }
});

const ITERATIONS = 2000;
const OUTPUT_DIR = 'scripts/simulations/missions';
const CLASSES = Object.keys(configProvider.getAllClassDefs()) as ClassId[];

interface ProgressionStep {
  label: string;
  ms: number;
}

const MISSION_PROGRESSION: Record<string, ProgressionStep[]> = {
  'mission_1': [
    { label: 'Sem Treino (0 min)', ms: 0 },
    { label: '30 Minutos', ms: 30 * 60 * 1000 },
    { label: '1 Hora', ms: 60 * 60 * 1000 },
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
  table += `| ${'Classe/Grupo'.padEnd(45)} | ` + columns.map(c => c.padEnd(18)).join(' | ') + ' |\n';
  table += `| ${'-'.repeat(45)} | ` + columns.map(c => '-'.repeat(18)).join(' | ') + ' |\n';
  for (const key of keys) {
    table += `| ${key.padEnd(45)} | ` + columns.map(col => String(data[key][col]).padEnd(18)).join(' | ') + ' |\n';
  }
  return table;
}

function runScenarios() {
  const startTime = Date.now();
  const targetMission = 'mission_1';

  console.log(`======================================================`);
  console.log(`  SIMULAÇÃO SANDBOX - BALANCEAMENTO PROPOSTO`);
  console.log(`  Iterações: ${ITERATIONS}`);
  console.log(`  Missão: ${targetMission}`);
  console.log(`======================================================\n`);

  const duoCombos = getCombinationsWithReplacement(CLASSES, 2);

  const missionsToRun = MISSIONS.filter(m => m.id === targetMission);

  for (const mission of missionsToRun) {
    console.log(`\n>>> Iniciando Missão: ${mission.name.toUpperCase()} (${mission.id})`);
    let output = '';
    const log = (msg: string) => output += msg + '\n';
    const steps = MISSION_PROGRESSION[mission.id] || [];

    log(`======================================================`);
    log(`  RELATÓRIO SANDBOX: ${mission.name.toUpperCase()} (${mission.id})`);
    log(`  Min Heróis: ${mission.minHeroes}`);
    log(`  Inimigos: ${mission.enemies?.map(e => `${e.count}x (HP:${e.hp} ATK:${e.atk})`).join(', ') || 'Template Padrão'}`);
    log(`  Nota: Valores customizados via ConfigProvider`);
    log(`======================================================\n`);

    for (const step of steps) {
      console.log(`  └─ Estágio: ${step.label}`);
      log(`\n### ESTÁGIO: ${step.label} ###\n`);

      // 1. Solos
      process.stdout.write(`     ├─ Solos... `);
      const soloResults: Record<string, any> = {};
      for (const classId of CLASSES) {
        for (const personality of PERSONALITY_LIST) {
          const hero = generateTrainedHero(classId, { ms: step.ms, focus: 'BALANCED', personality: personality.id });
          const key = `${configProvider.getClassDef(classId).displayName} (${personality.displayName})`;
          soloResults[key] = runMissionSimulation({
            heroes: [hero],
            missionId: mission.id,
            iterations: ITERATIONS
          });
        }
      }
      log(`[Solos - Combinações Classe + Personalidade]`);
      log(formatTable(soloResults));
      console.log(`Concluído`);

      // 2. Duplas
      process.stdout.write(`     └─ Duplas... `);
      const duoResults: Record<string, any> = {};
      for (const combo of duoCombos) {
        const personalitiesToTest = PERSONALITY_LIST.map(p => p.id);
        for (const pId of personalitiesToTest) {
          const heroes = combo.map((classId, idx) => {
            const hero = generateTrainedHero(classId, { ms: step.ms, focus: getFocusForClass(classId), personality: pId as any });
            hero.id = `hero_${idx}`;
            return hero;
          });
          
          let name = combo.map(c => configProvider.getClassDef(c).displayName).join(' + ');
          const pName = PERSONALITY_LIST.find(p => p.id === pId)?.displayName;
          name += ` [${pName}]`;

          duoResults[name] = runMissionSimulation({
            heroes,
            missionId: mission.id,
            iterations: ITERATIONS
          });
        }
      }
      log(`[Duplas - Com Personalidades]`);
      log(formatTable(duoResults));
      console.log(`Concluído`);
    }

    const fileName = path.join(OUTPUT_DIR, `mission_1_sandbox_results.txt`);
    fs.writeFileSync(fileName, output);
    console.log(`\n  └─ Relatório Sandbox gerado: ${fileName}`);
  }
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n======================================================`);
  console.log(`  Simulação Sandbox concluída em ${duration}s!`);
  console.log(`======================================================\n`);
}

runScenarios();
