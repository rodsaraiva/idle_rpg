import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { MissionTemplate } from '../types';

interface MissionListItemProps {
  mission: MissionTemplate;
  onSend: (templateId: string, minHeroes: number) => void;
  disabled: boolean;
}

export function MissionListItem({ mission, onSend, disabled }: MissionListItemProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{mission.name}</Text>
        <Text style={styles.reward}>
          💰 {mission.rewardMin}–{mission.rewardMax}
        </Text>
      </View>
      <Text style={styles.info}>
        Mínimo de heróis: {mission.minHeroes}
      </Text>
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
  name: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  reward: {
    color: theme.colors.gold,
    fontWeight: '600',
  },
  info: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  buttonContainer: {
    marginTop: theme.spacing.sm,
  },
});
