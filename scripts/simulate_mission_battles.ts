import { createHero } from '../src/utils/heroFactory';
import { BattleEngine, BattleState } from '../src/utils/battleEngine';
import { MISSIONS } from '../src/constants/missions';
import { CLASS_DEFS } from '../src/constants/classes';
import { MAX_BATTLE_ROUNDS } from '../src/constants/game';
import { ClassId, Hero } from '../src/types/index';
import { GameMath } from '../src/utils/gameMath';

const ITERATIONS = 1000;

function runSimulation() {
  const MISSION_TEMPLATE = MISSIONS.find((m: { id: string }) => m.id === 'mission_1');

  if (!MISSION_TEMPLATE) {
    throw new Error("Missão 1 não encontrada.");
  }

  console.log(`\n=== SIMULAÇÃO DE BATALHA: MISSÃO 1 ===`);
  console.log(`Inimigos Config: ${MISSION_TEMPLATE.enemies?.map((e: any) => `${e.count}x (HP:${e.hp} ATK:${e.atk})`).join(', ') || 'Template Padrão (Orcs)'}`);
  console.log(`Iterações por Classe: ${ITERATIONS}`);
  console.log(`Rounds Máximos: ${MAX_BATTLE_ROUNDS}\n`);

  const results: Record<string, any> = {};

  const classesToSimulate = Object.keys(CLASS_DEFS) as ClassId[];

  for (const classId of classesToSimulate) {
    let wins = 0;
    let losses = 0;
    let timeouts = 0; // Se chegar no MAX_BATTLE_ROUNDS
    let totalRoundsWon = 0;
    let totalHpLostWon = 0;
    let incapacitated = 0; // HP < 3

    for (let i = 0; i < ITERATIONS; i++) {
      // 1. Cria um herói "fresco" para cada iteração (aplica variância gaussiana)
      const hero = createHero(classId);
      const initialHp = hero.hpMax;

      // 2. Cria os inimigos baseados no template
      const enemies = BattleEngine.createEnemies(MISSION_TEMPLATE);

      // 3. Inicializa o estado da batalha
      const state: BattleState = {
        heroes: [hero],
        enemies,
        heroPositions: { [hero.id]: 47 }, // Posição central na linha de baixo (grid 10x5, pos 0-49)
        enemyPositions: {},
        lastAttacker: {},
        threats: {},
        log: [],
        actions: [],
        rounds: 1,
      };
      
      // Associa as posições geradas aleatoriamente aos inimigos (linha superior)
      enemies.forEach(e => {
        if (e.position !== undefined) {
            state.enemyPositions[e.id] = e.position;
        }
      });

      // 4. Loop de Batalha
      let battleOver = false;
      let heroWon = false;
      let isTimeout = false;

      while (!battleOver) {
        if (state.rounds > MAX_BATTLE_ROUNDS) {
          isTimeout = true;
          battleOver = true;
          break;
        }

        // Turno do Herói
        BattleEngine.processHeroTurn(hero, state, Math.random);

        // Checa se todos inimigos morreram
        if (state.enemies.every(e => !e.alive || e.hp <= 0)) {
          heroWon = true;
          battleOver = true;
          break;
        }

        // Turno dos Inimigos
        state.enemies.forEach(enemy => {
          if (!battleOver && enemy.alive && enemy.hp > 0) {
            BattleEngine.processEnemyTurn(enemy, state, Math.random, 0); // tankMitigation = 0
          }
        });

        // Checa se herói morreu (HP <= 0 é considerado morte em batalha simulada)
        if (hero.hpCurrent <= 0) {
          heroWon = false;
          battleOver = true;
          break;
        }

        state.rounds++;
      }

      // 5. Coleta de Métricas
      if (heroWon) {
        wins++;
        totalRoundsWon += state.rounds;
        totalHpLostWon += (initialHp - Math.max(0, hero.hpCurrent));
      } else if (isTimeout) {
        timeouts++;
      } else {
        losses++;
      }

      // Incapacitado se terminar a missão com menos de 3 de HP
      if (hero.hpCurrent < 3) {
        incapacitated++;
      }
    }

    // 6. Consolida os dados da classe
    results[CLASS_DEFS[classId].displayName] = {
      'Win Rate': ((wins / ITERATIONS) * 100).toFixed(1) + '%',
      'Loss Rate': ((losses / ITERATIONS) * 100).toFixed(1) + '%',
      'Timeout Rate': ((timeouts / ITERATIONS) * 100).toFixed(1) + '%',
      'Avg Rounds (Win)': wins > 0 ? (totalRoundsWon / wins).toFixed(1) : '-',
      'Avg HP Lost (Win)': wins > 0 ? (totalHpLostWon / wins).toFixed(1) : '-',
      'Incapacitated Rate': ((incapacitated / ITERATIONS) * 100).toFixed(1) + '%',
    };
  }

  console.table(results);
  console.log(`\nNota: "Incapacitado" significa terminar a batalha com menos de 3 de HP (precisará de enfermaria).`);
  console.log(`O "Timeout Rate" indica quantas batalhas chegaram a ${MAX_BATTLE_ROUNDS} rounds sem vencedor claro.`);
}

try {
  runSimulation();
} catch (e) {
  console.error("Erro ao rodar simulação:", e);
}
