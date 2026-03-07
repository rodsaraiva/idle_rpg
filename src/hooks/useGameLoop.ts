import { useEffect } from 'react';
import { TICK_INTERVAL_MS, AUTO_SAVE_INTERVAL_MS } from '../constants/game';
import { saveGameState } from '../services/storage';

interface UseGameLoopProps {
  isLoaded: boolean;
  tickIntervalMs?: number;
  onTick: () => void;
  stateRef: React.MutableRefObject<any>;
}

export function useGameLoop({ 
  isLoaded, 
  tickIntervalMs, 
  onTick, 
  stateRef 
}: UseGameLoopProps) {
  
  // Game loop tick
  useEffect(() => {
    if (!isLoaded) return;
    
    const tickMs = tickIntervalMs ?? TICK_INTERVAL_MS;

    const tickInterval = setInterval(() => {
      onTick();
    }, tickMs);

    return () => clearInterval(tickInterval);
  }, [isLoaded, tickIntervalMs, onTick]);

  // Auto-save
  useEffect(() => {
    if (!isLoaded) return;

    const saveInterval = setInterval(() => {
      if (stateRef.current) {
        saveGameState(stateRef.current);
      }
    }, AUTO_SAVE_INTERVAL_MS);

    return () => clearInterval(saveInterval);
  }, [isLoaded, stateRef]);
}
