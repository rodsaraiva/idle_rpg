import { checkAchievements } from '../../context/achievementHandler';
import { GameState, HeroTask } from '../../types';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    gold: 0,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: Date.now(),
    unlockedAchievements: [],
    completedMissionCount: 0,
    completedMissionIds: [],
    inventory: [],
    permanentBonuses: { atk: 0, hp: 0 },
    ...overrides,
  };
}

describe('checkAchievements', () => {
  test('não desbloqueia nada quando nenhuma condição é satisfeita', () => {
    const state = makeState();
    const next = checkAchievements(state);
    expect(next).toBe(state); // referência igual — sem mudança
    expect(next.unlockedAchievements).toEqual([]);
  });

  test('desbloqueia recruit_1 e concede 20 de gold ao recrutar o primeiro herói', () => {
    const state = makeState({ heroesRecruited: 1 });
    const next = checkAchievements(state);
    expect(next.unlockedAchievements).toContain('recruit_1');
    expect(next.gold).toBe(20); // gold base 0 + recompensa 20
  });

  test('desbloqueia múltiplas conquistas em uma só chamada', () => {
    // heroesRecruited >= 1 E >= 5
    const state = makeState({ heroesRecruited: 5 });
    const next = checkAchievements(state);
    expect(next.unlockedAchievements).toContain('recruit_1');
    expect(next.unlockedAchievements).toContain('recruit_5');
    expect(next.gold).toBe(20 + 100); // recompensas de recruit_1 + recruit_5
  });

  test('é idempotente: não desbloqueia conquista já presente', () => {
    const state = makeState({
      heroesRecruited: 1,
      unlockedAchievements: ['recruit_1', 'gold_100'],
      gold: 999,
    });
    const next = checkAchievements(state);
    expect(next).toBe(state); // nenhuma novidade → mesma referência
    expect(next.gold).toBe(999); // gold não muda
  });

  test('mission_50 concede gold + permanentAtkBonus', () => {
    const state = makeState({ completedMissionCount: 50 });
    const next = checkAchievements(state);
    expect(next.unlockedAchievements).toContain('mission_50');
    expect(next.permanentBonuses?.atk).toBeGreaterThan(0);
  });

  test('boss_slayer desbloqueia ao completar mission_boss_1', () => {
    const state = makeState({ completedMissionIds: ['mission_boss_1'] });
    const next = checkAchievements(state);
    expect(next.unlockedAchievements).toContain('boss_slayer');
    expect(next.permanentBonuses?.atk).toBeGreaterThan(0);
    expect(next.permanentBonuses?.hp).toBeGreaterThan(0);
  });

  test('accumulates permanentBonuses additively across calls', () => {
    // Primeira chamada: boss_slayer (+5 atk, +10 hp)
    const state1 = makeState({ completedMissionIds: ['mission_boss_1'] });
    const after1 = checkAchievements(state1);
    // Segunda chamada (nova condição): mission_50 (+2 atk)
    const state2 = {
      ...after1,
      completedMissionCount: 50,
    };
    const after2 = checkAchievements(state2);
    expect(after2.permanentBonuses?.atk).toBe(5 + 2); // boss(5) + mission_50(2)
    expect(after2.permanentBonuses?.hp).toBe(10);
  });
});
