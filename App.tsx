import React from 'react';
import { GameProvider } from './src/context/GameContext';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import { FeedbackLayer } from './src/components/FeedbackLayer';
import { ConsentGate } from './src/components/ConsentGate';
import { useReinoFonts } from './src/theme/fonts';
import { OnboardingProvider } from './src/onboarding/OnboardingProvider';
import { OnboardingOverlay } from './src/onboarding/OnboardingOverlay';

export default function App() {
  // Não bloqueia o boot: com fonte ainda carregando, RN usa o fallback do sistema.
  useReinoFonts();
  return (
    <ThemeProvider>
      <GameProvider>
        {/* Gate LGPD: bloqueia analytics até decisão; sincroniza flag de módulo no boot */}
        <ConsentGate />
        <OnboardingProvider>
          <AppNavigator />
          <FeedbackLayer />
          <OnboardingOverlay />
        </OnboardingProvider>
      </GameProvider>
    </ThemeProvider>
  );
}
