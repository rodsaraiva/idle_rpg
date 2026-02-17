import React from 'react';
import { GameProvider } from './src/context/GameContext';
import { GuildScreen } from './src/screens/GuildScreen';

export default function App() {
  return (
    <GameProvider>
      <GuildScreen />
    </GameProvider>
  );
}
