import React from 'react';
import { GameProvider } from './src/context/GameContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <GameProvider>
      <AppNavigator />
    </GameProvider>
  );
}
