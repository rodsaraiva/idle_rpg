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
import { HeroCard } from '../components/HeroCard';
import { RecruitButton } from '../components/RecruitButton';
import { Hero } from '../types';

export function GuildScreen() {
  const { state, setHeroTask, recruitHero, isLoaded } = useGame();

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
    <HeroCard hero={item} onSetTask={setHeroTask} />
  );

  const keyExtractor = (item: Hero) => item.id;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Guilda</Text>
            <Text style={styles.subtitle}>
              {state.heroes.length} herói{state.heroes.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <GoldDisplay gold={state.gold} />
        </View>

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
