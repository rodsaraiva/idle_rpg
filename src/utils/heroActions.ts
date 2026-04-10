import { Hero, HeroTask } from '../types';
import { theme } from '../theme';

export function getHeroActions(hero: Hero, setHeroTask: (id: string, task: HeroTask) => void) {
  return [
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
}
