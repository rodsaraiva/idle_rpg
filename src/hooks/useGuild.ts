import { useGame } from './useGame';
import { getRecruitCost } from '../utils/math';
import { Hero, HeroTask } from '../types';
import { getHeroActions as getHeroActionsUtil } from '../utils/heroActions';
import { useNavigation } from '@react-navigation/native';

export function useGuild() {
  const { 
    state, 
    setHeroTask, 
    recruitHero: recruitHeroAction, 
    isLoaded, 
    offlineSummary, 
    clearOfflineSummary,
    applyOfflineSummary 
  } = useGame();
  
  const navigation = useNavigation<any>();

  const nextRecruitCost = getRecruitCost(state.heroesRecruited);
  const canAfford = state.gold >= nextRecruitCost;

  const recruitHero = () => {
    recruitHeroAction();
    navigation.navigate('Treinamento');
  };

  const getHeroActions = (hero: Hero) => getHeroActionsUtil(hero, setHeroTask);

  return {
    state,
    isLoaded,
    offlineSummary,
    nextRecruitCost,
    canAfford,
    recruitHero,
    clearOfflineSummary,
    applyOfflineSummary,
    getHeroActions,
  };
}
