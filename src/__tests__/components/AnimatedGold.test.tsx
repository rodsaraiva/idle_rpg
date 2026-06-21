import React from 'react';
import { render } from '@testing-library/react-native';
import { AnimatedGold } from '../../components/AnimatedGold';
import { formatNumber } from '../../utils/math';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: (props: any) => require('react').createElement('View', props, props.children) },
  useSharedValue: (v: any) => ({ value: v }),
  useAnimatedStyle: (_fn: any) => ({}),
  useAnimatedProps: (_fn: any) => ({}),
  // useDerivedValue NÃO executa o callback para evitar setState durante render (loop infinito)
  useDerivedValue: (_fn: any) => ({ value: 0 }),
  withTiming: (v: any) => v,
  withSequence: (...v: any[]) => v[v.length - 1],
  Easing: { out: (e: any) => e, cubic: 0 },
  createAnimatedComponent: (c: any) => c,
  runOnJS: (fn: any) => fn,
}));

jest.mock('../../components/ui/Icon', () => ({
  Icon: (props: any) => require('react').createElement('Icon', props),
}));

describe('AnimatedGold', () => {
  test('renderiza o valor formatado inicial', () => {
    const { getByText } = render(<AnimatedGold gold={1200} />);
    expect(getByText(formatNumber(1200))).toBeTruthy();
  });

  test('expõe accessibilityLabel com o ouro formatado', () => {
    const { getByLabelText } = render(<AnimatedGold gold={500} />);
    expect(getByLabelText(`Ouro da guilda: ${formatNumber(500)}`)).toBeTruthy();
  });

  test('reflete o novo total ao mudar a prop gold', () => {
    const { rerender, getByText } = render(<AnimatedGold gold={100} />);
    rerender(<AnimatedGold gold={250} />);
    expect(getByText(formatNumber(250))).toBeTruthy();
  });

  test('não quebra com gold=0', () => {
    const { getByText } = render(<AnimatedGold gold={0} />);
    expect(getByText(formatNumber(0))).toBeTruthy();
  });
});
