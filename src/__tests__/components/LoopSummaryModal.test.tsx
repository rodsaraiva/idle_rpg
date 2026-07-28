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

function wrap(summary: LoopSummary | null, dispatch: jest.Mock = jest.fn(), offlineSummary: any = null) {
  return (
    <GameContext.Provider value={{
      state: { ...initialGameState, completedLoops: summary ? [summary] : [] } as any,
      dispatch, isLoaded: true, setHeroTask: jest.fn(), recruitHero: jest.fn(),
      offlineSummary, clearOfflineSummary: jest.fn(), applyOfflineSummary: jest.fn(),
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

test('baixas de múltiplos heróis aparecem numa única linha, como Materiais', () => {
  const s = resumo({
    tally: {
      cycles: 2, gold: 100, materials: {},
      casualties: [{ heroId: 'h1', hpAfter: 10 }, { heroId: 'h2', hpAfter: 0 }],
    },
  });
  const { getByText, queryAllByText } = render(wrap(s));
  expect(getByText(/Baixas ▸ h1 \(0% HP\), h2 \(0% HP\)/)).toBeTruthy();
  expect(queryAllByText(/Baixas ▸/)).toHaveLength(1);
});

test('"Fechar" despacha DISMISS_LOOP_SUMMARY com o missionId do resumo', () => {
  const dispatch = jest.fn();
  const { getByLabelText } = render(wrap(resumo({ missionId: 'm42' }), dispatch));
  fireEvent.press(getByLabelText('Fechar resumo do loop'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'DISMISS_LOOP_SUMMARY', missionId: 'm42' });
});

test('resumo pendente não abre com o modal offline em tela — evita empilhar dois modais no boot', () => {
  const { toJSON } = render(wrap(resumo(), jest.fn(), { ticks: 1, goldGained: 0, heroesAffected: 0, cappedHours: 0, perHeroChanges: [] }));
  expect(toJSON()).toBeNull();
});

test('resumo pendente aparece assim que o offline sai de tela', () => {
  const { getByText } = render(wrap(resumo(), jest.fn(), null));
  expect(getByText(/2 de 3 ciclos/)).toBeTruthy();
});

test('vendoCombate reseta ao trocar de resumo — não fica preso no combate do loop anterior', () => {
  const lastResult1 = { missionId: 'x1', templateId: 'mission_1', reward: 1, rounds: 1, actions: [], log: [], success: true, casualties: [], enemyCasualties: 1 } as any;
  const lastResult2 = { missionId: 'x2', templateId: 'mission_1', reward: 1, rounds: 1, actions: [], log: [], success: true, casualties: [], enemyCasualties: 1 } as any;
  const resumo1 = resumo({ missionId: 'm1', tally: { cycles: 2, gold: 100, materials: {}, casualties: [], lastResult: lastResult1 } });
  const resumo2 = resumo({ missionId: 'm2', tally: { cycles: 1, gold: 50, materials: {}, casualties: [], lastResult: lastResult2 } });

  const { getByLabelText, queryByLabelText, rerender } = render(wrap(resumo1));
  fireEvent.press(getByLabelText('Ver último combate'));
  expect(queryByLabelText('Fechar resumo do loop')).toBeNull();

  rerender(wrap(resumo2));
  expect(getByLabelText('Fechar resumo do loop')).toBeTruthy();
});
