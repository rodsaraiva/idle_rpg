import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Hero, HeroTask } from '../types';
import { theme } from '../theme';
import { StatBar } from './StatBar';
import { TaskButton } from './TaskButton';
import { AttributeProgress } from './AttributeProgress';
import { BASE_TRAIN_TIME_MS, TRAIN_INFLATION_FACTOR } from '../constants/game';
import { CLASS_DEFS } from '../constants/classes';

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
  onToggle?: (id: string) => void;
  onSetTask?: (heroId: string, task: HeroTask) => void;
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
  onToggle,
  onSetTask,
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
        </View>
      </TouchableOpacity>
    );
  }

  const defaultActions: HeroCardAction[] = onSetTask
    ? [
        {
          label: 'Treinar HP',
          isActive: hero.currentTask === HeroTask.TRAIN_HP,
          color: theme.colors.hp,
          onPress: () => onSetTask(hero.id, HeroTask.TRAIN_HP),
        },
        {
          label: 'Treinar ATK',
          isActive: hero.currentTask === HeroTask.TRAIN_ATK,
          color: theme.colors.atk,
          onPress: () => onSetTask(hero.id, HeroTask.TRAIN_ATK),
        },
        {
          label: 'Treinar MP',
          isActive: hero.currentTask === HeroTask.TRAIN_MP,
          color: theme.colors.mp,
          onPress: () => onSetTask(hero.id, HeroTask.TRAIN_MP),
        },
        {
          label: 'Descansar',
          isActive: hero.currentTask === HeroTask.IDLE,
          color: theme.colors.textMuted,
          onPress: () => onSetTask(hero.id, HeroTask.IDLE),
        },
      ]
    : [];

  const renderedActions = actions.length > 0 ? actions : defaultActions;

  return (
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

      <View style={styles.stats}>
        <View style={styles.hpRow}>
          <Text style={[styles.hpLabel, { color: theme.colors.hp }]}>HP</Text>
          <Text style={[styles.hpValue, { color: theme.colors.hp }]}>
            {Math.floor(hero.hpCurrent)}/{Math.floor(hero.hpMax)}
          </Text>
        </View>
        <StatBar label="ATK" value={Math.floor(hero.atk)} color={theme.colors.atk} />
        <StatBar label="MP" value={Math.floor(hero.mp)} color={theme.colors.mp} />
      </View>

      {hero.currentTask === HeroTask.TRAIN_HP && hero.trainingProgressMs ? (
        <AttributeProgress
          fraction={
            (hero.trainingProgressMs.hp ?? 0) /
            (BASE_TRAIN_TIME_MS * Math.pow(1 + TRAIN_INFLATION_FACTOR, hero.trainingCount?.hp ?? 0))
          }
          color={theme.colors.hp}
          label="Progresso HP"
        />
      ) : null}
      {hero.currentTask === HeroTask.TRAIN_ATK && hero.trainingProgressMs ? (
        <AttributeProgress
          fraction={
            (hero.trainingProgressMs.atk ?? 0) /
            (BASE_TRAIN_TIME_MS * Math.pow(1 + TRAIN_INFLATION_FACTOR, hero.trainingCount?.atk ?? 0))
          }
          color={theme.colors.atk}
          label="Progresso ATK"
        />
      ) : null}
      {hero.currentTask === HeroTask.TRAIN_MP && hero.trainingProgressMs ? (
        <AttributeProgress
          fraction={
            (hero.trainingProgressMs.mp ?? 0) /
            (BASE_TRAIN_TIME_MS * Math.pow(1 + TRAIN_INFLATION_FACTOR, hero.trainingCount?.mp ?? 0))
          }
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
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
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
});
