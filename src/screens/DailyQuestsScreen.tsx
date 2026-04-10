import React, { useContext, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameContext } from '../context/GameContext';
import { pickDailyQuests, DAILY_BONUS_REWARD, DailyQuestDef } from '../constants/dailyQuests';
import { theme } from '../theme';
import { ScreenHeader } from '../components/ui/ScreenHeader';

export function DailyQuestsScreen() {
  const { state, dispatch } = useContext(GameContext);
  const insets = useSafeAreaInsets();

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

  // Calculate time until reset
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const msUntilReset = tomorrow.getTime() - now.getTime();
  const hoursLeft = Math.floor(msUntilReset / (1000 * 60 * 60));
  const minutesLeft = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <View style={styles.headerWrapper}>
        <ScreenHeader
          title="Missoes Diarias"
          subtitle={`Renovam em ${hoursLeft}h ${minutesLeft}m`}
          showGold={false}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {questStates.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Carregando missoes diarias...</Text>
          </View>
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

            {/* Bonus card */}
            <View style={[styles.bonusCard, allClaimed && styles.bonusCardClaimed]}>
              <View style={styles.bonusHeader}>
                <Text style={styles.bonusIcon}>{'🏆'}</Text>
                <View style={styles.bonusTextContainer}>
                  <Text style={styles.bonusTitle}>Bonus Diario</Text>
                  <Text style={styles.bonusSubtitle}>
                    Complete todas as 3 missoes diarias
                  </Text>
                </View>
                <View style={styles.bonusRewardBadge}>
                  <Text style={styles.bonusRewardText}>+{DAILY_BONUS_REWARD}</Text>
                  <Text style={styles.bonusRewardGoldIcon}>{'🪙'}</Text>
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
                <Text style={styles.bonusClaimedText}>Bonus coletado!</Text>
              ) : allCompleted && allQuestsClaimed ? (
                <Text style={styles.bonusPendingText}>Colete todas as recompensas acima</Text>
              ) : (
                <Text style={styles.bonusPendingText}>
                  {questStates.filter(q => q.claimed).length}/3 missoes completas
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
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
    <View style={[styles.questCard, claimed && styles.questCardClaimed]}>
      <View style={styles.questRow}>
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
            <Text style={styles.claimButtonGold}>{'🪙'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.rewardPreview}>
            <Text style={styles.rewardPreviewText}>{def.reward}</Text>
            <Text style={styles.rewardPreviewGold}>{'🪙'}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerWrapper: {
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },

  // Quest card
  questCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
  },
  questCardClaimed: {
    opacity: 0.6,
  },
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  questIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceLight,
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
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  questNameClaimed: {
    textDecorationLine: 'line-through',
    color: theme.colors.textSecondary,
  },

  // Progress bar
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
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

  // Claim button
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
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '800',
  },
  claimButtonGold: {
    fontSize: 14,
  },

  // Claimed badge
  claimedBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  claimedBadgeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },

  // Reward preview (not yet claimable)
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
  rewardPreviewGold: {
    fontSize: 12,
  },

  // Bonus card
  bonusCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.gold,
    marginTop: 4,
  },
  bonusCardClaimed: {
    borderColor: theme.colors.success,
    opacity: 0.7,
  },
  bonusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bonusIcon: {
    fontSize: 28,
    marginRight: theme.spacing.md,
  },
  bonusTextContainer: {
    flex: 1,
  },
  bonusTitle: {
    color: theme.colors.gold,
    fontSize: 16,
    fontWeight: '800',
  },
  bonusSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  bonusRewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bonusRewardText: {
    color: theme.colors.gold,
    fontSize: 16,
    fontWeight: '800',
  },
  bonusRewardGoldIcon: {
    fontSize: 16,
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
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  bonusPendingText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
});
