import React from 'react';
import { View } from 'react-native';
import { useGame } from './useGame';
import { Hero } from '../types';
import { getHeroActions as getHeroActionsUtil } from '../utils/heroActions';

export function useTraining() {
  const { 
    state, 
    setHeroTask, 
    isLoaded, 
    offlineSummary, 
    clearOfflineSummary, 
    applyOfflineSummary 
  } = useGame();

  const getHeroActions = (hero: Hero, atkRef?: React.RefObject<View | null>) =>
    getHeroActionsUtil(hero, setHeroTask, atkRef);

  return {
    state,
    isLoaded,
    offlineSummary,
    getHeroActions,
    applyOfflineSummary,
    clearOfflineSummary,
  };
}
