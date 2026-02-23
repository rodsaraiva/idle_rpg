import React from 'react';
import { render } from '@testing-library/react-native';
import { EmptyState } from '../../components/ui/EmptyState';

test('EmptyState renders icon, title and subtitle', () => {
  const { getByText } = render(<EmptyState icon="🏰" title="No items" subtitle="Nothing here" />);
  expect(getByText('No items')).toBeTruthy();
  expect(getByText('Nothing here')).toBeTruthy();
});

