import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePantheon } from '../hooks/usePantheon';
import { Hero } from '../types';
import { theme } from '../theme';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { CLASS_DEFS } from '../constants/classes';

const CLASS_EMOJI: Record<string, string> = {
  WARRIOR: '⚔️', TANK: '🛡️', ROGUE: '🗡️',
  ARCHER: '🏹', MAGE: '🔮', HEALER: '💚',
};

function StarBadge({ stars }: { stars: number }) {
  if (!stars) return null;
  return (
    <Text style={styles.starBadge}>{'★'.repeat(stars)}</Text>
  );
}

export function PantheonScreen() {
  const insets = useSafeAreaInsets();
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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <View style={styles.headerWrapper}>
        <ScreenHeader
          title="Panteão dos Heróis"
          subtitle={`${pantheonFusions} fusão${pantheonFusions !== 1 ? 'ões' : ''} realizadas`}
          showGold={false}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Bônus do Panteão */}
        {hasBonuses && (
          <View style={styles.bonusSection}>
            <Text style={styles.sectionTitle}>Bônus Ativos</Text>
            <View style={styles.bonusRow}>
              {pantheonBonuses.goldPercent > 0 && (
                <View style={styles.bonusPill}>
                  <Text style={styles.bonusPillText}>{'🪙'} +{pantheonBonuses.goldPercent}% Gold</Text>
                </View>
              )}
              {pantheonBonuses.atkPercent > 0 && (
                <View style={styles.bonusPill}>
                  <Text style={styles.bonusPillText}>{'⚔️'} +{pantheonBonuses.atkPercent}% ATK</Text>
                </View>
              )}
              {pantheonBonuses.hpPercent > 0 && (
                <View style={styles.bonusPill}>
                  <Text style={styles.bonusPillText}>{'❤️'} +{pantheonBonuses.hpPercent}% HP</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Instrução de fusão */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionTitle}>{'🏛️'} Fusão de Heróis</Text>
          <Text style={styles.instructionText}>
            Selecione 3 heróis ociosos para fundir em um herói mais poderoso com estrelas.
            O herói fundido herda 10% do treinamento total.
          </Text>
        </View>

        {/* Heróis selecionados */}
        {selectedIds.length > 0 && (
          <View style={styles.selectionSection}>
            <Text style={styles.sectionTitle}>
              Selecionados ({selectedIds.length}/3)
            </Text>
            <View style={styles.selectedRow}>
              {selectedHeroes.map(hero => (
                <View key={hero.id} style={styles.selectedPill}>
                  <Text style={styles.selectedEmoji}>
                    {CLASS_EMOJI[hero.classId ?? ''] ?? '❓'}
                  </Text>
                  <Text style={styles.selectedName}>{hero.name}</Text>
                  <TouchableOpacity onPress={() => toggleHero(hero.id)}>
                    <Text style={styles.removeBtn}>✕</Text>
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
          </View>
        )}

        {/* Lista de heróis elegíveis */}
        <Text style={styles.sectionTitle}>
          Heróis Elegíveis ({eligibleHeroes.length})
        </Text>

        {eligibleHeroes.length < 3 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>{'⚠️'}</Text>
            <Text style={styles.emptyText}>
              Você precisa de pelo menos 3 heróis ociosos para fundir.
            </Text>
            <Text style={styles.emptySubtext}>
              Heróis em missão, treinamento ou enfermaria não podem ser fundidos.
            </Text>
          </View>
        ) : (
          eligibleHeroes.map(hero => {
            const isSelected = selectedIds.includes(hero.id);
            const isDisabled = !isSelected && selectedIds.length >= 3;
            const classLabel = hero.classId ? CLASS_DEFS[hero.classId]?.displayName ?? '' : '';
            return (
              <TouchableOpacity
                key={hero.id}
                style={[
                  styles.heroCard,
                  isSelected && styles.heroCardSelected,
                  isDisabled && styles.heroCardDisabled,
                ]}
                onPress={() => !isDisabled && toggleHero(hero.id)}
                disabled={isDisabled}
                activeOpacity={0.7}
              >
                <View style={styles.heroCardLeft}>
                  <Text style={styles.heroEmoji}>
                    {CLASS_EMOJI[hero.classId ?? ''] ?? '❓'}
                  </Text>
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
                    <Text style={styles.checkMarkText}>{'✓'}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Modal de confirmação */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmar Fusão</Text>
            <Text style={styles.modalSubtitle}>
              Os 3 heróis serão consumidos e um novo herói mais poderoso será criado.
            </Text>

            <View style={styles.modalHeroList}>
              {selectedHeroes.map(hero => (
                <View key={hero.id} style={styles.modalHeroRow}>
                  <Text style={styles.modalHeroEmoji}>
                    {CLASS_EMOJI[hero.classId ?? ''] ?? '❓'}
                  </Text>
                  <Text style={styles.modalHeroName}>{hero.name}</Text>
                  {(hero.stars ?? 0) > 0 && <StarBadge stars={hero.stars!} />}
                </View>
              ))}
            </View>

            <Text style={styles.modalArrow}>{'↓'}</Text>
            <View style={styles.modalResultPreview}>
              <Text style={styles.modalResultText}>
                {'✨'} Novo herói fusionado com estrelas
              </Text>
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
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  headerWrapper: {
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceLight,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 4,
  },
  // Bônus
  bonusSection: { gap: 8 },
  bonusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bonusPill: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  bonusPillText: { color: theme.colors.primaryLight, fontWeight: '700', fontSize: 13 },
  // Instrução
  instructionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
    gap: 6,
  },
  instructionTitle: { color: theme.colors.gold, fontSize: 15, fontWeight: '800' },
  instructionText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 },
  // Selecionados
  selectionSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    gap: 8,
  },
  selectedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  selectedEmoji: { fontSize: 16 },
  selectedName: { color: theme.colors.textPrimary, fontWeight: '700', fontSize: 13 },
  removeBtn: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  clearButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  clearButtonText: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 14 },
  fuseButton: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  fuseButtonDisabled: { backgroundColor: theme.colors.surfaceLight },
  fuseButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  // Hero cards
  heroCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
    alignItems: 'center',
  },
  heroCardSelected: { borderColor: theme.colors.primary, borderWidth: 2 },
  heroCardDisabled: { opacity: 0.35 },
  heroCardLeft: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  heroEmoji: { fontSize: 22 },
  heroCardInfo: { flex: 1 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroName: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '700' },
  starBadge: { color: theme.colors.gold, fontSize: 12, fontWeight: '800' },
  heroClass: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 1 },
  heroStats: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  checkMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMarkText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  // Empty state
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
  },
  emptyIcon: { fontSize: 32 },
  emptyText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtext: { color: theme.colors.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 16 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    width: '100%',
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  modalHeroList: { gap: 6 },
  modalHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    gap: 8,
  },
  modalHeroEmoji: { fontSize: 20 },
  modalHeroName: { flex: 1, color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14 },
  modalArrow: { fontSize: 24, textAlign: 'center', color: theme.colors.textSecondary },
  modalResultPreview: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  modalResultText: { color: theme.colors.primaryLight, fontWeight: '700', fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  modalCancelText: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 14 },
  modalConfirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
