import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HeroCard } from '../../components/HeroCard';
import { Hero, HeroTask } from '../../types';

const createHero = (overrides: Partial<Hero> = {}): Hero => ({
  id: 'h1',
  name: 'Heroe Teste',
  classId: 'WARRIOR',
  hpMax: 10,
  hpCurrent: 8,
  atk: 6,
  mp: 4,
  currentTask: HeroTask.IDLE,
  trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
  trainingCount: { hp: 0, atk: 0, mp: 0 },
  ...overrides,
});

describe('HeroCard variantes', () => {
  test('renderiza variante detailed com actions customizadas', () => {
    const onTrainHp = jest.fn();
    const hero = createHero();

    const { getByText } = render(
      React.createElement(HeroCard, {
        hero,
        actions: [
          { label: 'Treinar HP', onPress: onTrainHp, isActive: true },
          { label: 'Descansar', onPress: jest.fn() },
        ],
      })
    );

    expect(getByText('Heroe Teste')).toBeTruthy();
    expect(getByText('Treinar HP')).toBeTruthy();

    fireEvent.press(getByText('Treinar HP'));
    expect(onTrainHp).toHaveBeenCalledTimes(1);
  });

  test('renderiza variante compact e alterna seleção', () => {
    const onToggle = jest.fn();
    const hero = createHero();

    const { getByText } = render(
      React.createElement(HeroCard, {
        hero,
        variant: 'compact',
        selected: true,
        onToggle,
      })
    );

    expect(getByText('Heroe Teste')).toBeTruthy();
    fireEvent.press(getByText('Heroe Teste'));
    expect(onToggle).toHaveBeenCalledWith(hero.id);
  });
});
