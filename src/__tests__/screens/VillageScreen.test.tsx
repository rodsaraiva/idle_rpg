import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VillageScreen, HOTSPOTS } from '../../screens/VillageScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: (props: any) => require('react').createElement('SafeAreaProvider', props, props.children),
}));
import { GameContext } from '../../context/GameContext';
import { initialGameState } from '../../context/gameReducer';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../components/AnimatedGold', () => ({
  AnimatedGold: (props: any) => require('react').createElement('AnimatedGold', props),
}));
jest.mock('../../components/ui/PressableScale', () => ({
  PressableScale: (props: any) => require('react').createElement('PressableScale', props, props.children),
}));
jest.mock('../../components/ui/Icon', () => ({
  Icon: (props: any) => require('react').createElement('Icon', props),
}));
jest.mock('../../components/ui/Seal', () => ({
  Seal: (props: any) => require('react').createElement('Seal', props, props.children),
}));
jest.mock('../../components/ui/Banner', () => ({
  Banner: (props: any) => require('react').createElement('Banner', { ...props }, props.right),
}));
jest.mock('../../components/ui/Card', () => ({
  Card: (props: any) => require('react').createElement('Card', props, props.children),
}));

function wrapper(children: React.ReactNode) {
  return (
    <GameContext.Provider value={{
      state: initialGameState as any,
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

beforeEach(() => mockNavigate.mockClear());

describe('VillageScreen', () => {
  const ROTAS = ['Treinamento', 'Enfermaria', 'Ferreiro', 'MissoesDiarias', 'Conquistas', 'Panteao', 'Semanal', 'Guilda', 'Legado', 'MapaZonas', 'Configuracoes', 'Colecao'];

  test('define exatamente 12 hotspots com o conjunto de rotas esperado', () => {
    expect(HOTSPOTS).toHaveLength(12);
    expect(HOTSPOTS.map((h) => h.screen).sort()).toEqual([...ROTAS].sort());
  });

  test('renderiza sem throw', () => {
    const { toJSON } = render(wrapper(<VillageScreen />));
    expect(toJSON()).toBeTruthy();
  });

  test('expõe um destino por rota, sem depender de imagem de mapa', () => {
    const { getAllByTestId } = render(wrapper(<VillageScreen />));
    expect(getAllByTestId(/^village-/)).toHaveLength(12);
  });

  test('tap em cada destino navega para a rota correta', () => {
    const { getByTestId } = render(wrapper(<VillageScreen />));
    for (const h of HOTSPOTS) {
      mockNavigate.mockClear();
      fireEvent.press(getByTestId(`village-${h.screen}`));
      expect(mockNavigate).toHaveBeenCalledWith(h.screen);
    }
  });
});
