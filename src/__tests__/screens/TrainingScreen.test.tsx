/**
 * Treino é decisão por herói: não existe ordem coletiva.
 * Aplicar a mesma tarefa a todo mundo de uma vez apagava a escolha que a tela existe pra oferecer.
 */

import React from 'react';
import { FlatList } from 'react-native';
import { render } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: (props: any) => require('react').createElement('SafeAreaProvider', props, props.children),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('../../components/AnimatedGold', () => ({
  AnimatedGold: (props: any) => require('react').createElement('AnimatedGold', props),
}));
jest.mock('../../components/ui/Banner', () => ({
  Banner: (props: any) => require('react').createElement('Banner', { ...props }, props.right),
}));
jest.mock('../../components/ui/Icon', () => ({
  Icon: (props: any) => require('react').createElement('Icon', props),
}));
jest.mock('../../components/ui/Card', () => ({
  Card: (props: any) => require('react').createElement('Card', props, props.children),
}));
jest.mock('../../components/ui/OrnateFrame', () => ({
  OrnateFrame: (props: any) => require('react').createElement('OrnateFrame', props, props.children),
}));
jest.mock('../../components/ui/PressableScale', () => ({
  PressableScale: (props: any) => require('react').createElement('PressableScale', props, props.children),
}));
// ScreenContainer usa Reanimated (FadeInDown), que não roda no ambiente de teste
jest.mock('../../components/ui/ScreenContainer', () => ({
  ScreenContainer: (props: any) =>
    require('react').createElement('ScreenContainer', props, props.banner, props.children),
}));

import { TrainingScreen } from '../../screens/TrainingScreen';
import { GameContext } from '../../context/GameContext';
import { initialGameState } from '../../context/gameReducer';
import { Hero, HeroTask } from '../../types';

function makeHero(id: string): Hero {
  return {
    id, name: `Herói ${id}`, hpMax: 50, hpCurrent: 50, atk: 10, mp: 5,
    defense: 5, crit: 10, agility: 5, currentTask: HeroTask.IDLE,
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  } as Hero;
}

function wrapper(children: React.ReactNode, heroes: Hero[]) {
  return (
    <GameContext.Provider value={{
      state: { ...initialGameState, heroes } as any,
      dispatch: jest.fn(),
      isLoaded: true,
      setHeroTask: jest.fn(),
      recruitHero: jest.fn(),
      offlineSummary: null,
      clearOfflineSummary: jest.fn(),
      applyOfflineSummary: jest.fn(),
      advanceOnboarding: jest.fn(),
      skipOnboarding: jest.fn(),
      markHintSeen: jest.fn(),
      resetOnboarding: jest.fn(),
    }}>
      {children}
    </GameContext.Provider>
  );
}

describe('TrainingScreen', () => {
  const heroes = [makeHero('h1'), makeHero('h2')];

  test('não oferece ordens coletivas', () => {
    const { queryByText } = render(wrapper(<TrainingScreen />, heroes));
    expect(queryByText('Ordens Coletivas')).toBeNull();
  });

  test('cada herói recebe as 4 ações individuais', () => {
    const { UNSAFE_getByType } = render(wrapper(<TrainingScreen />, heroes));
    const list = UNSAFE_getByType(FlatList as any);
    const card = list.props.renderItem({ item: heroes[0], index: 0 });

    expect(card.props.actions.map((a: any) => a.label)).toEqual([
      'Treinar HP', 'Treinar ATK', 'Treinar MP', 'Descansar',
    ]);
  });

  test('alvo do FTUE fica no ATK do 1º herói, não nos demais', () => {
    const { UNSAFE_getByType } = render(wrapper(<TrainingScreen />, heroes));
    const list = UNSAFE_getByType(FlatList as any);
    const atkDo = (index: number) =>
      list.props
        .renderItem({ item: heroes[index], index })
        .props.actions.find((a: any) => a.label === 'Treinar ATK');

    expect(atkDo(0).ref).toBeTruthy();
    expect(atkDo(1).ref).toBeUndefined();
  });
});
