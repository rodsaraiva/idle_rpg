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
import { TICK_INTERVAL_MS, AUTO_SAVE_INTERVAL_MS, BASE_TRAIN_TIME_MS, TRAIN_INFLATION_FACTOR } from '../constants/game';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';
import { MISSIONS } from '../constants/missions';
import { calcMissionReward } from '../utils/missionMath';

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
  const prevStateRef = useRef<GameState | null>(null);

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
          const ticks = Math.floor(cappedMs / (savedState.tickIntervalMs ?? TICK_INTERVAL_MS));

          if (ticks > 0) {
            let offlineGold = 0;
            let heroesAffected = 0;
            const perHeroChanges: PerHeroChange[] = [];
            const newActiveMissions: any[] = [];

            const newHeroes = savedState.heroes.map((h) => {
              const beforeHp = h.hp;
              const beforeAtk = h.atk;
              const beforeMp = h.mp;
              let afterHp = beforeHp;
              let afterAtk = beforeAtk;
              let afterMp = beforeMp;
              const beforeProgress = h.trainingProgressMs ?? { hp: 0, atk: 0, mp: 0 };
              const beforeCount = h.trainingCount ?? { hp: 0, atk: 0, mp: 0 };
              let afterProgress = { ...beforeProgress };
              let afterCount = { ...beforeCount };

              switch (h.currentTask) {
                case HeroTask.TRAIN_HP: {
                  heroesAffected += 1;
                  const available = (h.trainingProgressMs?.hp ?? 0) + ticks * (savedState.tickIntervalMs ?? TICK_INTERVAL_MS);
                  const { points, leftoverMs } = require('../utils/trainingMath').computePointsFromMs(
                    BASE_TRAIN_TIME_MS,
                    savedState.trainInflationFactor ?? TRAIN_INFLATION_FACTOR,
                    available
                  );
                  afterHp += points;
                  afterProgress.hp = leftoverMs;
                  afterCount.hp = (h.trainingCount?.hp ?? 0) + points;
                  break;
                }

                case HeroTask.TRAIN_ATK: {
                  heroesAffected += 1;
                  const available = (h.trainingProgressMs?.atk ?? 0) + ticks * (savedState.tickIntervalMs ?? TICK_INTERVAL_MS);
                  const { points, leftoverMs } = require('../utils/trainingMath').computePointsFromMs(
                    BASE_TRAIN_TIME_MS,
                    savedState.trainInflationFactor ?? TRAIN_INFLATION_FACTOR,
                    available
                  );
                  afterAtk += points;
                  afterProgress.atk = leftoverMs;
                  afterCount.atk = (h.trainingCount?.atk ?? 0) + points;
                  break;
                }

                case HeroTask.TRAIN_MP: {
                  heroesAffected += 1;
                  const available = (h.trainingProgressMs?.mp ?? 0) + ticks * (savedState.tickIntervalMs ?? TICK_INTERVAL_MS);
                  const { points, leftoverMs } = require('../utils/trainingMath').computePointsFromMs(
                    BASE_TRAIN_TIME_MS,
                    savedState.trainInflationFactor ?? TRAIN_INFLATION_FACTOR,
                    available
                  );
                  afterMp += points;
                  afterProgress.mp = leftoverMs;
                  afterCount.mp = (h.trainingCount?.mp ?? 0) + points;
                  break;
                }

                case HeroTask.MISSION:
                  // mission progress will be handled per activeMission below
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
                mpBefore: beforeMp,
                mpAfter: afterMp,
              });

              return { ...h, hp: afterHp, atk: afterAtk, mp: afterMp, trainingProgressMs: afterProgress, trainingCount: afterCount };
            });

            const newState: GameState = {
              ...savedState,
              heroes: newHeroes,
              gold: (savedState.gold || 0) + offlineGold,
              activeMissions: savedState.activeMissions ?? [],
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
            // apply active missions progress: reduce remainingMs and collect rewards for completed missions
            if (savedState.activeMissions && savedState.activeMissions.length > 0) {
              let additionalGold = 0;
              const tickMs = savedState.tickIntervalMs ?? TICK_INTERVAL_MS;
              const perHeroGold = { ...(newState.perHeroGold ?? {}) };
              savedState.activeMissions.forEach((m: any) => {
                const remaining = m.remainingMs - ticks * tickMs;
                if (remaining <= 0) {
                  const template = MISSIONS.find((t) => t.id === m.templateId);
                  if (template) {
                    const heroesForMission = newHeroes.filter((h) => m.heroIds.includes(h.id));
                    const reward = calcMissionReward(template, heroesForMission, {
                      healerBuffMultiplier: m.healerBuffMultiplier,
                      rogueRngBonus: m.rogueRngBonus,
                    });
                    additionalGold += reward;
                    // distribute to heroes (floor division)
                    const n = m.heroIds.length || 1;
                    const per = Math.floor(reward / n);
                    m.heroIds.forEach((hid: string) => {
                      const idx = newHeroes.findIndex((hh) => hh.id === hid);
                      if (idx >= 0) newHeroes[idx] = { ...newHeroes[idx], currentTask: HeroTask.IDLE };
                      perHeroGold[hid] = (perHeroGold[hid] || 0) + per;
                    });
                  }
                } else {
                  // mission still in progress, update remaining and keep it
                  newActiveMissions.push({ ...m, remainingMs: remaining });
                }
              });
              newState.gold += additionalGold;
              newState.perHeroGold = perHeroGold;
              newState.activeMissions = newActiveMissions;
              summary.goldGained = Math.floor(offlineGold + additionalGold);
            }

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

  // Emit feedback events comparando prev/current state
  useEffect(() => {
    const prev = prevStateRef.current;
    if (prev) {
      // gold delta
      if ((state.gold || 0) > (prev.gold || 0)) {
        const delta = Math.floor((state.gold || 0) - (prev.gold || 0));
        if (delta > 0) {
          emit(FEEDBACK_EVENTS.FLOAT, { text: `+${delta}💰`, color: '#ffd34d' });
        }
      }

      // new heroes recruited
      if ((state.heroes?.length || 0) > (prev.heroes?.length || 0)) {
        const newCount = (state.heroes?.length || 0) - (prev.heroes?.length || 0);
        emit(FEEDBACK_EVENTS.TOAST, { text: `Recrutado +${newCount} herói(s)` });
      }

      // per-hero stat increases (aggregate small floats)
      state.heroes.forEach((h) => {
        const prevHero = prev.heroes.find((ph) => ph.id === h.id);
        if (!prevHero) return;
        if (h.hp > prevHero.hp) {
          emit(FEEDBACK_EVENTS.FLOAT, { text: `+${h.hp - prevHero.hp} HP`, color: '#7ed957' });
        }
        if (h.atk > prevHero.atk) {
          emit(FEEDBACK_EVENTS.FLOAT, { text: `+${h.atk - prevHero.atk} ATK`, color: '#ff8a65' });
        }
        if (h.mp > prevHero.mp) {
          emit(FEEDBACK_EVENTS.FLOAT, { text: `+${h.mp - prevHero.mp} MP`, color: '#66b2ff' });
        }
      });
    }
    prevStateRef.current = state;
  }, [state]);

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
