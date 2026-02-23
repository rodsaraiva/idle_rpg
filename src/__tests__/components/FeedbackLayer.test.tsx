import React from 'react';
import { render } from '@testing-library/react-native';
import { FeedbackLayer } from '../../components/FeedbackLayer';

test('FeedbackLayer renders without crashing', () => {
  const { getByText } = render(<FeedbackLayer />);
  // doesn't throw; as there is dynamic content, just ensure render succeeds
  expect(getByText).toBeDefined();
});

