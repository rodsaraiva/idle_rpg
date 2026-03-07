import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { theme } from '../theme';
import { GoldDisplay } from '../components/GoldDisplay';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { HeroCard } from '../components/HeroCard';
import { RecruitButton } from '../components/RecruitButton';
import { OfflineSummaryModal } from '../components/OfflineSummaryModal';
import { Hero } from '../types';
import { useGuild } from '../hooks/useGuild';
import { GuildEmptyState } from '../components/GuildEmptyState';
import { LoadingScreen } from '../components/ui/LoadingScreen';

export function GuildScreen() {
  const {
    state,
    isLoaded,
    offlineSummary,
    nextRecruitCost,
    canAfford,
    recruitHero,
    clearOfflineSummary,
    applyOfflineSummary,
    getHeroActions,
  } = useGuild();

  if (!isLoaded) {
    return <LoadingScreen message="Carregando guilda..." />;
  }

  const renderHero = ({ item }: { item: Hero }) => (
    <HeroCard
      hero={item}
      actions={getHeroActions(item)}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <View style={styles.container}>
        <ScreenHeader
          title="Guilda"
          subtitle={`${state.heroes.length} herói${state.heroes.length !== 1 ? 's' : ''}`}
          right={<GoldDisplay gold={state.gold} />}
        />

        <View style={styles.recruitSection}>
          <RecruitButton
            cost={nextRecruitCost}
            canAfford={canAfford}
            onPress={recruitHero}
          />
        </View>

        {state.heroes.length === 0 ? (
          <GuildEmptyState />
        ) : (
          <FlatList
            data={state.heroes}
            renderItem={renderHero}
            keyExtractor={(hero) => hero.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
      
      <OfflineSummaryModal
        visible={!!offlineSummary}
        summary={offlineSummary}
        onApply={applyOfflineSummary}
        onDismiss={clearOfflineSummary}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  recruitSection: {
    marginBottom: theme.spacing.md,
  },
  listContent: {
    paddingBottom: theme.spacing.xl,
  },
});
