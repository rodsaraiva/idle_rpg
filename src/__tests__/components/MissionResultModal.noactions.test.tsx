import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MissionResultModal } from '../../components/MissionResultModal';
import { GameContext } from '../../context/GameContext';

test('MissionResultModal displays log and casualties and dispatches dismiss on close', () => {
  const result = {
    missionId: 'm1',
    templateId: 'mission_1',
    success: true,
    reward: 10,
    casualties: [{ heroId: 'h1', hpLost: 2, hpAfter: 8 }],
    enemyCasualties: 1,
    rounds: 3,
    log: ['action1', 'action2'],
  };

  const state = { gold: 0, heroes: [], recentMissionResults: [result] };
  const dispatch = jest.fn();

  const { getByText } = render(
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
      <MissionResultModal />
    </GameContext.Provider>
  );

  // title
  expect(getByText('Missão concluída')).toBeTruthy();
  // log lines displayed
  expect(getByText('action1')).toBeTruthy();
  expect(getByText('action2')).toBeTruthy();
  // casualty line
  expect(getByText(/h1.*HP perdido/)).toBeTruthy();

  // press Close -> dispatch DISMISS_MISSION_RESULT
  const close = getByText('Fechar');
  fireEvent.press(close);
  expect(dispatch).toHaveBeenCalled();
  const called = dispatch.mock.calls.find((c: any) => c[0] && c[0].type === 'DISMISS_MISSION_RESULT');
  expect(called).toBeTruthy();
});

