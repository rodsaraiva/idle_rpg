import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, Button, ScrollView } from 'react-native';
import { useGame } from '../hooks/useGame';
import { HeroTask } from '../types';
import { theme } from '../theme';
import { Hero } from '../types';
import { MISSIONS } from '../constants/missions';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';
import { HeroSelectableRow } from '../components/HeroSelectableRow';
import { MissionActiveItem } from '../components/MissionActiveItem';
import { MissionResultModal } from '../components/MissionResultModal';

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    // remove selected ids that are no longer idle
    setSelectedIds((s) => s.filter((id) => idleHeroes.some((h) => h.id === id)));
  }, [idleHeroes]);

  const startMission = (templateId: string, minHeroes: number) => {
    if (selectedIds.length < minHeroes) {
      emit(FEEDBACK_EVENTS.TOAST, { text: `Selecione ao menos ${minHeroes} herói(s)` });
      return;
    }
    // ensure selected are still idle
    const valid = selectedIds.filter((id) => idleHeroes.some((h) => h.id === id));
    if (valid.length < minHeroes) {
      emit(FEEDBACK_EVENTS.TOAST, { text: 'Alguns heróis não estão mais disponíveis' });
      return;
    }
    dispatch({ type: 'START_MISSION', templateId, heroIds: valid });
    // clear selections that were sent
    setSelectedIds((s) => s.filter((id) => !valid.includes(id)));
  };

  const renderHero = ({ item }: { item: Hero }) => (
    <View style={styles.heroRow}>
      <Text style={styles.heroName}>{item.name}</Text>
      <Text style={styles.heroInfo}>
        HP {Math.floor(item.hpCurrent)}/{Math.floor(item.hpMax)} • ATK {Math.floor(item.atk)} • MP {Math.floor(item.mp)}
      </Text>
      <Text style={styles.heroInfo}>Total ganho: 💰 {Math.floor(state.perHeroGold?.[item.id] ?? 0)}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <MissionResultModal />
        <Text style={styles.title}>Missões</Text>
        <Text style={styles.subtitle}>Heróis em missão: {missionHeroes.length}</Text>

        <Text style={[styles.subtitle, { marginTop: 12 }]}>Missões disponíveis</Text>
        <Text style={[styles.subtitle, { marginTop: 6 }]}>Heróis disponíveis: {idleHeroes.length}</Text>
        <View style={{ marginTop: 8, marginBottom: 8 }}>
          {idleHeroes.map((h) => (
            <HeroSelectableRow
              key={h.id}
              hero={h}
              selected={selectedIds.includes(h.id)}
              disabled={false}
              onToggle={(id) =>
                setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
              }
            />
          ))}
        </View>
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

        <Text style={[styles.subtitle, { marginTop: 12 }]}>Missões ativas</Text>
        {state.activeMissions && state.activeMissions.length > 0 ? (
          state.activeMissions.map((m) => <MissionActiveItem key={m.id} mission={m} />)
        ) : (
          <Text style={{ color: theme.colors.textSecondary, marginTop: 6 }}>Nenhuma missão ativa</Text>
        )}
      </ScrollView>
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

