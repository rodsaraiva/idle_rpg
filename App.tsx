import React from 'react';
import { GameProvider } from './src/context/GameContext';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import { FeedbackLayer } from './src/components/FeedbackLayer';
import { useReinoFonts } from './src/theme/fonts';

export default function App() {
  // Não bloqueia o boot: com fonte ainda carregando, RN usa o fallback do sistema.
  useReinoFonts();
  return (
    <ThemeProvider>
      <GameProvider>
        <AppNavigator />
        <FeedbackLayer />
      </GameProvider>
    </ThemeProvider>
  );
}
