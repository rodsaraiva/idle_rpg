import React, {
  createContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
  useState,
} from 'react';
import { GameState, GameAction, HeroTask, OfflineSummaryFull, OnboardingStep } from '../types';
import { gameReducer, initialGameState } from './gameReducer';
import { loadGameState, saveGameState, CorruptSaveError } from '../services/storage';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';
import { calculateOfflineProgress, hasReportableGains } from '../utils/offlineProgress';
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
  advanceOnboarding: (step: OnboardingStep) => void;
  skipOnboarding: () => void;
  markHintSeen: (key: string) => void;
  resetOnboarding: () => void;
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
  advanceOnboarding: () => {},
  skipOnboarding: () => {},
  markHintSeen: () => {},
  resetOnboarding: () => {},
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
          // Hidratar SEMPRE antes de qualquer coisa: o autosave começa a rodar assim que
          // isLoaded vira true e gravaria o initialGameState por cima do save real.
          // O resumo offline é só um adicional a ser aplicado quando o jogador der ciente.
          dispatch({ type: 'LOAD_STATE', state: savedState });
          const summary = calculateOfflineProgress(savedState);
          if (hasReportableGains(summary)) {
            setOfflineSummary(summary);
          } else if (summary?.newState) {
            // Ausência curta: aplica em silêncio em vez de abrir um modal zerado
            dispatch({ type: 'LOAD_STATE', state: summary.newState });
          }
        }
      } catch (error) {
        if (error instanceof CorruptSaveError) {
          // Save ilegível: inicia do estado inicial SEM sobrescrever o save/.bak (preserva diagnóstico)
          emit(FEEDBACK_EVENTS.TOAST, {
            text: 'Save corrompido — iniciando novo jogo (backup preservado)',
            type: 'error',
          });
        } else {
          console.error('GameProvider: Error during initialization', error);
        }
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

  const advanceOnboarding = useCallback((step: OnboardingStep) => {
    dispatch({ type: 'SET_ONBOARDING', patch: { step } });
  }, [dispatch]);

  const skipOnboarding = useCallback(() => {
    dispatch({ type: 'SET_ONBOARDING', patch: { step: 'skipped' } });
  }, [dispatch]);

  const markHintSeen = useCallback((key: string) => {
    dispatch({ type: 'SET_ONBOARDING', patch: { hintsSeen: { [key]: true } } });
  }, [dispatch]);

  const resetOnboarding = useCallback(() => {
    dispatch({ type: 'SET_ONBOARDING', patch: { step: 'intro', startedAt: Date.now(), hintsSeen: {} } });
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
        advanceOnboarding,
        skipOnboarding,
        markHintSeen,
        resetOnboarding,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

interface GameProviderProps {
  children: ReactNode;
}
