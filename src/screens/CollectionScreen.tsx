/**
 * CollectionScreen — Catálogo de cosméticos do jogador.
 *
 * DÉBITO (device-bound, SPEC 9): compra real de cosméticos premium via IAP
 * (RevenueCat / StoreKit / Play Billing). Esta tela exibe apenas os cosméticos
 * ganhos por atividade (login streak, marcos). Os itens ainda não possuídos
 * aparecem como "Em breve" — sem botão de compra com dinheiro real neste slice.
 *
 * Validação visual: manual-pending (Playwright).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useGame } from '../hooks/useGame';
import { COSMETICS, type Cosmetic } from '../constants/cosmetics';
import { collectionView } from '../utils/collectionUtils';
import { theme } from '../theme';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { Banner } from '../components/ui/Banner';
import { Card } from '../components/ui/Card';
import { Icon, IconName } from '../components/ui/Icon';
// Re-exporta para facilitar imports de testes que preferem importar do screen
export { collectionView } from '../utils/collectionUtils';

// ---------------------------------------------------------------------------
// Componente de item de cosmético
// ---------------------------------------------------------------------------

const SLOT_ICONS: Record<Cosmetic['slot'], IconName> = {
  frame: 'image-frame',
  seal: 'seal',
  theme: 'palette',
};

interface CosmeticCardProps {
  cosmetic: Cosmetic;
  isOwned: boolean;
  isEquipped: boolean;
  onEquip?: () => void;
}

function CosmeticCard({ cosmetic, isOwned, isEquipped, onEquip }: CosmeticCardProps) {
  const rarityToken = theme.rarity[cosmetic.rarity];
  const borderColor = isOwned ? rarityToken.color : theme.colors.border;

  return (
    <Card elevation="e1" padding="sm">
      <View style={[styles.itemRow, { borderColor, borderWidth: 1, borderRadius: theme.borderRadius.sm }]}>
        {/* Ícone do slot */}
        <View style={[styles.iconContainer, { backgroundColor: isOwned ? theme.colors.surface : theme.colors.bgDeep }]}>
          <Icon
            name={SLOT_ICONS[cosmetic.slot]}
            size={28}
            color={isOwned ? rarityToken.color : theme.colors.textMuted}
          />
        </View>

        {/* Info */}
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, !isOwned && styles.dimmed]}>{cosmetic.name}</Text>
          <Text style={[styles.itemMeta, { color: rarityToken.color }]}>
            {rarityToken.label} · {SLOT_LABEL[cosmetic.slot]}
          </Text>
        </View>

        {/* Status / botão */}
        {isOwned ? (
          isEquipped ? (
            <View style={styles.equippedBadge}>
              <Text style={styles.equippedText}>Equipado</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.equipBtn} onPress={onEquip} accessibilityLabel={`Equipar ${cosmetic.name}`}>
              <Text style={styles.equipBtnText}>Equipar</Text>
            </TouchableOpacity>
          )
        ) : (
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>Em breve</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const SLOT_LABEL: Record<Cosmetic['slot'], string> = {
  frame: 'Moldura',
  seal: 'Selo',
  theme: 'Tema',
};

// ---------------------------------------------------------------------------
// Tela principal
// ---------------------------------------------------------------------------

export function CollectionScreen() {
  const { state, dispatch } = useGame();
  const { owned, locked } = collectionView(state);
  const equipped = state.cosmetics?.equipped ?? {};

  function equipCosmetic(slot: Cosmetic['slot'], id: string) {
    dispatch({ type: 'EQUIP_COSMETIC', slot, cosmeticId: id });
  }

  return (
    <ScreenContainer
      banner={
        <Banner
          title="Coleção"
          subtitle={`${owned.length} / ${COSMETICS.length} cosméticos`}
        />
      }
    >
      {/* Secção: Possuídos */}
      {owned.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Possuídos</Text>
          {owned.map((c) => {
            const isEquipped = equipped[c.slot] === c.id;
            return (
              <CosmeticCard
                key={c.id}
                cosmetic={c}
                isOwned
                isEquipped={isEquipped}
                onEquip={() => equipCosmetic(c.slot, c.id)}
              />
            );
          })}
        </View>
      )}

      {/* Secção: Bloqueados / Em breve */}
      {locked.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Em breve</Text>
          <Text style={styles.sectionSubtitle}>
            Cosméticos ganhos por login streak, marcos e futuramente via loja premium (SPEC 9 — IAP device-bound).
          </Text>
          {locked.map((c) => (
            <CosmeticCard key={c.id} cosmetic={c} isOwned={false} isEquipped={false} />
          ))}
        </View>
      )}

      {owned.length === 0 && locked.length === 0 && (
        <View style={styles.emptyState}>
          <Icon name="gift" size={48} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>Nenhum cosmético disponível ainda.</Text>
        </View>
      )}
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.type.h2,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  sectionSubtitle: {
    ...theme.type.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...theme.type.body,
    color: theme.colors.textPrimary,
    fontWeight: 'bold',
  },
  itemMeta: {
    ...theme.type.caption,
  },
  dimmed: {
    color: theme.colors.textMuted,
  },
  equippedBadge: {
    backgroundColor: theme.colors.gold,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  equippedText: {
    ...theme.type.label,
    color: theme.colors.bgDeep,
  },
  equipBtn: {
    borderWidth: 1,
    borderColor: theme.colors.gold,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  equipBtnText: {
    ...theme.type.label,
    color: theme.colors.gold,
  },
  comingSoonBadge: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  comingSoonText: {
    ...theme.type.label,
    color: theme.colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  emptyText: {
    ...theme.type.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
