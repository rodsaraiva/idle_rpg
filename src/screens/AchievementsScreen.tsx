import React from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useGame } from '../hooks/useGame';
import { ACHIEVEMENTS } from '../constants/achievements';

export function AchievementsScreen() {
  const { state } = useGame();
  const insets = useSafeAreaInsets();
  const unlocked = state.unlockedAchievements ?? [];

  const unlockedCount = unlocked.length;
  const totalCount = ACHIEVEMENTS.length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <View style={styles.headerWrapper}>
        <ScreenHeader
          title="Conquistas"
          subtitle={`${unlockedCount}/${totalCount} desbloqueadas`}
          showGold={false}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {ACHIEVEMENTS.map((achievement) => {
          const isUnlocked = unlocked.includes(achievement.id);
          return (
            <View
              key={achievement.id}
              style={[styles.card, isUnlocked ? styles.cardUnlocked : styles.cardLocked]}
            >
              <View style={[styles.iconContainer, isUnlocked ? styles.iconUnlocked : styles.iconLocked]}>
                <Text style={styles.icon}>{achievement.icon}</Text>
              </View>
              <View style={styles.content}>
                <View style={styles.titleRow}>
                  <Text style={[styles.name, !isUnlocked && styles.textLocked]}>
                    {achievement.name}
                  </Text>
                  {isUnlocked && <Text style={styles.checkmark}>{'✅'}</Text>}
                </View>
                <Text style={[styles.description, !isUnlocked && styles.textLocked]}>
                  {achievement.description}
                </Text>
                <View style={styles.rewardRow}>
                  {achievement.reward.gold != null && achievement.reward.gold > 0 && (
                    <Text style={[styles.rewardTag, !isUnlocked && styles.rewardTagLocked]}>
                      +{achievement.reward.gold} ouro
                    </Text>
                  )}
                  {achievement.reward.permanentAtkBonus != null && achievement.reward.permanentAtkBonus > 0 && (
                    <Text style={[styles.rewardTag, styles.rewardTagAtk, !isUnlocked && styles.rewardTagLocked]}>
                      +{achievement.reward.permanentAtkBonus} ATK
                    </Text>
                  )}
                  {achievement.reward.permanentHpBonus != null && achievement.reward.permanentHpBonus > 0 && (
                    <Text style={[styles.rewardTag, styles.rewardTagHp, !isUnlocked && styles.rewardTagLocked]}>
                      +{achievement.reward.permanentHpBonus} HP
                    </Text>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
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
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  cardUnlocked: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.success,
  },
  cardLocked: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.surfaceLight,
    opacity: 0.6,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  iconUnlocked: {
    backgroundColor: theme.colors.surfaceLight,
  },
  iconLocked: {
    backgroundColor: theme.colors.surfaceLight,
  },
  icon: {
    fontSize: 22,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  checkmark: {
    fontSize: 16,
    marginLeft: theme.spacing.sm,
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  textLocked: {
    color: theme.colors.textMuted,
  },
  rewardRow: {
    flexDirection: 'row',
    gap: 6,
  },
  rewardTag: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.gold,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  rewardTagAtk: {
    color: theme.colors.atk,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
  },
  rewardTagHp: {
    color: theme.colors.hp,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  rewardTagLocked: {
    opacity: 0.5,
  },
});
