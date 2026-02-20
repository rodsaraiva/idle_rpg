import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useGame } from '../hooks/useGame';
import { theme } from '../theme';
import { getRecruitCost } from '../utils/math';
import { GoldDisplay } from '../components/GoldDisplay';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { HeroCard } from '../components/HeroCard';
import { RecruitButton } from '../components/RecruitButton';
import { OfflineSummaryModal } from '../components/OfflineSummaryModal';
import { Hero, HeroTask } from '../types';

export function GuildScreen() {
  const { state, setHeroTask, recruitHero, isLoaded, offlineSummary, clearOfflineSummary } =
    useGame();
  const { applyOfflineSummary } = useGame();

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando guilda...</Text>
      </View>
    );
  }

  const nextRecruitCost = getRecruitCost(state.heroesRecruited);
  const canAfford = state.gold >= nextRecruitCost;

  const renderHero = ({ item }: { item: Hero }) => (
    <HeroCard
      hero={item}
      actions={[
        {
          label: 'Treinar HP',
          isActive: item.currentTask === HeroTask.TRAIN_HP,
          color: theme.colors.hp,
          onPress: () => setHeroTask(item.id, HeroTask.TRAIN_HP),
        },
        {
          label: 'Treinar ATK',
          isActive: item.currentTask === HeroTask.TRAIN_ATK,
          color: theme.colors.atk,
          onPress: () => setHeroTask(item.id, HeroTask.TRAIN_ATK),
        },
        {
          label: 'Treinar MP',
          isActive: item.currentTask === HeroTask.TRAIN_MP,
          color: theme.colors.mp,
          onPress: () => setHeroTask(item.id, HeroTask.TRAIN_MP),
        },
        {
          label: 'Descansar',
          isActive: item.currentTask === HeroTask.IDLE,
          color: theme.colors.textMuted,
          onPress: () => setHeroTask(item.id, HeroTask.IDLE),
        },
      ]}
    />
  );

  const keyExtractor = (item: Hero) => item.id;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <View style={styles.container}>
        <ScreenHeader
          title="Guilda"
          subtitle={`${state.heroes.length} herói${state.heroes.length !== 1 ? 's' : ''}`}
          right={<GoldDisplay gold={state.gold} />}
        />

        {/* Botão de Recrutamento */}
        <View style={styles.recruitSection}>
          <RecruitButton
            cost={nextRecruitCost}
            canAfford={canAfford}
            onPress={recruitHero}
          />
        </View>

        {/* Lista de Heróis */}
        {state.heroes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏰</Text>
            <Text style={styles.emptyTitle}>Sua guilda está vazia</Text>
            <Text style={styles.emptySubtitle}>
              Recrute seu primeiro herói para começar a aventura!
            </Text>
          </View>
        ) : (
          <FlatList
            data={state.heroes}
            renderItem={renderHero}
            keyExtractor={keyExtractor}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  recruitSection: {
    marginBottom: theme.spacing.md,
  },
  listContent: {
    paddingBottom: theme.spacing.xl,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
});
