import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveGameState, loadGameState } from '../../services/storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('migração v10 — bloco onboarding', () => {
  beforeEach(() => jest.clearAllMocks());

  test('save sem onboarding (veterano v9) migra para step "done"', async () => {
    const legacy = { _version: 9, gold: 100, heroes: [], heroesRecruited: 0, lastSavedAt: 5000 };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(legacy));
    const loaded = await loadGameState();
    expect(loaded).not.toBeNull();
    expect((loaded as any).onboarding).toBeDefined();
    expect((loaded as any).onboarding.step).toBe('done');
    expect((loaded as any).onboarding.startedAt).toBe(5000); // usa lastSavedAt do save
  });

  test('round-trip de save v10 preserva step e hintsSeen', async () => {
    const captured: Record<string, string> = {};
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (k: string, v: string) => {
      captured[k] = v;
    });
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) => captured[k] ?? null);

    await saveGameState({
      gold: 0,
      heroes: [],
      heroesRecruited: 0,
      lastSavedAt: 0,
      onboarding: { version: 1, step: 'collect', startedAt: 111, hintsSeen: { forge: true } },
    } as any);

    const loaded = await loadGameState();
    expect((loaded as any).onboarding.step).toBe('collect');
    expect((loaded as any).onboarding.hintsSeen).toEqual({ forge: true });
  });
});
