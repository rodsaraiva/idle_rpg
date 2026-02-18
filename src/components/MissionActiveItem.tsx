import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ActiveMission } from '../types';
import { MISSIONS } from '../constants/missions';
import { useGame } from '../hooks/useGame';
import { theme } from '../theme';

interface Props {
  mission: ActiveMission;
}

function formatMs(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const ss = Math.floor(total % 60)
    .toString()
    .padStart(2, '0');
  return `${mm}:${ss}`;
}

export function MissionActiveItem({ mission }: Props) {
  const { state } = useGame();
  const template = MISSIONS.find((t) => t.id === mission.templateId);
  const heroes = state.heroes.filter((h) => mission.heroIds.includes(h.id));

  const progress = useMemo(() => {
    if (!template) return 0;
    return Math.max(0, 1 - mission.remainingMs / template.durationMs);
  }, [mission.remainingMs, template]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{template?.name ?? mission.templateId}</Text>
        <Text style={styles.time}>{formatMs(mission.remainingMs)}</Text>
      </View>
      <View style={styles.heroesRow}>
        {heroes.map((h) => (
          <Text key={h.id} style={styles.heroName}>
            {h.name}
          </Text>
        ))}
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${Math.min(100, Math.round(progress * 100))}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textPrimary,
  },
  time: {
    color: theme.colors.textSecondary,
  },
  heroesRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  heroName: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginRight: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
});

