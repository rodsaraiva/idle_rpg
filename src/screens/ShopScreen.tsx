import React, { useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../theme';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { GoldDisplay } from '../components/GoldDisplay';
import { RecruitButton } from '../components/RecruitButton';
import { ChestRevealModal } from '../components/ChestRevealModal';
import { useGame } from '../hooks/useGame';
import { getRecruitCost } from '../utils/math';
import { SHOP_ITEMS } from '../constants/shop';
import { Hero } from '../types';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';

export function ShopScreen() {
  const { state, dispatch } = useGame();
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
  };

  const handleRevealCancel = () => {
    setRevealVisible(false);
    setActiveChestLabel('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Loja"
          subtitle="Compre baús para recrutar heróis"
          right={<GoldDisplay gold={state.gold} />}
        />

        <View style={styles.items}>
          {SHOP_ITEMS.map((it) => (
            <View key={it.id} style={styles.item}>
              <RecruitButton
                cost={cost}
                canAfford={canAfford}
                onPress={() => handleBuyChest(it.id, it.label)}
                label={it.label}
              />
            </View>
          ))}
        </View>
      </ScrollView>

      <ChestRevealModal
        visible={revealVisible}
        chestLabel={activeChestLabel}
        onComplete={handleRevealComplete}
        onCancel={handleRevealCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.md },
  items: { gap: theme.spacing.md },
  item: { marginBottom: theme.spacing.md },
});
