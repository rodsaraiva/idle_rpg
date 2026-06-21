import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useContext } from 'react';
import { useWeekly, WeeklyQuestState } from '../hooks/useWeekly';
import { WeeklyBossTemplate, getWeeklyBoss } from '../constants/weeklyBosses';
import { theme } from '../theme';
import { Banner } from '../components/ui/Banner';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { Card } from '../components/ui/Card';
import { ComingSoon } from '../components/ui/ComingSoon';
import { AnimatedGold } from '../components/AnimatedGold';
import { WEEKLY_BONUS_REWARD } from '../constants/weeklyQuests';
import { GameContext } from '../context/GameContext';
import { HeroTask } from '../types';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';
import { Icon } from '../components/ui/Icon';

export function WeeklyScreen() {
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

  const banner = (
    <Banner
      title="Desafio Semanal"
      subtitle={resetLabel}
      right={<AnimatedGold gold={state.gold} />}
    />
  );

  return (
    <ScreenContainer scroll banner={banner}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.bgDeep} />

      {questStates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Carregando desafio semanal...</Text>
        </View>
      ) : (
        <View style={styles.gap}>
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
          <Card elevation="e2">
            <View style={[styles.bonusInner, allClaimed && styles.bonusCardClaimed]}>
              <View style={styles.bonusHeader}>
                <View style={styles.bonusTextContainer}>
                  <Text style={styles.bonusTitle}>Bônus Semanal</Text>
                  <Text style={styles.bonusSubtitle}>
                    Complete todas as {questStates.length} missões semanais
                  </Text>
                </View>
                <View style={styles.bonusRewardBadge}>
                  <Text style={styles.bonusRewardText}>+{WEEKLY_BONUS_REWARD}</Text>
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
          </Card>

          {/* Seção Boss Semanal (em breve) */}
          <ComingSoon
            icon="trophy"
            title="Boss Semanal"
            description="Em breve: enfrente o chefe da semana por recompensas épicas."
          />
        </View>
      )}
    </ScreenContainer>
  );
}

function BossCard({ boss, bossDefeated, onFight }: { boss: WeeklyBossTemplate; bossDefeated: boolean; onFight: () => void }) {
  return (
    <Card elevation="e1">
      <View style={[styles.bossInner, bossDefeated && styles.bossCardDefeated]}>
        <View style={styles.bossHeader}>
          <View style={styles.bossInfo}>
            <Text style={styles.bossTitle}>{boss.bossName}</Text>
            <Text style={styles.bossSubtitle}>
              {boss.minHeroes}+ heróis • Dificuldade {boss.difficulty}
            </Text>
          </View>
          <View style={styles.bossRewardBadge}>
            <Text style={styles.bossRewardText}>+{boss.baseReward}</Text>
          </View>
        </View>

        {bossDefeated ? (
          <View style={styles.bossDefeatedBanner}>
            <Icon name="check" size={14} color={theme.colors.success} />
            <Text style={styles.bossDefeatedText}> Derrotado esta semana</Text>
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
    </Card>
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
    <Card elevation="e1">
      <View style={[styles.questInner, claimed && styles.questCardClaimed]}>
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
              <Icon name="check" size={18} color={theme.colors.textPrimary} />
            </View>
          ) : completed ? (
            <TouchableOpacity style={styles.claimButton} onPress={onClaim} activeOpacity={0.7}>
              <Text style={styles.claimButtonText}>+{def.reward}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.rewardPreview}>
              <Text style={styles.rewardPreviewText}>{def.reward}</Text>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  emptyContainer: { alignItems: 'center', paddingTop: 40 },
  emptyText: { ...theme.type.body, color: theme.colors.textSecondary },

  // Boss card
  bossInner: { gap: 12 },
  bossCardDefeated: { opacity: 0.75 },
  bossHeader: { flexDirection: 'row', alignItems: 'center' },
  bossInfo: { flex: 1 },
  bossTitle: { ...theme.type.h2, color: theme.colors.textPrimary },
  bossSubtitle: { ...theme.type.caption, color: theme.colors.textSecondary, marginTop: 2 },
  bossRewardBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bossRewardText: { ...theme.type.h2, color: theme.colors.gold },
  bossButton: {
    backgroundColor: theme.colors.danger,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  bossButtonText: { ...theme.type.label, color: theme.colors.textPrimary },
  bossDefeatedBanner: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  bossDefeatedText: { ...theme.type.label, color: theme.colors.success },

  // Quest card
  questInner: {},
  questCardClaimed: { opacity: 0.6 },
  questRow: { flexDirection: 'row', alignItems: 'center' },
  questIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  questIcon: { fontSize: 22 },
  questInfo: { flex: 1, marginRight: theme.spacing.sm },
  questName: { ...theme.type.label, color: theme.colors.textPrimary, marginBottom: 6 },
  questNameClaimed: {
    textDecorationLine: 'line-through',
    color: theme.colors.textSecondary,
  },
  progressBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  progressBarComplete: { backgroundColor: theme.colors.success },
  progressText: { ...theme.type.caption, color: theme.colors.textSecondary, minWidth: 36, textAlign: 'right' },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    gap: 4,
  },
  claimButtonText: { ...theme.type.label, color: theme.colors.bgDeep },
  claimedBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardPreview: { flexDirection: 'row', alignItems: 'center', gap: 2, opacity: 0.5 },
  rewardPreviewText: { ...theme.type.caption, color: theme.colors.textSecondary },

  // Bonus card
  bonusInner: { gap: 8 },
  bonusCardClaimed: { opacity: 0.7 },
  bonusHeader: { flexDirection: 'row', alignItems: 'center' },
  bonusTextContainer: { flex: 1 },
  bonusTitle: { ...theme.type.h2, color: theme.colors.gold },
  bonusSubtitle: { ...theme.type.caption, color: theme.colors.textSecondary, marginTop: 2 },
  bonusRewardBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bonusRewardText: { ...theme.type.h2, color: theme.colors.gold },
  bonusProgressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  bonusDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  bonusDotFilled: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  bonusDotEmpty: { backgroundColor: 'transparent', borderColor: theme.colors.textMuted },
  bonusClaimedText: { ...theme.type.label, color: theme.colors.success, textAlign: 'center' },
  bonusPendingText: { ...theme.type.caption, color: theme.colors.textSecondary, textAlign: 'center' },
});
