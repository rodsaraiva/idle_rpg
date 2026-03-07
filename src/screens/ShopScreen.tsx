import React from 'react';
import { SafeAreaView, View, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../theme';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { GoldDisplay } from '../components/GoldDisplay';
import { RecruitButton } from '../components/RecruitButton';
import { ChestRevealModal } from '../components/ChestRevealModal';
import { SHOP_ITEMS } from '../constants/shop';
import { useShop } from '../hooks/useShop';

export function ShopScreen() {
  const {
    state,
    cost,
    canAfford,
    revealVisible,
    activeChestLabel,
    handleBuyChest,
    handleRevealComplete,
    handleRevealCancel,
  } = useShop();

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
