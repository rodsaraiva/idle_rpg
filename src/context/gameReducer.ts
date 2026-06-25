import { GameState, GameAction } from '../types';
import { validateShape } from '../services/storage';
import { handleTick } from './tickHandler';
import {
  handleStartMission,
  handleCompleteMission,
  handleDismissMissionResult,
  handleStartWeeklyBoss,
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
import {
  handleForgeEquipment,
  handleCollectEquipment,
  handleEquipItem,
  handleUnequipItem
} from './equipmentHandler';
import { claimDailyQuest } from './dailyQuestHandler';
import { handleFuseHeroes } from './pantheonHandler';
import { claimWeeklyQuest } from './weeklyHandler';
import { TICK_INTERVAL_MS, TRAIN_INFLATION_FACTOR } from '../constants/game';
import { createHero } from '../utils/heroFactory';
import { handleSetOnboarding } from './onboardingHandler';

/** Estado inicial quando não há save (boot do FTUE). */
export const initialGameState: GameState = {
  gold: 25, // cobre 1 recruta extra (15) só depois de a missão render ouro — não trivializa
  heroes: [createHero('WARRIOR')], // herói semeado determinístico: remove a vila de prédios inúteis
  heroesRecruited: 1, // o herói grátis conta como o 1º → próximo custa floor(10*1.5)=15 (preço cheio)
  unlockedAchievements: ['recruit_1'], // pré-creditado: o herói semeado JÁ satisfaz "recrute o 1º" — sem o +20 grátis no boot (sem gold passivo)
  lastSavedAt: Date.now(),
  tickIntervalMs: TICK_INTERVAL_MS,
  trainInflationFactor: TRAIN_INFLATION_FACTOR,
  activeMissions: [],
  onboarding: {
    version: 1,
    step: 'intro',
    startedAt: Date.now(),
    hintsSeen: {},
  },
};

/** Reducer puro que contém toda a lógica do jogo */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'TICK':
      return handleTick(state, action.now);

    case 'START_MISSION':
      return handleStartMission(state, action.templateId, action.heroIds, action.heroPositions, action.now, action.looping);

    case 'DISMISS_MISSION_RESULT':
      return handleDismissMissionResult(state, action.missionId);

    case 'COMPLETE_MISSION':
      return handleCompleteMission(state, action.missionId, action.reward);

    case 'SET_HERO_TASK':
      return handleSetHeroTask(state, action.heroId, action.task);

    case 'RECRUIT_HERO':
      return handleRecruitHero(state);

    case 'BUY_CHEST':
      return handleBuyChest(state, action.chestId);

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

    case 'FORGE_EQUIPMENT':
      return handleForgeEquipment(state, action.tier, action.equipmentType, action.now);

    case 'COLLECT_EQUIPMENT':
      return handleCollectEquipment(state, action.equipmentId);

    case 'EQUIP_ITEM':
      return handleEquipItem(state, action.heroId, action.equipmentId);

    case 'UNEQUIP_ITEM':
      return handleUnequipItem(state, action.heroId, action.equipmentId);

    case 'CLAIM_DAILY_QUEST':
      return claimDailyQuest(state, action.questId);

    case 'FUSE_HEROES':
      return handleFuseHeroes(state, action.heroIds);

    case 'CLAIM_WEEKLY_QUEST':
      return claimWeeklyQuest(state, action.questId);

    case 'START_WEEKLY_BOSS':
      return handleStartWeeklyBoss(state, action.heroIds, action.heroPositions, action.now);

    case 'SET_ONBOARDING':
      return handleSetOnboarding(state, action.patch);

    case 'LOAD_STATE':
      try {
        return validateShape({ ...action.state });
      } catch {
        return state; // estado inválido não derruba o reducer
      }

    default:
      return state;
  }
}
