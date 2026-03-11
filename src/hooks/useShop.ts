import { useState } from 'react';
import { useGame } from './useGame';
import { getRecruitCost } from '../utils/math';
import { Hero } from '../types';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';
import { useNavigation } from '@react-navigation/native';

export function useShop() {
  const { state, dispatch } = useGame();
  const navigation = useNavigation<any>();
  const cost = getRecruitCost(state.heroesRecruited);
  const canAfford = state.gold >= cost;

  const [revealVisible, setRevealVisible] = useState(false);
  const [activeChestLabel, setActiveChestLabel] = useState('');

  const handleBuyChest = (chestId: string, label: string) => {
    if (state.gold < cost) {
      emit(FEEDBACK_EVENTS.TOAST, { text: 'Ouro insuficiente' });
      return;
    }
    
    dispatch({ type: 'BUY_CHEST', chestId });
    setActiveChestLabel(label);
    setRevealVisible(true);
  };

  const handleRevealComplete = (hero: Hero) => {
    dispatch({ type: 'CONFIRM_CHEST_REVEAL', hero });
    setRevealVisible(false);
    setActiveChestLabel('');
    
    // Redireciona para a tela de treinamento após contratar um herói
    navigation.navigate('Treinamento');
  };

  const handleRevealCancel = () => {
    setRevealVisible(false);
    setActiveChestLabel('');
  };

  return {
    state,
    cost,
    canAfford,
    revealVisible,
    activeChestLabel,
    handleBuyChest,
    handleRevealComplete,
    handleRevealCancel,
  };
}
