import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MissionsScreen } from '../../screens/MissionsScreen';
import { GameContext } from '../../context/GameContext';
import { HeroTask } from '../../types';

function makeHero(id: string, name = 'Hero') {
  return { id, name, hpMax: 10, hpCurrent: 10, atk: 5, mp: 3, currentTask: HeroTask.IDLE };
}

test('MissionsScreen opens modal and modal is accessible', async () => {
  const heroes = [makeHero('h1', 'Alpha')];
  const state = {
    gold: 0,
    heroes,
    heroesRecruited: 1,
    lastSavedAt: Date.now(),
    activeMissions: [],
  };
  const dispatch = jest.fn();

  const { getByText, getByLabelText } = render(
    <GameContext.Provider
      value={{
        state: state as any,
        dispatch: dispatch as any,
        setHeroTask: () => {},
        recruitHero: () => {},
        isLoaded: true,
        offlineSummary: null,
        clearOfflineSummary: () => {},
        applyOfflineSummary: async () => {},
      }}
    >
      <MissionsScreen />
    </GameContext.Provider>
  );

  // Press Enviar on first mission
  const send = getByText('Enviar');
  fireEvent.press(send);

  // Modal title appears
  await waitFor(() => getByText('Posicione os heróis na missão'));

  // Accessibility labels inside modal exist
  expect(getByLabelText('Fechar modal de seleção')).toBeTruthy();
  expect(getByLabelText('Iniciar missão com heróis selecionados')).toBeTruthy();
});

