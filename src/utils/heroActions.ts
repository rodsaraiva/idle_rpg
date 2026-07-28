import React from 'react';
import { View } from 'react-native';
import { Hero, HeroTask } from '../types';
import { theme } from '../theme';

/** `atkRef` marca o botão de ATK como alvo mensurável do spotlight do FTUE. */
export function getHeroActions(
  hero: Hero,
  setHeroTask: (id: string, task: HeroTask) => void,
  atkRef?: React.RefObject<View | null>
) {
  return [
    {
      label: 'Treinar HP',
      isActive: hero.currentTask === HeroTask.TRAIN_HP,
      color: theme.colors.statHp,
      onPress: () => setHeroTask(hero.id, HeroTask.TRAIN_HP),
    },
    {
      label: 'Treinar ATK',
      isActive: hero.currentTask === HeroTask.TRAIN_ATK,
      color: theme.colors.statAtk,
      onPress: () => setHeroTask(hero.id, HeroTask.TRAIN_ATK),
      ...(atkRef ? { ref: atkRef } : {}),
    },
    {
      label: 'Treinar MP',
      isActive: hero.currentTask === HeroTask.TRAIN_MP,
      color: theme.colors.statMp,
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
