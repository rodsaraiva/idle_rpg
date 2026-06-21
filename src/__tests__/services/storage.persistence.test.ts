import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService, CorruptSaveError, validateShape } from '../../services/storage';
import { GameState, HeroTask, Hero } from '../../types';

const STORAGE_KEY = '@idle_rpg_game_state';
const BACKUP_KEY = '@idle_rpg_game_state.bak';

function makeHero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 'h1', name: 'T', hpMax: 50, hpCurrent: 50, atk: 10, mp: 5,
    defense: 5, crit: 10, agility: 5, currentTask: HeroTask.IDLE,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { gold: 10, heroes: [makeHero()], heroesRecruited: 1, lastSavedAt: Date.now(), ...overrides };
}

describe('StorageService — persistência robusta', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('sem save: load() retorna null', async () => {
    const result = await StorageService.load();
    expect(result).toBeNull();
  });

  test('corrompido: JSON truncado → load() lança CorruptSaveError (não retorna null)', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{trunc');
    await expect(StorageService.load()).rejects.toBeInstanceOf(CorruptSaveError);
  });

  test('backup recupera: principal corrompido + .bak válido v8 → load() retorna estado do backup', async () => {
    const valid = { ...makeState({ gold: 999 }), _version: 8, lastSavedAt: Date.now() };
    await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify(valid));
    await AsyncStorage.setItem(STORAGE_KEY, '{trunc');
    const loaded = await StorageService.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.gold).toBe(999);
  });

  test('backup escrito no save: dois save() consecutivos → .bak contém o penúltimo JSON', async () => {
    await StorageService.save(makeState({ gold: 1 }));
    await StorageService.save(makeState({ gold: 2 }));
    const bak = await AsyncStorage.getItem(BACKUP_KEY);
    expect(bak).not.toBeNull();
    expect(JSON.parse(bak!).gold).toBe(1);
  });

  test('migração v9: save v8 com remainingMs → após load(), missão sem remainingMs e com startedAt', async () => {
    const started = 123456;
    const v8 = {
      ...makeState(),
      _version: 8,
      activeMissions: [{ id: 'm1', templateId: 'mission_1', heroIds: ['h1'], remainingMs: 5000, startedAt: started }],
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(v8));
    const loaded = await StorageService.load();
    const mission: any = loaded!.activeMissions![0];
    expect(mission.remainingMs).toBeUndefined();
    expect(mission.startedAt).toBe(started);
  });

  test('migração v9: missão sem startedAt ganha startedAt numérico', async () => {
    const v8 = {
      ...makeState(),
      _version: 8,
      activeMissions: [{ id: 'm1', templateId: 'mission_1', heroIds: ['h1'], remainingMs: 1000 }],
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(v8));
    const loaded = await StorageService.load();
    const mission: any = loaded!.activeMissions![0];
    expect(typeof mission.startedAt).toBe('number');
    expect(mission.remainingMs).toBeUndefined();
  });

  test('validateShape rejeita: heroes não-array → corrupção (load lança)', async () => {
    const bad = { gold: 10, heroes: 'nope', heroesRecruited: 0, lastSavedAt: Date.now(), _version: 9 };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bad));
    await expect(StorageService.load()).rejects.toBeInstanceOf(CorruptSaveError);
  });

  test('validateShape aceita estado válido e o retorna', () => {
    const s = makeState();
    expect(validateShape(s)).toBe(s);
  });
});
