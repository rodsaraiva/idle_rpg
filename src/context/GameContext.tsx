import React, {
  createContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { GameState, GameAction, HeroTask } from '../types';
import { gameReducer, initialGameState } from './gameReducer';
import { saveGameState, loadGameState } from '../services/storage';
import { TICK_INTERVAL_MS, AUTO_SAVE_INTERVAL_MS } from '../constants/game';

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  setHeroTask: (heroId: string, task: HeroTask) => void;
  recruitHero: () => void;
  isLoaded: boolean;
}

export const GameContext = createContext<GameContextValue>({
  state: initialGameState,
  dispatch: () => {},
  setHeroTask: () => {},
  recruitHero: () => {},
  isLoaded: false,
});

interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const stateRef = useRef(state);

  // Mantém a ref sincronizada para o auto-save não usar estado stale
  stateRef.current = state;

  // Carrega o estado salvo ao iniciar
  useEffect(() => {
    async function loadSavedState() {
      const savedState = await loadGameState();
      if (savedState) {
        dispatch({ type: 'LOAD_STATE', state: savedState });
      }
      setIsLoaded(true);
    }
    loadSavedState();
  }, []);

  // Game loop — executa a cada TICK_INTERVAL_MS
  useEffect(() => {
    if (!isLoaded) return;

    const tickInterval = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(tickInterval);
  }, [isLoaded]);

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
      dispatch({ type: 'SET_HERO_TASK', heroId, task });
    },
    [dispatch]
  );

  const recruitHero = useCallback(() => {
    dispatch({ type: 'RECRUIT_HERO' });
  }, [dispatch]);

  return (
    <GameContext.Provider
      value={{ state, dispatch, setHeroTask, recruitHero, isLoaded }}
    >
      {children}
    </GameContext.Provider>
  );
}
