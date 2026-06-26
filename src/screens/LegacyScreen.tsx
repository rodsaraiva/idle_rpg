import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useGame } from '../hooks/useGame';
import { theme } from '../theme';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { Banner } from '../components/ui/Banner';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import {
  LEGACY_UPGRADES,
  availableLegacyPoints,
  canBuy,
  legacyRewardMultiplier,
  legacyDurationMultiplier,
  legacyTrainSpeedFactor,
  legacyMissionSlotBonus,
  LegacyUpgrade,
} from '../constants/legacyUpgrades';
import { legacyExpThreshold } from '../constants/legacy';

/** Rótulo de efeito legível para exibição */
function effectLabel(upg: LegacyUpgrade): string {
  switch (upg.effect) {
    case 'missionRewardPct':
      return `+${upg.perRank}% Gold/Missão por rank`;
    case 'missionDurationPct':
      return `−${upg.perRank}% Duração de Missão por rank`;
    case 'trainSpeedPct':
      return `+${upg.perRank}% Velocidade de Treino por rank`;
    case 'missionSlot':
      return `+${upg.perRank} Slot de Missão por rank`;
  }
}

export function LegacyScreen() {
  const { state, dispatch } = useGame();

  const legacy = state.legacy ?? { level: 0, totalExp: 0, sealsEarned: [] };
  const points = availableLegacyPoints(state);
  const expForNext = legacyExpThreshold(legacy.level);
  const expProgress = Math.min(legacy.totalExp / expForNext, 1);

  const rewardMult = legacyRewardMultiplier(state);
  const durationMult = legacyDurationMultiplier(state);
  const trainFactor = legacyTrainSpeedFactor(state);
  const slotBonus = legacyMissionSlotBonus(state);

  const hasBonuses =
    rewardMult > 1 || durationMult < 1 || trainFactor > 1 || slotBonus > 0;

  return (
    <ScreenContainer
      banner={
        <Banner
          title="Legado da Guilda"
          subtitle={`Nível ${legacy.level} • ${legacy.sealsEarned.length} Selos`}
        />
      }
    >
      {/* Progresso de nível */}
      <Card elevation="e2">
        <View style={styles.levelHeader}>
          <Icon name="trophy" size={20} color={theme.colors.goldBright} />
          <Text style={styles.levelTitle}> Nível de Legado {legacy.level}</Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { flex: expProgress }]} />
          <View style={[styles.progressEmpty, { flex: 1 - expProgress }]} />
        </View>
        <Text style={styles.expText}>
          {legacy.totalExp} / {expForNext} EXP
        </Text>

        <View style={styles.pointsPill}>
          <Icon name="star" size={14} color={theme.colors.gold} />
          <Text style={styles.pointsText}>
            {' '}{points} ponto{points !== 1 ? 's' : ''} disponíve{points !== 1 ? 'is' : 'l'}
          </Text>
        </View>
      </Card>

      {/* Bônus ativos */}
      {hasBonuses && (
        <Card elevation="e1">
          <Text style={styles.sectionTitle}>Bônus Ativos</Text>
          <View style={styles.bonusGrid}>
            {rewardMult > 1 && (
              <View style={styles.bonusPill}>
                <Icon name="gold-coin" size={12} color={theme.colors.gold} />
                <Text style={styles.bonusPillText}>
                  {' '}+{Math.round((rewardMult - 1) * 100)}% Gold
                </Text>
              </View>
            )}
            {durationMult < 1 && (
              <View style={styles.bonusPill}>
                <Icon name="scroll" size={12} color={theme.colors.textSecondary} />
                <Text style={styles.bonusPillText}>
                  {' '}{Math.round((1 - durationMult) * 100)}% Menos Tempo
                </Text>
              </View>
            )}
            {trainFactor > 1 && (
              <View style={styles.bonusPill}>
                <Icon name="sword" size={12} color={theme.colors.statAtk} />
                <Text style={styles.bonusPillText}>
                  {' '}+{Math.round((trainFactor - 1) * 100)}% Treino
                </Text>
              </View>
            )}
            {slotBonus > 0 && (
              <View style={styles.bonusPill}>
                <Icon name="map-marker-path" size={12} color={theme.colors.textSecondary} />
                <Text style={styles.bonusPillText}>
                  {' '}+{slotBonus} Slot de Missão
                </Text>
              </View>
            )}
          </View>
        </Card>
      )}

      {/* Árvore de upgrades */}
      <Text style={styles.sectionTitle}>Árvore de Upgrades</Text>

      {LEGACY_UPGRADES.map(upg => {
        const currentRank = (state.legacyUpgrades ?? {})[upg.id] ?? 0;
        const purchasable = canBuy(state, upg.id);
        const maxed = currentRank >= upg.maxRank;

        return (
          <Card key={upg.id} elevation="e1">
            <View style={styles.upgradeRow}>
              <View style={styles.upgradeInfo}>
                <Text style={styles.upgradeName}>{upg.name}</Text>
                <Text style={styles.upgradeEffect}>{effectLabel(upg)}</Text>

                {/* Pips de rank */}
                <View style={styles.rankPips}>
                  {Array.from({ length: upg.maxRank }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.pip,
                        i < currentRank ? styles.pipFilled : styles.pipEmpty,
                      ]}
                    />
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.buyBtn,
                  !purchasable && styles.buyBtnDisabled,
                ]}
                disabled={!purchasable}
                onPress={() =>
                  dispatch({ type: 'BUY_LEGACY_UPGRADE', upgradeId: upg.id })
                }
              >
                <Text style={[
                  styles.buyBtnText,
                  !purchasable && styles.buyBtnTextDisabled,
                ]}>
                  {maxed ? 'MAX' : purchasable ? 'Comprar' : '—'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        );
      })}

      {/* Selos obtidos */}
      {legacy.sealsEarned.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            Selos Obtidos ({legacy.sealsEarned.length})
          </Text>
          <Card elevation="e1">
            <View style={styles.sealsGrid}>
              {legacy.sealsEarned.map(id => (
                <View key={id} style={styles.sealChip}>
                  <Text style={styles.sealChipText}>{id}</Text>
                </View>
              ))}
            </View>
          </Card>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...theme.type.label,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  // Nível / EXP
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  levelTitle: {
    ...theme.type.h2,
    color: theme.colors.goldBright,
  },
  progressTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.xs,
  },
  progressFill: {
    backgroundColor: theme.colors.gold,
  },
  progressEmpty: {
    backgroundColor: theme.colors.surface,
  },
  expText: {
    ...theme.type.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
  pointsText: {
    ...theme.type.label,
    color: theme.colors.gold,
  },
  // Bônus ativos
  bonusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  bonusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bonusPillText: {
    ...theme.type.caption,
    color: theme.colors.textPrimary,
  },
  // Upgrade card
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  upgradeInfo: {
    flex: 1,
  },
  upgradeName: {
    ...theme.type.body,
    color: theme.colors.textPrimary,
    fontWeight: '700',
  },
  upgradeEffect: {
    ...theme.type.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
    marginBottom: theme.spacing.xs,
  },
  rankPips: {
    flexDirection: 'row',
    gap: 4,
  },
  pip: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
  },
  pipFilled: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.goldBright,
  },
  pipEmpty: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.border,
  },
  // Botão comprar
  buyBtn: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gold,
    minWidth: 80,
    alignItems: 'center',
  },
  buyBtnDisabled: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buyBtnText: {
    ...theme.type.label,
    color: theme.colors.bgDeep,
  },
  buyBtnTextDisabled: {
    color: theme.colors.textMuted,
  },
  // Selos
  sealsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  sealChip: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
  sealChipText: {
    ...theme.type.caption,
    color: theme.colors.goldBright,
  },
});
