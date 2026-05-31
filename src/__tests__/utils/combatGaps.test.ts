// src/__tests__/utils/combatGaps.test.ts
import { executePreAttackSkills } from '../../utils/skillEffects';
import {
  BattleState,
  BattleEnemy,
  BattleEngine,
  SynergyHandlers,
} from '../../utils/battleEngine';
import { Hero, HeroTask } from '../../types';
import { EnemySkillDef } from '../../constants/enemySkills';
import { executeEnemyPreAttackSkills } from '../../utils/enemySkillEffects';
import { createSynergyHandlers } from '../../utils/synergyEffects';

// ─── helpers ───

function makeHero(overrides: Partial<Hero> & { classId: string }): Hero {
  return {
    id: 'h1', name: 'Hero', hpMax: 100, hpCurrent: 100,
    atk: 20, mp: 10, defense: 5, crit: 10, agility: 5,
    currentTask: HeroTask.IDLE,
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    ...overrides,
  } as Hero;
}

function makeEnemy(overrides?: Partial<BattleEnemy>): BattleEnemy {
  return {
    id: 'e1', hp: 50, maxHp: 50, atk: 10, mp: 0,
    defense: 5, crit: 5, agility: 5, alive: true,
    attackType: 'MELEE', range: 1, movement: 2,
    position: 2,
    skills: [],
    ...overrides,
  };
}

function makeHandlers(overrides?: Partial<SynergyHandlers>): SynergyHandlers {
  return {
    onBattleStart: () => {},
    onHealApplied: () => {},
    onHeroDamaged: () => {},
    onAttackResolved: () => {},
    shouldIgnoreDefense: () => false,
    modifyTargetScore: (_s, _e, _c, score) => score,
    ...overrides,
  };
}

function makeState(
  heroes: Hero[],
  enemies: BattleEnemy[],
  round: number = 1,
  handlersOverride?: Partial<SynergyHandlers>,
): BattleState {
  const heroPositions: Record<string, number> = {};
  heroes.forEach((h, i) => { heroPositions[h.id] = 40 + i; });
  const enemyPositions: Record<string, number> = {};
  enemies.forEach(e => { enemyPositions[e.id] = e.position ?? 2; });
  return {
    heroes, enemies, heroPositions, enemyPositions,
    lastAttacker: {}, threats: {},
    log: [], actions: [], rounds: round,
    activeSynergies: [], buffs: {}, flags: {},
    handlers: makeHandlers(handlersOverride),
    skillCooldowns: {}, skillOnceUsed: {},
  };
}

const alwaysHit = () => 0.1; // rng < hitChance → sempre acerta

// ─── D1: AoE de skill herói ───

describe('D1 — AoE de skill herói', () => {
  // Helper: inimigo com escudo ativo (50% de redução)
  function stateWithShieldedEnemy(skillId: string, classId: string, atk: number) {
    const hero = makeHero({ classId: classId as any, atk, trainingCount: { hp: 0, atk: 100, mp: 100 } });
    // Dois inimigos na mesma posição (hex 2) para testar AoE
    const e1 = makeEnemy({ id: 'e1', hp: 50, maxHp: 50, position: 2 });
    const e2 = makeEnemy({ id: 'e2', hp: 50, maxHp: 50, position: 2 });
    const state = makeState([hero], [e1, e2]);
    // Colocar escudo no e1
    state.buffs['e1'] = [{ source: 'MAGE_ESCUDO_ARCANO', type: 'shield', value: 0.5, expiresAfterRound: 99 }];
    return { hero, e1, e2, state };
  }

  test('Chuva de Flechas: inimigo com escudo 50% recebe metade do dano', () => {
    const { hero, e1, state } = stateWithShieldedEnemy('ARCHER_CHUVA_DE_FLECHAS', 'ARCHER', 20);
    // Garantir Chuva de Flechas disponível e bloquear Tiro Certeiro para não consumir o turno primeiro
    state.skillCooldowns['h1_ARCHER_CHUVA_DE_FLECHAS'] = 0;
    state.skillCooldowns['h1_ARCHER_TIRO_CERTEIRO'] = 999; // em cooldown

    const hpBefore = e1.hp;
    executePreAttackSkills(hero, e1, state, alwaysHit);

    const rawDmg = Math.max(1, Math.floor(20 * 0.5)); // 10
    const reduced = Math.max(1, Math.floor(rawDmg * 0.5)); // 5
    // e1 tinha escudo → deve receber dano reduzido (< rawDmg)
    expect(hpBefore - e1.hp).toBeLessThan(rawDmg);
    expect(hpBefore - e1.hp).toBe(reduced);
  });

  test('Chuva de Flechas: dispara onEnemyDamagedSkills em cada alvo atingido', () => {
    const hero = makeHero({ classId: 'ARCHER', atk: 20, trainingCount: { hp: 0, atk: 100, mp: 0 } });
    const skillDef = (id: string): EnemySkillDef => ({ id, name: id, icon: '?', cooldownRounds: 4, minDifficulty: 1 });
    const e1 = makeEnemy({ id: 'e1', position: 2, skills: [skillDef('MAGIC_SHIELD')] });
    const state = makeState([hero], [e1]);
    state.skillCooldowns['h1_ARCHER_CHUVA_DE_FLECHAS'] = 0;
    state.skillCooldowns['h1_ARCHER_TIRO_CERTEIRO'] = 999; // em cooldown

    // MAGIC_SHIELD reage a onEnemyDamagedSkills aplicando um buff 'shield' no inimigo
    executePreAttackSkills(hero, e1, state, alwaysHit);

    const shieldBuff = state.buffs['e1']?.find(b => b.source === 'ENEMY_MAGIC_SHIELD');
    expect(shieldBuff).toBeDefined();
  });

  test('Bola de Fogo: alvo principal com escudo 50% recebe metade do dano', () => {
    const hero = makeHero({ classId: 'MAGE', atk: 20, trainingCount: { hp: 0, atk: 0, mp: 100 } });
    const e1 = makeEnemy({ id: 'e1', hp: 100, maxHp: 100, position: 2 });
    const state = makeState([hero], [e1]);
    state.buffs['e1'] = [{ source: 'MAGE_ESCUDO_ARCANO', type: 'shield', value: 0.5, expiresAfterRound: 99 }];
    state.skillCooldowns['h1_MAGE_BOLA_DE_FOGO'] = 0;

    const rawMain = Math.max(1, Math.floor(20 * 0.8)); // 16
    const reduced = Math.max(1, Math.floor(rawMain * 0.5)); // 8

    executePreAttackSkills(hero, e1, state, alwaysHit);

    expect(100 - e1.hp).toBe(reduced);
  });

  test('Meteoro: inimigo com escudo recebe dano reduzido', () => {
    const hero = makeHero({ classId: 'MAGE', atk: 20, trainingCount: { hp: 0, atk: 0, mp: 100 } });
    // 3 inimigos vivos (condição para Meteoro)
    const e1 = makeEnemy({ id: 'e1', hp: 60, maxHp: 60, position: 2 });
    const e2 = makeEnemy({ id: 'e2', hp: 60, maxHp: 60, position: 3 });
    const e3 = makeEnemy({ id: 'e3', hp: 60, maxHp: 60, position: 4 });
    const state = makeState([hero], [e1, e2, e3]);
    state.buffs['e1'] = [{ source: 'MAGE_ESCUDO_ARCANO', type: 'shield', value: 0.5, expiresAfterRound: 99 }];

    const rawDmg = Math.max(1, Math.floor(20 * 1.0)); // 20
    const reduced = Math.max(1, Math.floor(rawDmg * 0.5)); // 10

    executePreAttackSkills(hero, e1, state, alwaysHit);

    expect(60 - e1.hp).toBe(reduced);
  });
});

// ─── D2: AOE de inimigo respeita escudo e dispara reações de herói ───

describe('D2 — AOE de inimigo', () => {
  function makeEnemyWithAoe(atk: number = 20): BattleEnemy {
    return makeEnemy({
      id: 'boss', atk,
      skills: [{ id: 'AOE_ATTACK', name: 'AoE', icon: '💥', cooldownRounds: 4, minDifficulty: 1 }],
      skillCooldowns: { 'boss_AOE_ATTACK': 0 },
    });
  }

  test('herói com escudo 50% recebe metade do dano do AOE_ATTACK', () => {
    const hero = makeHero({ classId: 'WARRIOR', id: 'w1' });
    const enemy = makeEnemyWithAoe(20);
    const state = makeState([hero], [enemy]);
    // Escudo ativo no herói
    state.buffs['w1'] = [{ source: 'MAGE_ESCUDO_ARCANO', type: 'shield', value: 0.5, expiresAfterRound: 99 }];
    state.heroPositions['w1'] = 40;
    state.enemyPositions['boss'] = 2;

    const rawDmg = Math.max(1, Math.floor(20 * 0.5)); // 10
    const reduced = Math.max(1, Math.floor(rawDmg * 0.5)); // 5
    const hpBefore = hero.hpCurrent;

    executeEnemyPreAttackSkills(enemy, hero, state, 0.5);

    expect(hpBefore - hero.hpCurrent).toBe(reduced);
  });

  test('AOE_ATTACK dispara onHeroDamaged do handler', () => {
    const hero = makeHero({ classId: 'WARRIOR', id: 'w1' });
    const enemy = makeEnemyWithAoe(20);
    let damagedCalled = false;
    const state = makeState([hero], [enemy], 1, {
      onHeroDamaged: () => { damagedCalled = true; },
    });
    state.heroPositions['w1'] = 40;
    state.enemyPositions['boss'] = 2;

    executeEnemyPreAttackSkills(enemy, hero, state, 0.5);

    expect(damagedCalled).toBe(true);
  });

  test('AOE_ATTACK dispara onHeroDamagedSkills (Mage ganha Escudo Arcano)', () => {
    const mage = makeHero({ classId: 'MAGE', id: 'm1', trainingCount: { hp: 0, atk: 0, mp: 50 } });
    const enemy = makeEnemyWithAoe(20);
    const state = makeState([mage], [enemy]);
    state.heroPositions['m1'] = 40;
    state.enemyPositions['boss'] = 2;

    executeEnemyPreAttackSkills(enemy, mage, state, 0.5);

    const shieldBuff = state.buffs['m1']?.find(b => b.source === 'MAGE_ESCUDO_ARCANO' && b.type === 'shield');
    expect(shieldBuff).toBeDefined();
  });
});

// ─── D3: Ataque-extra do Oportunista usa caminho normal ───

describe('D3 — Ataque-extra do Oportunista', () => {
  // Herói com personalidade Oportunista (agility alta → aciona applyPersonalityOnHit)
  // Verificamos via fixture direta que o bloco do extra-attack aplica escudo e veneno.

  function makeOppState() {
    // Herói Rogue com trainingCount suficiente para ROGUE_VENENO (atk >= 50)
    // personality OPPORTUNIST: alvo fraco (hp<0.4) ganha score +30 extra
    const hero: Hero = {
      id: 'rogue1', name: 'Rogue', hpMax: 100, hpCurrent: 100,
      atk: 60, mp: 5, defense: 5, crit: 10, agility: 20,
      currentTask: HeroTask.IDLE,
      classId: 'ROGUE' as any,
      trainingCount: { hp: 0, atk: 60, mp: 0 },
      trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
      personality: 'OPPORTUNIST' as any,
      range: 1, movement: 2,
    } as Hero;

    // e1 (quase morto, HP 1) na mesma posição que o herói (dist=0)
    // e2 (saudável) na posição adjacente (dist=1)
    // Assim e1 sempre tem score muito maior e é selecionado primeiro
    const e1 = makeEnemy({ id: 'e1', hp: 1, maxHp: 50, position: 5, defense: 0 });
    const e2 = makeEnemy({ id: 'e2', hp: 50, maxHp: 50, position: 6, defense: 0 });

    const handlers = createSynergyHandlers([]);
    const state: BattleState = {
      heroes: [hero], enemies: [e1, e2],
      heroPositions: { rogue1: 5 },
      enemyPositions: { e1: 5, e2: 6 },
      lastAttacker: {}, threats: {},
      log: [], actions: [], rounds: 2, // round 2: Golpe Furtivo não dispara
      activeSynergies: [], buffs: {}, flags: {},
      handlers,
      skillCooldowns: {}, skillOnceUsed: {},
    };
    return { hero, e1, e2, state };
  }

  test('ataque-extra respeita escudo do segundo inimigo', () => {
    const { e1, e2, state } = makeOppState();
    // Colocar escudo em e2
    state.buffs['e2'] = [{ source: 'MAGE_ESCUDO_ARCANO', type: 'shield', value: 0.5, expiresAfterRound: 99 }];
    const hpBefore = e2.hp;
    // rng sequence para forçar: e1 como alvo, acertar, OPPORTUNIST ativar, e2 atacado com escudo
    // calls: 1-3 selectTarget (>0.2), 4 hit(<0.89), 5 crit, 6 veneno(>0.3 não aplica), 7 OPPORTUNIST(<0.25), 8+ extra
    let c = 0;
    const deterministicRng = () => {
      c++;
      if (c <= 3) return 0.5;  // selectTarget: fica no 1º candidato
      if (c === 6) return 0.5; // veneno NÃO aplica (> 0.3)
      if (c === 7) return 0.1; // OPPORTUNIST < 0.25 → ativa extra!
      return 0.5;              // hit/crit ok
    };
    BattleEngine.processHeroTurn(state.heroes[0], state, deterministicRng);
    // e1 com hp=1 deve ser morto; Oportunista dispara extra em e2
    expect(e1.alive).toBe(false); // e1 foi morto
    expect(e2.hp).toBeLessThan(hpBefore); // e2 recebeu dano
    // APÓS o fix: escudo foi consumido pelo getShieldReduction no extra-attack
    expect(state.buffs['e2']?.find(b => b.type === 'shield')).toBeUndefined(); // escudo consumido
  });

  test('ataque-extra de Rogue aplica veneno no segundo inimigo', () => {
    const { e1, e2, state } = makeOppState();
    const hpBefore = e2.hp;
    // rng sequence: e1 como alvo, acertar, veneno em e1 (call 6 < 0.3), OPPORTUNIST ativa (call 7 < 0.25)
    // No extra-attack (e2): acertar, call de veneno em e2 (< 0.3)
    let c = 0;
    const deterministicRng = () => {
      c++;
      if (c <= 3) return 0.5;  // selectTarget: fica no 1º candidato
      if (c === 6) return 0.1; // veneno em e1 aplica (< 0.3)
      if (c === 7) return 0.1; // OPPORTUNIST < 0.25 → ativa extra!
      if (c === 10) return 0.1; // veneno em e2 aplica (< 0.3) após extra hit/crit
      return 0.5;              // outros (hit/crit ok)
    };
    BattleEngine.processHeroTurn(state.heroes[0], state, deterministicRng);
    // e1 deve ter morrido e ataque-extra em e2 deve ter aplicado veneno
    expect(e1.alive).toBe(false);
    expect(e2.hp).toBeLessThan(hpBefore); // e2 foi atacado
    const dotBuff = state.buffs['e2']?.find(b => b.type === 'dot' && b.source === 'ROGUE_VENENO');
    expect(dotBuff).toBeDefined(); // veneno em e2
  });
});

// ─── D4: Curas de skill disparam onHealApplied para sinergia ───

describe('D4 — Curas de skill disparam onHealApplied', () => {
  function makeHealerState(injured: Partial<Hero> = {}) {
    const healer = makeHero({
      id: 'healer1', classId: 'HEALER',
      trainingCount: { hp: 0, atk: 0, mp: 20 }, // desbloqueia HEALER_CURA_MAIOR
    });
    const warrior = makeHero({
      id: 'warrior1', classId: 'WARRIOR',
      hpMax: 100, hpCurrent: 30, // abaixo de 40% → Cura Maior ativa
      ...injured,
    });
    const handlers = createSynergyHandlers(['LINHA_DE_FRENTE']);
    const state: BattleState = {
      heroes: [healer, warrior],
      enemies: [makeEnemy()],
      heroPositions: { healer1: 40, warrior1: 41 },
      enemyPositions: { e1: 2 },
      lastAttacker: {}, threats: {},
      log: [], actions: [], rounds: 1,
      activeSynergies: ['LINHA_DE_FRENTE'],
      buffs: {}, flags: {},
      handlers,
      skillCooldowns: {}, skillOnceUsed: {},
    };
    return { healer, warrior, state };
  }

  test('Cura Maior dispara onHealApplied e aplica buff LINHA_DE_FRENTE no Guerreiro', () => {
    const { healer, warrior, state } = makeHealerState();

    executePreAttackSkills(healer, makeEnemy(), state, alwaysHit);

    // LINHA_DE_FRENTE adiciona atkMul 1.30 ao guerreiro curado
    const furorBuff = state.buffs['warrior1']?.find(b => b.source === 'LINHA_DE_FRENTE' && b.type === 'atkMul');
    expect(furorBuff).toBeDefined();
    expect(furorBuff?.value).toBe(1.30);
  });

  test('Purificação dispara onHealApplied e aplica buff LINHA_DE_FRENTE no Guerreiro', () => {
    const healer = makeHero({
      id: 'healer2', classId: 'HEALER',
      trainingCount: { hp: 0, atk: 0, mp: 50 }, // desbloqueia HEALER_PURIFICACAO
    });
    const warrior = makeHero({
      id: 'warrior2', classId: 'WARRIOR',
      hpMax: 100, hpCurrent: 80, // Purificação não exige HP baixo
    });
    const handlers = createSynergyHandlers(['LINHA_DE_FRENTE']);
    const state: BattleState = {
      heroes: [healer, warrior],
      enemies: [makeEnemy()],
      heroPositions: { healer2: 40, warrior2: 41 },
      enemyPositions: { e1: 2 },
      lastAttacker: {}, threats: {},
      log: [], actions: [], rounds: 1,
      activeSynergies: ['LINHA_DE_FRENTE'],
      buffs: {
        warrior2: [{ source: 'ENEMY_POISON', type: 'dot', value: 5, expiresAfterRound: 5 }],
      },
      flags: {},
      handlers,
      skillCooldowns: {}, skillOnceUsed: {},
    };

    executePreAttackSkills(healer, makeEnemy(), state, alwaysHit);

    // Purificação remove o dot e cura 20% HP, deve disparar onHealApplied
    const furorBuff = state.buffs['warrior2']?.find(b => b.source === 'LINHA_DE_FRENTE' && b.type === 'atkMul');
    expect(furorBuff).toBeDefined();
    expect(furorBuff?.value).toBe(1.30);
  });
});
