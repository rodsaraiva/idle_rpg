import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, Button, ScrollView } from 'react-native';
import { useGame } from '../hooks/useGame';
import { HeroTask } from '../types';
import { theme } from '../theme';
import { Hero } from '../types';
import { MISSIONS } from '../constants/missions';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';
import { HeroCard } from '../components/HeroCard';
import { MissionActiveItem } from '../components/MissionActiveItem';
import { MissionResultModal } from '../components/MissionResultModal';
import { MissionHeroSelectionModal } from '../components/MissionHeroSelectionModal';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { GoldDisplay } from '../components/GoldDisplay';

export function MissionsScreen() {
  const { state, isLoaded, dispatch } = useGame();

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando missões...</Text>
      </View>
    );
  }

  // modal state for choosing heroes after clicking "Enviar"
  const [selectionModalVisible, setSelectionModalVisible] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<{ templateId: string; minHeroes: number } | null>(null);

  // memoize hero lists to avoid unnecessary effect runs / re-renders
  const missionHeroes = React.useMemo(
    () => state.heroes.filter((h) => h.currentTask === HeroTask.MISSION),
    [state.heroes]
  );
  const selectableHeroes = React.useMemo(
    () => state.heroes.filter((h) => h.currentTask !== HeroTask.MISSION),
    [state.heroes]
  );

  const openSelectionModal = (templateId: string, minHeroes: number) => {
    setPendingTemplate({ templateId, minHeroes });
    setSelectionModalVisible(true);
  };

  const handleConfirmMission = (templateId: string, heroIds: string[]) => {
    if (!templateId) return;
    // validate again before dispatch
    const now = Date.now();
    const valid = heroIds.filter((id) =>
      selectableHeroes.some((h) => h.id === id && !(h.incapacitatedUntilMs && h.incapacitatedUntilMs > now))
    );
    if (valid.length < (pendingTemplate?.minHeroes ?? 0)) {
      emit(FEEDBACK_EVENTS.TOAST, { text: 'Alguns heróis não podem ir para missão (estão incapacitados ou já em missão)' });
      return;
    }
    dispatch({ type: 'START_MISSION', templateId, heroIds: valid });
    setSelectionModalVisible(false);
    setPendingTemplate(null);
  };

  const availableCount = selectableHeroes.filter((h) => !(h.incapacitatedUntilMs && h.incapacitatedUntilMs > Date.now())).length;

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
        <ScreenHeader
          title="Missões"
          subtitle={`Heróis em missão: ${missionHeroes.length}`}
          right={<GoldDisplay gold={state.gold} />}
        />

        <Text style={[styles.subtitle, { marginTop: 12 }]}>Missões disponíveis</Text>
        <Text style={[styles.subtitle, { marginTop: 6 }]}>Heróis disponíveis: {selectableHeroes.length}</Text>
        <FlatList
          data={MISSIONS}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: '700' }}>{item.name}</Text>
              <Text style={{ color: theme.colors.textSecondary }}>
                Min {item.minHeroes} • Recompensa {item.rewardMin}–{item.rewardMax}
              </Text>
              <View style={{ marginTop: 6 }}>
                <Button
                  title="Enviar"
                  onPress={() => openSelectionModal(item.id, item.minHeroes)}
                  disabled={availableCount < item.minHeroes}
                />
              </View>
            </View>
          )}
        />
        <MissionHeroSelectionModal
          visible={selectionModalVisible}
          onClose={() => {
            setSelectionModalVisible(false);
            setPendingTemplate(null);
          }}
          selectableHeroes={selectableHeroes}
          minHeroes={pendingTemplate?.minHeroes ?? 0}
          templateId={pendingTemplate?.templateId ?? ''}
          onConfirm={handleConfirmMission}
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

