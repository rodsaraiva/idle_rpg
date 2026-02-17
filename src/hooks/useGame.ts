import { useContext } from 'react';
import { GameContext } from '../context/GameContext';

/** Hook para acessar o estado e ações do jogo de qualquer componente */
export function useGame() {
  const context = useContext(GameContext);

  if (!context) {
    throw new Error('useGame deve ser usado dentro de um GameProvider');
  }

  return context;
}
