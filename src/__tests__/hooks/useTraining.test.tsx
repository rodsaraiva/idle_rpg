import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { useTraining } from '../../hooks/useTraining';
import { GameContext } from '../../context/GameContext';
import { initialGameState } from '../../context/gameReducer';
import { HeroTask } from '../../types';

const mockHero = { id: 'h1', name: 'Alpha', currentTask: HeroTask.IDLE, hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, defense: 5, crit: 5, agility: 10 };
const mockState = {
  ...initialGameState,
  heroes: [mockHero],
};

const mockSetHeroTask = jest.fn();
const mockApplyOfflineSummary = jest.fn();
const mockClearOfflineSummary = jest.fn();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <GameContext.Provider value={{
    state: mockState as any,
    dispatch: jest.fn(),
    isLoaded: true,
    setHeroTask: mockSetHeroTask,
    recruitHero: jest.fn(),
    offlineSummary: { ticks: 10, goldGained: 100 } as any,
    clearOfflineSummary: mockClearOfflineSummary,
    applyOfflineSummary: mockApplyOfflineSummary,
  }}>
    {children}
  </GameContext.Provider>
);

describe('useTraining', () => {
  test('returns state and offline progress info', () => {
    const { result } = renderHook(() => useTraining(), { wrapper });
    
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.offlineSummary).not.toBeNull();
  });

  test('setAllHeroesTask calls setHeroTask for each hero', () => {
    const { result } = renderHook(() => useTraining(), { wrapper });
    
    act(() => {
      result.current.setAllHeroesTask(HeroTask.TRAIN_HP);
    });
    
    expect(mockSetHeroTask).toHaveBeenCalledWith('h1', HeroTask.TRAIN_HP);
  });

  test('getHeroActions returns correct action objects', () => {
    const { result } = renderHook(() => useTraining(), { wrapper });
    const actions = result.current.getHeroActions(mockHero);
    
    expect(actions.length).toBe(4);
    expect(actions[0].label).toBe('Treinar HP');
    expect(actions[0].isActive).toBe(false); // mockHero is IDLE
    
    act(() => {
      actions[0].onPress();
    });
    expect(mockSetHeroTask).toHaveBeenCalledWith('h1', HeroTask.TRAIN_HP);
  });

  test('apply and clear offline summary proxies', () => {
    const { result } = renderHook(() => useTraining(), { wrapper });
    
    act(() => {
      result.current.applyOfflineSummary();
    });
    expect(mockApplyOfflineSummary).toHaveBeenCalled();

    act(() => {
      result.current.clearOfflineSummary();
    });
    expect(mockClearOfflineSummary).toHaveBeenCalled();
  });
});
