import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { ActiveMission } from '../types';
import { MISSIONS } from '../constants/missions';
import { useGame } from '../hooks/useGame';
import { theme } from '../theme';
import { on, off, FEEDBACK_EVENTS } from '../services/feedback';

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
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    const unsub = on('BATTLE_HIGHLIGHT', (p: any) => {
      if (!p || !p.id) return;
      setHighlighted(p.id);
      const t = p.duration ?? 400;
      setTimeout(() => setHighlighted((cur) => (cur === p.id ? null : cur)), t);
    });
    return () => unsub();
  }, []);

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
          <View key={h.id} style={[styles.heroMini, highlighted === h.id ? styles.highlight : null]}>
            <Text style={styles.heroMiniName}>{h.name}</Text>
            <View style={styles.hpRow}>
              <View style={styles.hpBar}>
                <View style={[styles.hpFill, { width: `${Math.max(0, Math.min(100, Math.round(((h.hpCurrent ?? 0) / (h.hpMax ?? 1)) * 100)))}%` }]} />
              </View>
              <Text style={styles.hpText}>
                {Math.floor(h.hpCurrent ?? 0)}/{Math.floor(h.hpMax ?? 0)}
              </Text>
            </View>
            <Text style={styles.typeText}>{h.attackType === 'RANGED' ? 'R' : 'M'}</Text>
          </View>
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
  heroMini: {
    backgroundColor: theme.colors.surfaceLight,
    padding: 6,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginRight: 8,
    minWidth: 88,
  },
  heroMiniName: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: 4,
  },
  hpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hpBar: {
    width: 64,
    height: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 6,
    overflow: 'hidden',
  },
  hpFill: {
    height: '100%',
    backgroundColor: theme.colors.hp,
  },
  hpText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
  },
  typeText: {
    marginTop: 4,
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  highlight: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    ...Platform.select({
      web: {
        boxShadow: `0 0 8px ${theme.colors.primary}`,
      },
      default: {
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
      },
    }),
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

