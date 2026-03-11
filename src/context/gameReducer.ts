import { GameState, GameAction } from '../types';
import { handleTick } from './tickHandler';
import { 
  handleStartMission, 
  handleCompleteMission, 
  handleDismissMissionResult 
} from './missionHandler';
import { 
  handleRecruitHero, 
  handleStartInfirmary, 
  handleReleaseFromInfirmary,
  handleSetHeroTask,
  handleBuyChest,
  handleConfirmChestReveal
} from './heroHandler';
import { 
  handleSetTickInterval, 
  handleSetTrainInflation 
} from './systemHandler';

/** Estado inicial quando não há save */
export const initialGameState: GameState = {
  gold: 20,
  heroes: [],
  heroesRecruited: 0,
  lastSavedAt: Date.now(),
  tickIntervalMs: 1000,
  trainInflationFactor: 0.1,
  activeMissions: [],
};

/** Reducer puro que contém toda a lógica do jogo */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'TICK':
      return handleTick(state);

    case 'START_MISSION':
      return handleStartMission(state, action.templateId, action.heroIds, action.heroPositions);

    case 'DISMISS_MISSION_RESULT':
      return handleDismissMissionResult(state, action.missionId);

    case 'COMPLETE_MISSION':
      return handleCompleteMission(state, action.missionId, action.reward);

    case 'SET_HERO_TASK':
      return handleSetHeroTask(state, action.heroId, action.task);

    case 'RECRUIT_HERO':
      return handleRecruitHero(state);

    case 'BUY_CHEST':
      return handleBuyChest(state);

    case 'CONFIRM_CHEST_REVEAL':
      return handleConfirmChestReveal(state, action.hero);

    case 'SET_TICK_INTERVAL':
      return handleSetTickInterval(state, action.ms);

    case 'SET_TRAIN_INFLATION':
      return handleSetTrainInflation(state, action.inflation);

    case 'START_INFERMARIA':
      return handleStartInfirmary(state, action.heroIds);

    case 'RELEASE_FROM_INFERMARIA':
      return handleReleaseFromInfirmary(state, action.heroIds);

    case 'LOAD_STATE':
      return { ...action.state };

    default:
      return state;
  }
}
