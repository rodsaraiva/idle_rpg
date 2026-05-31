import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { useShop } from '../../hooks/useShop';
import { GameContext } from '../../context/GameContext';
import { initialGameState } from '../../context/gameReducer';

// jest.mock deve ficar no nível do módulo (hoisted automaticamente pelo Jest)
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const mockDispatch = jest.fn();

function makeWrapper(gold: number, heroesRecruited: number) {
  const state = { ...initialGameState, gold, heroesRecruited };
  return ({ children }: { children: React.ReactNode }) => (
    <GameContext.Provider value={{
      state: state as any,
      dispatch: mockDispatch,
      isLoaded: true,
      setHeroTask: jest.fn(),
      recruitHero: jest.fn(),
      offlineSummary: null,
      clearOfflineSummary: jest.fn(),
      applyOfflineSummary: jest.fn(),
    }}>
      {children}
    </GameContext.Provider>
  );
}

beforeEach(() => {
  mockDispatch.mockClear();
});

describe('useShop', () => {
  test('chestCosts aumenta com heroesRecruited (custo base cresce)', () => {
    const { result: r0 } = renderHook(() => useShop(), { wrapper: makeWrapper(0, 0) });
    const { result: r5 } = renderHook(() => useShop(), { wrapper: makeWrapper(0, 5) });
    // baseCost cresce com heroesRecruited; todos os chests devem ser mais caros
    const ids = Object.keys(r5.current.chestCosts);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(r5.current.chestCosts[id]).toBeGreaterThan(r0.current.chestCosts[id]);
    }
  });

  test('handleBuyChest não dispara BUY_CHEST quando gold insuficiente', () => {
    const { result } = renderHook(() => useShop(), { wrapper: makeWrapper(0, 0) });
    act(() => {
      const firstChestId = Object.keys(result.current.chestCosts)[0];
      result.current.handleBuyChest(firstChestId, 'Básico');
    });
    // Com gold=0 e custo>0, deve retornar sem dispatch
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(result.current.revealVisible).toBe(false);
  });

  test('handleBuyChest dispara BUY_CHEST quando gold suficiente', () => {
    const { result } = renderHook(() => useShop(), { wrapper: makeWrapper(99999, 0) });
    act(() => {
      const firstChestId = Object.keys(result.current.chestCosts)[0];
      result.current.handleBuyChest(firstChestId, 'Básico');
    });
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'BUY_CHEST' }));
    expect(result.current.revealVisible).toBe(true);
  });

  test('handleRevealCancel fecha o modal e limpa estado', () => {
    const { result } = renderHook(() => useShop(), { wrapper: makeWrapper(99999, 0) });
    act(() => {
      const firstChestId = Object.keys(result.current.chestCosts)[0];
      result.current.handleBuyChest(firstChestId, 'Básico');
    });
    expect(result.current.revealVisible).toBe(true);
    act(() => {
      result.current.handleRevealCancel();
    });
    expect(result.current.revealVisible).toBe(false);
    expect(result.current.activeChestLabel).toBe('');
  });

  test('handleRevealComplete dispara CONFIRM_CHEST_REVEAL e fecha modal', () => {
    const { result } = renderHook(() => useShop(), { wrapper: makeWrapper(99999, 0) });
    act(() => {
      const firstChestId = Object.keys(result.current.chestCosts)[0];
      result.current.handleBuyChest(firstChestId, 'Básico');
    });
    const fakeHero = { id: 'h99', name: 'Test' } as any;
    act(() => {
      result.current.handleRevealComplete(fakeHero);
    });
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CONFIRM_CHEST_REVEAL', hero: fakeHero })
    );
    expect(result.current.revealVisible).toBe(false);
  });
});
