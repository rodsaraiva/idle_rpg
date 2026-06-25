import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { theme } from '../theme';
import { useOnboarding } from './OnboardingProvider';
import { measureTarget, TargetLayout } from './targetRegistry';
import { OnboardingStep } from '../types';

const STEP_COPY: Record<OnboardingStep, { title: string; body: string; cta: string }> = {
  intro: {
    title: 'Bem-vindo à sua guilda',
    body: 'Vamos formar sua primeira equipe e enviá-la em missão.',
    cta: 'Começar',
  },
  recruit: {
    title: 'Recrute um aliado',
    body: 'Você já tem 1 herói. Recrute mais um na Guilda.',
    cta: 'Entendi',
  },
  train: {
    title: 'Fortaleça seu herói',
    body: 'Treine +1 de ATK no Treinamento.',
    cta: 'Entendi',
  },
  mission: {
    title: 'Hora da ação',
    body: 'Envie sua equipe na Primeira Patrulha.',
    cta: 'Entendi',
  },
  collect: {
    title: 'Equipe em campo',
    body: 'Sua equipe luta por ~10s. Aguarde a recompensa.',
    cta: 'Entendi',
  },
  done: { title: '', body: '', cta: '' },
  skipped: { title: '', body: '', cta: '' },
};

export function OnboardingOverlay() {
  const { step, isActive, target, advance, skip } = useOnboarding();
  const [layout, setLayout] = useState<TargetLayout | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!target) {
      setLayout(null);
      return;
    }
    measureTarget(target).then(l => {
      if (!cancelled) setLayout(l);
    });
    return () => { cancelled = true; };
  }, [target, step]);

  if (!isActive) return null;

  const copy = STEP_COPY[step];

  return (
    <Modal transparent visible animationType="fade" onRequestClose={skip}>
      <View style={styles.scrim} pointerEvents="box-none">
        {layout && (
          <View
            pointerEvents="none"
            style={[
              styles.spotlight,
              {
                left: layout.x - theme.spacing.sm,
                top: layout.y - theme.spacing.sm,
                width: layout.width + theme.spacing.sm * 2,
                height: layout.height + theme.spacing.sm * 2,
              },
            ]}
          />
        )}
        <View style={styles.card} pointerEvents="auto">
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={skip} style={styles.skipBtn} activeOpacity={0.7}>
              <Text style={styles.skipText}>Pular tutorial</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={advance} style={styles.ctaBtn} activeOpacity={0.8}>
              <Text style={styles.ctaText}>{copy.cta}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  spotlight: {
    position: 'absolute',
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.gold,
  },
  card: {
    margin: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxWidth: width - theme.spacing.lg * 2,
  },
  title: {
    ...theme.type.h2,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  body: {
    ...theme.type.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipBtn: { paddingVertical: theme.spacing.sm },
  skipText: { ...theme.type.label, color: theme.colors.textMuted },
  ctaBtn: {
    backgroundColor: theme.colors.gold,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  ctaText: { ...theme.type.label, color: theme.colors.textPrimary },
});
