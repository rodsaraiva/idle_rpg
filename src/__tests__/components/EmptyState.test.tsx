import React from 'react';
import { render } from '@testing-library/react-native';
import { EmptyState } from '../../components/ui/EmptyState';

jest.mock('../../components/ui/Icon', () => ({
  Icon: (props: any) => require('react').createElement('Icon', props),
}));
jest.mock('lottie-react-native', () => ({
  __esModule: true,
  default: (props: any) => require('react').createElement('LottieView', props),
}));

describe('EmptyState', () => {
  test('renderiza <Icon> (não <Text> de emoji) a partir de icon: IconName', () => {
    const { UNSAFE_getByType, getByText } = render(
      <EmptyState icon="castle" title="Vazio" subtitle="nada aqui" />
    );
    expect(getByText('Vazio')).toBeTruthy();
    // o nó Icon mockado é renderizado como elemento 'Icon'
    expect(UNSAFE_getByType('Icon' as any)).toBeTruthy();
  });

  test('com prop lottie monta o LottieView', () => {
    const { UNSAFE_getByType } = render(
      <EmptyState icon="castle" title="Vazio" lottie="SPARKLE_BURST" />
    );
    expect(UNSAFE_getByType('LottieView' as any)).toBeTruthy();
  });
});
