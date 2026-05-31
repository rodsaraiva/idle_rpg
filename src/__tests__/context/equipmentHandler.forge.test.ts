import { handleForgeEquipment } from '../../context/equipmentHandler';
import { GameState, HeroTask } from '../../types';
import { refreshWeeklyState } from '../../context/weeklyHandler';

const baseState: GameState = {
  gold: 100,
  heroes: [],
  heroesRecruited: 0,
  lastSavedAt: Date.now(),
  materials: { iron: 20, crystal: 20, essence: 20, starstone: 5 },
  inventory: [],
  forgingQueue: [],
};

describe('handleForgeEquipment with materials', () => {
  test('forges weapon tier 1 and deducts materials + gold', () => {
    const state = handleForgeEquipment(baseState, 1, 'weapon', Date.now());
    expect(state.materials!.iron).toBe(17); // 20 - 3
    expect(state.gold).toBe(90); // 100 - 10
    expect(state.inventory!).toHaveLength(1);
  });

  test('rejects if insufficient materials', () => {
    const poor = { ...baseState, materials: { iron: 1 } };
    const state = handleForgeEquipment(poor, 1, 'weapon', Date.now());
    expect(state.inventory).toHaveLength(0);
  });

  test('rejects if insufficient gold', () => {
    const broke = { ...baseState, gold: 0 };
    const state = handleForgeEquipment(broke, 1, 'weapon', Date.now());
    expect(state.inventory).toHaveLength(0);
  });

  test('epic tier requires starstone', () => {
    const state = handleForgeEquipment(baseState, 3, 'weapon', Date.now());
    expect(state.materials!.starstone).toBe(3); // 5 - 2
    expect(state.inventory!).toHaveLength(1);
  });
});

describe('tracker semanal itemsForged', () => {
  test('FORGE_EQUIPMENT incrementa weeklyState.progress.itemsForged', () => {
    // Inicializar com weeklyState ativo
    const stateWithWeekly = refreshWeeklyState({ ...baseState });
    const result = handleForgeEquipment(stateWithWeekly, 1, 'weapon', Date.now());
    expect(result.weeklyState?.progress['itemsForged']).toBe(1);
  });

  test('forjar 3 itens acumula itemsForged = 3', () => {
    let s = refreshWeeklyState({ ...baseState });
    s = handleForgeEquipment(s, 1, 'weapon', Date.now());
    s = handleForgeEquipment(s, 1, 'weapon', Date.now());
    s = handleForgeEquipment(s, 1, 'weapon', Date.now());
    expect(s.weeklyState?.progress['itemsForged']).toBe(3);
  });
});
