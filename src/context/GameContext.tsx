import React, {
  createContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { GameState, GameAction, HeroTask, OfflineSummaryFull } from '../types';
import { gameReducer, initialGameState } from './gameReducer';
import { saveGameState, loadGameState } from '../services/storage';
import { TICK_INTERVAL_MS, AUTO_SAVE_INTERVAL_MS } from '../constants/game';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';
import { calculateOfflineProgress } from '../utils/offlineProgress';
import { useGameFeedback } from '../hooks/useGameFeedback';

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  setHeroTask: (heroId: string, task: HeroTask) => void;
  recruitHero: () => void;
  isLoaded: boolean;
  offlineSummary: OfflineSummaryFull | null;
  clearOfflineSummary: () => void;
  applyOfflineSummary: () => Promise<void>;
  setTickInterval?: (ms: number) => void;
  setTrainInflationFactor?: (inflation: number) => void;
}

export const GameContext = createContext<GameContextValue>({
  state: initialGameState,
  dispatch: () => {},
  setHeroTask: () => {},
  recruitHero: () => {},
  isLoaded: false,
  offlineSummary: null,
  clearOfflineSummary: () => {},
  applyOfflineSummary: async () => {},
  setTickInterval: () => {},
  setTrainInflationFactor: () => {},
});

interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [offlineSummary, setOfflineSummary] = React.useState<OfflineSummaryFull | null>(null);
  const stateRef = useRef(state);

  // Mantém a ref sincronizada para o auto-save não usar estado stale
  stateRef.current = state;

  // Gerencia feedbacks automáticos baseados no estado
  useGameFeedback(state);

  // Carrega o estado salvo ao iniciar e aplica progresso offline
  useEffect(() => {
    async function loadSavedState() {
      const savedState = await loadGameState();
      if (savedState) {
        const summary = calculateOfflineProgress(savedState);
        if (summary) {
          setOfflineSummary(summary);
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.log(
              `Offline progress calculated: ${summary.ticks} ticks, gold +${summary.goldGained}`
            );
          }
        } else {
          dispatch({ type: 'LOAD_STATE', state: savedState });
        }
      }
      setIsLoaded(true);
    }
    loadSavedState();
  }, []);

  // Game loop — executa a cada tickIntervalMs configurável
  useEffect(() => {
    if (!isLoaded) return;
    const tickMs = state.tickIntervalMs ?? TICK_INTERVAL_MS;

    const tickInterval = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, tickMs);

    return () => clearInterval(tickInterval);
  }, [isLoaded, state.tickIntervalMs]);

  // Auto-save periódico
  useEffect(() => {
    if (!isLoaded) return;

    const saveInterval = setInterval(() => {
      saveGameState(stateRef.current);
    }, AUTO_SAVE_INTERVAL_MS);

    return () => clearInterval(saveInterval);
  }, [isLoaded]);

  const setHeroTask = useCallback(
    (heroId: string, task: HeroTask) => {
      const h = stateRef.current.heroes.find((x) => x.id === heroId);
      if (!h) return;
      if (h.currentTask === HeroTask.MISSION) {
        emit(FEEDBACK_EVENTS.TOAST, { text: 'Herói em missão — não pode ser interrompido' });
        return;
      }
      dispatch({ type: 'SET_HERO_TASK', heroId, task });
    },
    [dispatch]
  );

  const recruitHero = useCallback(() => {
    dispatch({ type: 'RECRUIT_HERO' });
  }, [dispatch]);

  const setTickInterval = useCallback((ms: number) => {
    dispatch({ type: 'SET_TICK_INTERVAL', ms });
  }, []);

  const setTrainInflationFactor = useCallback((inflation: number) => {
    dispatch({ type: 'SET_TRAIN_INFLATION', inflation });
  }, []);

  const clearOfflineSummary = useCallback(() => {
    setOfflineSummary(null);
  }, []);

  const applyOfflineSummary = useCallback(async () => {
    if (!offlineSummary || !offlineSummary.newState) return;
    try {
      dispatch({ type: 'LOAD_STATE', state: offlineSummary.newState });
      await saveGameState(offlineSummary.newState);
    } catch (err) {
      console.error('Erro ao aplicar offlineSummary:', err);
    } finally {
      setOfflineSummary(null);
    }
  }, [offlineSummary, dispatch]);

  return (
    <GameContext.Provider
      value={{
        state,
        dispatch,
        setHeroTask,
        recruitHero,
        isLoaded,
        offlineSummary,
        clearOfflineSummary,
        applyOfflineSummary,
        setTickInterval,
        setTrainInflationFactor,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
