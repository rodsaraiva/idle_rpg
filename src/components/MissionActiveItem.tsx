import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { ActiveMission } from '../types';
import { MISSIONS } from '../constants/missions';
import { useGame } from '../hooks/useGame';
import { theme } from '../theme';
import { on } from '../services/feedback';
import { CombatantCard } from './CombatantCard';

interface Props {
  mission: ActiveMission;
  onWatch?: (id: string) => void;
}

export function MissionActiveItem({ mission, onWatch }: Props) {
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
    const totalActions = (mission.scheduledActions || []).length;
    if (totalActions === 0) return 0;
    const applied = (mission.scheduledActions || []).filter((s: any) => s.applied).length;
    return Math.max(0, Math.min(1, applied / totalActions));
  }, [mission.scheduledActions]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{template?.name ?? mission.templateId}</Text>
        <TouchableOpacity 
          style={styles.watchButton} 
          onPress={() => onWatch?.(mission.id)}
        >
          <Text style={styles.watchButtonText}>👁 Assistir</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.battleHeader}>
        <Text style={styles.battleHeaderText}>Aliados</Text>
        <Text style={styles.battleHeaderText}>VS</Text>
        <Text style={styles.battleHeaderText}>Inimigos</Text>
      </View>

      <View style={styles.battleRow}>
        <View style={styles.columnLeft}>
          {heroes.map((h) => (
            <CombatantCard
              key={h.id}
              id={h.id}
              name={h.name}
              hp={h.hpCurrent ?? 0}
              maxHp={h.hpMax ?? 0}
              atk={h.atk}
              mp={h.mp}
              defense={h.defense}
              agility={h.agility}
              crit={h.crit}
              attackType={h.attackType}
              align="left"
              highlighted={highlighted === h.id}
            />
          ))}
        </View>

        <View style={styles.columnRight}>
          {(mission.enemiesState || []).map((e: any) => (
            <CombatantCard
              key={e.id}
              id={e.id}
              name={e.id}
              hp={e.hp ?? 0}
              maxHp={e.maxHp ?? e.hp ?? 1}
              atk={e.atk}
              mp={e.mp}
              defense={e.defense}
              agility={e.agility}
              crit={e.crit}
              attackType={e.attackType}
              align="right"
              highlighted={highlighted === e.id}
            />
          ))}
        </View>
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
  watchButton: {
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  watchButtonText: {
    color: theme.colors.primaryLight,
    fontSize: 11,
    fontWeight: 'bold',
  },
  time: {
    color: theme.colors.textSecondary,
  },
  battleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  columnLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 8,
  },
  columnRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    flex: 1,
    marginLeft: 8,
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
    boxShadow: `0px 0px 8px ${theme.colors.primary}`,
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
    borderRadius: 6,
  },
  battleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  battleHeaderText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
});

