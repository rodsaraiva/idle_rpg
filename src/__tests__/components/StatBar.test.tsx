import React from 'react';
import { render } from '@testing-library/react-native';
import { StatBar } from '../../components/StatBar';

test('StatBar renders with given value and max', () => {
  const { getByText } = render(<StatBar label="HP" value={5} max={10} />);
  expect(getByText('HP')).toBeTruthy();
  expect(getByText(/5\/10/)).toBeTruthy();
});

