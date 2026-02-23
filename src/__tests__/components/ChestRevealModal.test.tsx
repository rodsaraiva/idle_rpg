import React from 'react';
import { render } from '@testing-library/react-native';
import { ChestRevealModal } from '../../components/ChestRevealModal';

test('ChestRevealModal renders and can be hidden', () => {
  const { queryByText, rerender } = render(<ChestRevealModal visible={false} chestLabel="Test" onComplete={() => {}} onCancel={() => {}} />);
  expect(queryByText('Test')).toBeNull();
  rerender(<ChestRevealModal visible={true} chestLabel="Test" onComplete={() => {}} onCancel={() => {}} />);
  expect(queryByText('Test')).toBeTruthy();
});

