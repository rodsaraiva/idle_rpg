import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { theme } from '../theme';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { Banner } from '../components/ui/Banner';
import { AnimatedGold } from '../components/AnimatedGold';
import { Card } from '../components/ui/Card';
import { OrnateFrame } from '../components/ui/OrnateFrame';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon, IconName } from '../components/ui/Icon';
import { useGame } from '../hooks/useGame';
import { EQUIPMENT_TIERS, MAX_EQUIPPED_ITEMS } from '../constants/equipment';
import { CLASS_DEFS } from '../constants/classes';
import { Equipment } from '../types';
import { MATERIALS, FORGE_RECIPES, MaterialId, EquipmentType } from '../constants/materials';
import { LOTTIE_ASSETS } from '../constants/assets';

const STAT_LABELS: Record<string, string> = {
  hp: 'HP',
  atk: 'ATK',
  mp: 'MP',
  defense: 'DEF',
  crit: 'CRIT',
  agility: 'AGI',
};

const TYPE_ICONS: Record<string, IconName> = {
  weapon: 'sword',
  armor: 'shield',
  accessory: 'accessory',
};

function formatStatBonus(statBonus: Equipment['statBonus']): string {
  return Object.entries(statBonus)
    .filter(([, v]) => v && v > 0)
    .map(([k, v]) => `+${v} ${STAT_LABELS[k] || k}`)
    .join('  ');
}

function getTierColor(tier: number): string {
  const def = EQUIPMENT_TIERS.find(t => t.tier === tier);
  return def ? theme.rarity[def.rarity].color : theme.rarity.common.color;
}

export function BlacksmithScreen() {
  const { state, dispatch } = useGame();
  const [now, setNow] = useState(Date.now());
  const [equipModalItem, setEquipModalItem] = useState<Equipment | null>(null);
  const [selectedTier, setSelectedTier] = useState<number>(1);
  const [selectedEquipmentType, setSelectedEquipmentType] = useState<EquipmentType>('weapon');
  const forgeRef = useRef<LottieView>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const forgingQueue = state.forgingQueue || [];
  const inventory = state.inventory || [];

  const activeForging = forgingQueue.filter(f => f.finishAt > now);
  const readyToCollect = forgingQueue.filter(f => f.finishAt <= now);

  const forgingIds = new Set(forgingQueue.map(f => f.equipmentId));
  const completedItems = inventory.filter(e => !forgingIds.has(e.id));

  const handleForge = useCallback((tier: number, equipmentType: 'weapon' | 'armor' | 'accessory' = 'weapon') => {
    dispatch({ type: 'FORGE_EQUIPMENT', tier, equipmentType, now: Date.now() });
  }, [dispatch]);

  const handleCollect = useCallback((equipmentId: string) => {
    dispatch({ type: 'COLLECT_EQUIPMENT', equipmentId });
    forgeRef.current?.play();
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
      <Card key={tierDef.tier} rarity={tierDef.rarity} elevation="e1" onPress={canAfford ? () => {
        setSelectedTier(tierDef.tier);
        handleForge(tierDef.tier, selectedEquipmentType);
      } : undefined} padding="sm">
        <View style={styles.tierHeader}>
          <Text style={[styles.tierLabel, { color: theme.rarity[tierDef.rarity].color }]}>
            {tierDef.label}
          </Text>
          <Text style={[styles.tierCost, !canAfford && styles.costDisabled]}>
            {tierDef.cost} ouro
          </Text>
        </View>
        <Text style={styles.tierTime}>
          Tempo: {Math.round(tierDef.forgeTimeMs / 1000)}s
        </Text>
      </Card>
    );
  };

  const renderForgeProgress = (item: { equipmentId: string; finishAt: number }) => {
    const eq = inventory.find(e => e.id === item.equipmentId);
    if (!eq) return null;
    const remaining = Math.max(0, item.finishAt - now);
    const secs = Math.ceil(remaining / 1000);
    return (
      <Card key={item.equipmentId} elevation="e1" padding="sm">
        <View style={styles.progressRow}>
          <View style={styles.progressInfo}>
            <View style={styles.itemNameRow}>
              <Icon name={TYPE_ICONS[eq.type] ?? 'anvil'} size={14} color={getTierColor(eq.tier)} />
              <Text style={[styles.itemName, { color: getTierColor(eq.tier) }]}>{eq.name}</Text>
            </View>
            <Text style={styles.statText}>{formatStatBonus(eq.statBonus)}</Text>
          </View>
          <Text style={styles.progressTime}>{secs}s</Text>
        </View>
      </Card>
    );
  };

  const renderReadyItem = (item: { equipmentId: string; finishAt: number }) => {
    const eq = inventory.find(e => e.id === item.equipmentId);
    if (!eq) return null;
    return (
      <Card key={item.equipmentId} elevation="e2" padding="sm">
        <View style={styles.progressRow}>
          <View style={styles.progressInfo}>
            <View style={styles.itemNameRow}>
              <Icon name={TYPE_ICONS[eq.type] ?? 'anvil'} size={14} color={getTierColor(eq.tier)} />
              <Text style={[styles.itemName, { color: getTierColor(eq.tier) }]}>{eq.name}</Text>
            </View>
            <Text style={styles.statText}>{formatStatBonus(eq.statBonus)}</Text>
          </View>
          <TouchableOpacity
            style={styles.collectBtn}
            onPress={() => handleCollect(item.equipmentId)}
          >
            <Text style={styles.collectBtnText}>Coletar</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const renderInventoryItem = (eq: Equipment) => {
    const equippedByHero = state.heroes.find(h => (h.equippedItems || []).includes(eq.id));
    return (
      <Card key={eq.id} elevation="e1" padding="sm">
        <View style={styles.progressRow}>
          <View style={styles.progressInfo}>
            <View style={styles.itemNameRow}>
              <Icon name={TYPE_ICONS[eq.type] ?? 'anvil'} size={14} color={getTierColor(eq.tier)} />
              <Text style={[styles.itemName, { color: getTierColor(eq.tier) }]}>{eq.name}</Text>
            </View>
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
      </Card>
    );
  };

  return (
    <ScreenContainer
      scroll={true}
      banner={
        <Banner
          title="Ferreiro Real"
          subtitle="Forje equipamentos para seus heróis"
          right={<AnimatedGold gold={state.gold} />}
        />
      }
    >
      {/* Forge Tiers */}
      <Text style={styles.sectionTitle}>Forjar Equipamento</Text>

      {/* Seletor de tipo de equipamento */}
      <View style={styles.typeRow}>
        {(['weapon', 'armor', 'accessory'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.typeBtn, selectedEquipmentType === t && styles.typeBtnActive]}
            onPress={() => setSelectedEquipmentType(t)}
          >
            <Icon name={TYPE_ICONS[t]} size={16} color={selectedEquipmentType === t ? theme.colors.bgDeep : theme.colors.textPrimary} />
            <Text style={[styles.typeBtnText, selectedEquipmentType === t && styles.typeBtnTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
        <EmptyState icon="anvil" title="Forja vazia" subtitle="Nenhum equipamento ainda. Forje algo!" />
      ) : (
        completedItems.map(renderInventoryItem)
      )}

      {/* Materiais */}
      <Text style={styles.sectionTitle}>Materiais</Text>
      {(() => {
        const playerMaterials = (state.materials ?? {}) as Partial<Record<MaterialId, number>>;
        const recipe = FORGE_RECIPES[selectedTier]?.[selectedEquipmentType];
        return (
          <View style={styles.materialsGrid}>
            {MATERIALS.map(m => {
              const owned = playerMaterials[m.id] ?? 0;
              const needed = recipe?.materials[m.id] ?? 0;
              const isMissing = needed > 0 && owned < needed;
              return (
                <View
                  key={m.id}
                  style={[styles.materialCard, isMissing && styles.materialCardMissing]}
                >
                  <Text style={styles.materialIcon}>{m.icon}</Text>
                  <Text style={[styles.materialName, isMissing && styles.materialNameMissing]}>
                    {m.name}
                  </Text>
                  <Text style={[styles.materialCount, isMissing && styles.materialCountMissing]}>
                    {owned}{needed > 0 ? `/${needed}` : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })()}

      {/* Lottie forge FX — overlay invisível, dispara ao coletar */}
      <LottieView
        ref={forgeRef}
        source={LOTTIE_ASSETS.FORGE_COMPLETE}
        loop={false}
        style={[styles.forgeFx, { pointerEvents: 'none' }]}
      />

      {/* Modal de seleção de herói para equipar */}
      <Modal
        visible={equipModalItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEquipModalItem(null)}
      >
        <View style={styles.modalOverlay}>
          <OrnateFrame>
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
    marginTop: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  tiersRow: {
    gap: 8,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierLabel: {
    ...theme.type.body,
    fontWeight: '700',
  },
  tierCost: {
    ...theme.type.body,
    color: theme.colors.gold,
  },
  costDisabled: {
    color: theme.colors.textMuted,
  },
  tierTime: {
    ...theme.type.caption,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressInfo: {
    flex: 1,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressTime: {
    ...theme.type.stat,
    fontVariant: ['tabular-nums'] as import('react-native').TextStyle['fontVariant'],
    color: theme.colors.gold,
    marginLeft: 12,
  },
  collectBtn: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    marginLeft: 12,
  },
  collectBtnText: {
    ...theme.type.label,
    color: theme.colors.textPrimary,
  },
  itemName: {
    ...theme.type.body,
    fontWeight: '700',
  },
  statText: {
    ...theme.type.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  equippedByText: {
    ...theme.type.caption,
    color: theme.colors.goldBright,
    marginTop: 2,
  },
  equipBtn: {
    backgroundColor: theme.colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    marginLeft: 12,
  },
  equipBtnText: {
    ...theme.type.label,
    color: theme.colors.bgDeep,
  },
  unequipBtn: {
    backgroundColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    marginLeft: 12,
  },
  unequipBtnText: {
    ...theme.type.label,
    color: theme.colors.danger,
  },
  // Equipment type selector
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  typeBtnActive: {
    backgroundColor: theme.colors.gold,
  },
  typeBtnText: {
    ...theme.type.caption,
    color: theme.colors.textPrimary,
  },
  typeBtnTextActive: {
    color: theme.colors.bgDeep,
  },
  // Materials grid
  materialsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  materialCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  materialCardMissing: {
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.surface,
  },
  materialIcon: {
    fontSize: 22,
  },
  materialName: {
    ...theme.type.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  materialNameMissing: {
    color: theme.colors.danger,
    fontWeight: '700',
  },
  materialCount: {
    ...theme.type.stat,
    fontVariant: ['tabular-nums'] as import('react-native').TextStyle['fontVariant'],
    color: theme.colors.textPrimary,
  },
  materialCountMissing: {
    color: theme.colors.danger,
  },
  // Lottie FX overlay
  forgeFx: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalTitle: {
    ...theme.type.h2,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...theme.type.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  modalList: {
    flexGrow: 0,
    maxHeight: 300,
  },
  modalHeroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
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
    ...theme.type.body,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  modalHeroClass: {
    ...theme.type.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  modalHeroTextDisabled: {
    color: theme.colors.textMuted,
  },
  alreadyEquippedBadge: {
    ...theme.type.caption,
    fontWeight: '700',
    color: theme.colors.gold,
    marginLeft: 8,
  },
  fullBadge: {
    ...theme.type.caption,
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
    ...theme.type.body,
    color: theme.colors.textSecondary,
  },
});
