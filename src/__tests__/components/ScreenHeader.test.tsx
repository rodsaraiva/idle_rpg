import React from 'react';
import { render } from '@testing-library/react-native';
import { ScreenHeader } from '../../components/ui/ScreenHeader';

test('ScreenHeader renders title and subtitle', () => {
  const { getByText } = render(<ScreenHeader title="Title" subtitle="Sub" right={null} />);
  expect(getByText('Title')).toBeTruthy();
  expect(getByText('Sub')).toBeTruthy();
});

