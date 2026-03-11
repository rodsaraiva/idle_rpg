import { useGame } from './useGame';
import { getRecruitCost } from '../utils/math';
import { Hero, HeroTask } from '../types';
import { theme } from '../theme';
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

  const getHeroActions = (hero: Hero) => [
    {
      label: 'Treinar HP',
      isActive: hero.currentTask === HeroTask.TRAIN_HP,
      color: theme.colors.hp,
      onPress: () => setHeroTask(hero.id, HeroTask.TRAIN_HP),
    },
    {
      label: 'Treinar ATK',
      isActive: hero.currentTask === HeroTask.TRAIN_ATK,
      color: theme.colors.atk,
      onPress: () => setHeroTask(hero.id, HeroTask.TRAIN_ATK),
    },
    {
      label: 'Treinar MP',
      isActive: hero.currentTask === HeroTask.TRAIN_MP,
      color: theme.colors.mp,
      onPress: () => setHeroTask(hero.id, HeroTask.TRAIN_MP),
    },
    {
      label: 'Descansar',
      isActive: hero.currentTask === HeroTask.IDLE,
      color: theme.colors.textMuted,
      onPress: () => setHeroTask(hero.id, HeroTask.IDLE),
    },
  ];

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
