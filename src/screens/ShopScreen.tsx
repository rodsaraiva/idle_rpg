import React from 'react';
import { SafeAreaView, View, Text, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../theme';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { GoldDisplay } from '../components/GoldDisplay';
import { RecruitButton } from '../components/RecruitButton';
import { useGame } from '../hooks/useGame';
import { getRecruitCost } from '../utils/math';
import { SHOP_ITEMS } from '../constants/shop';

export function ShopScreen() {
  const { state, recruitHero } = useGame();
  const cost = getRecruitCost(state.heroesRecruited);
  const canAfford = state.gold >= cost;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader title="Loja" subtitle="Compre baús para recrutar heróis" right={<GoldDisplay gold={state.gold} />} />

        <View style={styles.description}>
          <Text style={styles.helpText}>Por enquanto os baús recrutam heróis aleatórios (mesmo comportamento de Recrutar Herói).</Text>
        </View>

        <View style={styles.items}>
          {SHOP_ITEMS.map((it) => (
            <View key={it.id} style={styles.item}>
              <RecruitButton
                cost={cost}
                canAfford={canAfford}
                onPress={() => {
                  recruitHero();
                }}
                label={it.label}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.md },
  description: { marginVertical: theme.spacing.md },
  helpText: { color: theme.colors.textSecondary },
  items: { gap: theme.spacing.md },
  item: { marginBottom: theme.spacing.md },
});

