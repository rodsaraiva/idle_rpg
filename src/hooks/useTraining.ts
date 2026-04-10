import { useGame } from './useGame';
import { Hero, HeroTask } from '../types';
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

  const setAllHeroesTask = (task: HeroTask) => {
    state.heroes.forEach(h => setHeroTask(h.id, task));
  };

  const getHeroActions = (hero: Hero) => getHeroActionsUtil(hero, setHeroTask);

  return {
    state,
    isLoaded,
    offlineSummary,
    setAllHeroesTask,
    getHeroActions,
    applyOfflineSummary,
    clearOfflineSummary,
  };
}
