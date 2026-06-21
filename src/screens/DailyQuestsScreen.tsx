import React, { useContext, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GameContext } from '../context/GameContext';
import { pickDailyQuests, DAILY_BONUS_REWARD, DailyQuestDef } from '../constants/dailyQuests';
import { theme } from '../theme';
import { Banner } from '../components/ui/Banner';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { AnimatedGold } from '../components/AnimatedGold';
import { Icon } from '../components/ui/Icon';

export function DailyQuestsScreen() {
  const { state, dispatch } = useContext(GameContext);

  const dailyQuests = state.dailyQuests;
  const questDefs = useMemo(() => {
    if (!dailyQuests) return [];
    return pickDailyQuests(dailyQuests.seed);
  }, [dailyQuests?.seed]);

  const questStates = useMemo(() => {
    if (!dailyQuests) return [];
    return questDefs.map(def => {
      const stateEntry = dailyQuests.quests.find(q => q.id === def.id);
      const current = dailyQuests.progress[def.tracker] ?? 0;
      const completed = current >= def.targetValue;
      const claimed = stateEntry?.claimed ?? false;
      return { def, current, completed, claimed };
    });
  }, [dailyQuests, questDefs]);

  const allClaimed = dailyQuests?.allClaimed ?? false;
  const allCompleted = questStates.every(q => q.completed);
  const allQuestsClaimed = questStates.every(q => q.claimed);

  function handleClaim(questId: string) {
    dispatch({ type: 'CLAIM_DAILY_QUEST', questId });
  }

  // Tempo até reset
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const msUntilReset = tomorrow.getTime() - now.getTime();
  const hoursLeft = Math.floor(msUntilReset / (1000 * 60 * 60));
  const minutesLeft = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <ScreenContainer
      banner={
        <Banner
          title="Missões Diárias"
          subtitle={`Renovam em ${hoursLeft}h ${minutesLeft}m`}
          right={<AnimatedGold gold={state.gold} />}
        />
      }
    >
      {questStates.length === 0 ? (
        <EmptyState
          icon="scroll"
          title="Sem missões diárias"
          subtitle="Volte amanhã para novos objetivos."
        />
      ) : (
        <>
          {questStates.map(({ def, current, completed, claimed }) => (
            <QuestCard
              key={def.id}
              def={def}
              current={current}
              completed={completed}
              claimed={claimed}
              onClaim={() => handleClaim(def.id)}
            />
          ))}

          {/* Card de bônus diário */}
          <Card elevation="e1">
            <View style={[styles.bonusInner, allClaimed && styles.bonusCardClaimed]}>
              <View style={styles.bonusHeader}>
                <View style={styles.bonusIconWrapper}>
                  <Icon name="trophy" size={28} color={theme.colors.gold} />
                </View>
                <View style={styles.bonusTextContainer}>
                  <Text style={styles.bonusTitle}>Bônus Diário</Text>
                  <Text style={styles.bonusSubtitle}>
                    Complete todas as 3 missões diárias
                  </Text>
                </View>
                <View style={styles.bonusRewardBadge}>
                  <Text style={styles.bonusRewardText}>+{DAILY_BONUS_REWARD}</Text>
                  <Icon name="gold-coin" size={16} color={theme.colors.gold} />
                </View>
              </View>

              <View style={styles.bonusProgressRow}>
                {questStates.map((q, i) => (
                  <View
                    key={i}
                    style={[
                      styles.bonusDot,
                      q.claimed ? styles.bonusDotFilled : styles.bonusDotEmpty,
                    ]}
                  />
                ))}
              </View>

              {allClaimed ? (
                <Text style={styles.bonusClaimedText}>Bônus coletado!</Text>
              ) : allCompleted && allQuestsClaimed ? (
                <Text style={styles.bonusPendingText}>Colete todas as recompensas acima</Text>
              ) : (
                <Text style={styles.bonusPendingText}>
                  {questStates.filter(q => q.claimed).length}/3 missões completas
                </Text>
              )}
            </View>
          </Card>
        </>
      )}
    </ScreenContainer>
  );
}

function QuestCard({
  def,
  current,
  completed,
  claimed,
  onClaim,
}: {
  def: DailyQuestDef;
  current: number;
  completed: boolean;
  claimed: boolean;
  onClaim: () => void;
}) {
  const progress = Math.min(current / def.targetValue, 1);

  return (
    <Card elevation="e1">
      <View style={[styles.questRow, claimed && styles.questRowClaimed]}>
        <View style={styles.questIconContainer}>
          <Text style={styles.questIcon}>{def.icon}</Text>
        </View>
        <View style={styles.questInfo}>
          <Text style={[styles.questName, claimed && styles.questNameClaimed]}>{def.name}</Text>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progress * 100}%` },
                  completed ? styles.progressBarComplete : null,
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {Math.min(current, def.targetValue)}/{def.targetValue}
            </Text>
          </View>
        </View>

        {claimed ? (
          <View style={styles.claimedBadge}>
            <Text style={styles.claimedBadgeText}>{'✓'}</Text>
          </View>
        ) : completed ? (
          <TouchableOpacity style={styles.claimButton} onPress={onClaim} activeOpacity={0.7}>
            <Text style={styles.claimButtonText}>+{def.reward}</Text>
            <Icon name="gold-coin" size={14} color={theme.colors.bgDeep} />
          </TouchableOpacity>
        ) : (
          <View style={styles.rewardPreview}>
            <Text style={styles.rewardPreviewText}>{def.reward}</Text>
            <Icon name="gold-coin" size={12} color={theme.colors.textSecondary} />
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  questRowClaimed: {
    opacity: 0.6,
  },
  questIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  questIcon: {
    fontSize: 22,
  },
  questInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  questName: {
    color: theme.colors.textPrimary,
    ...theme.type.body,
    fontWeight: '700',
    marginBottom: 6,
  },
  questNameClaimed: {
    textDecorationLine: 'line-through',
    color: theme.colors.textSecondary,
  },

  // Barra de progresso
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.gold,
    borderRadius: 4,
  },
  progressBarComplete: {
    backgroundColor: theme.colors.success,
  },
  progressText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },

  // Botão de coletar
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    gap: 4,
  },
  claimButtonText: {
    color: theme.colors.bgDeep,
    ...theme.type.label,
  },
  // Badge de coletado
  claimedBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  claimedBadgeText: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },

  // Prévia de recompensa (ainda não claimable)
  rewardPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    opacity: 0.5,
  },
  rewardPreviewText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  // Card de bônus
  bonusInner: {
    borderWidth: 2,
    borderColor: theme.colors.borderGold,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
  },
  bonusCardClaimed: {
    borderColor: theme.colors.success,
    opacity: 0.7,
  },
  bonusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bonusIconWrapper: {
    marginRight: theme.spacing.md,
  },
  bonusTextContainer: {
    flex: 1,
  },
  bonusTitle: {
    color: theme.colors.gold,
    ...theme.type.h2,
  },
  bonusSubtitle: {
    color: theme.colors.textSecondary,
    ...theme.type.caption,
    marginTop: 2,
  },
  bonusRewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bonusRewardText: {
    color: theme.colors.gold,
    ...theme.type.h2,
  },
  bonusProgressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  bonusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  bonusDotFilled: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  bonusDotEmpty: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.textMuted,
  },
  bonusClaimedText: {
    color: theme.colors.success,
    ...theme.type.label,
    textAlign: 'center',
  },
  bonusPendingText: {
    color: theme.colors.textSecondary,
    ...theme.type.caption,
    textAlign: 'center',
  },
});
