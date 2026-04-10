import { useState, useMemo } from 'react';
import { useGame } from './useGame';
import { getRecruitCost } from '../utils/math';
import { Hero } from '../types';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';
import { useNavigation } from '@react-navigation/native';
import { SHOP_ITEMS, StatVariance } from '../constants/shop';

export function useShop() {
  const { state, dispatch } = useGame();
  const navigation = useNavigation<any>();
  const baseCost = getRecruitCost(state.heroesRecruited);

  /** Cost per chest id */
  const chestCosts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of SHOP_ITEMS) {
      map[item.id] = baseCost * item.costMultiplier;
    }
    return map;
  }, [baseCost]);

  const [revealVisible, setRevealVisible] = useState(false);
  const [activeChestLabel, setActiveChestLabel] = useState('');
  const [activeStatVariance, setActiveStatVariance] = useState<StatVariance | undefined>(undefined);

  const handleBuyChest = (chestId: string, label: string) => {
    const chest = SHOP_ITEMS.find((item) => item.id === chestId);
    if (!chest) return;

    const cost = chestCosts[chestId] ?? baseCost;
    if (state.gold < cost) {
      emit(FEEDBACK_EVENTS.TOAST, { text: 'Ouro insuficiente' });
      return;
    }

    dispatch({ type: 'BUY_CHEST', chestId });
    setActiveChestLabel(label);
    setActiveStatVariance(chest.statVariance);
    setRevealVisible(true);
  };

  const handleRevealComplete = (hero: Hero) => {
    dispatch({ type: 'CONFIRM_CHEST_REVEAL', hero });
    setRevealVisible(false);
    setActiveChestLabel('');
    setActiveStatVariance(undefined);

    // Redireciona para a tela de treinamento após contratar um herói
    navigation.navigate('Treinamento');
  };

  const handleRevealCancel = () => {
    setRevealVisible(false);
    setActiveChestLabel('');
    setActiveStatVariance(undefined);
  };

  return {
    state,
    baseCost,
    chestCosts,
    revealVisible,
    activeChestLabel,
    activeStatVariance,
    handleBuyChest,
    handleRevealComplete,
    handleRevealCancel,
  };
}
