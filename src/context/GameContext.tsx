import React, {
  createContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { GameState, GameAction, HeroTask, OfflineSummaryFull, PerHeroChange } from '../types';
import { gameReducer, initialGameState } from './gameReducer';
import { saveGameState, loadGameState } from '../services/storage';
import {
  TICK_INTERVAL_MS,
  AUTO_SAVE_INTERVAL_MS,
  HP_TRAIN_PER_TICK,
  ATK_TRAIN_PER_TICK,
} from '../constants/game';
import { getMissionGoldPerTick } from '../utils/math';

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  setHeroTask: (heroId: string, task: HeroTask) => void;
  recruitHero: () => void;
  isLoaded: boolean;
  offlineSummary: OfflineSummary | null;
  clearOfflineSummary: () => void;
  applyOfflineSummary: () => Promise<void>;
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

  // Carrega o estado salvo ao iniciar e aplica progresso offline (com cap)
  useEffect(() => {
    async function loadSavedState() {
      const savedState = await loadGameState();
      if (savedState) {
        try {
          const savedAt = savedState.lastSavedAt || Date.now();
          const elapsedMs = Date.now() - savedAt;

          // Limita o progresso offline a 72 horas (configurável)
          const MAX_OFFLINE_MS = 1000 * 60 * 60 * 24 * 3; // 72h
          const cappedMs = Math.min(elapsedMs, MAX_OFFLINE_MS);
          const ticks = Math.floor(cappedMs / TICK_INTERVAL_MS);

          if (ticks > 0) {
            let offlineGold = 0;
            let heroesAffected = 0;
            const perHeroChanges: PerHeroChange[] = [];

            const newHeroes = savedState.heroes.map((h) => {
              const beforeHp = h.hp;
              const beforeAtk = h.atk;
              let afterHp = beforeHp;
              let afterAtk = beforeAtk;

              switch (h.currentTask) {
                case HeroTask.TRAIN_HP:
                  afterHp = beforeHp + HP_TRAIN_PER_TICK * ticks;
                  heroesAffected += 1;
                  break;

                case HeroTask.TRAIN_ATK:
                  afterAtk = beforeAtk + ATK_TRAIN_PER_TICK * ticks;
                  heroesAffected += 1;
                  break;

                case HeroTask.MISSION:
                  offlineGold += ticks * getMissionGoldPerTick(h.atk);
                  heroesAffected += 1;
                  break;

                default:
                  break;
              }

              perHeroChanges.push({
                id: h.id,
                name: h.name,
                hpBefore: beforeHp,
                hpAfter: afterHp,
                atkBefore: beforeAtk,
                atkAfter: afterAtk,
              });

              return { ...h, hp: afterHp, atk: afterAtk };
            });

            const newState: GameState = {
              ...savedState,
              heroes: newHeroes,
              gold: (savedState.gold || 0) + offlineGold,
            };

            const cappedHours =
              elapsedMs > MAX_OFFLINE_MS ? Math.floor(MAX_OFFLINE_MS / (1000 * 60 * 60)) : 0;

            const summary: OfflineSummaryFull = {
              ticks,
              goldGained: Math.floor(offlineGold),
              heroesAffected,
              cappedHours,
              perHeroChanges,
              previousState: savedState,
              newState,
            };

            // salva resumo temporariamente para exibir no modal (aguarda confirmação do usuário)
            setOfflineSummary(summary);
            console.log(
              `Offline progress calculated: ${ticks} ticks (capped), gold +${offlineGold}`
            );
          } else {
            // nenhum progresso offline - carrega normalmente
            dispatch({ type: 'LOAD_STATE', state: savedState });
          }
        } catch (err) {
          console.error('Erro ao aplicar progresso offline:', err);
          dispatch({ type: 'LOAD_STATE', state: savedState });
        }
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
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
