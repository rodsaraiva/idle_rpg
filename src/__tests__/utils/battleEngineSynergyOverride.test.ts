import { BattleEngine, SynergyId } from '../../utils/battleEngine';

const fakeTemplate: any = {
  id: 'test', name: 'Test', minHeroes: 2, rewardMin: 1, rewardMax: 2,
  enemies: [{ hp: 1, atk: 1, mp: 0, count: 1 }],
};

// Dupla TANK+ARCHER ativa MURALHA_E_FLECHA por auto-detecção.
const heroes: any = [
  { id: 't1', classId: 'TANK', name: 'T', hpMax: 50, hpCurrent: 50, atk: 5, mp: 0, defense: 10, crit: 0, agility: 5, range: 1, movement: 2 },
  { id: 'a1', classId: 'ARCHER', name: 'A', hpMax: 30, hpCurrent: 30, atk: 8, mp: 0, defense: 2, crit: 0, agility: 8, range: 3, movement: 2 },
];

describe('initializeBattle — forceSynergies (hook de teste)', () => {
  test('sem forceSynergies, auto-detecta MURALHA_E_FLECHA para TANK+ARCHER', () => {
    const state = BattleEngine.initializeBattle(heroes, fakeTemplate, { rng: () => 0.5 });
    expect(state.activeSynergies).toEqual(['MURALHA_E_FLECHA']);
  });

  test('forceSynergies:[] desliga sinergias mesmo com par sinérgico', () => {
    const state = BattleEngine.initializeBattle(heroes, fakeTemplate, { rng: () => 0.5, forceSynergies: [] });
    expect(state.activeSynergies).toEqual([]);
    // NOOP: onBattleStart não aplica buffs de Muralha e Flecha
    expect(state.buffs).toEqual({});
  });

  test('forceSynergies sobrepõe a auto-detecção com a lista dada', () => {
    const forced: SynergyId[] = ['ARTILHARIA'];
    const state = BattleEngine.initializeBattle(heroes, fakeTemplate, { rng: () => 0.5, forceSynergies: forced });
    expect(state.activeSynergies).toEqual(['ARTILHARIA']);
  });
});
