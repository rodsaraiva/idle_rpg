import { useEffect } from 'react';
import { TICK_INTERVAL_MS, AUTO_SAVE_INTERVAL_MS } from '../constants/game';
import { saveGameState } from '../services/storage';

interface UseGameLoopProps {
  isLoaded: boolean;
  tickIntervalMs?: number;
  onTick: () => void;
  stateRef: React.MutableRefObject<any>;
  /**
   * Suspende só o TICK (não o autosave). Usado enquanto há um resumo offline pendente:
   * o modal cobre a tela inteira e bloqueia toques, então nada fica visivelmente parado —
   * e evita tickar por cima do save cru enquanto o jogador não dá ciente (ver I1, task 10).
   */
  paused?: boolean;
}

export function useGameLoop({
  isLoaded,
  tickIntervalMs,
  onTick,
  stateRef,
  paused = false,
}: UseGameLoopProps) {

  // Game loop tick
  useEffect(() => {
    if (!isLoaded || paused) return;

    const tickMs = tickIntervalMs ?? TICK_INTERVAL_MS;

    const tickInterval = setInterval(() => {
      onTick();
    }, tickMs);

    return () => clearInterval(tickInterval);
  }, [isLoaded, tickIntervalMs, onTick, paused]);

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
