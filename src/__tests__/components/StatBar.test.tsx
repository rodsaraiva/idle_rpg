import React from 'react';
import { render } from '@testing-library/react-native';
import { StatBar } from '../../components/StatBar';

test('StatBar renders with given value', () => {
  const { getByText } = render(<StatBar label="HP" value={5} color="red" />);
  expect(getByText('HP')).toBeTruthy();
  expect(getByText('5')).toBeTruthy();
});

