import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MissionResultModal } from '../../components/MissionResultModal';
import { GameContext } from '../../context/GameContext';

// Mock BattleRunner to run actions synchronously
jest.mock('../../services/battleRunner', () => ({
  BattleRunner: class {
    actions: any[];
    delay: number;
    constructor(actions: any[], delay = 1000) {
      this.actions = actions || [];
      this.delay = delay;
    }
    start(onAction: any, onComplete: any) {
      this.actions.forEach((a: any) => onAction(a));
      onComplete && onComplete();
    }
    skip(onAction: any, onComplete: any) {
      this.actions.forEach((a: any) => onAction(a));
      onComplete && onComplete();
    }
    stop() {}
  },
}));

jest.mock('../../services/sound', () => ({ playSound: jest.fn() }));
jest.mock('../../services/haptics', () => ({ lightTap: jest.fn(), successNotification: jest.fn() }));
jest.mock('../../services/feedback', () => ({ emit: jest.fn(), FEEDBACK_EVENTS: {} }));

test('MissionResultModal plays actions and skip button shows full log', async () => {
  const actions = [
    { text: 'hit 1', actionType: 'hit', amount: 2, targetId: 'h1' },
    { text: 'miss 1', actionType: 'miss' },
  ];
  const result = {
    missionId: 'm2',
    templateId: 'mission_1',
    success: false,
    reward: 0,
    casualties: [],
    enemyCasualties: 0,
    rounds: 2,
    actions,
    log: ['hit 1', 'miss 1'],
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

  // Wait for actions to be displayed (sync in our mock)
  await waitFor(() => {
    expect(getByText('hit 1')).toBeTruthy();
    expect(getByText('miss 1')).toBeTruthy();
  });

  // Press "Pular animação" to invoke skip (should be safe)
  const skip = getByText('Pular animação');
  fireEvent.press(skip);
  // no errors and log remains visible
  expect(getByText('hit 1')).toBeTruthy();
});

