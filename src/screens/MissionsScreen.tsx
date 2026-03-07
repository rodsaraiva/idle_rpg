import React from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { theme } from '../theme';
import { MISSIONS } from '../constants/missions';
import { MissionActiveItem } from '../components/MissionActiveItem';
import { MissionResultModal } from '../components/MissionResultModal';
import { MissionHeroSelectionModal } from '../components/MissionHeroSelectionModal';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { GoldDisplay } from '../components/GoldDisplay';
import { useMissions } from '../hooks/useMissions';
import { MissionListItem } from '../components/MissionListItem';
import { MissionHeroRow } from '../components/MissionHeroRow';
import { LoadingScreen } from '../components/ui/LoadingScreen';

export function MissionsScreen() {
  const {
    state,
    isLoaded,
    missionHeroes,
    selectableHeroes,
    selectionModalVisible,
    pendingTemplate,
    availableCount,
    openSelectionModal,
    closeSelectionModal,
    handleConfirmMission,
  } = useMissions();

  if (!isLoaded) {
    return <LoadingScreen message="Carregando missões..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <MissionResultModal />
        <ScreenHeader
          title="Missões"
          subtitle={`Heróis em missão: ${missionHeroes.length}`}
          right={<GoldDisplay gold={state.gold} />}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Missões disponíveis</Text>
          <Text style={styles.sectionSubtitle}>Heróis disponíveis: {availableCount}</Text>
          {MISSIONS.map((mission) => (
            <MissionListItem
              key={mission.id}
              mission={mission}
              onSend={openSelectionModal}
              disabled={availableCount < mission.minHeroes}
            />
          ))}
        </View>

        <MissionHeroSelectionModal
          visible={selectionModalVisible}
          onClose={closeSelectionModal}
          selectableHeroes={selectableHeroes}
          minHeroes={pendingTemplate?.minHeroes ?? 0}
          templateId={pendingTemplate?.templateId ?? ''}
          onConfirm={handleConfirmMission}
        />

        {missionHeroes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Heróis em missão</Text>
            {missionHeroes.map((hero) => (
              <MissionHeroRow 
                key={hero.id} 
                hero={hero} 
                perHeroGold={state.perHeroGold} 
              />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Missões ativas</Text>
          {state.activeMissions && state.activeMissions.length > 0 ? (
            state.activeMissions.map((m) => (
              <MissionActiveItem key={m.id} mission={m} />
            ))
          ) : (
            <Text style={styles.emptyText}>Nenhuma missão ativa</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: theme.colors.background 
  },
  container: { 
    padding: theme.spacing.md 
  },
  section: {
    marginTop: theme.spacing.lg,
  },
  sectionTitle: { 
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary, 
    marginBottom: 4 
  },
  sectionSubtitle: { 
    color: theme.colors.textSecondary, 
    marginBottom: theme.spacing.md,
    fontSize: 14,
  },
  emptyText: { 
    color: theme.colors.textSecondary, 
    marginTop: theme.spacing.sm,
    fontStyle: 'italic',
  },
});
