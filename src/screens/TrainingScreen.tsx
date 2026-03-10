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
    return <LoadingScreen message="Carregando treinamento..." />;
  }

  const renderHero = ({ item }: { item: Hero }) => (
    <HeroCard
      hero={item}
      actions={getHeroActions(item)}
    />
  );

  const BatchButton = ({ title, icon, color, onPress }: { title: string; icon: string; color: string; onPress: () => void }) => (
    <TouchableOpacity 
      style={[styles.batchButton, { borderColor: color }]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.batchIcon}>{icon}</Text>
      <Text style={styles.batchText}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScreenHeader
          title="Campo de Treino"
          subtitle={`${state.heroes.length} herói${state.heroes.length !== 1 ? 's' : ''} em prontidão`}
          right={<GoldDisplay gold={state.gold} />}
        />

        <View style={styles.batchSection}>
          <Text style={styles.sectionTitle}>Ordens Coletivas</Text>
          <View style={styles.batchRow}>
            <BatchButton 
              title="HP" 
              icon="❤️" 
              color={theme.colors.hp} 
              onPress={() => setAllHeroesTask(HeroTask.TRAIN_HP)} 
            />
            <BatchButton 
              title="ATK" 
              icon="⚔️" 
              color={theme.colors.atk} 
              onPress={() => setAllHeroesTask(HeroTask.TRAIN_ATK)} 
            />
            <BatchButton 
              title="MP" 
              icon="🔮" 
              color={theme.colors.mp} 
              onPress={() => setAllHeroesTask(HeroTask.TRAIN_MP)} 
            />
          </View>
        </View>

        {state.heroes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>Campo de Treino Vazio</Text>
            <Text style={styles.emptySubtitle}>Não há ninguém aqui para treinar. Recrute heróis na loja!</Text>
            <TouchableOpacity
              style={styles.shopButton}
              onPress={() => navigation.navigate('Loja')}
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
  safeArea: { 
    flex: 1, 
    backgroundColor: theme.colors.background 
  },
  container: { 
    flex: 1, 
    paddingHorizontal: theme.spacing.md 
  },
  batchSection: {
    marginVertical: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  batchRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    gap: theme.spacing.sm, 
  },
  batchButton: { 
    flex: 1, 
    backgroundColor: theme.colors.surface, 
    padding: theme.spacing.sm, 
    borderRadius: 12, 
    alignItems: 'center',
    borderWidth: 1,
    elevation: 2,
    boxShadow: '0px 1px 2px rgba(0,0,0,0.1)',
  },
  batchIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  batchText: { 
    color: theme.colors.textPrimary, 
    fontWeight: '700', 
    fontSize: 10,
    textTransform: 'uppercase',
  },
  listContent: { 
    paddingBottom: theme.spacing.xl 
  },
  emptyState: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingBottom: 100 
  },
  emptyIcon: { 
    fontSize: 64, 
    marginBottom: theme.spacing.md 
  },
  emptyTitle: { 
    fontSize: theme.fontSize.xl, 
    fontWeight: theme.fontWeight.bold, 
    color: theme.colors.textPrimary, 
    marginBottom: theme.spacing.sm 
  },
  emptySubtitle: { 
    fontSize: theme.fontSize.md, 
    color: theme.colors.textSecondary, 
    textAlign: 'center', 
    paddingHorizontal: theme.spacing.xl 
  },
  shopButton: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
  },
  shopButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
