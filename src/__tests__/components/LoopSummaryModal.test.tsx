import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../../components/MissionResultModal', () => ({
  MissionResultModal: () => null,
}));

import { LoopSummaryGate } from '../../components/LoopSummaryModal';
import { GameContext } from '../../context/GameContext';
import { initialGameState } from '../../context/gameReducer';
import { LoopSummary } from '../../types';

function resumo(over: Partial<LoopSummary> = {}): LoopSummary {
  return {
    missionId: 'm1', templateId: 'mission_1', heroIds: ['h1'],
    tally: { cycles: 2, gold: 240, materials: { couro: 3 }, casualties: [] },
    plannedCycles: 3, reason: 'completed', ...over,
  };
}

function wrap(summary: LoopSummary | null, dispatch: jest.Mock = jest.fn()) {
  return (
    <GameContext.Provider value={{
      state: { ...initialGameState, completedLoops: summary ? [summary] : [] } as any,
      dispatch, isLoaded: true, setHeroTask: jest.fn(), recruitHero: jest.fn(),
      offlineSummary: null, clearOfflineSummary: jest.fn(), applyOfflineSummary: jest.fn(),
      advanceOnboarding: jest.fn(), skipOnboarding: jest.fn(),
      markHintSeen: jest.fn(), resetOnboarding: jest.fn(),
    } as any}>
      <LoopSummaryGate />
    </GameContext.Provider>
  );
}

test('sem resumo pendente não renderiza nada', () => {
  const { toJSON } = render(wrap(null));
  expect(toJSON()).toBeNull();
});

test('modo times mostra "N de M ciclos"', () => {
  const { getByText } = render(wrap(resumo()));
  expect(getByText(/2 de 3 ciclos/)).toBeTruthy();
});

test('modo sem planejamento mostra só a contagem', () => {
  const { getByText, queryByText } = render(wrap(resumo({ plannedCycles: undefined })));
  expect(getByText(/2 ciclos/)).toBeTruthy();
  expect(queryByText(/de 3/)).toBeNull();
});

test('mostra o ouro e os materiais acumulados', () => {
  const { getByText } = render(wrap(resumo()));
  expect(getByText(/240/)).toBeTruthy();
  expect(getByText(/couro ×3/)).toBeTruthy();
});

test('"Fechar" despacha DISMISS_LOOP_SUMMARY com o missionId do resumo', () => {
  const dispatch = jest.fn();
  const { getByLabelText } = render(wrap(resumo({ missionId: 'm42' }), dispatch));
  fireEvent.press(getByLabelText('Fechar resumo do loop'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'DISMISS_LOOP_SUMMARY', missionId: 'm42' });
});
