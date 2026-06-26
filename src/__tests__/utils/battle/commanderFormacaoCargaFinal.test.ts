/**
 * Testes determinísticos para COMMANDER_FORMACAO e COMMANDER_CARGA_FINAL.
 *
 * Verifica que:
 *  - FORMACAO aplica buff atkMul 1.15 só em aliados adjacentes (distância ≤ 1)
 *    e respeita o cooldown de 4 rounds.
 *  - CARGA_FINAL aplica buff atkMul 1.30 a todos os aliados vivos e é once-per-battle.
 *  - Ambas não consomem o turno do Comandante.
 */

import { executePreAttackSkills } from '../../../utils/skillEffects';
import { BattleState, BattleEnemy } from '../../../utils/battleEngine';
import { HeroTask, Hero } from '../../../types';

function makeCommander(atkStat: number, id = 'cmd1'): Hero {
  return {
    id,
    name: 'Comandante',
    hpMax: 60,
    hpCurrent: 60,
    atk: atkStat,
    mp: 5,
    defense: 3,
    crit: 5,
    agility: 5,
    currentTask: HeroTask.IDLE,
    classId: 'COMMANDER',
    // trainingCount decide quais skills estão desbloqueadas
    trainingCount: { hp: 0, atk: atkStat, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
  } as Hero;
}

function makeAlly(id: string, position?: number): Hero {
  return {
    id,
    name: `Aliado ${id}`,
    hpMax: 50,
    hpCurrent: 50,
    atk: 15,
    mp: 3,
    defense: 2,
    crit: 5,
    agility: 5,
    currentTask: HeroTask.IDLE,
    classId: 'WARRIOR',
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
  } as Hero;
}

function makeEnemy(id = 'e1'): BattleEnemy {
  return {
    id, hp: 80, maxHp: 80, atk: 10, mp: 0,
    defense: 3, crit: 5, agility: 5, alive: true,
    attackType: 'MELEE', range: 1, movement: 2,
    position: 2,
  };
}

function makeState(heroes: Hero[], round = 1): BattleState {
  const heroPositions: Record<string, number> = {};
  heroes.forEach((h, i) => { heroPositions[h.id] = 40 + i; });

  return {
    heroes,
    enemies: [makeEnemy()],
    heroPositions,
    enemyPositions: { e1: 2 },
    lastAttacker: {},
    threats: {},
    log: [],
    actions: [],
    rounds: round,
    activeSynergies: [],
    buffs: {},
    flags: {},
    handlers: {} as any,
    skillCooldowns: {},
    skillOnceUsed: {},
    rng: () => 0.5,
  };
}

// Comandante com FORMACAO desbloqueada (atk ≥ 50, treino atk=50)
const CMD_WITH_FORMACAO_ATK = 50;
// Comandante com CARGA_FINAL desbloqueada (atk ≥ 100, treino atk=100)
const CMD_WITH_CARGA_FINAL_ATK = 100;

// ─── COMMANDER_FORMACAO ───

describe('COMMANDER_FORMACAO', () => {
  test('aplica atkMul 1.15 em aliado adjacente (distância ≤ 1) no round de cooldown', () => {
    const commander = makeCommander(CMD_WITH_FORMACAO_ATK);
    const ally = makeAlly('ally1');
    const state = makeState([commander, ally], 1);

    // Colocar aliado adjacente ao comandante (distância = 1)
    state.heroPositions['cmd1'] = 40;
    state.heroPositions['ally1'] = 41; // posições consecutivas → distância ≤ 1 no grid hex

    const consumed = executePreAttackSkills(commander, makeEnemy(), state, () => 0.5);

    // Não consome turno
    expect(consumed).toBe(false);
    // Aliado adjacente recebeu buff
    const buff = state.buffs['ally1']?.find(b => b.source === 'COMMANDER_FORMACAO' && b.type === 'atkMul');
    expect(buff).toBeDefined();
    expect(buff!.value).toBe(1.15);
    expect(buff!.expiresAfterRound).toBe(3); // round 1 + 2
    // Cooldown marcado
    expect(state.skillCooldowns['cmd1_COMMANDER_FORMACAO']).toBe(5); // round 1 + 4
  });

  test('NÃO aplica em aliado DISTANTE (distância > 1)', () => {
    const commander = makeCommander(CMD_WITH_FORMACAO_ATK);
    const farAlly = makeAlly('farAlly');
    const state = makeState([commander, farAlly], 1);

    state.heroPositions['cmd1'] = 40;
    state.heroPositions['farAlly'] = 46; // distância > 1

    executePreAttackSkills(commander, makeEnemy(), state, () => 0.5);

    // Aliado distante NÃO recebeu buff de Formação
    const buff = state.buffs['farAlly']?.find(b => b.source === 'COMMANDER_FORMACAO');
    expect(buff).toBeUndefined();
  });

  test('respeita cooldown de 4 rounds: não re-ativa antes do cooldown expirar', () => {
    const commander = makeCommander(CMD_WITH_FORMACAO_ATK);
    const ally = makeAlly('ally1');
    const state = makeState([commander, ally], 1);
    state.heroPositions['cmd1'] = 40;
    state.heroPositions['ally1'] = 41;

    // Round 1: ativa e marca cooldown readyAt = 5
    executePreAttackSkills(commander, makeEnemy(), state, () => 0.5);
    expect(state.skillCooldowns['cmd1_COMMANDER_FORMACAO']).toBe(5);

    // Round 3: cooldown ainda não expirou
    state.rounds = 3;
    state.buffs = {}; // limpa buffs para detectar re-aplicação limpa
    executePreAttackSkills(commander, makeEnemy(), state, () => 0.5);
    expect(state.buffs['ally1']?.find(b => b.source === 'COMMANDER_FORMACAO')).toBeUndefined();

    // Round 5: cooldown expirou (readyAt=5, rounds=5)
    state.rounds = 5;
    executePreAttackSkills(commander, makeEnemy(), state, () => 0.5);
    const buff = state.buffs['ally1']?.find(b => b.source === 'COMMANDER_FORMACAO');
    expect(buff).toBeDefined();
  });

  test('NÃO ativa quando a skill não está desbloqueada (treino atk < 50)', () => {
    const commander = makeCommander(20); // treino atk=20 → só RALLY desbloqueado
    const ally = makeAlly('ally1');
    const state = makeState([commander, ally], 1);
    state.heroPositions['cmd1'] = 40;
    state.heroPositions['ally1'] = 41;

    executePreAttackSkills(commander, makeEnemy(), state, () => 0.5);

    const buff = state.buffs['ally1']?.find(b => b.source === 'COMMANDER_FORMACAO');
    expect(buff).toBeUndefined();
  });
});

// ─── COMMANDER_CARGA_FINAL ───

describe('COMMANDER_CARGA_FINAL', () => {
  test('aplica atkMul 1.30 a todos os aliados vivos com 2+ aliados (once-per-battle)', () => {
    const commander = makeCommander(CMD_WITH_CARGA_FINAL_ATK);
    const ally1 = makeAlly('ally1');
    const ally2 = makeAlly('ally2');
    const state = makeState([commander, ally1, ally2], 1);

    const consumed = executePreAttackSkills(commander, makeEnemy(), state, () => 0.5);

    // Não consome turno
    expect(consumed).toBe(false);
    // Ambos aliados receberam buff
    for (const allyId of ['ally1', 'ally2']) {
      const buff = state.buffs[allyId]?.find(b => b.source === 'COMMANDER_CARGA_FINAL' && b.type === 'atkMul');
      expect(buff).toBeDefined();
      expect(buff!.value).toBe(1.30);
      expect(buff!.expiresAfterRound).toBe(2); // round 1 + 1
    }
    // Marcado como once-used
    expect(state.skillOnceUsed['cmd1_COMMANDER_CARGA_FINAL']).toBe(true);
  });

  test('NÃO ativa quando há menos de 2 aliados vivos', () => {
    const commander = makeCommander(CMD_WITH_CARGA_FINAL_ATK);
    const singleAlly = makeAlly('ally1');
    const state = makeState([commander, singleAlly], 1);

    executePreAttackSkills(commander, makeEnemy(), state, () => 0.5);

    // Com só 1 aliado, não ativa
    const buff = state.buffs['ally1']?.find(b => b.source === 'COMMANDER_CARGA_FINAL');
    expect(buff).toBeUndefined();
    expect(state.skillOnceUsed['cmd1_COMMANDER_CARGA_FINAL']).toBeUndefined();
  });

  test('NÃO ativa uma segunda vez na mesma batalha (once-per-battle)', () => {
    const commander = makeCommander(CMD_WITH_CARGA_FINAL_ATK);
    const ally1 = makeAlly('ally1');
    const ally2 = makeAlly('ally2');
    const state = makeState([commander, ally1, ally2], 1);

    // 1ª ativação
    executePreAttackSkills(commander, makeEnemy(), state, () => 0.5);
    expect(state.skillOnceUsed['cmd1_COMMANDER_CARGA_FINAL']).toBe(true);

    // Limpa buffs para detectar re-aplicação
    state.buffs = {};
    state.rounds = 2;

    // 2ª tentativa (mesma batalha)
    executePreAttackSkills(commander, makeEnemy(), state, () => 0.5);
    expect(state.buffs['ally1']?.find(b => b.source === 'COMMANDER_CARGA_FINAL')).toBeUndefined();
    expect(state.buffs['ally2']?.find(b => b.source === 'COMMANDER_CARGA_FINAL')).toBeUndefined();
  });

  test('NÃO ativa quando skill não está desbloqueada (treino atk < 100)', () => {
    const commander = makeCommander(50); // treino atk=50 → RALLY + FORMACAO desbloqueados, sem CARGA_FINAL
    const ally1 = makeAlly('ally1');
    const ally2 = makeAlly('ally2');
    const state = makeState([commander, ally1, ally2], 1);

    executePreAttackSkills(commander, makeEnemy(), state, () => 0.5);

    const buff = state.buffs['ally1']?.find(b => b.source === 'COMMANDER_CARGA_FINAL');
    expect(buff).toBeUndefined();
  });
});
