import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RecruitButton } from '../../components/RecruitButton';

test('RecruitButton calls onPress when enabled', () => {
  const onPress = jest.fn();
  const { getByText } = render(<RecruitButton cost={5} canAfford={true} onPress={onPress} />);
  const btn = getByText(/Recrutar/i);
  fireEvent.press(btn);
  expect(onPress).toHaveBeenCalled();
});

