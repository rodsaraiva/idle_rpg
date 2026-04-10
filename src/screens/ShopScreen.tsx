import React from 'react';
import { SafeAreaView, View, StyleSheet, ScrollView, Text } from 'react-native';
import { theme } from '../theme';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { GoldDisplay } from '../components/GoldDisplay';
import { ChestRevealModal } from '../components/ChestRevealModal';
import { SHOP_ITEMS } from '../constants/shop';
import { useShop } from '../hooks/useShop';
import { ChestCard } from '../components/ChestCard';

export function ShopScreen() {
  const {
    state,
    chestCosts,
    revealVisible,
    activeChestLabel,
    activeStatVariance,
    handleBuyChest,
    handleRevealComplete,
    handleRevealCancel,
  } = useShop();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Mercado Real"
          subtitle="Contrate mercenários lendários"
          right={<GoldDisplay gold={state.gold} />}
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Cada herói contratado aumenta o custo do próximo contrato.
          </Text>
        </View>

        <View style={styles.items}>
          {SHOP_ITEMS.map((it) => {
            const chestCost = chestCosts[it.id] ?? 0;
            return (
              <ChestCard
                key={it.id}
                label={it.label}
                cost={chestCost}
                canAfford={state.gold >= chestCost}
                onPress={() => handleBuyChest(it.id, it.label)}
                description="Contrate um herói aleatório para sua guilda."
                icon={it.id === 'chest_gold' ? '💎' : it.id === 'chest_silver' ? '🥈' : '🎁'}
              />
            );
          })}
        </View>
      </ScrollView>

      <ChestRevealModal
        visible={revealVisible}
        chestLabel={activeChestLabel}
        statVariance={activeStatVariance}
        onComplete={handleRevealComplete}
        onCancel={handleRevealCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: theme.colors.background 
  },
  container: { 
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  infoBox: {
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  infoText: {
    color: theme.colors.gold,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  items: { 
    gap: 8,
  },
});
