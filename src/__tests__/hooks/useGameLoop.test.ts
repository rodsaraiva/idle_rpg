import { renderHook } from '@testing-library/react-native';
import { useGameLoop } from '../../hooks/useGameLoop';
import { saveGameState } from '../../services/storage';

jest.mock('../../services/storage', () => ({
  saveGameState: jest.fn(),
  loadGameState: jest.fn(),
}));

describe('useGameLoop', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('does not start timers if not loaded', () => {
    const onTick = jest.fn();
    const stateRef = { current: { gold: 10 } };
    
    renderHook(() => useGameLoop({
      isLoaded: false,
      onTick,
      stateRef,
    }));
    
    jest.advanceTimersByTime(5000);
    expect(onTick).not.toHaveBeenCalled();
    expect(saveGameState).not.toHaveBeenCalled();
  });

  test('calls onTick on interval when loaded', () => {
    const onTick = jest.fn();
    const stateRef = { current: { gold: 10 } };
    
    renderHook(() => useGameLoop({
      isLoaded: true,
      tickIntervalMs: 1000,
      onTick,
      stateRef,
    }));
    
    expect(onTick).not.toHaveBeenCalled();
    
    jest.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledTimes(1);
    
    jest.advanceTimersByTime(2000);
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  test('calls saveGameState on auto-save interval', () => {
    const onTick = jest.fn();
    const stateRef = { current: { gold: 10 } };
    
    renderHook(() => useGameLoop({
      isLoaded: true,
      onTick,
      stateRef,
    }));
    
    // Default AUTO_SAVE_INTERVAL_MS is 5000
    jest.advanceTimersByTime(4900);
    expect(saveGameState).not.toHaveBeenCalled();
    
    jest.advanceTimersByTime(100);
    expect(saveGameState).toHaveBeenCalledTimes(1);
    expect(saveGameState).toHaveBeenCalledWith(stateRef.current);
  });
});
