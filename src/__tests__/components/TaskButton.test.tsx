import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TaskButton } from '../../components/TaskButton';

test('TaskButton triggers onPress', () => {
  const onPress = jest.fn();
  const { getByText } = render(<TaskButton label="Do" onPress={onPress} isActive={false} />);
  fireEvent.press(getByText('Do'));
  expect(onPress).toHaveBeenCalled();
});

