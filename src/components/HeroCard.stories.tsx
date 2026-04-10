import React from 'react';
import { HeroCard } from './HeroCard';
import { Hero, HeroTask } from '../types';

const baseHero: Hero = {
  id: 'hero-1',
  name: 'Arthas',
  classId: 'WARRIOR',
  hpMax: 12,
  hpCurrent: 9,
  atk: 7,
  mp: 3,
  currentTask: HeroTask.IDLE,
  trainingProgressMs: { hp: 0, atk: 0, mp: 0, defense: 0, crit: 0, agility: 0 },
  trainingCount: { hp: 0, atk: 0, mp: 0, defense: 0, crit: 0, agility: 0 },
};

export default {
  title: 'Components/HeroCard',
  component: HeroCard,
};

export const Detailed = () => (
  <HeroCard
    hero={baseHero}
    actions={[
      { label: 'Treinar HP', onPress: () => {}, color: '#26A69A' },
      { label: 'Treinar ATK', onPress: () => {}, color: '#EF5350' },
      { label: 'Treinar MP', onPress: () => {}, color: '#5C6BC0' },
      { label: 'Descansar', onPress: () => {}, color: '#90A4AE', isActive: true },
    ]}
  />
);

export const Compact = () => (
  <HeroCard
    hero={baseHero}
    variant="compact"
    selected
    onToggle={() => {}}
  />
);
