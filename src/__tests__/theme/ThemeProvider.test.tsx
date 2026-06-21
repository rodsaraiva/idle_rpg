import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider, useTheme } from '../../theme/ThemeProvider';

function Probe() {
  const { mode, colors } = useTheme();
  return <Text>{`${mode}:${colors.bgBase}`}</Text>;
}

describe('ThemeProvider', () => {
  test('default é dark (bgBase do dark)', () => {
    const { getByText } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(getByText('dark:#1E1710')).toBeTruthy();
  });

  test('initialMode=light usa a paleta pergaminho', () => {
    const { getByText } = render(
      <ThemeProvider initialMode="light">
        <Probe />
      </ThemeProvider>
    );
    expect(getByText('light:#E8DCC0')).toBeTruthy();
  });
});
