import React from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { theme } from '../theme';
import { GoldDisplay } from '../components/GoldDisplay';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { HeroCard } from '../components/HeroCard';
import { useNavigation } from '@react-navigation/native';
import { OfflineSummaryModal } from '../components/OfflineSummaryModal';
import { Hero, HeroTask } from '../types';
import { useTraining } from '../hooks/useTraining';
import { LoadingScreen } from '../components/ui/LoadingScreen';

export function TrainingScreen() {
  const {
    state,
    isLoaded,
    offlineSummary,
    setAllHeroesTask,
    getHeroActions,
    applyOfflineSummary,
    clearOfflineSummary,
  } = useTraining();
  
  const navigation = useNavigation<any>();

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
      <View style={styles.container}>
        <ScreenHeader
          title="Treinamento"
          subtitle={`${state.heroes.length} herói${state.heroes.length !== 1 ? 's' : ''}`}
          right={<GoldDisplay gold={state.gold} />}
        />

        <View style={styles.batchRow}>
          <TouchableOpacity style={styles.batchButton} onPress={() => setAllHeroesTask(HeroTask.TRAIN_HP)}>
            <Text style={styles.batchText}>Treinar HP (Todos)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.batchButton} onPress={() => setAllHeroesTask(HeroTask.TRAIN_ATK)}>
            <Text style={styles.batchText}>Treinar ATK (Todos)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.batchButton} onPress={() => setAllHeroesTask(HeroTask.TRAIN_MP)}>
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
          <FlatList 
            data={state.heroes} 
            renderItem={renderHero} 
            keyExtractor={(item) => item.id} 
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
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, paddingHorizontal: theme.spacing.md },
  batchRow: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm, marginBottom: theme.spacing.md, marginTop: theme.spacing.md },
  batchButton: { flex: 1, backgroundColor: theme.colors.surfaceLight, padding: theme.spacing.sm, borderRadius: theme.borderRadius.sm, alignItems: 'center' },
  batchText: { color: theme.colors.textPrimary, fontWeight: theme.fontWeight.semibold, fontSize: 12 },
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
