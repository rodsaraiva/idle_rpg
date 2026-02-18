import React from 'react';
import { GameProvider } from './src/context/GameContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { FeedbackLayer } from './src/components/FeedbackLayer';

export default function App() {
  return (
    <GameProvider>
      <AppNavigator />
      <FeedbackLayer />
    </GameProvider>
  );
}
