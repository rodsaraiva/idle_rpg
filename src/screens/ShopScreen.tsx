import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { theme } from '../theme';
import { Banner } from '../components/ui/Banner';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { AnimatedGold } from '../components/AnimatedGold';
import { ChestRevealModal } from '../components/ChestRevealModal';
import { SHOP_ITEMS } from '../constants/shop';
import { useShop } from '../hooks/useShop';
import { ChestCard } from '../components/ChestCard';
import { LOTTIE_ASSETS } from '../constants/assets';
import { IconName } from '../components/ui/Icon';

const CHEST_ICON: Record<string, IconName> = {
  chest_gold: 'treasure-chest',
  chest_silver: 'treasure-chest-outline',
};

function getChestIcon(id: string): IconName {
  return CHEST_ICON[id] ?? 'gift';
}

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

  const recruitRef = useRef<LottieView>(null);

  const onRevealComplete: typeof handleRevealComplete = (hero) => {
    recruitRef.current?.play();
    handleRevealComplete(hero);
  };

  return (
    <ScreenContainer
      banner={
        <Banner
          title="Mercado Real"
          subtitle="Contrate mercenários lendários"
          right={<AnimatedGold gold={state.gold} />}
        />
      }
    >
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
              icon={getChestIcon(it.id)}
            />
          );
        })}
      </View>

      <View style={styles.recruitFx} pointerEvents="none">
        <LottieView
          ref={recruitRef}
          source={LOTTIE_ASSETS.RECRUIT}
          loop={false}
          style={styles.recruitFxInner}
        />
      </View>

      <ChestRevealModal
        visible={revealVisible}
        chestLabel={activeChestLabel}
        statVariance={activeStatVariance}
        onComplete={onRevealComplete}
        onCancel={handleRevealCancel}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  infoBox: {
    backgroundColor: theme.colors.surfaceRaised,
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
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
  recruitFx: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  recruitFxInner: {
    flex: 1,
  },
});
