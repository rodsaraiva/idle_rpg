import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveGameState, loadGameState, clearGameState } from '../../services/storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('storage service', () => {
  const fakeState = { gold: 10, heroes: [], heroesRecruited: 0, lastSavedAt: Date.now() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('saveGameState calls AsyncStorage.setItem with a JSON payload', async () => {
    await saveGameState(fakeState as any);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    const [key, value] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
    expect(typeof key).toBe('string');
    expect(typeof value).toBe('string');
    const parsed = JSON.parse(value);
    expect(parsed.gold).toBe(10);
  });

  test('loadGameState parses JSON from AsyncStorage.getItem', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(fakeState));
    const loaded = await loadGameState();
    expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
    expect(loaded).not.toBeNull();
    expect((loaded as any).gold).toBe(10);
  });

  test('loadGameState migrates missing training fields', async () => {
    const legacy = { gold: 5, heroes: [{ id: 'h1', name: 'Old', hpMax: 10, hpCurrent: 5 }] };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(legacy));
    const loaded = await loadGameState();
    expect(loaded).not.toBeNull();
    const h = (loaded as any).heroes[0];
    expect(h.trainingProgressMs).toBeDefined();
    expect(h.trainingCount).toBeDefined();
  });

  test('clearGameState calls removeItem', async () => {
    await clearGameState();
    expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
  });
});

