import React from 'react';
import { render } from '@testing-library/react-native';
import { HeroCard } from '../../components/HeroCard';
import { GameContext } from '../../context/GameContext';
import { initialGameState } from '../../context/gameReducer';
import { Hero, HeroTask } from '../../types';

jest.mock('../../components/ui/Icon', () => ({
  Icon: (props: any) => require('react').createElement('Icon', props),
}));
jest.mock('../../components/ui/Card', () => ({
  Card: (props: any) => require('react').createElement('Card', props, props.children),
}));
jest.mock('../../components/ui/OrnateFrame', () => ({
  OrnateFrame: (props: any) => require('react').createElement('OrnateFrame', props, props.children),
}));

function makeHero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 'h1', name: 'Aria', hpMax: 50, hpCurrent: 50, atk: 10, mp: 5,
    defense: 5, crit: 10, agility: 5, currentTask: HeroTask.IDLE,
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
    ...overrides,
  } as Hero;
}

function wrap(children: React.ReactNode) {
  return (
    <GameContext.Provider value={{
      state: initialGameState as any, dispatch: jest.fn(), isLoaded: true,
      setHeroTask: jest.fn(), recruitHero: jest.fn(), offlineSummary: null,
      clearOfflineSummary: jest.fn(), applyOfflineSummary: jest.fn(),
      advanceOnboarding: jest.fn(), skipOnboarding: jest.fn(),
      markHintSeen: jest.fn(), resetOnboarding: jest.fn(),
    }}>{children}</GameContext.Provider>
  );
}

describe('HeroCard — render condicional de cosméticos', () => {
  test('usa OrnateFrame quando equippedCosmetics.frame está setado', () => {
    const { UNSAFE_queryAllByType } = render(
      wrap(
        <HeroCard
          hero={makeHero()}
          equippedCosmetics={{ frame: 'frame_gold' }}
        />
      )
    );
    expect(UNSAFE_queryAllByType('OrnateFrame' as any).length).toBeGreaterThan(0);
  });

  test('usa Card padrão quando equippedCosmetics.frame não está setado', () => {
    const { UNSAFE_queryAllByType } = render(
      wrap(<HeroCard hero={makeHero()} />)
    );
    expect(UNSAFE_queryAllByType('Card' as any).length).toBeGreaterThan(0);
    expect(UNSAFE_queryAllByType('OrnateFrame' as any).length).toBe(0);
  });

  test('exibe badge de selo quando equippedCosmetics.seal está setado', () => {
    const { getByLabelText } = render(
      wrap(
        <HeroCard
          hero={makeHero()}
          equippedCosmetics={{ seal: 'seal_flame' }}
        />
      )
    );
    expect(getByLabelText('Selo: Selo da Chama')).toBeTruthy();
  });

  test('não exibe badge de selo quando equippedCosmetics.seal não está setado', () => {
    const { queryByLabelText } = render(
      wrap(<HeroCard hero={makeHero()} />)
    );
    expect(queryByLabelText(/^Selo:/)).toBeNull();
  });

  test('frame e seal podem coexistir no mesmo render', () => {
    const { UNSAFE_queryAllByType, getByLabelText } = render(
      wrap(
        <HeroCard
          hero={makeHero()}
          equippedCosmetics={{ frame: 'frame_silver', seal: 'seal_void' }}
        />
      )
    );
    expect(UNSAFE_queryAllByType('OrnateFrame' as any).length).toBeGreaterThan(0);
    expect(getByLabelText('Selo: Selo do Vazio')).toBeTruthy();
  });
});

describe('HeroCard — regra DEF/CRIT/AGI não-treináveis', () => {
  test('defaultActions só tem treino de HP/ATK/MP (+ Descansar), nunca DEF/CRIT/AGI', () => {
    const { queryByText } = render(
      wrap(<HeroCard hero={makeHero()} onSetTask={jest.fn()} />)
    );
    expect(queryByText('Treinar HP')).toBeTruthy();
    expect(queryByText('Treinar ATK')).toBeTruthy();
    expect(queryByText('Treinar MP')).toBeTruthy();
    expect(queryByText(/Treinar DEF/i)).toBeNull();
    expect(queryByText(/Treinar CRIT/i)).toBeNull();
    expect(queryByText(/Treinar AGI/i)).toBeNull();
  });

  test('com showSecondaryStats, DEF/CRIT/AGI aparecem como leitura (accessibilityLabel)', () => {
    const { getByLabelText } = render(
      wrap(<HeroCard hero={makeHero({ defense: 7, crit: 12, agility: 4 })} showSecondaryStats />)
    );
    expect(getByLabelText('DEF 7')).toBeTruthy();
    expect(getByLabelText('CRIT 12%')).toBeTruthy();
    expect(getByLabelText('AGI 4')).toBeTruthy();
  });

  test('sem showSecondaryStats, não renderiza a linha de secundários', () => {
    const { queryByLabelText } = render(
      wrap(<HeroCard hero={makeHero()} showSecondaryStats={false} />)
    );
    expect(queryByLabelText(/^DEF /)).toBeNull();
  });
});
