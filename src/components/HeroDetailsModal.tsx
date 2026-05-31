import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Hero, Equipment } from '../types';
import { theme } from '../theme';
import { CLASS_DEFS } from '../constants/classes';
import { PERSONALITIES } from '../constants/personalities';
import { HPBar } from './HPBar';
import { useGame } from '../hooks/useGame';
import { getEffectiveStats } from '../utils/heroUtils';

interface HeroDetailsModalProps {
  hero: Hero | null;
  visible: boolean;
  onClose: () => void;
}

export function HeroDetailsModal({ hero, visible, onClose }: HeroDetailsModalProps) {
  const { state } = useGame();

  if (!hero) return null;

  const classDef = hero.classId ? CLASS_DEFS[hero.classId] : null;
  const personalityDef = hero.personality ? PERSONALITIES[hero.personality] : null;
  const inventory = state.inventory ?? [];
  const equippedEquipment = (hero.equippedItems ?? [])
    .map((id) => inventory.find((eq) => eq.id === id))
    .filter((eq): eq is Equipment => eq != null);

  const effectiveStats = getEffectiveStats(hero, state);

  // Deltas para mostrar o ganho dos bônus na UI
  const atkDelta = effectiveStats.atk - hero.atk;
  const hpMaxDelta = effectiveStats.hpMax - hero.hpMax;
  const mpDelta = effectiveStats.mp - hero.mp;
  const defenseDelta = effectiveStats.defense - (hero.defense ?? 0);
  const critDelta = effectiveStats.crit - (hero.crit ?? 0);
  const agilityDelta = effectiveStats.agility - (hero.agility ?? 0);

  const typeIcons: Record<Equipment['type'], string> = {
    weapon: '\u2694\uFE0F',
    armor: '\uD83D\uDEE1\uFE0F',
    accessory: '\uD83D\uDC8D',
  };

  const statLabelMap: Record<string, { label: string; color: string }> = {
    hp: { label: 'HP', color: theme.colors.hp },
    atk: { label: 'ATK', color: theme.colors.atk },
    mp: { label: 'MP', color: theme.colors.mp },
    defense: { label: 'DEF', color: theme.colors.textSecondary },
    crit: { label: 'CRIT', color: theme.colors.gold },
    agility: { label: 'AGI', color: theme.colors.success },
  };

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
                  <Text style={styles.hpValue}>
                    {Math.floor(effectiveStats.hpCurrent)} / {Math.floor(effectiveStats.hpMax)}
                    {hpMaxDelta > 0 ? <Text style={{ color: theme.colors.success }}> (+{hpMaxDelta})</Text> : null}
                  </Text>
                </View>
                <HPBar current={effectiveStats.hpCurrent} max={effectiveStats.hpMax} />
              </View>

              <StatItem
                label="Ataque"
                value={atkDelta > 0 ? `${Math.floor(effectiveStats.atk)} (+${atkDelta})` : Math.floor(effectiveStats.atk)}
                icon="⚔️"
                color={theme.colors.atk}
              />
              <StatItem
                label="Mana"
                value={mpDelta > 0 ? `${Math.floor(effectiveStats.mp)} (+${mpDelta})` : Math.floor(effectiveStats.mp)}
                icon="🔮"
                color={theme.colors.mp}
              />
            </View>

            {personalityDef && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Personalidade</Text>
                <View style={styles.personalityContainer}>
                  <Text style={styles.personalityHeader}>
                    {personalityDef.emoji} {personalityDef.displayName}
                  </Text>
                  <Text style={styles.personalityDescription}>
                    {personalityDef.description}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Atributos Secundários</Text>
              <StatItem
                label="Defesa"
                value={defenseDelta > 0 ? `${Math.floor(effectiveStats.defense)} (+${defenseDelta})` : Math.floor(effectiveStats.defense)}
                icon="🛡️"
              />
              <StatItem
                label="Crítico"
                value={critDelta > 0 ? `${Math.floor(effectiveStats.crit)}% (+${critDelta})` : `${Math.floor(effectiveStats.crit)}%`}
                icon="🎯"
              />
              <StatItem
                label="Agilidade"
                value={agilityDelta > 0 ? `${Math.floor(effectiveStats.agility)} (+${agilityDelta})` : Math.floor(effectiveStats.agility)}
                icon="🏃"
              />
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

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Equipamentos</Text>
              {equippedEquipment.length === 0 ? (
                <Text style={styles.noEquipmentText}>Nenhum equipamento</Text>
              ) : (
                equippedEquipment.map((eq) => (
                  <View key={eq.id} style={styles.equipmentItem}>
                    <View style={styles.equipmentHeader}>
                      <Text style={styles.equipmentIcon}>{typeIcons[eq.type]}</Text>
                      <Text style={styles.equipmentName}>{eq.name}</Text>
                    </View>
                    <View style={styles.equipmentBonuses}>
                      {Object.entries(eq.statBonus).map(([stat, value]) => {
                        if (!value) return null;
                        const info = statLabelMap[stat];
                        if (!info) return null;
                        return (
                          <Text key={stat} style={[styles.equipmentBonusText, { color: info.color }]}>
                            +{value} {info.label}
                          </Text>
                        );
                      })}
                    </View>
                  </View>
                ))
              )}
            </View>
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
  personalityContainer: {
    marginTop: 4,
  },
  personalityHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  personalityDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
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
  noEquipmentText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  equipmentItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  equipmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  equipmentIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  equipmentBonuses: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginLeft: 26,
  },
  equipmentBonusText: {
    fontSize: 13,
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
