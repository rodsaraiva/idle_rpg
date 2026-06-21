import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Hero, HeroTask } from '../types';
import { theme } from '../theme';
import { StatBar } from './StatBar';
import { TaskButton } from './TaskButton';
import { AttributeProgress } from './AttributeProgress';
import { BASE_TRAIN_TIME_MS, TRAIN_INFLATION_FACTOR, INCAPACITATED_HP_THRESHOLD } from '../constants/game';
import { CLASS_DEFS } from '../constants/classes';
import { PERSONALITIES } from '../constants/personalities';
import { useGame } from '../hooks/useGame';
import { HPBar } from './HPBar';
import { Icon, IconName } from './ui/Icon';
import { Card } from './ui/Card';

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

const TASK_LABEL_MAP: Record<HeroTask, { icon: IconName; label: string }> = {
  [HeroTask.IDLE]: { icon: 'sleep', label: 'Ocioso' },
  [HeroTask.TRAIN_HP]: { icon: 'stat-hp', label: 'Treinando HP' },
  [HeroTask.TRAIN_ATK]: { icon: 'stat-atk', label: 'Treinando ATK' },
  [HeroTask.TRAIN_MP]: { icon: 'stat-mp', label: 'Treinando MP' },
  [HeroTask.INFIRMARY]: { icon: 'potion', label: 'Enfermaria' },
  [HeroTask.MISSION]: { icon: 'scroll', label: 'Em Missão' },
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
  const { state } = useGame();
  const inventory = state.inventory ?? [];
  const equippedEquipment = (hero.equippedItems ?? [])
    .map((id) => inventory.find((eq) => eq.id === id))
    .filter(Boolean);

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
          {selected ? <Icon name="check" size={14} color={theme.colors.textPrimary} /> : null}
        </View>
        <View style={styles.compactInfo}>
          <Text style={styles.name}>{hero.name}</Text>
          <Text style={styles.classLabel}>
            {(hero.classId ? CLASS_DEFS[hero.classId] : undefined)?.displayName ?? ''}
            {hero.personality && PERSONALITIES[hero.personality] ? ` · ${PERSONALITIES[hero.personality].emoji} ${PERSONALITIES[hero.personality].displayName}` : ''}
          </Text>
          <Text style={styles.smallStats}>
            HP {Math.floor(hero.hpCurrent)}/{Math.floor(hero.hpMax)} • ATK {Math.floor(hero.atk)}
          </Text>
          <View style={styles.statusRow}>
            <Icon name={TASK_LABEL_MAP[hero.currentTask].icon} size={12} color={theme.colors.textSecondary} />
            <Text style={styles.statusText}>{TASK_LABEL_MAP[hero.currentTask].label}</Text>
          </View>
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
            color: theme.colors.statHp,
            disabled: isLocked,
            onPress: () => !isLocked && onSetTask(hero.id, HeroTask.TRAIN_HP),
          },
          {
            label: 'Treinar ATK',
            isActive: hero.currentTask === HeroTask.TRAIN_ATK,
            color: theme.colors.statAtk,
            disabled: isLocked,
            onPress: () => !isLocked && onSetTask(hero.id, HeroTask.TRAIN_ATK),
          },
          {
            label: 'Treinar MP',
            isActive: hero.currentTask === HeroTask.TRAIN_MP,
            color: theme.colors.statMp,
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
    <Card elevation="e1">
      <View style={styles.header}>
        <View>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{hero.name}</Text>
          </View>
          <Text style={styles.classLabel}>
            {(hero.classId ? CLASS_DEFS[hero.classId] : undefined)?.displayName ?? ''}
            {hero.personality && PERSONALITIES[hero.personality] ? ` · ${PERSONALITIES[hero.personality].emoji} ${PERSONALITIES[hero.personality].displayName}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={styles.taskBadge}>
            <Icon name={TASK_LABEL_MAP[hero.currentTask].icon} size={11} color={theme.colors.textSecondary} />
            <Text style={styles.taskBadgeText}>{TASK_LABEL_MAP[hero.currentTask].label}</Text>
          </View>
          {hero.hpCurrent < INCAPACITATED_HP_THRESHOLD ? (
            <Text style={styles.incapText}>Incapacitado</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.hpArea} accessibilityLabel={`HP ${Math.floor(hero.hpCurrent)}/${Math.floor(hero.hpMax)}`}>
          <HPBar current={hero.hpCurrent} max={hero.hpMax} />
        </View>

        <View style={styles.statItem} accessibilityLabel={`ATK ${Math.floor(hero.atk)}`}>
          <Icon name="stat-atk" size={14} color={theme.colors.statAtk} />
          <Text style={styles.statValue}>{Math.floor(hero.atk)}</Text>
        </View>

        <View style={styles.statItem} accessibilityLabel={`MP ${Math.floor(hero.mp)}`}>
          <Icon name="stat-mp" size={14} color={theme.colors.statMp} />
          <Text style={styles.statValue}>{Math.floor(hero.mp)}</Text>
        </View>
      </View>

      {showSecondaryStats && (
        <View style={styles.secondaryStatsRow}>
          <View style={styles.statItem} accessibilityLabel={`DEF ${Math.floor(hero.defense || 0)}`}>
            <Icon name="stat-def" size={14} color={theme.colors.statDef} />
            <Text style={styles.statValue}>{Math.floor(hero.defense || 0)}</Text>
          </View>
          <View style={styles.statItem} accessibilityLabel={`CRIT ${Math.floor(hero.crit || 0)}%`}>
            <Icon name="crit" size={14} color={theme.colors.statDef} />
            <Text style={styles.statValue}>{Math.floor(hero.crit || 0)}%</Text>
          </View>
          <View style={styles.statItem} accessibilityLabel={`AGI ${Math.floor(hero.agility || 0)}`}>
            <Icon name="agility" size={14} color={theme.colors.statDef} />
            <Text style={styles.statValue}>{Math.floor(hero.agility || 0)}</Text>
          </View>
        </View>
      )}

      {equippedEquipment.length > 0 && (
        <View style={styles.equipmentRow}>
          {equippedEquipment.map((eq) => (
            <View key={eq!.id} style={styles.equipmentPill}>
              <Text style={styles.equipmentPillText}>{eq!.name}</Text>
            </View>
          ))}
        </View>
      )}

      {hero.currentTask === HeroTask.TRAIN_HP && hero.trainingProgressMs ? (
        <AttributeProgress
          fraction={(hero.trainingProgressMs.hp ?? 0) / getTrainTimePerPoint('hp')}
          color={theme.colors.statHp}
          label="Progresso HP"
        />
      ) : null}
      {hero.currentTask === HeroTask.TRAIN_ATK && hero.trainingProgressMs ? (
        <AttributeProgress
          fraction={(hero.trainingProgressMs.atk ?? 0) / getTrainTimePerPoint('atk')}
          color={theme.colors.statAtk}
          label="Progresso ATK"
        />
      ) : null}
      {hero.currentTask === HeroTask.TRAIN_MP && hero.trainingProgressMs ? (
        <AttributeProgress
          fraction={(hero.trainingProgressMs.mp ?? 0) / getTrainTimePerPoint('mp')}
          color={theme.colors.statMp}
          label="Progresso MP"
        />
      ) : null}

      <View style={styles.actions}>
        {renderedActions.map((a, i) => (
          <TaskButton
            key={`${a.label}-${i}`}
            label={a.label}
            isActive={!!a.isActive}
            color={a.color ?? theme.colors.gold}
            onPress={a.onPress}
            disabled={!!a.disabled}
          />
        ))}
      </View>
    </Card>
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
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  personalityBadge: {
    fontSize: 14,
  },
  taskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  taskBadgeText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  classLabel: {
    fontSize: 11,
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
  statValue: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  // statBadge removed (attack type no longer shown)
  equipmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: theme.spacing.sm,
  },
  equipmentPill: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  equipmentPillText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
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
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hpValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  incapText: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: 11,
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
    borderColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checked: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
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
