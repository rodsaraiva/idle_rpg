import React from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { useGame } from '../hooks/useGame';
import { HeroTask } from '../types';
import { theme } from '../theme';
import { Hero } from '../types';
import { MISSIONS } from '../constants/missions';
import { Button } from 'react-native';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';

export function MissionsScreen() {
  const { state, isLoaded, dispatch } = useGame();

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando missões...</Text>
      </View>
    );
  }

  const missionHeroes = state.heroes.filter((h) => h.currentTask === HeroTask.MISSION);
  const idleHeroes = state.heroes.filter((h) => h.currentTask === HeroTask.IDLE);

  const startMission = (templateId: string, minHeroes: number) => {
    if (idleHeroes.length < minHeroes) {
      // use centralized feedback (works on web and native)
      emit(FEEDBACK_EVENTS.TOAST, { text: `Heróis insuficientes — precisa de ${minHeroes}` });
      return;
    }
    const selected = idleHeroes.slice(0, minHeroes).map((h) => h.id);
    dispatch({ type: 'START_MISSION', templateId, heroIds: selected });
  };

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

        <Text style={[styles.subtitle, { marginTop: 12 }]}>Missões disponíveis</Text>
        <Text style={[styles.subtitle, { marginTop: 6 }]}>Heróis disponíveis: {idleHeroes.length}</Text>
        <FlatList
          data={MISSIONS}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: '700' }}>{item.name}</Text>
              <Text style={{ color: theme.colors.textSecondary }}>
                Min {item.minHeroes} • Duração {Math.floor(item.durationMs / 1000)}s • Recompensa {item.rewardMin}–{item.rewardMax}
              </Text>
              <View style={{ marginTop: 6 }}>
                <Button
                  title="Enviar"
                  onPress={() => startMission(item.id, item.minHeroes)}
                  disabled={idleHeroes.length < item.minHeroes}
                />
              </View>
            </View>
          )}
        />

        <Text style={[styles.subtitle, { marginTop: 12 }]}>Heróis em missão</Text>
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

