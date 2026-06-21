import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
} from 'react-native';
import { usePantheon } from '../hooks/usePantheon';
import { useGame } from '../hooks/useGame';
import { Hero } from '../types';
import { theme } from '../theme';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { Banner } from '../components/ui/Banner';
import { Card } from '../components/ui/Card';
import { OrnateFrame } from '../components/ui/OrnateFrame';
import { Seal } from '../components/ui/Seal';
import { Icon } from '../components/ui/Icon';
import { AnimatedGold } from '../components/AnimatedGold';
import { CLASS_DEFS } from '../constants/classes';

function StarBadge({ stars }: { stars: number }) {
  if (!stars) return null;
  return (
    <View style={styles.starBadge}>
      {Array.from({ length: stars }).map((_, i) => (
        <Icon key={i} name="star" size={12} color={theme.colors.gold} />
      ))}
    </View>
  );
}

export function PantheonScreen() {
  const { state } = useGame();
  const {
    eligibleHeroes,
    pantheonBonuses,
    pantheonFusions,
    selectedIds,
    canFuse,
    toggleHero,
    confirmFusion,
    clearSelection,
  } = usePantheon();

  const [confirmVisible, setConfirmVisible] = useState(false);

  const selectedHeroes = selectedIds
    .map(id => eligibleHeroes.find(h => h.id === id))
    .filter(Boolean) as Hero[];

  const hasBonuses = pantheonBonuses.goldPercent > 0
    || pantheonBonuses.atkPercent > 0
    || pantheonBonuses.hpPercent > 0;

  return (
    <ScreenContainer
      banner={
        <Banner
          title="Panteão dos Heróis"
          subtitle={`${pantheonFusions} fusão${pantheonFusions !== 1 ? 'ões' : ''} realizadas`}
          right={<AnimatedGold gold={state.gold} />}
        />
      }
    >
      {/* Bônus do Panteão */}
      {hasBonuses && (
        <View style={styles.bonusSection}>
          <Text style={styles.sectionTitle}>Bônus Ativos</Text>
          <View style={styles.bonusRow}>
            {pantheonBonuses.goldPercent > 0 && (
              <Card elevation="e1" padding="sm">
                <View style={styles.bonusPillInner}>
                  <Icon name="gold-coin" size={14} color={theme.colors.gold} />
                  <Text style={styles.bonusPillText}> +{pantheonBonuses.goldPercent}% Gold</Text>
                </View>
              </Card>
            )}
            {pantheonBonuses.atkPercent > 0 && (
              <Card elevation="e1" padding="sm">
                <View style={styles.bonusPillInner}>
                  <Icon name="sword" size={14} color={theme.colors.statAtk} />
                  <Text style={styles.bonusPillText}> +{pantheonBonuses.atkPercent}% ATK</Text>
                </View>
              </Card>
            )}
            {pantheonBonuses.hpPercent > 0 && (
              <Card elevation="e1" padding="sm">
                <View style={styles.bonusPillInner}>
                  <Icon name="stat-hp" size={14} color={theme.colors.statHp} />
                  <Text style={styles.bonusPillText}> +{pantheonBonuses.hpPercent}% HP</Text>
                </View>
              </Card>
            )}
          </View>
        </View>
      )}

      {/* Instrução de fusão */}
      <Card elevation="e1">
        <View style={styles.instructionHeader}>
          <Icon name="merge" size={18} color={theme.colors.gold} />
          <Text style={styles.instructionTitle}> Fusão de Heróis</Text>
        </View>
        <Text style={styles.instructionText}>
          Selecione 3 heróis ociosos para fundir em um herói mais poderoso com estrelas.
          O herói fundido herda 10% do treinamento total.
        </Text>
      </Card>

      {/* Heróis selecionados */}
      {selectedIds.length > 0 && (
        <Card elevation="e2">
          <Text style={styles.sectionTitle}>
            Selecionados ({selectedIds.length}/3)
          </Text>
          <View style={styles.selectedRow}>
            {selectedHeroes.map(hero => (
              <View key={hero.id} style={styles.selectedPill}>
                <Seal kind={hero.classId ?? 'WARRIOR'} size={28} />
                <Text style={styles.selectedName}>{hero.name}</Text>
                <TouchableOpacity onPress={() => toggleHero(hero.id)}>
                  <Icon name="close" size={14} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearSelection}
            >
              <Text style={styles.clearButtonText}>Limpar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.fuseButton, !canFuse && styles.fuseButtonDisabled]}
              onPress={() => canFuse && setConfirmVisible(true)}
              disabled={!canFuse}
            >
              <Text style={styles.fuseButtonText}>
                {canFuse ? 'Fundir Heróis' : `Selecione ${3 - selectedIds.length} mais`}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {/* Lista de heróis elegíveis */}
      <Text style={styles.sectionTitle}>
        Heróis Elegíveis ({eligibleHeroes.length})
      </Text>

      {eligibleHeroes.length < 3 ? (
        <Card elevation="e1">
          <View style={styles.emptyCardInner}>
            <Icon name="skull" size={32} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>
              Você precisa de pelo menos 3 heróis ociosos para fundir.
            </Text>
            <Text style={styles.emptySubtext}>
              Heróis em missão, treinamento ou enfermaria não podem ser fundidos.
            </Text>
          </View>
        </Card>
      ) : (
        eligibleHeroes.map(hero => {
          const isSelected = selectedIds.includes(hero.id);
          const isDisabled = !isSelected && selectedIds.length >= 3;
          const classLabel = hero.classId ? CLASS_DEFS[hero.classId]?.displayName ?? '' : '';
          return (
            <TouchableOpacity
              key={hero.id}
              activeOpacity={0.7}
              onPress={() => !isDisabled && toggleHero(hero.id)}
              disabled={isDisabled}
            >
              <Card elevation={isSelected ? 'e2' : 'e1'}>
                <View style={[styles.heroCardInner, isDisabled && styles.heroCardDisabled]}>
                  <View style={styles.heroCardLeft}>
                    <Seal kind={hero.classId ?? 'WARRIOR'} size={44} />
                  </View>
                  <View style={styles.heroCardInfo}>
                    <View style={styles.heroNameRow}>
                      <Text style={styles.heroName}>{hero.name}</Text>
                      {(hero.stars ?? 0) > 0 && <StarBadge stars={hero.stars!} />}
                    </View>
                    <Text style={styles.heroClass}>{classLabel}</Text>
                    <Text style={styles.heroStats}>
                      HP {Math.floor(hero.hpMax)} • ATK {Math.floor(hero.atk)} • MP {Math.floor(hero.mp)}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.checkMark}>
                      <Icon name="check" size={16} color={theme.colors.bgDeep} />
                    </View>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          );
        })
      )}

      {/* Modal de confirmação */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <OrnateFrame corner="gold" elevation="e3">
            <Text style={styles.modalTitle}>Confirmar Fusão</Text>
            <Text style={styles.modalSubtitle}>
              Os 3 heróis serão consumidos e um novo herói mais poderoso será criado.
            </Text>

            <View style={styles.modalHeroList}>
              {selectedHeroes.map(hero => (
                <View key={hero.id} style={styles.modalHeroRow}>
                  <Seal kind={hero.classId ?? 'WARRIOR'} size={32} />
                  <Text style={styles.modalHeroName}>{hero.name}</Text>
                  {(hero.stars ?? 0) > 0 && <StarBadge stars={hero.stars!} />}
                </View>
              ))}
            </View>

            <View style={styles.modalArrowRow}>
              <Icon name="merge" size={24} color={theme.colors.textSecondary} />
            </View>
            <View style={styles.modalResultPreview}>
              <Icon name="trophy" size={18} color={theme.colors.goldBright} />
              <Text style={styles.modalResultText}> Novo herói fusionado com estrelas</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setConfirmVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  setConfirmVisible(false);
                  confirmFusion();
                }}
              >
                <Text style={styles.modalConfirmText}>Fundir!</Text>
              </TouchableOpacity>
            </View>
          </OrnateFrame>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...theme.type.label,
    color: theme.colors.textSecondary,
    marginTop: 4,
    marginBottom: 4,
  },
  // Bônus
  bonusSection: { gap: 8, marginBottom: 4 },
  bonusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bonusPillInner: { flexDirection: 'row', alignItems: 'center' },
  bonusPillText: { ...theme.type.label, color: theme.colors.textPrimary },
  // Instrução
  instructionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  instructionTitle: { ...theme.type.h2, color: theme.colors.gold },
  instructionText: { ...theme.type.body, color: theme.colors.textSecondary, lineHeight: 18 },
  // Selecionados
  selectedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
  selectedName: { ...theme.type.label, color: theme.colors.textPrimary },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  clearButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  clearButtonText: { ...theme.type.label, color: theme.colors.textSecondary },
  fuseButton: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gold,
    alignItems: 'center',
  },
  fuseButtonDisabled: { backgroundColor: theme.colors.surfaceRaised },
  fuseButtonText: { ...theme.type.label, color: theme.colors.bgDeep },
  // Hero cards
  heroCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroCardDisabled: { opacity: 0.35 },
  heroCardLeft: {
    marginRight: theme.spacing.md,
  },
  heroCardInfo: { flex: 1 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroName: { ...theme.type.body, color: theme.colors.textPrimary, fontWeight: '700' },
  starBadge: { flexDirection: 'row', gap: 1 },
  heroClass: { ...theme.type.caption, color: theme.colors.textSecondary, marginTop: 1 },
  heroStats: { ...theme.type.caption, color: theme.colors.textMuted, marginTop: 2 },
  checkMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty state
  emptyCardInner: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: theme.spacing.sm,
  },
  emptyText: {
    ...theme.type.body,
    color: theme.colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtext: { ...theme.type.caption, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 16 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalTitle: { ...theme.type.h1, color: theme.colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  modalSubtitle: { ...theme.type.body, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  modalHeroList: { gap: 6, marginTop: 8 },
  modalHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    gap: 8,
  },
  modalHeroName: { flex: 1, ...theme.type.body, color: theme.colors.textPrimary, fontWeight: '700' },
  modalArrowRow: { alignItems: 'center', marginVertical: 8 },
  modalResultPreview: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
  modalResultText: { ...theme.type.label, color: theme.colors.goldBright },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.md },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  modalCancelText: { ...theme.type.label, color: theme.colors.textSecondary },
  modalConfirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gold,
    alignItems: 'center',
  },
  modalConfirmText: { ...theme.type.label, color: theme.colors.bgDeep, fontWeight: '800' },
});
