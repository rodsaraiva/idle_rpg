import React, { createContext, useContext, useMemo, useState } from 'react';
import { darkColors, lightColors } from './tokens/colors';

export type ThemeMode = 'dark' | 'light';
type ColorScheme = Record<keyof typeof darkColors, string>;

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ColorScheme;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  colors: darkColors,
  setMode: () => {},
});

export function ThemeProvider({
  children,
  initialMode = 'dark',
}: {
  children: React.ReactNode;
  initialMode?: ThemeMode;
}) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const value = useMemo<ThemeContextValue>(
    () => ({ mode, colors: mode === 'dark' ? darkColors : lightColors, setMode }),
    [mode]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
