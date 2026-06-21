import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { Banner } from '../components/ui/Banner';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { Seal } from '../components/ui/Seal';
import { useGame } from '../hooks/useGame';
import { ACHIEVEMENTS } from '../constants/achievements';

export function AchievementsScreen() {
  const { state } = useGame();
  const unlocked = state.unlockedAchievements ?? [];

  const unlockedCount = unlocked.length;
  const totalCount = ACHIEVEMENTS.length;

  return (
    <ScreenContainer
      banner={
        <Banner
          title="Conquistas"
          subtitle={`${unlockedCount}/${totalCount} desbloqueadas`}
        />
      }
    >
      {ACHIEVEMENTS.map((achievement) => {
        const isUnlocked = unlocked.includes(achievement.id);
        return (
          <Card key={achievement.id} elevation="e1" padding="md">
            <View style={styles.row}>
              <View style={styles.iconContainer}>
                {isUnlocked ? (
                  <Seal kind="achievement" size={44} />
                ) : (
                  <Seal kind="achievement" size={44} locked />
                )}
              </View>
              <View style={styles.content}>
                <View style={styles.titleRow}>
                  <Text style={[styles.name, !isUnlocked && styles.textLocked]}>
                    {achievement.name}
                  </Text>
                  {isUnlocked && (
                    <Icon name="trophy" size={16} color={theme.colors.gold} />
                  )}
                </View>
                <Text style={[styles.description, !isUnlocked && styles.textLocked]}>
                  {achievement.description}
                </Text>
                <View style={styles.rewardRow}>
                  {achievement.reward.gold != null && achievement.reward.gold > 0 && (
                    <View style={[styles.rewardTag, !isUnlocked && styles.rewardTagLocked]}>
                      <Icon name="gold-coin" size={11} color={theme.colors.gold} />
                      <Text style={[styles.rewardText, { color: theme.colors.gold }]}>
                        +{achievement.reward.gold}
                      </Text>
                    </View>
                  )}
                  {achievement.reward.permanentAtkBonus != null && achievement.reward.permanentAtkBonus > 0 && (
                    <View style={[styles.rewardTag, !isUnlocked && styles.rewardTagLocked]}>
                      <Icon name="sword" size={11} color={theme.colors.statAtk} />
                      <Text style={[styles.rewardText, { color: theme.colors.statAtk }]}>
                        +{achievement.reward.permanentAtkBonus} ATK
                      </Text>
                    </View>
                  )}
                  {achievement.reward.permanentHpBonus != null && achievement.reward.permanentHpBonus > 0 && (
                    <View style={[styles.rewardTag, !isUnlocked && styles.rewardTagLocked]}>
                      <Icon name="heart" size={11} color={theme.colors.statHp} />
                      <Text style={[styles.rewardText, { color: theme.colors.statHp }]}>
                        +{achievement.reward.permanentHpBonus} HP
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </Card>
        );
      })}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: theme.spacing.md,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: theme.spacing.sm,
  },
  name: {
    ...theme.type.label,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  description: {
    ...theme.type.caption,
    color: theme.colors.textSecondary,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    overflow: 'hidden',
  },
  rewardText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  rewardTagLocked: {
    opacity: 0.5,
  },
});
