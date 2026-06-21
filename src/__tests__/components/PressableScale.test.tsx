import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (c: any) => c },
  useSharedValue: (v: any) => ({ value: v }),
  useAnimatedStyle: (fn: any) => fn(),
  withSpring: (v: any) => v,
}));

import { PressableScale } from '../../components/ui/PressableScale';

describe('PressableScale', () => {
  test('renderiza children', () => {
    const { getByText } = render(
      <PressableScale onPress={() => {}}>
        <Text>toque</Text>
      </PressableScale>
    );
    expect(getByText('toque')).toBeTruthy();
  });

  test('encaminha onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <PressableScale onPress={onPress}>
        <Text>toque</Text>
      </PressableScale>
    );
    fireEvent.press(getByText('toque'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
