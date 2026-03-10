import React from 'react';
import { render } from '@testing-library/react-native';
import { OfflineSummaryModal } from '../../components/OfflineSummaryModal';

test('OfflineSummaryModal renders summary when provided', () => {
  const summary = { ticks: 1, goldGained: 10, heroesAffected: 0, cappedHours: 0, perHeroChanges: [] };
  const { getByText } = render(<OfflineSummaryModal visible={true} summary={summary as any} onApply={() => {}} onDismiss={() => {}} />);
  expect(getByText(/Progresso offline/i)).toBeTruthy();
});

