import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';
import { OfflineSummaryFull } from '../types';
import { formatNumber } from '../utils/math';

interface Props {
  visible: boolean;
  summary: OfflineSummaryFull | null;
  onApply: () => void;
  onDismiss: () => void;
}

export function OfflineSummaryModal({ visible, summary, onApply, onDismiss }: Props) {
  if (!summary) return null;

  const hours = Math.floor(summary.ticks / 3600);
  const minutes = Math.floor((summary.ticks % 3600) / 60);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Progresso Offline</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Tempo simulado:</Text>
            <Text style={styles.value}>
              {hours}h {minutes}m
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Ouro ganho:</Text>
            <Text style={styles.value}>💰 {formatNumber(summary.goldGained)}</Text>
          </View>

          <View style={{ height: 8 }} />
          <Text style={[styles.label, { marginBottom: 8 }]}>Mudanças por herói:</Text>
          <View style={{ maxHeight: 160 }}>
            {summary.perHeroChanges.map((p) => (
              <View key={p.id} style={styles.heroRow}>
                <Text style={styles.heroName}>{p.name}</Text>
                <Text style={styles.heroChange}>
                  HP {Math.floor(p.hpBefore)} → {Math.floor(p.hpAfter)} · ATK {p.atkBefore.toFixed(1)} → {p.atkAfter.toFixed(1)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Heróis afetados:</Text>
            <Text style={styles.value}>{summary.heroesAffected}</Text>
          </View>

          {summary.cappedHours > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Cap aplicado:</Text>
              <Text style={styles.value}>{summary.cappedHours}h</Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.cancel]} onPress={onDismiss} activeOpacity={0.8}>
              <Text style={styles.buttonText}>Descartar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.apply]} onPress={onApply} activeOpacity={0.8}>
              <Text style={styles.buttonText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '85%',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  button: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  cancel: {
    backgroundColor: theme.colors.surfaceLight,
    flex: 1,
  },
  apply: {
    backgroundColor: theme.colors.primary,
    flex: 1,
  },
  buttonText: {
    color: theme.colors.textPrimary,
    fontWeight: theme.fontWeight.bold,
  },
  heroRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceLight,
  },
  heroName: {
    color: theme.colors.textPrimary,
    fontWeight: theme.fontWeight.semibold,
  },
  heroChange: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
});

