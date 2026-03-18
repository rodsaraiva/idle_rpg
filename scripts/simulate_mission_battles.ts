import { CLASS_DEFS } from '../src/constants/classes';
import { ClassId } from '../src/types/index';
import { generateTrainedHero } from './utils/trainedHeroGenerator';
import { runMissionSimulation, SimulationParams } from './utils/simulationRunner';

const ITERATIONS = 1000;

function runScenarios() {
  console.log(`\n======================================================`);
  console.log(`  SIMULADOR DE BALANCEAMENTO: MISSÕES E CENÁRIOS`);
  console.log(`  Iterações por cenário: ${ITERATIONS}`);
  console.log(`======================================================\n`);

  // --- CENÁRIO 1: Missão 1 - Heróis Solo Dia 1 (Fresco) ---
  console.log(`\n[CENÁRIO 1] Missão 1 - Solo Dia 1 (Heróis Recém Recrutados)`);
  const resultsScenario1: Record<string, any> = {};
  const classes = Object.keys(CLASS_DEFS) as ClassId[];

  for (const classId of classes) {
    const hero = generateTrainedHero(classId, { days: 0, focus: 'BALANCED' });
    const result = runMissionSimulation({
      heroes: [hero],
      missionId: 'mission_1',
      iterations: ITERATIONS
    });
    resultsScenario1[CLASS_DEFS[classId].displayName] = result;
  }
  console.table(resultsScenario1);


  // --- CENÁRIO 2: Missão 2 - Solo Dia 3 (Treino Balanceado) ---
  console.log(`\n[CENÁRIO 2] Missão 2 - Solo Dia 3 (3 Dias de Treino Balanceado)`);
  const resultsScenario2: Record<string, any> = {};

  for (const classId of classes) {
    const hero = generateTrainedHero(classId, { days: 3, focus: 'BALANCED' });
    const result = runMissionSimulation({
      heroes: [hero],
      missionId: 'mission_2',
      iterations: ITERATIONS
    });
    resultsScenario2[CLASS_DEFS[classId].displayName] = result;
  }
  console.table(resultsScenario2);


  // --- CENÁRIO 3: Missão 3 - Grupos Duplos Dia 7 ---
  console.log(`\n[CENÁRIO 3] Missão 3 - Duplas Sinergéticas Dia 7`);
  const resultsScenario3: Record<string, any> = {};

  const duos: { name: string, h1: ClassId, f1: any, h2: ClassId, f2: any }[] = [
    { name: "Tank + Healer", h1: 'TANK', f1: 'HP', h2: 'HEALER', f2: 'MP' },
    { name: "Warrior + Mage", h1: 'WARRIOR', f1: 'ATK', h2: 'MAGE', f2: 'MP' },
    { name: "Duplo Rogue", h1: 'ROGUE', f1: 'ATK', h2: 'ROGUE', f2: 'ATK' },
  ];

  for (const duo of duos) {
    const hero1 = generateTrainedHero(duo.h1, { days: 7, focus: duo.f1 });
    const hero2 = generateTrainedHero(duo.h2, { days: 7, focus: duo.f2 });
    
    // Forçar IDs diferentes
    hero2.id = 'h2_sim';

    const result = runMissionSimulation({
      heroes: [hero1, hero2],
      missionId: 'mission_3',
      iterations: ITERATIONS
    });
    resultsScenario3[duo.name] = result;
  }
  console.table(resultsScenario3);

  console.log(`\nLegenda:`);
  console.log(`- Incapacitated Rate: Porcentagem de heróis do grupo que terminaram a missão com HP < 3.`);
  console.log(`- Timeout Rate: Porcentagem de batalhas que bateram o limite máximo de rounds (empate).`);
}

try {
  runScenarios();
} catch (e) {
  console.error("Erro ao rodar simulações de cenário:", e);
}
