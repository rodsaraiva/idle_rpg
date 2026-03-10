import React from 'react';
import { render } from '@testing-library/react-native';
import { ScreenHeader } from '../../components/ui/ScreenHeader';

// Mock the components that might cause issues with ts-jest + react-native
jest.mock('../../components/GoldDisplay', () => ({
  GoldDisplay: ({ gold }: any) => <div testID="gold">{gold}</div>
}));

test('ScreenHeader renders title and subtitle', () => {
  const { getByText } = render(<ScreenHeader title="Title" subtitle="Sub" right={null} />);
  expect(getByText('Title')).toBeTruthy();
  expect(getByText('Sub')).toBeTruthy();
});

