import { GameState } from '../types';

export function handleSetTickInterval(state: GameState, ms: number): GameState {
  return {
    ...state,
    tickIntervalMs: ms,
  };
}

export function handleSetTrainInflation(state: GameState, inflation: number): GameState {
  return {
    ...state,
    trainInflationFactor: inflation,
  };
}
