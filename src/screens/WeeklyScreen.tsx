import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useContext } from 'react';
import { useWeekly, WeeklyQuestState } from '../hooks/useWeekly';
import { WeeklyBossTemplate, getWeeklyBoss } from '../constants/weeklyBosses';
import { theme } from '../theme';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { WEEKLY_BONUS_REWARD } from '../constants/weeklyQuests';
import { GameContext } from '../context/GameContext';
import { HeroTask } from '../types';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';

export function WeeklyScreen() {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useContext(GameContext);
  const {
    weeklyState,
    questStates,
    boss,
    allClaimed,
    bossDefeated,
    daysLeft,
    hoursLeft,
    minutesLeft,
    handleClaim,
  } = useWeekly();

  const availableHeroes = state.heroes.filter(h => h.currentTask === HeroTask.IDLE);

  function handleFightBoss() {
    if (bossDefeated) return;
    const seed = weeklyState?.seed ?? 0;
    const bossDef = getWeeklyBoss(seed);
    const heroIds = availableHeroes
      .slice(0, Math.min(availableHeroes.length, 5))
      .map(h => h.id);
    if (heroIds.length < bossDef.minHeroes) {
      emit(FEEDBACK_EVENTS.TOAST, {
        text: `Necessários ${bossDef.minHeroes} heróis disponíveis. Disponíveis: ${heroIds.length}.`,
      });
      return;
    }
    dispatch({ type: 'START_WEEKLY_BOSS', heroIds, now: Date.now() });
  }

  const allCompleted = questStates.every(q => q.completed);
  const allQuestsClaimed = questStates.every(q => q.claimed);

  const resetLabel = daysLeft > 0
    ? `Renova em ${daysLeft}d ${hoursLeft}h`
    : `Renova em ${hoursLeft}h ${minutesLeft}m`;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <View style={styles.headerWrapper}>
        <ScreenHeader
          title="Desafio Semanal"
          subtitle={resetLabel}
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
            <Text style={styles.emptyText}>Carregando desafio semanal...</Text>
          </View>
        ) : (
          <>
            {/* Boss card */}
            {boss && (
              <BossCard boss={boss} bossDefeated={bossDefeated} onFight={handleFightBoss} />
            )}

            {/* Quest cards */}
            {questStates.map(({ def, current, completed, claimed }) => (
              <WeeklyQuestCard
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
                  <Text style={styles.bonusTitle}>Bônus Semanal</Text>
                  <Text style={styles.bonusSubtitle}>
                    Complete todas as {questStates.length} missões semanais
                  </Text>
                </View>
                <View style={styles.bonusRewardBadge}>
                  <Text style={styles.bonusRewardText}>+{WEEKLY_BONUS_REWARD}</Text>
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
                <Text style={styles.bonusClaimedText}>Bônus coletado!</Text>
              ) : allCompleted && allQuestsClaimed ? (
                <Text style={styles.bonusPendingText}>Colete todas as recompensas acima</Text>
              ) : (
                <Text style={styles.bonusPendingText}>
                  {questStates.filter(q => q.claimed).length}/{questStates.length} missões completas
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function BossCard({ boss, bossDefeated, onFight }: { boss: WeeklyBossTemplate; bossDefeated: boolean; onFight: () => void }) {
  return (
    <View style={[styles.bossCard, bossDefeated && styles.bossCardDefeated]}>
      <View style={styles.bossHeader}>
        <Text style={styles.bossIcon}>{'🐉'}</Text>
        <View style={styles.bossInfo}>
          <Text style={styles.bossTitle}>{boss.bossName}</Text>
          <Text style={styles.bossSubtitle}>
            {boss.minHeroes}+ heróis • Dificuldade {boss.difficulty}
          </Text>
        </View>
        <View style={styles.bossRewardBadge}>
          <Text style={styles.bossRewardText}>+{boss.baseReward}</Text>
          <Text style={styles.bossRewardGoldIcon}>{'🪙'}</Text>
        </View>
      </View>

      {bossDefeated ? (
        <View style={styles.bossDefeatedBanner}>
          <Text style={styles.bossDefeatedText}>{'✓'} Derrotado esta semana</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.bossButton}
          onPress={onFight}
          disabled={false}
          activeOpacity={0.7}
          accessibilityLabel="Enfrentar Boss"
        >
          <Text style={styles.bossButtonText}>Enfrentar Boss</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function WeeklyQuestCard({
  def,
  current,
  completed,
  claimed,
  onClaim,
}: WeeklyQuestState & { onClaim: () => void }) {
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
  scrollView: { flex: 1 },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    gap: 12,
  },
  emptyContainer: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: theme.colors.textSecondary, fontSize: 14 },

  // Boss card
  bossCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.danger,
    gap: 12,
  },
  bossCardDefeated: {
    borderColor: theme.colors.success,
    opacity: 0.75,
  },
  bossHeader: { flexDirection: 'row', alignItems: 'center' },
  bossIcon: { fontSize: 28, marginRight: theme.spacing.md },
  bossInfo: { flex: 1 },
  bossTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  bossSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  bossRewardBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bossRewardText: { color: theme.colors.gold, fontSize: 16, fontWeight: '800' },
  bossRewardGoldIcon: { fontSize: 16 },
  bossButton: {
    backgroundColor: theme.colors.danger,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  bossButtonDisabled: {
    backgroundColor: theme.colors.surfaceLight,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  bossButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  bossDefeatedBanner: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  bossDefeatedText: {
    color: theme.colors.success,
    fontWeight: '700',
    fontSize: 14,
  },

  // Quest card (espelha DailyQuestsScreen)
  questCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
  },
  questCardClaimed: { opacity: 0.6 },
  questRow: { flexDirection: 'row', alignItems: 'center' },
  questIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  questIcon: { fontSize: 22 },
  questInfo: { flex: 1, marginRight: theme.spacing.sm },
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
  progressBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  progressBarComplete: { backgroundColor: theme.colors.success },
  progressText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    gap: 4,
  },
  claimButtonText: { color: '#1a1a1a', fontSize: 14, fontWeight: '800' },
  claimButtonGold: { fontSize: 14 },
  claimedBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  claimedBadgeText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  rewardPreview: { flexDirection: 'row', alignItems: 'center', gap: 2, opacity: 0.5 },
  rewardPreviewText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' },
  rewardPreviewGold: { fontSize: 12 },

  // Bonus card (espelha DailyQuestsScreen)
  bonusCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.gold,
    marginTop: 4,
  },
  bonusCardClaimed: { borderColor: theme.colors.success, opacity: 0.7 },
  bonusHeader: { flexDirection: 'row', alignItems: 'center' },
  bonusIcon: { fontSize: 28, marginRight: theme.spacing.md },
  bonusTextContainer: { flex: 1 },
  bonusTitle: { color: theme.colors.gold, fontSize: 16, fontWeight: '800' },
  bonusSubtitle: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  bonusRewardBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bonusRewardText: { color: theme.colors.gold, fontSize: 16, fontWeight: '800' },
  bonusRewardGoldIcon: { fontSize: 16 },
  bonusProgressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  bonusDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  bonusDotFilled: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  bonusDotEmpty: { backgroundColor: 'transparent', borderColor: theme.colors.textMuted },
  bonusClaimedText: { color: theme.colors.success, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  bonusPendingText: { color: theme.colors.textSecondary, fontSize: 12, textAlign: 'center' },
});
