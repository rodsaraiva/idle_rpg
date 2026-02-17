import React from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { useGame } from '../hooks/useGame';
import { HeroTask } from '../types';
import { theme } from '../theme';
import { Hero } from '../types';
import { getMissionGoldPerTick } from '../utils/math';

export function MissionsScreen() {
  const { state, isLoaded } = useGame();

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando missões...</Text>
      </View>
    );
  }

  const missionHeroes = state.heroes.filter(h => h.currentTask === HeroTask.MISSION);
  const goldPerSecond = missionHeroes.reduce((acc, h) => acc + getMissionGoldPerTick(h.atk), 0);

  const renderHero = ({ item }: { item: Hero }) => (
    <View style={styles.heroRow}>
      <Text style={styles.heroName}>{item.name}</Text>
      <Text style={styles.heroInfo}>ATK {item.atk.toFixed(1)}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Missões</Text>
        <Text style={styles.subtitle}>Heróis em missão: {missionHeroes.length}</Text>
        <Text style={styles.subtitle}>Ganho estimado por segundo: 💰 {Math.floor(goldPerSecond)}</Text>

        <FlatList data={missionHeroes} renderItem={renderHero} keyExtractor={(i) => i.id} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.md },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: theme.colors.textSecondary },
  title: { fontSize: theme.fontSize.xxl, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary },
  subtitle: { color: theme.colors.textSecondary, marginBottom: theme.spacing.md },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.surfaceLight },
  heroName: { color: theme.colors.textPrimary, fontWeight: theme.fontWeight.semibold },
  heroInfo: { color: theme.colors.textSecondary },
});

