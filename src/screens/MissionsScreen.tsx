import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { MISSIONS } from '../constants/missions';
import { MissionActiveItem } from '../components/MissionActiveItem';
import { MissionResultModal } from '../components/MissionResultModal';
import { MissionHeroSelectionModal } from '../components/MissionHeroSelectionModal';
import { Banner } from '../components/ui/Banner';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { AnimatedGold } from '../components/AnimatedGold';
import { EmptyState } from '../components/ui/EmptyState';
import { useMissions } from '../hooks/useMissions';
import { MissionListItem } from '../components/MissionListItem';
import { MissionHeroRow } from '../components/MissionHeroRow';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { MissionPlaybackModal } from '../components/MissionPlaybackModal';

export function MissionsScreen() {
  const {
    state,
    isLoaded,
    missionHeroes,
    selectableHeroes,
    selectionModalVisible,
    pendingTemplate,
    activePlaybackMission,
    availableCount,
    openSelectionModal,
    closeSelectionModal,
    handleConfirmMission,
    openPlaybackModal,
    closePlaybackModal,
  } = useMissions();

  if (!isLoaded) {
    return <LoadingScreen message="Carregando missões..." />;
  }

  return (
    <ScreenContainer
      banner={
        <Banner
          title="Quadro de Missões"
          subtitle={`${missionHeroes.length} heróis em campo`}
          right={<AnimatedGold gold={state.gold} />}
        />
      }
    >
      <MissionResultModal />

      {state.activeMissions && state.activeMissions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Missões em Andamento</Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>{state.activeMissions.length}</Text>
            </View>
          </View>
          {state.activeMissions.map((m) => (
            <MissionActiveItem
              key={m.id}
              mission={m}
              onWatch={openPlaybackModal}
            />
          ))}
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Missões Disponíveis</Text>
          <Text style={styles.availableCount}>{availableCount} heróis prontos</Text>
        </View>

        <View style={styles.missionList}>
          {MISSIONS.map((mission) => (
            <MissionListItem
              key={mission.id}
              mission={mission}
              onSend={openSelectionModal}
              disabled={availableCount < mission.minHeroes}
            />
          ))}
        </View>
      </View>

      <MissionHeroSelectionModal
        visible={selectionModalVisible}
        onClose={closeSelectionModal}
        selectableHeroes={selectableHeroes}
        minHeroes={pendingTemplate?.minHeroes ?? 0}
        templateId={pendingTemplate?.templateId ?? ''}
        onConfirm={handleConfirmMission}
      />

      <MissionPlaybackModal
        visible={!!activePlaybackMission}
        onClose={closePlaybackModal}
        mission={activePlaybackMission}
      />

      {missionHeroes.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equipe em Campo</Text>
          <View style={styles.heroGrid}>
            {missionHeroes.map((hero) => (
              <MissionHeroRow
                key={hero.id}
                hero={hero}
                perHeroGold={state.perHeroGold}
              />
            ))}
          </View>
        </View>
      ) : (
        <EmptyState
          icon="map-marker-path"
          title="Nenhum herói em campo"
          subtitle="Envie heróis em missões para ganhar ouro."
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    gap: 8,
  },
  sectionTitle: {
    ...theme.type.h2,
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeBadge: {
    backgroundColor: theme.colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: theme.colors.bgDeep,
    fontSize: 12,
    fontWeight: 'bold',
  },
  availableCount: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 'auto',
  },
  missionList: {
    gap: 12,
  },
  heroGrid: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: 16,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
});
