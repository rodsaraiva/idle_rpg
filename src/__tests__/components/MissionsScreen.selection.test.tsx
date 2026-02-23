import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MissionsScreen } from '../../screens/MissionsScreen';
import { GameContext } from '../../context/GameContext';
import { HeroTask } from '../../types';

function createHero(id: string, name = 'Hero') {
  return {
    id,
    name,
    hpMax: 10,
    hpCurrent: 10,
    atk: 5,
    mp: 3,
    currentTask: HeroTask.IDLE,
    classId: 'WARRIOR',
  };
}

test('opens selection modal and dispatches START_MISSION with selected heroes', async () => {
  const heroes = [createHero('h1', 'Alpha'), createHero('h2', 'Beta')];
  const state = {
    gold: 0,
    heroes,
    heroesRecruited: 2,
    lastSavedAt: Date.now(),
    activeMissions: [],
  };

  const dispatch = jest.fn();

  const wrapper = render(
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

  // press first Enviar button (mission_1)
  const sendButtons = wrapper.getAllByText('Enviar');
  expect(sendButtons.length).toBeGreaterThan(0);
  fireEvent.press(sendButtons[0]);

  // modal should open - find title
  await waitFor(() => wrapper.getByText('Posicione os heróis na missão'));

  // place a hero by pressing its item
  const heroItem = wrapper.getByText('Alpha');
  fireEvent.press(heroItem);

  // start mission
  const startButton = wrapper.getByText('Iniciar missão');
  fireEvent.press(startButton);

  // dispatch should have been called with START_MISSION
  await waitFor(() => {
    expect(dispatch).toHaveBeenCalled();
    const calledWith = dispatch.mock.calls.find((c: any) => c[0] && c[0].type === 'START_MISSION');
    expect(calledWith).toBeTruthy();
    expect(calledWith[0].heroIds).toContain('h1');
  });
});

