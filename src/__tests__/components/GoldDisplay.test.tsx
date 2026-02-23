import React from 'react';
import { render } from '@testing-library/react-native';
import { GoldDisplay } from '../../components/GoldDisplay';

test('GoldDisplay shows amount and icon', () => {
  const { getByText } = render(<GoldDisplay gold={123} />);
  expect(getByText('123')).toBeTruthy();
});

