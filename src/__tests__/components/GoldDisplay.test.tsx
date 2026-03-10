import React from 'react';
import { render } from '@testing-library/react-native';
import { GoldDisplay } from '../../components/GoldDisplay';

test('GoldDisplay shows amount', () => {
  const { getByText } = render(<GoldDisplay gold={123} />);
  // We use a regex to find the text because the component might have icons
  expect(getByText(/123/)).toBeTruthy();
});

