import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { theme } from '../theme';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { GoldDisplay } from '../components/GoldDisplay';
import { useGame } from '../hooks/useGame';
import { EQUIPMENT_TIERS, MAX_EQUIPPED_ITEMS } from '../constants/equipment';
import { CLASS_DEFS } from '../constants/classes';
import { Equipment } from '../types';

const STAT_LABELS: Record<string, string> = {
  hp: 'HP',
  atk: 'ATK',
  mp: 'MP',
  defense: 'DEF',
  crit: 'CRIT',
  agility: 'AGI',
};

const TYPE_ICONS: Record<string, string> = {
  weapon: '\u2694\uFE0F',
  armor: '\uD83D\uDEE1\uFE0F',
  accessory: '\uD83D\uDC8D',
};

function formatStatBonus(statBonus: Equipment['statBonus']): string {
  return Object.entries(statBonus)
    .filter(([, v]) => v && v > 0)
    .map(([k, v]) => `+${v} ${STAT_LABELS[k] || k}`)
    .join('  ');
}

function getTierColor(tier: number): string {
  const def = EQUIPMENT_TIERS.find(t => t.tier === tier);
  return def?.color || '#94A3B8';
}

export function BlacksmithScreen() {
  const { state, dispatch } = useGame();
  const [now, setNow] = useState(Date.now());
  const [equipModalItem, setEquipModalItem] = useState<Equipment | null>(null);

  // Update timer every second for forging progress
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const forgingQueue = state.forgingQueue || [];
  const inventory = state.inventory || [];

  // Items still being forged (not yet collected)
  const activeForging = forgingQueue.filter(f => f.finishAt > now);
  const readyToCollect = forgingQueue.filter(f => f.finishAt <= now);

  // Items not in forging queue (available to equip)
  const forgingIds = new Set(forgingQueue.map(f => f.equipmentId));
  const completedItems = inventory.filter(e => !forgingIds.has(e.id));

  const handleForge = useCallback((tier: number, equipmentType: 'weapon' | 'armor' | 'accessory' = 'weapon') => {
    dispatch({ type: 'FORGE_EQUIPMENT', tier, equipmentType, now: Date.now() });
  }, [dispatch]);

  const handleCollect = useCallback((equipmentId: string) => {
    dispatch({ type: 'COLLECT_EQUIPMENT', equipmentId });
  }, [dispatch]);

  const handleEquip = useCallback((heroId: string, equipmentId: string) => {
    dispatch({ type: 'EQUIP_ITEM', heroId, equipmentId });
    setEquipModalItem(null);
  }, [dispatch]);

  const handleUnequip = useCallback((heroId: string, equipmentId: string) => {
    dispatch({ type: 'UNEQUIP_ITEM', heroId, equipmentId });
  }, [dispatch]);

  const renderForgeTier = (tierDef: typeof EQUIPMENT_TIERS[number]) => {
    const canAfford = state.gold >= tierDef.cost;
    return (
      <TouchableOpacity
        key={tierDef.tier}
        style={[styles.tierCard, { borderColor: tierDef.color }]}
        onPress={() => handleForge(tierDef.tier)}
        disabled={!canAfford}
        activeOpacity={0.7}
      >
        <View style={styles.tierHeader}>
          <Text style={[styles.tierLabel, { color: tierDef.color }]}>
            {tierDef.label}
          </Text>
          <Text style={[styles.tierCost, !canAfford && styles.costDisabled]}>
            {tierDef.cost} ouro
          </Text>
        </View>
        <Text style={styles.tierTime}>
          Tempo: {Math.round(tierDef.forgeTimeMs / 1000)}s
        </Text>
      </TouchableOpacity>
    );
  };

  const renderForgeProgress = (item: { equipmentId: string; finishAt: number }) => {
    const eq = inventory.find(e => e.id === item.equipmentId);
    if (!eq) return null;
    const remaining = Math.max(0, item.finishAt - now);
    const secs = Math.ceil(remaining / 1000);
    return (
      <View key={item.equipmentId} style={styles.progressCard}>
        <View style={styles.progressInfo}>
          <Text style={[styles.itemName, { color: getTierColor(eq.tier) }]}>
            {TYPE_ICONS[eq.type] || ''} {eq.name}
          </Text>
          <Text style={styles.statText}>{formatStatBonus(eq.statBonus)}</Text>
        </View>
        <Text style={styles.progressTime}>{secs}s</Text>
      </View>
    );
  };

  const renderReadyItem = (item: { equipmentId: string; finishAt: number }) => {
    const eq = inventory.find(e => e.id === item.equipmentId);
    if (!eq) return null;
    return (
      <View key={item.equipmentId} style={styles.readyCard}>
        <View style={styles.progressInfo}>
          <Text style={[styles.itemName, { color: getTierColor(eq.tier) }]}>
            {TYPE_ICONS[eq.type] || ''} {eq.name}
          </Text>
          <Text style={styles.statText}>{formatStatBonus(eq.statBonus)}</Text>
        </View>
        <TouchableOpacity
          style={styles.collectBtn}
          onPress={() => handleCollect(item.equipmentId)}
        >
          <Text style={styles.collectBtnText}>Coletar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderInventoryItem = (eq: Equipment) => {
    const equippedByHero = state.heroes.find(h => (h.equippedItems || []).includes(eq.id));
    return (
      <View key={eq.id} style={styles.inventoryCard}>
        <View style={styles.progressInfo}>
          <Text style={[styles.itemName, { color: getTierColor(eq.tier) }]}>
            {TYPE_ICONS[eq.type] || ''} {eq.name}
          </Text>
          <Text style={styles.statText}>{formatStatBonus(eq.statBonus)}</Text>
          {equippedByHero && (
            <Text style={styles.equippedByText}>
              Equipado por {equippedByHero.name}
            </Text>
          )}
        </View>
        {equippedByHero ? (
          <TouchableOpacity
            style={styles.unequipBtn}
            onPress={() => handleUnequip(equippedByHero.id, eq.id)}
          >
            <Text style={styles.unequipBtnText}>Desequipar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.equipBtn}
            onPress={() => setEquipModalItem(eq)}
          >
            <Text style={styles.equipBtnText}>Equipar</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Ferreiro Real"
          subtitle="Forje equipamentos para seus heróis"
          right={<GoldDisplay gold={state.gold} />}
        />

        {/* Forge Tiers */}
        <Text style={styles.sectionTitle}>Forjar Equipamento</Text>
        <View style={styles.tiersRow}>
          {EQUIPMENT_TIERS.map(renderForgeTier)}
        </View>

        {/* Active Forging */}
        {activeForging.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Forjando...</Text>
            {activeForging.map(renderForgeProgress)}
          </>
        )}

        {/* Ready to Collect */}
        {readyToCollect.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Pronto para Coletar</Text>
            {readyToCollect.map(renderReadyItem)}
          </>
        )}

        {/* Inventory */}
        <Text style={styles.sectionTitle}>
          Inventário ({completedItems.length})
        </Text>
        {completedItems.length === 0 ? (
          <Text style={styles.emptyText}>
            Nenhum equipamento ainda. Forje algo!
          </Text>
        ) : (
          completedItems.map(renderInventoryItem)
        )}
      </ScrollView>

      {/* Hero selection modal for equipping */}
      <Modal
        visible={equipModalItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEquipModalItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Equipar {equipModalItem?.name}
            </Text>
            <Text style={styles.modalSubtitle}>Escolha um herói</Text>

            <ScrollView style={styles.modalList}>
              {state.heroes.map(hero => {
                const heroEquipped = hero.equippedItems || [];
                const isFull = heroEquipped.length >= MAX_EQUIPPED_ITEMS;
                const alreadyHasItem = equipModalItem
                  ? heroEquipped.includes(equipModalItem.id)
                  : false;
                const disabled = isFull || alreadyHasItem;
                const classLabel = hero.classId
                  ? CLASS_DEFS[hero.classId]?.displayName ?? ''
                  : '';

                return (
                  <TouchableOpacity
                    key={hero.id}
                    style={[
                      styles.modalHeroRow,
                      disabled && styles.modalHeroRowDisabled,
                    ]}
                    disabled={disabled}
                    onPress={() =>
                      equipModalItem && handleEquip(hero.id, equipModalItem.id)
                    }
                    activeOpacity={0.7}
                  >
                    <View style={styles.modalHeroInfo}>
                      <Text
                        style={[
                          styles.modalHeroName,
                          disabled && styles.modalHeroTextDisabled,
                        ]}
                      >
                        {hero.name}
                      </Text>
                      <Text
                        style={[
                          styles.modalHeroClass,
                          disabled && styles.modalHeroTextDisabled,
                        ]}
                      >
                        {classLabel}  {heroEquipped.length}/{MAX_EQUIPPED_ITEMS}
                      </Text>
                    </View>
                    {alreadyHasItem && (
                      <Text style={styles.alreadyEquippedBadge}>
                        Já equipado
                      </Text>
                    )}
                    {isFull && !alreadyHasItem && (
                      <Text style={styles.fullBadge}>Cheio</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setEquipModalItem(null)}
            >
              <Text style={styles.modalCloseBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginTop: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tiersRow: {
    gap: 8,
  },
  tierCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    borderWidth: 1,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  tierCost: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.gold,
  },
  costDisabled: {
    color: theme.colors.textMuted,
  },
  tierTime: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  progressCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressInfo: {
    flex: 1,
  },
  progressTime: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.gold,
    marginLeft: 12,
  },
  readyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  collectBtn: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    marginLeft: 12,
  },
  collectBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  inventoryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
  },
  statText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  equippedBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    marginLeft: 12,
  },
  equippedByText: {
    fontSize: 11,
    color: theme.colors.primaryLight,
    marginTop: 2,
  },
  equipBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    marginLeft: 12,
  },
  equipBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  unequipBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    marginLeft: 12,
  },
  unequipBtnText: {
    color: theme.colors.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  emptyText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    width: '100%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  modalList: {
    flexGrow: 0,
  },
  modalHeroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 6,
  },
  modalHeroRowDisabled: {
    opacity: 0.45,
  },
  modalHeroInfo: {
    flex: 1,
  },
  modalHeroName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  modalHeroClass: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  modalHeroTextDisabled: {
    color: theme.colors.textMuted,
  },
  alreadyEquippedBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.gold,
    marginLeft: 8,
  },
  fullBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginLeft: 8,
  },
  modalCloseBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalCloseBtnText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
});
