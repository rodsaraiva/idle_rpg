import * as fs from 'fs';
import * as path from 'path';
import { configProvider } from '../../../src/services/configProvider';
import { MISSIONS, MissionTemplate } from '../../../src/constants/missions';
import { ClassId } from '../../../src/types/index';
import { generateTrainedHero } from '../../utils/trainedHeroGenerator';
import { runMissionSimulation } from '../../utils/simulationRunner';
import { PERSONALITY_LIST } from '../../../src/constants/personalities';
import { BattleEngine } from '../../../src/utils/battleEngine';
import { GameMath } from '../../../src/utils/gameMath';

const ITERATIONS = 3000;
const OUTPUT_DIR = 'scripts/simulations/missions';
const TARGET_MISSION_ID = 'mission_1';

// Hooks da Sandbox para alterar comportamento das personalidades
const originalCalculateAttack = BattleEngine.calculateAttack;
const sandboxDamageBonusMap = new Map<string, number>();

BattleEngine.selectTarget = function(attacker: any, attackerPos: number, candidates: any[], rng: () => number, context: any) {
  if (!candidates || candidates.length === 0) return undefined;
  
  // Limpa apenas limpando o cache geral do atacante iterando as chaves.
  for (const key of sandboxDamageBonusMap.keys()) {
    if (key.startsWith(attacker.id + '->')) {
      sandboxDamageBonusMap.delete(key);
    }
  }

  const hpOf = (c: any) => (typeof c.hp === 'number' ? c.hp : c.hpCurrent ?? 0);
  const maxHpOf = (c: any) => (typeof c.maxHp === 'number' ? c.maxHp : 100);

  const scores = candidates.map(target => {
    let score = 100;
    const dist = GameMath.getHexDistance(attackerPos, target.position ?? 0);
    const targetHpPct = hpOf(target) / maxHpOf(target);
    
    score -= dist * 10;

    if (attacker.classId === 'TANK' || attacker.classId === 'WARRIOR') {
      if (dist <= 1) score += 20;
    } else if (attacker.classId === 'ROGUE' || attacker.classId === 'ARCHER' || attacker.classId === 'MAGE') {
      if (target.classId !== 'TANK') score += 15;
      if (targetHpPct < 0.5) score += 10;
    }

    switch (attacker.personality) {
      case 'AGGRESSIVE':
        if (targetHpPct < 0.3) {
          score += 100;
        } else if (targetHpPct <= 0.5) {
          score += 40;
        }
        break;
      case 'PROTECTOR':
        if (context?.threats && target.id in context.threats) {
          sandboxDamageBonusMap.set(attacker.id + '->' + target.id, 0.05);
          const targetOfEnemy = context.threats[target.id];
          if (context.alliesInDanger?.includes(targetOfEnemy)) {
            score += 100;
          }
        }
        break;
      case 'CAUTIOUS':
        const range = attacker.range ?? 1;
        if (dist <= range) score += 30;
        break;
      case 'VENGEFUL':
        if (target.id === context?.lastAttackerId) {
          score += 200;
          sandboxDamageBonusMap.set(attacker.id + '->' + target.id, 0.05);
        }
        break;
      case 'OPPORTUNIST':
        if (target.classId !== 'TANK') score += 20;
        if (targetHpPct < 0.4) score += 30;
        break;
    }

    return { target, score };
  });

  scores.sort((a, b) => b.score - a.score);
  
  const topCandidates = scores.slice(0, 2);
  if (topCandidates.length > 1 && rng() < 0.2) {
    return topCandidates[1].target;
  }
  return topCandidates[0]?.target;
};

BattleEngine.calculateAttack = function(attacker: any, target: any, baseHitChance: number, actorType: any, round: number, rng: () => number, distance: number = 1) {
  const result = originalCalculateAttack.call(BattleEngine, attacker, target, baseHitChance, actorType, round, rng, distance);
  
  if (result && result.dmg > 0) {
    const key = attacker.id + '->' + target.id;
    const bonus = sandboxDamageBonusMap.get(key) || 0;
    if (bonus > 0) {
      const extraDmg = Math.max(1, Math.floor(result.dmg * bonus));
      result.dmg += extraDmg;
      result.action.amount = result.dmg;
      result.action.text = `${attacker.name ?? attacker.id} causou ${result.dmg} de dano em ${target.name ?? target.id}${result.action.isCrit ? ' (CRÍTICO!)' : ''} (Bônus Personalidade)`;
    }
  }
  return result;
};

// Aplica buff de inimigos SOMENTE na sandbox de forma isolada.
// Objetivo: sandbox igual ao original, com a única diferença
// sendo: +2 HP e +1 defesa nos inimigos da mission_1.
const missionToBuff = MISSIONS.find(m => m.id === TARGET_MISSION_ID);
if (!missionToBuff?.enemies) {
  throw new Error(`Configuração inválida: mission_1 sem composição de inimigos em MISSIONS.`);
}

const originalEnemies = missionToBuff.enemies.map(e => ({ ...e }));
missionToBuff.enemies = originalEnemies.map(e => ({
  ...e,
  hp: e.hp + 2,
  defense: (e.defense ?? 0) + 1,
}));

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
  const targetMission = TARGET_MISSION_ID;

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

try {
  runScenarios();
} finally {
  // Restaura para não contaminar futuras execuções no mesmo processo.
  missionToBuff.enemies = originalEnemies;
}
