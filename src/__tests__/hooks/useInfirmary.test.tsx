import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { useInfirmary } from '../../hooks/useInfirmary';
import { GameContext } from '../../context/GameContext';
import { initialGameState } from '../../context/gameReducer';
import { HeroTask } from '../../types';

const mockState = {
  ...initialGameState,
  heroes: [
    { id: 'h1', name: 'Alpha', currentTask: HeroTask.IDLE, hpMax: 10, hpCurrent: 5, atk: 5, mp: 0, defense: 5, crit: 5, agility: 10 }, // injured, idle
    { id: 'h2', name: 'Beta', currentTask: HeroTask.IDLE, hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, defense: 5, crit: 5, agility: 10 }, // full hp, idle
    { id: 'h3', name: 'Gamma', currentTask: HeroTask.INFIRMARY, hpMax: 10, hpCurrent: 2, atk: 5, mp: 0, defense: 5, crit: 5, agility: 10 }, // in infirmary
  ],
};

const mockDispatch = jest.fn();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <GameContext.Provider value={{
    state: mockState as any,
    dispatch: mockDispatch as any,
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

describe('useInfirmary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('filters injured and infirmary heroes correctly', () => {
    const { result } = renderHook(() => useInfirmary(), { wrapper });
    
    expect(result.current.injuredIdle.length).toBe(1);
    expect(result.current.injuredIdle[0].id).toBe('h1');
    
    expect(result.current.inInfirmary.length).toBe(1);
    expect(result.current.inInfirmary[0].id).toBe('h3');
  });

  test('toggles hero selection', () => {
    const { result } = renderHook(() => useInfirmary(), { wrapper });
    
    expect(result.current.selectedIds).toEqual([]);
    
    act(() => {
      result.current.toggleSelection('h1');
    });
    expect(result.current.selectedIds).toEqual(['h1']);
    
    act(() => {
      result.current.toggleSelection('h2');
    });
    expect(result.current.selectedIds).toEqual(['h1', 'h2']);
    
    act(() => {
      result.current.toggleSelection('h1');
    });
    expect(result.current.selectedIds).toEqual(['h2']);
  });

  test('sendToInfirmary dispatches action and clears selection', () => {
    const { result } = renderHook(() => useInfirmary(), { wrapper });
    
    act(() => {
      result.current.toggleSelection('h1');
    });
    
    act(() => {
      result.current.sendToInfirmary();
    });
    
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'START_INFERMARIA',
      heroIds: ['h1'],
    });
    expect(result.current.selectedIds).toEqual([]);
  });

  test('sendToInfirmary does nothing if selection is empty', () => {
    const { result } = renderHook(() => useInfirmary(), { wrapper });
    
    act(() => {
      result.current.sendToInfirmary();
    });
    
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  test('releaseFromInfirmary dispatches action', () => {
    const { result } = renderHook(() => useInfirmary(), { wrapper });
    
    act(() => {
      result.current.releaseFromInfirmary('h3');
    });
    
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'RELEASE_FROM_INFERMARIA',
      heroIds: ['h3'],
    });
  });
});
