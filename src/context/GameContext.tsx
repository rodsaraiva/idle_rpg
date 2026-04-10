import React, {
  createContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
  useState,
} from 'react';
import { GameState, GameAction, HeroTask, OfflineSummaryFull } from '../types';
import { gameReducer, initialGameState } from './gameReducer';
import { loadGameState, saveGameState } from '../services/storage';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';
import { calculateOfflineProgress } from '../utils/offlineProgress';
import { useGameFeedback } from '../hooks/useGameFeedback';
import { useGameLoop } from '../hooks/useGameLoop';
import { isHeroInMission } from '../utils/heroUtils';

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

export function GameProvider({ children }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [offlineSummary, setOfflineSummary] = useState<OfflineSummaryFull | null>(null);
  const stateRef = useRef(state);

  // Keep ref in sync for hooks that need the latest state without re-running effects
  useEffect(() => {
  stateRef.current = state;
  }, [state]);

  // Handle automatic feedback events
  useGameFeedback(state);

  // Manage Game Tick and Auto-save
  const handleTick = useCallback(() => {
    dispatch({ type: 'TICK', now: Date.now() });
  }, [dispatch]);

  useGameLoop({
    isLoaded,
    tickIntervalMs: state.tickIntervalMs,
    onTick: handleTick,
    stateRef,
  });

  // Initialization: Load state and check offline progress
  useEffect(() => {
    async function initialize() {
      try {
      const savedState = await loadGameState();
      if (savedState) {
          const summary = calculateOfflineProgress(savedState);
          if (summary) {
            setOfflineSummary(summary);
          } else {
            dispatch({ type: 'LOAD_STATE', state: savedState });
          }
        }
      } catch (error) {
        console.error('GameProvider: Error during initialization', error);
      } finally {
        setIsLoaded(true);
      }
    }
    initialize();
  }, []);

  const setHeroTask = useCallback(
    (heroId: string, task: HeroTask) => {
      const hero = stateRef.current.heroes.find((h) => h.id === heroId);
      if (!hero) return;
      
      if (isHeroInMission(hero)) {
        emit(FEEDBACK_EVENTS.TOAST, { 
          text: 'Herói em missão — não pode ser interrompido' 
        });
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
  }, [dispatch]);

  const setTrainInflationFactor = useCallback((inflation: number) => {
    dispatch({ type: 'SET_TRAIN_INFLATION', inflation });
  }, [dispatch]);

  const clearOfflineSummary = useCallback(() => {
    setOfflineSummary(null);
  }, []);

  const applyOfflineSummary = useCallback(async () => {
    if (!offlineSummary?.newState) return;
    
    try {
      dispatch({ type: 'LOAD_STATE', state: offlineSummary.newState });
      await saveGameState(offlineSummary.newState);
    } catch (err) {
      console.error('GameProvider: Error applying offline summary', err);
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

interface GameProviderProps {
  children: ReactNode;
}
