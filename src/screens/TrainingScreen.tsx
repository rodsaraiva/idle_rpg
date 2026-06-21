import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { AnimatedGold } from '../components/AnimatedGold';
import { Banner } from '../components/ui/Banner';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { Icon, IconName } from '../components/ui/Icon';
import { PressableScale } from '../components/ui/PressableScale';
import { EmptyState } from '../components/ui/EmptyState';
import { HeroCard } from '../components/HeroCard';
import { HeroDetailsModal } from '../components/HeroDetailsModal';
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

  const [selectedHero, setSelectedHero] = React.useState<Hero | null>(null);

  if (!isLoaded) {
    return <LoadingScreen message="Carregando treinamento..." />;
  }

  const renderHero = ({ item }: { item: Hero }) => (
    <HeroCard
      hero={item}
      actions={getHeroActions(item)}
      showSecondaryStats={false}
      onPress={setSelectedHero}
    />
  );

  const BatchButton = ({ title, icon, color, onPress }: { title: string; icon: IconName; color: string; onPress: () => void }) => (
    <PressableScale style={[styles.batchButton, { borderColor: color }]} onPress={onPress}>
      <Icon name={icon} size={20} color={color} />
      <Text style={styles.batchText}>{title}</Text>
    </PressableScale>
  );

  return (
    <ScreenContainer
      scroll={false}
      banner={
        <Banner
          title="Campo de Treino"
          subtitle={`${state.heroes.length} herói${state.heroes.length !== 1 ? 's' : ''} em prontidão`}
          right={<AnimatedGold gold={state.gold} />}
        />
      }
    >
      <View style={styles.batchSection}>
        <Text style={styles.sectionTitle}>Ordens Coletivas</Text>
        <View style={styles.batchRow}>
          <BatchButton
            title="HP"
            icon="heart"
            color={theme.colors.statHp}
            onPress={() => setAllHeroesTask(HeroTask.TRAIN_HP)}
          />
          <BatchButton
            title="ATK"
            icon="sword"
            color={theme.colors.statAtk}
            onPress={() => setAllHeroesTask(HeroTask.TRAIN_ATK)}
          />
          <BatchButton
            title="MP"
            icon="stat-mp"
            color={theme.colors.statMp}
            onPress={() => setAllHeroesTask(HeroTask.TRAIN_MP)}
          />
        </View>
      </View>

      {state.heroes.length === 0 ? (
        <EmptyState
          icon="castle"
          title="Campo de Treino Vazio"
          subtitle="Não há ninguém aqui para treinar. Recrute heróis na loja!"
        />
      ) : (
        <FlatList
          data={state.heroes}
          renderItem={renderHero}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <OfflineSummaryModal
        visible={!!offlineSummary}
        summary={offlineSummary}
        onApply={applyOfflineSummary}
        onDismiss={clearOfflineSummary}
      />
      <HeroDetailsModal
        visible={!!selectedHero}
        hero={selectedHero}
        onClose={() => setSelectedHero(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  batchSection: {
    marginVertical: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.type.label,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  batchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  batchButton: {
    flex: 1,
    backgroundColor: theme.colors.surfaceRaised,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  batchText: {
    ...theme.type.label,
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  listContent: {
    paddingBottom: theme.spacing.xl,
  },
});
