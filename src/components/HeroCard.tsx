import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Hero, HeroTask } from '../types';
import { theme } from '../theme';
import { StatBar } from './StatBar';
import { TaskButton } from './TaskButton';
import { AttributeProgress } from './AttributeProgress';
import { BASE_TRAIN_TIME_MS, TRAIN_INFLATION_FACTOR } from '../constants/game';
import { CLASS_DEFS } from '../constants/classes';

import { HPBar } from './HPBar';

export interface HeroCardAction {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
  isActive?: boolean;
}

interface HeroCardProps {
  hero: Hero;
  variant?: 'compact' | 'detailed';
  actions?: HeroCardAction[];
  selected?: boolean;
  showSecondaryStats?: boolean;
  onToggle?: (id: string) => void;
  onSetTask?: (heroId: string, task: HeroTask) => void;
  onPress?: (hero: Hero) => void;
}

const TASK_LABEL_MAP: Record<HeroTask, string> = {
  [HeroTask.IDLE]: '💤 Ocioso',
  [HeroTask.TRAIN_HP]: '❤️ Treinando HP',
  [HeroTask.TRAIN_ATK]: '⚔️ Treinando ATK',
  [HeroTask.TRAIN_MP]: '🔮 Treinando MP',
  [HeroTask.INFIRMARY]: '🩺 Enfermaria',
  [HeroTask.MISSION]: '🪙 Em Missão',
};

export function HeroCard({
  hero,
  variant = 'detailed',
  actions = [],
  selected = false,
  showSecondaryStats = true,
  onToggle,
  onSetTask,
  onPress,
}: HeroCardProps) {
  if (variant === 'compact') {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.compactRow}
        onPress={() => onToggle?.(hero.id)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        <View style={[styles.checkbox, selected ? styles.checked : null]}>
          {selected ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
        <View style={styles.compactInfo}>
          <Text style={styles.name}>{hero.name}</Text>
          <Text style={styles.classLabel}>{CLASS_DEFS[hero.classId ?? undefined]?.displayName ?? ''}</Text>
          <Text style={styles.smallStats}>
            HP {Math.floor(hero.hpCurrent)}/{Math.floor(hero.hpMax)} • ATK {Math.floor(hero.atk)}
          </Text>
          <Text style={styles.statusText}>{TASK_LABEL_MAP[hero.currentTask]}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const defaultActions: HeroCardAction[] = onSetTask
    ? (() => {
        const isLocked = hero.currentTask === HeroTask.MISSION;
        return [
          {
            label: 'Treinar HP',
            isActive: hero.currentTask === HeroTask.TRAIN_HP,
            color: theme.colors.hp,
            disabled: isLocked,
            onPress: () => !isLocked && onSetTask(hero.id, HeroTask.TRAIN_HP),
          },
          {
            label: 'Treinar ATK',
            isActive: hero.currentTask === HeroTask.TRAIN_ATK,
            color: theme.colors.atk,
            disabled: isLocked,
            onPress: () => !isLocked && onSetTask(hero.id, HeroTask.TRAIN_ATK),
          },
          {
            label: 'Treinar MP',
            isActive: hero.currentTask === HeroTask.TRAIN_MP,
            color: theme.colors.mp,
            disabled: isLocked,
            onPress: () => !isLocked && onSetTask(hero.id, HeroTask.TRAIN_MP),
          },
          {
            label: 'Descansar',
            isActive: hero.currentTask === HeroTask.IDLE,
            color: theme.colors.textMuted,
            disabled: isLocked,
            onPress: () => !isLocked && onSetTask(hero.id, HeroTask.IDLE),
          },
        ];
      })()
    : [];

  const renderedActions = actions.length > 0 ? actions : defaultActions;

  const getTrainTimePerPoint = (statKey: 'hp' | 'atk' | 'mp') => {
    const classSpeed = hero.classId ? (CLASS_DEFS[hero.classId]?.trainSpeed?.[statKey] ?? 1) : 1;
    const count = hero.trainingCount?.[statKey] ?? 0;
    return (BASE_TRAIN_TIME_MS * Math.pow(1 + TRAIN_INFLATION_FACTOR, count)) / classSpeed;
  };

  const CardContent = (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.name}>{hero.name}</Text>
          <Text style={styles.classLabel}>{CLASS_DEFS[hero.classId ?? undefined]?.displayName ?? ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.taskBadge}>{TASK_LABEL_MAP[hero.currentTask]}</Text>
          {hero.incapacitatedUntilMs && hero.incapacitatedUntilMs > Date.now() ? (
            <Text style={styles.incapText}>Incapacitado</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.hpArea} accessibilityLabel={`HP ${Math.floor(hero.hpCurrent)}/${Math.floor(hero.hpMax)}`}>
          <HPBar current={hero.hpCurrent} max={hero.hpMax} />
        </View>

        <View style={styles.statItem} accessibilityLabel={`ATK ${Math.floor(hero.atk)}`}>
          <Text style={styles.statIcon}>⚔️</Text>
          <Text style={styles.statValue}>{Math.floor(hero.atk)}</Text>
        </View>

        <View style={styles.statItem} accessibilityLabel={`MP ${Math.floor(hero.mp)}`}>
          <Text style={styles.statIcon}>🔮</Text>
          <Text style={styles.statValue}>{Math.floor(hero.mp)}</Text>
        </View>
      </View>

      {showSecondaryStats && (
        <View style={styles.secondaryStatsRow}>
          <View style={styles.statItem} accessibilityLabel={`DEF ${Math.floor(hero.defense || 0)}`}>
            <Text style={styles.statIcon}>🛡️</Text>
            <Text style={styles.statValue}>{Math.floor(hero.defense || 0)}</Text>
          </View>
          <View style={styles.statItem} accessibilityLabel={`CRIT ${Math.floor(hero.crit || 0)}%`}>
            <Text style={styles.statIcon}>🎯</Text>
            <Text style={styles.statValue}>{Math.floor(hero.crit || 0)}%</Text>
          </View>
          <View style={styles.statItem} accessibilityLabel={`AGI ${Math.floor(hero.agility || 0)}`}>
            <Text style={styles.statIcon}>🏃</Text>
            <Text style={styles.statValue}>{Math.floor(hero.agility || 0)}</Text>
          </View>
        </View>
      )}

      {hero.currentTask === HeroTask.TRAIN_HP && hero.trainingProgressMs ? (
        <AttributeProgress
          fraction={(hero.trainingProgressMs.hp ?? 0) / getTrainTimePerPoint('hp')}
          color={theme.colors.hp}
          label="Progresso HP"
        />
      ) : null}
      {hero.currentTask === HeroTask.TRAIN_ATK && hero.trainingProgressMs ? (
        <AttributeProgress
          fraction={(hero.trainingProgressMs.atk ?? 0) / getTrainTimePerPoint('atk')}
          color={theme.colors.atk}
          label="Progresso ATK"
        />
      ) : null}
      {hero.currentTask === HeroTask.TRAIN_MP && hero.trainingProgressMs ? (
        <AttributeProgress
          fraction={(hero.trainingProgressMs.mp ?? 0) / getTrainTimePerPoint('mp')}
          color={theme.colors.mp}
          label="Progresso MP"
        />
      ) : null}

      <View style={styles.actions}>
        {renderedActions.map((a, i) => (
          <TaskButton
            key={`${a.label}-${i}`}
            label={a.label}
            isActive={!!a.isActive}
            color={a.color ?? theme.colors.primary}
            onPress={a.onPress}
            disabled={!!a.disabled}
          />
        ))}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(hero)}>
        {CardContent}
      </TouchableOpacity>
    );
  }

  return CardContent;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
    // Subtle shadow for depth
    boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  name: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
  },
  taskBadge: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  classLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  stats: {
    marginBottom: theme.spacing.md,
    gap: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  secondaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    opacity: 0.8,
  },
  hpArea: {
    flex: 1,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
    minWidth: 44,
    justifyContent: 'center',
  },
  statIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  statValue: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontWeight: theme.fontWeight.semibold,
  },
  // statBadge removed (attack type no longer shown)
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  hpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
    marginBottom: 4,
  },
  hpLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hpValue: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
  },
  incapText: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    marginBottom: 6,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkMark: {
    color: '#fff',
    fontWeight: '700',
  },
  compactInfo: {
    flex: 1,
  },
  smallStats: {
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontSize: 12,
  },
  statusText: {
    color: theme.colors.textSecondary,
    marginTop: 4,
    fontSize: 12,
  },
});
