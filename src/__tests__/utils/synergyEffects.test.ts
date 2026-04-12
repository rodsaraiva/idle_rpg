import { createSynergyHandlers } from '../../utils/synergyEffects';

describe('createSynergyHandlers', () => {
  test('empty list returns no-op handlers', () => {
    const h = createSynergyHandlers([]);
    expect(typeof h.onBattleStart).toBe('function');
    expect(h.shouldIgnoreDefense({} as any, {} as any)).toBe(false);
    expect(h.modifyTargetScore({} as any, {} as any, {} as any, 100)).toBe(100);
  });

  test('non-empty list returns object with all hooks defined', () => {
    const h = createSynergyHandlers(['LINHA_DE_FRENTE']);
    expect(h.onBattleStart).toBeDefined();
    expect(h.onHealApplied).toBeDefined();
    expect(h.onHeroDamaged).toBeDefined();
    expect(h.onAttackResolved).toBeDefined();
    expect(h.shouldIgnoreDefense).toBeDefined();
    expect(h.modifyTargetScore).toBeDefined();
  });

  test('BattleEngine.initializeBattle returns state with handlers and empty buffs', () => {
    const { BattleEngine } = require('../../utils/battleEngine');
    const fakeTemplate = {
      id: 'test', name: 'Test', minHeroes: 1, maxHeroes: 1,
      rewardMin: 1, rewardMax: 2,
      enemies: [{ hp: 1, atk: 1, mp: 0, count: 1 }],
    };
    const heroes = [{ id: 'h1', classId: 'WARRIOR', hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, defense: 5, crit: 0, agility: 5, range: 1, movement: 2, name: 'h1' }] as any;
    const state = BattleEngine.initializeBattle(heroes, fakeTemplate);
    expect(state.activeSynergies).toEqual([]);
    expect(state.buffs).toEqual({});
    expect(state.flags).toEqual({});
    expect(state.handlers).toBeDefined();
  });

  test('cleanExpiredBuffs removes expired buffs and keeps persistent ones', () => {
    const { BattleEngine } = require('../../utils/battleEngine');
    const state: any = {
      rounds: 5,
      buffs: {
        h1: [
          { source: 'LINHA_DE_FRENTE', type: 'atkMul', value: 1.3, expiresAfterRound: 4 },
          { source: 'MURALHA_E_FLECHA', type: 'critFlat', value: 20, expiresAfterRound: -1 },
          { source: 'CAOS_ARCANO', type: 'defDebuffMul', value: 0.5, expiresAfterRound: 6 },
        ],
      },
    };
    BattleEngine.cleanExpiredBuffs(state);
    expect(state.buffs.h1).toHaveLength(2);
    expect(state.buffs.h1.find((b: any) => b.source === 'LINHA_DE_FRENTE')).toBeUndefined();
  });

  // --- LINHA_DE_FRENTE (Furor) ---
  test('LINHA_DE_FRENTE: curar Guerreiro aplica buff Furor (atkMul 1.30 por 1 turno)', () => {
    const handlers = createSynergyHandlers(['LINHA_DE_FRENTE']);
    const state: any = { rounds: 3, buffs: {}, flags: {} };
    const healer: any = { id: 'h1', classId: 'HEALER', name: 'Aria' };
    const warrior: any = { id: 'w1', classId: 'WARRIOR', name: 'Brak', hpMax: 100, hpCurrent: 50 };

    handlers.onHealApplied(state, healer, warrior, 20);

    expect(state.buffs['w1']).toBeDefined();
    expect(state.buffs['w1']).toHaveLength(1);
    const buff = state.buffs['w1'][0];
    expect(buff.source).toBe('LINHA_DE_FRENTE');
    expect(buff.type).toBe('atkMul');
    expect(buff.value).toBe(1.30);
    expect(buff.expiresAfterRound).toBe(4);
  });

  test('LINHA_DE_FRENTE: refresh em vez de stack', () => {
    const handlers = createSynergyHandlers(['LINHA_DE_FRENTE']);
    const state: any = { rounds: 3, buffs: {}, flags: {} };
    const healer: any = { id: 'h1', classId: 'HEALER' };
    const warrior: any = { id: 'w1', classId: 'WARRIOR' };

    handlers.onHealApplied(state, healer, warrior, 10);
    state.rounds = 4;
    handlers.onHealApplied(state, healer, warrior, 10);

    expect(state.buffs['w1']).toHaveLength(1);
    expect(state.buffs['w1'][0].expiresAfterRound).toBe(5);
  });

  test('LINHA_DE_FRENTE: não dispara se alvo não é WARRIOR', () => {
    const handlers = createSynergyHandlers(['LINHA_DE_FRENTE']);
    const state: any = { rounds: 1, buffs: {}, flags: {} };
    const healer: any = { id: 'h1', classId: 'HEALER' };
    const tank: any = { id: 't1', classId: 'TANK' };

    handlers.onHealApplied(state, healer, tank, 10);
    expect(state.buffs['t1']).toBeUndefined();
  });

  // --- CAOS_ARCANO (Disjunção) ---
  test('CAOS_ARCANO: ataque do Mago aplica defDebuffMul 0.5 no alvo', () => {
    const handlers = createSynergyHandlers(['CAOS_ARCANO']);
    const state: any = { rounds: 2, buffs: {}, flags: {} };
    const mage: any = { id: 'm1', classId: 'MAGE' };
    const enemy: any = { id: 'e1', defense: 20 };

    handlers.onAttackResolved(state, mage, enemy, 8, 3);

    expect(state.buffs['e1']).toBeDefined();
    const buff = state.buffs['e1'][0];
    expect(buff.source).toBe('CAOS_ARCANO');
    expect(buff.type).toBe('defDebuffMul');
    expect(buff.value).toBe(0.5);
    expect(buff.expiresAfterRound).toBe(3);
  });

  test('CAOS_ARCANO: outras classes não disparam', () => {
    const handlers = createSynergyHandlers(['CAOS_ARCANO']);
    const state: any = { rounds: 1, buffs: {}, flags: {} };
    const archer: any = { id: 'a1', classId: 'ARCHER' };
    const enemy: any = { id: 'e1' };

    handlers.onAttackResolved(state, archer, enemy, 10, 3);
    expect(state.buffs['e1']).toBeUndefined();
  });

  test('CAOS_ARCANO: dano zero não dispara', () => {
    const handlers = createSynergyHandlers(['CAOS_ARCANO']);
    const state: any = { rounds: 1, buffs: {}, flags: {} };
    const mage: any = { id: 'm1', classId: 'MAGE' };
    const enemy: any = { id: 'e1' };

    handlers.onAttackResolved(state, mage, enemy, 0, 3);
    expect(state.buffs['e1']).toBeUndefined();
  });

  // --- EMBOSCADA (Surpresa) ---
  test('EMBOSCADA: shouldIgnoreDefense true para Guerreiro/Ladino nos rounds 1-2', () => {
    const handlers = createSynergyHandlers(['EMBOSCADA']);
    const warrior: any = { id: 'w1', classId: 'WARRIOR' };
    const rogue: any = { id: 'r1', classId: 'ROGUE' };

    expect(handlers.shouldIgnoreDefense({ rounds: 1 } as any, warrior)).toBe(true);
    expect(handlers.shouldIgnoreDefense({ rounds: 2 } as any, rogue)).toBe(true);
  });

  test('EMBOSCADA: shouldIgnoreDefense false após round 2', () => {
    const handlers = createSynergyHandlers(['EMBOSCADA']);
    const warrior: any = { classId: 'WARRIOR' };
    expect(handlers.shouldIgnoreDefense({ rounds: 3 } as any, warrior)).toBe(false);
  });

  test('EMBOSCADA: outras classes não disparam', () => {
    const handlers = createSynergyHandlers(['EMBOSCADA']);
    const archer: any = { classId: 'ARCHER' };
    expect(handlers.shouldIgnoreDefense({ rounds: 1 } as any, archer)).toBe(false);
  });

  // --- MURALHA_E_FLECHA (Posição Fortificada) ---
  test('MURALHA_E_FLECHA: onBattleStart aplica taunt em Tanques e crit/range em Arqueiros', () => {
    const handlers = createSynergyHandlers(['MURALHA_E_FLECHA']);
    const tank: any = { id: 't1', classId: 'TANK', hpCurrent: 50 };
    const archer: any = { id: 'a1', classId: 'ARCHER', hpCurrent: 40 };
    const warrior: any = { id: 'w1', classId: 'WARRIOR', hpCurrent: 60 };
    const state: any = { rounds: 0, heroes: [tank, archer, warrior], buffs: {}, flags: {} };

    handlers.onBattleStart(state);

    expect(state.buffs['t1'].some((b: any) => b.type === 'taunt' && b.value === 60)).toBe(true);
    expect(state.buffs['a1'].some((b: any) => b.type === 'rangeFlat' && b.value === 1)).toBe(true);
    expect(state.buffs['a1'].some((b: any) => b.type === 'critFlat' && b.value === 20)).toBe(true);
    expect(state.buffs['w1']).toBeUndefined();
  });

  test('MURALHA_E_FLECHA: onHeroDamaged remove buffs quando último Tanque morre', () => {
    const handlers = createSynergyHandlers(['MURALHA_E_FLECHA']);
    const tank: any = { id: 't1', classId: 'TANK', hpCurrent: 0, hpMax: 100 };
    const archer: any = { id: 'a1', classId: 'ARCHER', hpCurrent: 40 };
    const state: any = {
      rounds: 3,
      heroes: [tank, archer],
      buffs: {
        t1: [{ source: 'MURALHA_E_FLECHA', type: 'taunt', value: 60, expiresAfterRound: -1 }],
        a1: [
          { source: 'MURALHA_E_FLECHA', type: 'rangeFlat', value: 1, expiresAfterRound: -1 },
          { source: 'MURALHA_E_FLECHA', type: 'critFlat', value: 20, expiresAfterRound: -1 },
        ],
      },
      flags: {},
    };

    handlers.onHeroDamaged(state, tank, 0);

    expect(state.buffs['t1']).toBeUndefined();
    expect(state.buffs['a1']).toBeUndefined();
  });

  test('MURALHA_E_FLECHA: modifyTargetScore soma taunt quando alvo é Tanque', () => {
    const handlers = createSynergyHandlers(['MURALHA_E_FLECHA']);
    const tank: any = { id: 't1', classId: 'TANK' };
    const state: any = {
      rounds: 1,
      buffs: { t1: [{ source: 'MURALHA_E_FLECHA', type: 'taunt', value: 60, expiresAfterRound: -1 }] },
      flags: {},
    };

    const score = handlers.modifyTargetScore(state, {} as any, tank, 100);
    expect(score).toBe(160);
  });

  // --- BASTIAO (Sopro de Esperança) ---
  test('BASTIAO: arma flag quando Tanque vai abaixo de 50% HP', () => {
    const handlers = createSynergyHandlers(['BASTIAO']);
    const tank: any = { id: 't1', classId: 'TANK', hpMax: 100 };
    const state: any = { rounds: 2, heroes: [tank], buffs: {}, flags: {} };

    handlers.onHeroDamaged(state, tank, 40);
    expect(state.flags['bastion_armed']).toBe(true);
  });

  test('BASTIAO: não rearma se Tanque acima de 50%', () => {
    const handlers = createSynergyHandlers(['BASTIAO']);
    const tank: any = { id: 't1', classId: 'TANK', hpMax: 100 };
    const state: any = { rounds: 2, heroes: [tank], buffs: {}, flags: {} };

    handlers.onHeroDamaged(state, tank, 80);
    expect(state.flags['bastion_armed']).toBeFalsy();
  });

  test('BASTIAO: não dispara para classe diferente', () => {
    const handlers = createSynergyHandlers(['BASTIAO']);
    const archer: any = { id: 'a1', classId: 'ARCHER', hpMax: 100 };
    const state: any = { rounds: 2, heroes: [archer], buffs: {}, flags: {} };

    handlers.onHeroDamaged(state, archer, 10);
    expect(state.flags['bastion_armed']).toBeFalsy();
  });

  test('BASTIAO: AoE consome flag e cura aliados em raio 2', () => {
    const { BattleEngine } = require('../../utils/battleEngine');
    const tank: any = { id: 't1', classId: 'TANK', name: 'T', hpMax: 100, hpCurrent: 30 };
    const healer: any = { id: 'h1', classId: 'HEALER', name: 'H', mp: 20, hpMax: 50, hpCurrent: 50 };
    const ally: any = { id: 'w1', classId: 'WARRIOR', name: 'W', hpMax: 80, hpCurrent: 40 };
    const state: any = {
      heroes: [tank, healer, ally],
      enemies: [],
      heroPositions: { t1: 45, h1: 46, w1: 47 },
      enemyPositions: {},
      lastAttacker: {},
      threats: {},
      log: [],
      actions: [],
      rounds: 3,
      activeSynergies: ['BASTIAO'],
      buffs: {},
      flags: { bastion_armed: true },
      handlers: createSynergyHandlers(['BASTIAO']),
    };

    BattleEngine.executeClassAbility(healer, state);

    expect(state.flags['bastion_armed']).toBeUndefined();
    expect(tank.hpCurrent).toBeGreaterThan(30);
    expect(ally.hpCurrent).toBeGreaterThan(40);
  });

  // --- ARTILHARIA (Bombardeio) ---
  test('ARTILHARIA: ataque ranged ≥2 hex tem 50% chance de respingar 50% do dano', () => {
    const handlers = createSynergyHandlers(['ARTILHARIA']);
    const archer: any = { id: 'a1', classId: 'ARCHER', name: 'Ari' };
    const target: any = { id: 'e1', hp: 10, position: 5 };
    const neighbor: any = { id: 'e2', hp: 10, position: 6 };
    const farEnemy: any = { id: 'e3', hp: 10, position: 30 };
    const state: any = {
      rounds: 1,
      buffs: {},
      flags: {},
      enemies: [target, neighbor, farEnemy],
      enemyPositions: { e1: 5, e2: 6, e3: 30 },
      log: [],
      actions: [],
    };
    const origRandom = Math.random;
    Math.random = () => 0.4;
    try {
      handlers.onAttackResolved(state, archer, target, 8, 3);
    } finally {
      Math.random = origRandom;
    }

    expect(neighbor.hp).toBe(6); // 10 - floor(8*0.5) = 6
    expect(farEnemy.hp).toBe(10);
  });

  test('ARTILHARIA: rng acima de 50% não dispara', () => {
    const handlers = createSynergyHandlers(['ARTILHARIA']);
    const archer: any = { id: 'a1', classId: 'ARCHER' };
    const target: any = { id: 'e1', hp: 10, position: 5 };
    const neighbor: any = { id: 'e2', hp: 10, position: 6 };
    const state: any = {
      rounds: 1,
      buffs: {},
      flags: {},
      enemies: [target, neighbor],
      enemyPositions: { e1: 5, e2: 6 },
      log: [],
      actions: [],
    };
    const origRandom = Math.random;
    Math.random = () => 0.6;
    try {
      handlers.onAttackResolved(state, archer, target, 8, 3);
    } finally {
      Math.random = origRandom;
    }
    expect(neighbor.hp).toBe(10);
  });

  test('ARTILHARIA: não dispara em melee (distance < 2)', () => {
    const handlers = createSynergyHandlers(['ARTILHARIA']);
    const archer: any = { id: 'a1', classId: 'ARCHER' };
    const target: any = { id: 'e1', hp: 10, position: 5 };
    const neighbor: any = { id: 'e2', hp: 10, position: 6 };
    const state: any = {
      rounds: 1,
      buffs: {},
      flags: {},
      enemies: [target, neighbor],
      enemyPositions: { e1: 5, e2: 6 },
      log: [],
      actions: [],
    };
    const origRandom = Math.random;
    Math.random = () => 0.0;
    try {
      handlers.onAttackResolved(state, archer, target, 8, 1);
    } finally {
      Math.random = origRandom;
    }
    expect(neighbor.hp).toBe(10);
  });
});
