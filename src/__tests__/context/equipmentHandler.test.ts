import { gameReducer, initialGameState } from '../../context/gameReducer';
import { HeroTask } from '../../types';

describe('Equipment system', () => {
  test('FORGE_EQUIPMENT deducts gold and adds to inventory and queue', () => {
    const state = { ...initialGameState, gold: 500 };
    const next = gameReducer(state, { type: 'FORGE_EQUIPMENT', tier: 1, equipmentType: 'weapon', now: Date.now() });
    expect(next.gold).toBeLessThan(500);
    expect((next.inventory || []).length).toBe(1);
    expect((next.forgingQueue || []).length).toBe(1);
  });

  test('FORGE_EQUIPMENT fails with insufficient gold', () => {
    const state = { ...initialGameState, gold: 0 };
    const next = gameReducer(state, { type: 'FORGE_EQUIPMENT', tier: 1, equipmentType: 'weapon', now: Date.now() });
    expect(next.gold).toBe(0);
    expect((next.inventory || []).length).toBe(0);
  });

  test('COLLECT_EQUIPMENT removes from forging queue', () => {
    const state = { ...initialGameState, gold: 500 };
    const s1 = gameReducer(state, { type: 'FORGE_EQUIPMENT', tier: 1, equipmentType: 'weapon', now: Date.now() });
    const eqId = s1.inventory![0].id;
    const s2 = gameReducer(s1, { type: 'COLLECT_EQUIPMENT', equipmentId: eqId });
    expect((s2.forgingQueue || []).length).toBe(0);
    expect((s2.inventory || []).length).toBe(1); // still in inventory
  });

  test('EQUIP_ITEM assigns item to hero', () => {
    const hero = { id: 'h1', name: 'H', hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, defense: 5, crit: 5, agility: 10, currentTask: HeroTask.IDLE };
    const state = { ...initialGameState, heroes: [hero], gold: 500 };
    const s1 = gameReducer(state as any, { type: 'FORGE_EQUIPMENT', tier: 1, equipmentType: 'weapon', now: Date.now() });
    const eqId = s1.inventory![0].id;
    const s2 = gameReducer(s1 as any, { type: 'EQUIP_ITEM', heroId: 'h1', equipmentId: eqId });
    expect(s2.heroes[0].equippedItems).toContain(eqId);
  });

  test('EQUIP_ITEM respects max 2 items', () => {
    const hero = { id: 'h1', name: 'H', hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, defense: 5, crit: 5, agility: 10, currentTask: HeroTask.IDLE, equippedItems: ['eq1', 'eq2'] };
    const eq = { id: 'eq3', name: 'Sword', type: 'weapon' as const, statBonus: { atk: 3 }, tier: 1 };
    const state = { ...initialGameState, heroes: [hero], inventory: [eq] } as any;
    const next = gameReducer(state, { type: 'EQUIP_ITEM', heroId: 'h1', equipmentId: 'eq3' });
    expect(next.heroes[0].equippedItems!.length).toBe(2); // unchanged
  });

  test('UNEQUIP_ITEM removes item from hero', () => {
    const hero = { id: 'h1', name: 'H', hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, defense: 5, crit: 5, agility: 10, currentTask: HeroTask.IDLE, equippedItems: ['eq1'] };
    const state = { ...initialGameState, heroes: [hero] } as any;
    const next = gameReducer(state, { type: 'UNEQUIP_ITEM', heroId: 'h1', equipmentId: 'eq1' });
    expect(next.heroes[0].equippedItems).not.toContain('eq1');
  });
});
