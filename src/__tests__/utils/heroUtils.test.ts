import { getEffectiveStats, applyGoldBonus } from '../../utils/heroUtils';
import { Hero, HeroTask, GameState } from '../../types';

function makeHero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 'h1',
    name: 'Test',
    hpMax: 50,
    hpCurrent: 40,
    atk: 10,
    mp: 5,
    defense: 5,
    crit: 10,
    agility: 5,
    currentTask: HeroTask.IDLE,
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
    ...overrides,
  } as Hero;
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    gold: 0,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: 0,
    inventory: [],
    ...overrides,
  };
}

describe('getEffectiveStats', () => {
  test('sem equipamento e sem bônus retorna stats base', () => {
    const hero = makeHero();
    const state = makeState();
    const eff = getEffectiveStats(hero, state);
    expect(eff.hpMax).toBe(50);
    expect(eff.atk).toBe(10);
    expect(eff.mp).toBe(5);
    expect(eff.defense).toBe(5);
    expect(eff.crit).toBe(10);
    expect(eff.agility).toBe(5);
  });

  test('equipamento com atk aplica flat sobre base', () => {
    const hero = makeHero({ equippedItems: ['eq1'] });
    const state = makeState({
      inventory: [{ id: 'eq1', name: 'Sword', type: 'weapon', statBonus: { atk: 5 }, tier: 1 }],
    });
    const eff = getEffectiveStats(hero, state);
    expect(eff.atk).toBe(15);
  });

  test('equipamento com hp aplica flat e hpMax escala hpCurrent proporcional', () => {
    const hero = makeHero({ hpCurrent: 40, hpMax: 50, equippedItems: ['eq1'] });
    const state = makeState({
      inventory: [{ id: 'eq1', name: 'Plate', type: 'armor', statBonus: { hp: 10 }, tier: 1 }],
    });
    const eff = getEffectiveStats(hero, state);
    expect(eff.hpMax).toBe(60);
    // hpCurrent: min(60, 40 + 10) = 50
    expect(eff.hpCurrent).toBe(50);
  });

  test('permanentBonuses flat atk aplica sobre base+equip', () => {
    const hero = makeHero({ equippedItems: ['eq1'] });
    const state = makeState({
      inventory: [{ id: 'eq1', name: 'Sword', type: 'weapon', statBonus: { atk: 5 }, tier: 1 }],
      permanentBonuses: { atk: 3, hp: 0 },
    });
    const eff = getEffectiveStats(hero, state);
    // base 10 + equip 5 + permanentBonus 3 = 18
    expect(eff.atk).toBe(18);
  });

  test('permanentBonuses flat hp aplica sobre base+equip e escala hpCurrent', () => {
    const hero = makeHero({ hpCurrent: 40, hpMax: 50 });
    const state = makeState({
      permanentBonuses: { atk: 0, hp: 10 },
    });
    const eff = getEffectiveStats(hero, state);
    expect(eff.hpMax).toBe(60);
    expect(eff.hpCurrent).toBe(50);
  });

  test('pantheonBonuses atkPercent aplica multiplicador sobre (base+equip+permanent)', () => {
    const hero = makeHero();
    const state = makeState({
      pantheonBonuses: { atkPercent: 10, hpPercent: 0, goldPercent: 0 },
    });
    const eff = getEffectiveStats(hero, state);
    // 10 * 1.10 = 11
    expect(eff.atk).toBe(11);
  });

  test('pantheonBonuses hpPercent aplica multiplicador sobre hpMax e escala hpCurrent', () => {
    const hero = makeHero({ hpCurrent: 40, hpMax: 50 });
    const state = makeState({
      pantheonBonuses: { atkPercent: 0, hpPercent: 10, goldPercent: 0 },
    });
    const eff = getEffectiveStats(hero, state);
    // 50 * 1.10 = 55
    expect(eff.hpMax).toBe(55);
    // hpCurrent: min(55, 40 + (55-50)) = 45
    expect(eff.hpCurrent).toBe(45);
  });

  test('DEF/CRIT/AGI recebem apenas equipamento, não permanentBonuses nem pantheonBonuses', () => {
    const hero = makeHero({ equippedItems: ['eq1'] });
    const state = makeState({
      inventory: [{ id: 'eq1', name: 'Shield', type: 'armor', statBonus: { defense: 3, crit: 2, agility: 1 }, tier: 1 }],
      permanentBonuses: { atk: 99, hp: 99 },
      pantheonBonuses: { atkPercent: 100, hpPercent: 100, goldPercent: 0 },
    });
    const eff = getEffectiveStats(hero, state);
    // defense = 5 (base) + 3 (equip) = 8 — NÃO sofre multiplicador de panteão
    expect(eff.defense).toBe(8);
    expect(eff.crit).toBe(12);
    expect(eff.agility).toBe(6);
  });

  test('combinação completa: equip + permanent + pantheon', () => {
    const hero = makeHero({ hpCurrent: 50, hpMax: 50, equippedItems: ['eq1'] });
    const state = makeState({
      inventory: [{ id: 'eq1', name: 'Sword', type: 'weapon', statBonus: { atk: 5, hp: 10 }, tier: 1 }],
      permanentBonuses: { atk: 2, hp: 5 },
      pantheonBonuses: { atkPercent: 10, hpPercent: 20, goldPercent: 5 },
    });
    const eff = getEffectiveStats(hero, state);
    // atk: (10 base + 5 equip + 2 permanent) * 1.10 = 17 * 1.10 = 18 (floor)
    expect(eff.atk).toBe(18);
    // hpMax: (50 base + 10 equip + 5 permanent) * 1.20 = 65 * 1.20 = 78
    expect(eff.hpMax).toBe(78);
  });
});

describe('applyGoldBonus', () => {
  test('sem pantheonBonuses retorna reward intacto', () => {
    const state = makeState();
    expect(applyGoldBonus(100, state)).toBe(100);
  });

  test('goldPercent 0 retorna reward intacto', () => {
    const state = makeState({ pantheonBonuses: { atkPercent: 5, hpPercent: 5, goldPercent: 0 } });
    expect(applyGoldBonus(100, state)).toBe(100);
  });

  test('goldPercent 5 retorna floor(100 * 1.05) = 105', () => {
    const state = makeState({ pantheonBonuses: { atkPercent: 0, hpPercent: 0, goldPercent: 5 } });
    expect(applyGoldBonus(100, state)).toBe(105);
  });

  test('goldPercent 8 com reward 50 retorna floor(50 * 1.08) = 54', () => {
    const state = makeState({ pantheonBonuses: { atkPercent: 0, hpPercent: 0, goldPercent: 8 } });
    expect(applyGoldBonus(50, state)).toBe(54);
  });
});
