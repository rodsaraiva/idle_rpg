import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: (props: any) => require('react').createElement('Animated.View', props, props.children) },
  useSharedValue: (v: any) => ({ value: v }),
  useAnimatedStyle: (fn: any) => fn(),
  withRepeat: (v: any) => v,
  withTiming: (v: any) => v,
  Easing: { linear: 0, out: (e: any) => e, cubic: 0 },
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: (props: any) => require('react').createElement('LinearGradient', props, props.children),
}));

import { Shimmer } from '../../components/ui/Shimmer';

describe('Shimmer', () => {
  test('renderiza sem throw', () => {
    const { toJSON } = render(<Shimmer height={16} />);
    expect(toJSON()).toBeTruthy();
  });

  test('aceita width e radius', () => {
    const { toJSON } = render(<Shimmer width={120} height={20} radius="md" />);
    expect(toJSON()).toBeTruthy();
  });
});
