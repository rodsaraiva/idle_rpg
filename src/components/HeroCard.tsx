import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Hero, HeroTask } from '../types';
import { theme } from '../theme';
import { StatBar } from './StatBar';
import { TaskButton } from './TaskButton';

interface HeroCardProps {
  hero: Hero;
  onSetTask: (heroId: string, task: HeroTask) => void;
}

const TASK_LABEL_MAP: Record<HeroTask, string> = {
  [HeroTask.IDLE]: '💤 Ocioso',
  [HeroTask.TRAIN_HP]: '❤️ Treinando HP',
  [HeroTask.TRAIN_ATK]: '⚔️ Treinando ATK',
  [HeroTask.TRAIN_MP]: '🔮 Treinando MP',
  [HeroTask.MISSION]: '🪙 Em Missão',
};

export function HeroCard({ hero, onSetTask }: HeroCardProps) {
  return (
    <View style={styles.card}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.name}>{hero.name}</Text>
        <Text style={styles.taskBadge}>{TASK_LABEL_MAP[hero.currentTask]}</Text>
      </View>

      {/* Atributos */}
      <View style={styles.stats}>
        <StatBar label="HP" value={hero.hp} color={theme.colors.hp} />
        <StatBar label="ATK" value={hero.atk} color={theme.colors.atk} />
        <StatBar label="MP" value={hero.mp} color={theme.colors.mp} />
      </View>

      {/* Botões de Tarefa */}
      <View style={styles.actions}>
        <TaskButton
          label="Treinar HP"
          isActive={hero.currentTask === HeroTask.TRAIN_HP}
          color={theme.colors.hp}
          onPress={() => onSetTask(hero.id, HeroTask.TRAIN_HP)}
        />
        <TaskButton
          label="Treinar ATK"
          isActive={hero.currentTask === HeroTask.TRAIN_ATK}
          color={theme.colors.atk}
          onPress={() => onSetTask(hero.id, HeroTask.TRAIN_ATK)}
        />
        <TaskButton
          label="Treinar MP"
          isActive={hero.currentTask === HeroTask.TRAIN_MP}
          color={theme.colors.mp}
          onPress={() => onSetTask(hero.id, HeroTask.TRAIN_MP)}
        />
        <TaskButton
          label="Descansar"
          isActive={hero.currentTask === HeroTask.IDLE}
          color={theme.colors.textMuted}
          onPress={() => onSetTask(hero.id, HeroTask.IDLE)}
        />
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
  stats: {
    marginBottom: theme.spacing.md,
    gap: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
});
