import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Hero } from '../types';
import { theme } from '../theme';
import { CLASS_DEFS } from '../constants/classes';
import { HPBar } from './HPBar';

interface HeroDetailsModalProps {
  hero: Hero | null;
  visible: boolean;
  onClose: () => void;
}

export function HeroDetailsModal({ hero, visible, onClose }: HeroDetailsModalProps) {
  if (!hero) return null;

  const classDef = hero.classId ? CLASS_DEFS[hero.classId] : null;

  const StatItem = ({ label, value, icon, color }: { label: string; value: string | number; icon: string; color?: string }) => (
    <View style={styles.statRow}>
      <View style={styles.statLabelContainer}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View>
              <Text style={styles.name}>{hero.name}</Text>
              <Text style={styles.className}>{classDef?.displayName || 'Sem Classe'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Status de Combate</Text>
              
              <View style={styles.hpContainer}>
                <View style={styles.hpHeader}>
                  <Text style={styles.hpLabel}>Pontos de Vida</Text>
                  <Text style={styles.hpValue}>{Math.floor(hero.hpCurrent)} / {Math.floor(hero.hpMax)}</Text>
                </View>
                <HPBar current={hero.hpCurrent} max={hero.hpMax} />
              </View>

              <StatItem label="Ataque" value={Math.floor(hero.atk)} icon="⚔️" color={theme.colors.atk} />
              <StatItem label="Mana" value={Math.floor(hero.mp)} icon="🔮" color={theme.colors.mp} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Atributos Secundários</Text>
              <StatItem label="Defesa" value={Math.floor(hero.defense || 0)} icon="🛡️" />
              <StatItem label="Crítico" value={`${Math.floor(hero.crit || 0)}%`} icon="🎯" />
              <StatItem label="Agilidade" value={Math.floor(hero.agility || 0)} icon="🏃" />
            </View>

            {classDef && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Informações de Classe</Text>
                <StatItem label="Tipo de Ataque" value={hero.attackType === 'RANGED' ? 'Distância' : 'Corpo a Corpo'} icon="🏹" />
                {classDef.ability && (
                  <View style={styles.abilityContainer}>
                    <Text style={styles.abilityLabel}>Habilidade Especial:</Text>
                    <Text style={styles.abilityValue}>{classDef.ability === 'ROGUE_BONUS' ? 'Bônus de Sorte do Ladino' : 'Buff de Cura do Curandeiro'}</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.footerButton} onPress={onClose}>
            <Text style={styles.footerButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing.lg,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.lg,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  className: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  closeButton: {
    padding: 8,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    marginBottom: theme.spacing.lg,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  statLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  statLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  hpContainer: {
    marginBottom: theme.spacing.md,
  },
  hpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  hpLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  hpValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.hp,
  },
  abilityContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  abilityLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  abilityValue: {
    fontSize: 15,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  footerButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  footerButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
