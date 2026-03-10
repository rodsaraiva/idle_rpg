import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { useMissions } from '../../hooks/useMissions';
import { GameContext } from '../../context/GameContext';
import { initialGameState } from '../../context/gameReducer';
import { HeroTask } from '../../types';

const mockState = {
  ...initialGameState,
  heroes: [
    { id: 'h1', name: 'Alpha', currentTask: HeroTask.IDLE, hpMax: 10, hpCurrent: 10, atk: 5, mp: 0 },
    { id: 'h2', name: 'Beta', currentTask: HeroTask.MISSION, hpMax: 10, hpCurrent: 10, atk: 5, mp: 0 },
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

describe('useMissions', () => {
  test('returns filtered heroes lists', () => {
    const { result } = renderHook(() => useMissions(), { wrapper });
    
    expect(result.current.missionHeroes.length).toBe(1);
    expect(result.current.missionHeroes[0].id).toBe('h2');
    expect(result.current.selectableHeroes.length).toBe(1);
    expect(result.current.selectableHeroes[0].id).toBe('h1');
  });

  test('opens and closes selection modal', () => {
    const { result } = renderHook(() => useMissions(), { wrapper });
    
    act(() => {
      result.current.openSelectionModal('m1', 1);
    });
    
    expect(result.current.selectionModalVisible).toBe(true);
    expect(result.current.pendingTemplate?.templateId).toBe('m1');
    
    act(() => {
      result.current.closeSelectionModal();
    });
    
    expect(result.current.selectionModalVisible).toBe(false);
  });

  test('handleConfirmMission dispatches START_MISSION and closes modal', () => {
    const { result } = renderHook(() => useMissions(), { wrapper });
    
    act(() => {
      result.current.openSelectionModal('m1', 1);
    });
    
    act(() => {
      result.current.handleConfirmMission('m1', ['h1']);
    });
    
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'START_MISSION',
      templateId: 'm1',
      heroIds: ['h1'],
    });
    expect(result.current.selectionModalVisible).toBe(false);
  });
});
