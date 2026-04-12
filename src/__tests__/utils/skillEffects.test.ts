import { executePreAttackSkills, onHeroDamagedSkills, onHeroDeathSkills, onRogueHitSkills, processDoTBuffs, getShieldReduction } from '../../utils/skillEffects';
import { BattleState, BattleEnemy } from '../../utils/battleEngine';
import { Hero, HeroTask } from '../../types';

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
    ...overrides,
  };
}

function makeState(heroes: Hero[], enemies: BattleEnemy[], round: number = 1): BattleState {
  const heroPositions: Record<string, number> = {};
  heroes.forEach((h, i) => { heroPositions[h.id] = 40 + i; });
  const enemyPositions: Record<string, number> = {};
  enemies.forEach(e => { enemyPositions[e.id] = e.position ?? 2; });

  return {
    heroes, enemies, heroPositions, enemyPositions,
    lastAttacker: {}, threats: {},
    log: [], actions: [], rounds: round,
    activeSynergies: [], buffs: {}, flags: {},
    handlers: {} as any,
    skillCooldowns: {}, skillOnceUsed: {},
  };
}

const fixedRng = (val: number) => () => val;

describe('skillEffects', () => {
  describe('Warrior skills', () => {
    test('Golpe Pesado triggers every 3 rounds and consumes turn', () => {
      const hero = makeHero({ classId: 'WARRIOR', trainingCount: { hp: 0, atk: 20, mp: 0 } });
      const enemy = makeEnemy();
      const state = makeState([hero], [enemy], 1);

      const consumed = executePreAttackSkills(hero, enemy, state, fixedRng(0.5));
      expect(consumed).toBe(true);
      expect(enemy.hp).toBeLessThan(50);
      expect(state.skillCooldowns['h1_WARRIOR_GOLPE_PESADO']).toBe(4); // round 1 + 3
    });

    test('Fúria triggers below 30% HP once per battle', () => {
      const hero = makeHero({ classId: 'WARRIOR', hpCurrent: 20, trainingCount: { hp: 0, atk: 100, mp: 0 } });
      const enemy = makeEnemy();
      const state = makeState([hero], [enemy]);

      executePreAttackSkills(hero, enemy, state, fixedRng(0.5));
      expect(state.buffs['h1']).toBeDefined();
      const atkBuff = state.buffs['h1'].find(b => b.source === 'WARRIOR_FURIA' && b.type === 'atkMul');
      expect(atkBuff?.value).toBe(1.50);
      expect(state.skillOnceUsed['h1_WARRIOR_FURIA']).toBe(true);
    });
  });

  describe('Rogue skills', () => {
    test('Golpe Furtivo only on round 1, double damage', () => {
      const hero = makeHero({ id: 'r1', classId: 'ROGUE', atk: 20, trainingCount: { hp: 0, atk: 20, mp: 0 } });
      const enemy = makeEnemy({ hp: 100, maxHp: 100 });
      const state = makeState([hero], [enemy], 1);

      const consumed = executePreAttackSkills(hero, enemy, state, fixedRng(0.5));
      expect(consumed).toBe(true);
      expect(enemy.hp).toBe(60); // 100 - 20*2.0
    });

    test('Veneno applies DoT with 30% chance', () => {
      const hero = makeHero({ classId: 'ROGUE', trainingCount: { hp: 0, atk: 50, mp: 0 } });
      const enemy = makeEnemy();
      const state = makeState([hero], [enemy]);

      onRogueHitSkills(hero, enemy, state, fixedRng(0.1)); // rng < 0.3 → triggers
      const dot = state.buffs['e1']?.find(b => b.type === 'dot');
      expect(dot).toBeDefined();
      expect(dot?.value).toBeGreaterThan(0);
    });
  });

  describe('Tank skills', () => {
    test('Último Suspiro buffs allies on death', () => {
      const tank = makeHero({ id: 'tank1', classId: 'TANK', hpCurrent: 0, trainingCount: { hp: 100, atk: 0, mp: 0 } });
      const ally = makeHero({ id: 'ally1', classId: 'WARRIOR' });
      const state = makeState([tank, ally], [makeEnemy()]);

      onHeroDeathSkills(tank, state);
      const defBuff = state.buffs['ally1']?.find(b => b.source === 'TANK_ULTIMO_SUSPIRO');
      expect(defBuff?.type).toBe('defMul');
      expect(defBuff?.value).toBe(1.30);
    });
  });

  describe('Healer skills', () => {
    test('Ressurreição revives dead ally once per battle', () => {
      const healer = makeHero({ id: 'healer1', classId: 'HEALER', trainingCount: { hp: 0, atk: 0, mp: 100 } });
      const dead = makeHero({ id: 'dead1', classId: 'WARRIOR', hpCurrent: 0 });
      const state = makeState([healer, dead], [makeEnemy()]);

      const consumed = executePreAttackSkills(healer, undefined, state, fixedRng(0.5));
      expect(consumed).toBe(true);
      expect(dead.hpCurrent).toBe(30); // 30% of 100
      expect(state.skillOnceUsed['healer1_HEALER_RESSURREICAO']).toBe(true);

      // Second time should not trigger
      dead.hpCurrent = 0;
      const consumed2 = executePreAttackSkills(healer, undefined, state, fixedRng(0.5));
      expect(dead.hpCurrent).toBe(0); // Not revived again
    });
  });

  describe('Mage skills', () => {
    test('Escudo Arcano triggers on damage and provides shield', () => {
      const mage = makeHero({ classId: 'MAGE', trainingCount: { hp: 0, atk: 0, mp: 50 } });
      const state = makeState([mage], [makeEnemy()]);

      onHeroDamagedSkills(mage, state);
      const shield = state.buffs['h1']?.find(b => b.type === 'shield');
      expect(shield?.value).toBe(0.50);
    });
  });

  describe('DoT processing', () => {
    test('processDoTBuffs applies damage and kills', () => {
      const enemy = makeEnemy({ hp: 5, maxHp: 50 });
      const state = makeState([makeHero({ classId: 'WARRIOR' })], [enemy]);
      state.buffs['e1'] = [{ source: 'ROGUE_VENENO', type: 'dot', value: 10, expiresAfterRound: 3 }];

      processDoTBuffs(state);
      expect(enemy.hp).toBe(0);
      expect(enemy.alive).toBe(false);
    });
  });

  describe('Shield reduction', () => {
    test('getShieldReduction returns value and consumes shield', () => {
      const state = makeState([makeHero({ classId: 'WARRIOR' })], []);
      state.buffs['h1'] = [{ source: 'MAGE_ESCUDO_ARCANO', type: 'shield', value: 0.50, expiresAfterRound: 5 }];

      const reduction = getShieldReduction(state, 'h1');
      expect(reduction).toBe(0.50);
      expect(state.buffs['h1'].find(b => b.type === 'shield')).toBeUndefined();
    });
  });
});
