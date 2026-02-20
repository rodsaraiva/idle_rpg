import React from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useGame } from '../hooks/useGame';
import { theme } from '../theme';
import { getRecruitCost } from '../utils/math';
import { GoldDisplay } from '../components/GoldDisplay';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { HeroCard } from '../components/HeroCard';
import { useNavigation } from '@react-navigation/native';
import { OfflineSummaryModal } from '../components/OfflineSummaryModal';
import { Hero, HeroTask } from '../types';

export function TrainingScreen() {
  const { state, setHeroTask, isLoaded, offlineSummary, clearOfflineSummary, applyOfflineSummary } = useGame();
  const navigation = useNavigation<any>();

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

  const setAll = (task: HeroTask) => {
    state.heroes.forEach(h => setHeroTask(h.id, task));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text />
        </View>
        {/* ScreenHeader */}
        <ScreenHeader
          title="Treinamento"
          subtitle={`${state.heroes.length} herói${state.heroes.length !== 1 ? 's' : ''}`}
          right={<GoldDisplay gold={state.gold} />}
        />

        {/* Recruit moved to Loja — no recruit button here */}

        <View style={styles.batchRow}>
          <TouchableOpacity style={styles.batchButton} onPress={() => setAll(HeroTask.TRAIN_HP)}>
            <Text style={styles.batchText}>Treinar HP (Todos)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.batchButton} onPress={() => setAll(HeroTask.TRAIN_ATK)}>
            <Text style={styles.batchText}>Treinar ATK (Todos)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.batchButton} onPress={() => setAll(HeroTask.TRAIN_MP)}>
            <Text style={styles.batchText}>Treinar MP (Todos)</Text>
          </TouchableOpacity>
        </View>

        {state.heroes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏰</Text>
            <Text style={styles.emptyTitle}>Sua guilda está vazia</Text>
            <Text style={styles.emptySubtitle}>Recrute seu primeiro herói para começar a aventura!</Text>
            <TouchableOpacity
              style={styles.shopButton}
              onPress={() => navigation.navigate('Loja')}
              accessibilityRole="button"
              accessibilityLabel="Ir para a loja"
            >
              <Text style={styles.shopButtonText}>Ir à Loja</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList data={state.heroes} renderItem={renderHero} keyExtractor={keyExtractor} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} />
        )}
      </View>
      <OfflineSummaryModal visible={!!offlineSummary} summary={offlineSummary} onApply={applyOfflineSummary} onDismiss={clearOfflineSummary} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, paddingHorizontal: theme.spacing.md },
  loadingContainer: { flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', gap: theme.spacing.md },
  loadingText: { color: theme.colors.textSecondary, fontSize: theme.fontSize.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.md },
  title: { fontSize: theme.fontSize.xxl, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary },
  subtitle: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 2 },
  recruitSection: { marginBottom: theme.spacing.md },
  batchRow: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  batchButton: { flex: 1, backgroundColor: theme.colors.surfaceLight, padding: theme.spacing.sm, borderRadius: theme.borderRadius.sm, alignItems: 'center' },
  batchText: { color: theme.colors.textPrimary, fontWeight: theme.fontWeight.semibold, fontSize: theme.fontSize.sm },
  listContent: { paddingBottom: theme.spacing.xl },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyIcon: { fontSize: 64, marginBottom: theme.spacing.md },
  emptyTitle: { fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, marginBottom: theme.spacing.sm },
  emptySubtitle: { fontSize: theme.fontSize.md, color: theme.colors.textSecondary, textAlign: 'center', paddingHorizontal: theme.spacing.xl },
  shopButton: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
  },
  shopButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: theme.fontWeight.bold,
  },
});

