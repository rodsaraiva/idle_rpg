import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { MissionTemplate } from '../constants/missions';

interface MissionListItemProps {
  mission: MissionTemplate;
  onSend: (templateId: string, minHeroes: number) => void;
  disabled: boolean;
}

export function MissionListItem({ mission, onSend, disabled }: MissionListItemProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.name}>{mission.name}</Text>
          {mission.difficulty && (
            <View style={styles.difficultyBadge}>
              <Text style={styles.difficultyText}>Nv. {mission.difficulty}</Text>
            </View>
          )}
        </View>
        <Text style={styles.reward}>
          💰 {mission.rewardMin}–{mission.rewardMax}
        </Text>
      </View>
      
      <Text style={styles.info}>
        Mínimo de heróis: {mission.minHeroes}
      </Text>

      {mission.requirements && mission.requirements.length > 0 && (
        <View style={styles.requirements}>
          {mission.requirements.map((req, idx) => (
            <Text key={idx} style={styles.requirementItem}>
              • {req.label}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button
          title="Enviar"
          onPress={() => onSend(mission.id, mission.minHeroes)}
          disabled={disabled}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: 8,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  difficultyBadge: {
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  difficultyText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  reward: {
    color: theme.colors.gold,
    fontWeight: '600',
  },
  info: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  requirements: {
    marginTop: 6,
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
  },
  requirementItem: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  buttonContainer: {
    marginTop: theme.spacing.sm,
  },
});
