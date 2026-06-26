import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { theme } from '../theme';
import { AnimatedGold } from '../components/AnimatedGold';
import { Banner } from '../components/ui/Banner';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { Icon } from '../components/ui/Icon';
import { HeroCard } from '../components/HeroCard';
import { RecruitButton } from '../components/RecruitButton';
import { OfflineSummaryModal } from '../components/OfflineSummaryModal';
import { Hero } from '../types';
import { useGuild } from '../hooks/useGuild';
import { GuildEmptyState } from '../components/GuildEmptyState';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { LOTTIE_ASSETS } from '../constants/assets';
import { registerTarget } from '../onboarding/targetRegistry';
import { getRecruitCost } from '../utils/math';
import { emitSecondRecruitHint } from '../services/milestones';
import { useGame } from '../hooks/useGame';

export function GuildScreen() {
  const {
    state,
    isLoaded,
    offlineSummary,
    nextRecruitCost,
    canAfford,
    recruitHero,
    clearOfflineSummary,
    applyOfflineSummary,
    getHeroActions,
  } = useGuild();

  const { markHintSeen } = useGame();

  const recruitBtnRef = useRef<View>(null);

  useEffect(() => {
    return registerTarget('recruit-button', () =>
      new Promise((resolve) => {
        const node = recruitBtnRef.current as any;
        if (!node?.measureInWindow) return resolve(null);
        node.measureInWindow((x: number, y: number, width: number, height: number) =>
          resolve({ x, y, width, height })
        );
      })
    );
  }, []);

  const onRecruitGuarded = useCallback(() => {
    const cost = getRecruitCost(state.heroesRecruited);
    if (state.gold < cost && !state.onboarding?.hintsSeen.second_recruit) {
      emitSecondRecruitHint();
      markHintSeen('second_recruit');
    }
    recruitHero();
  }, [state.heroesRecruited, state.gold, state.onboarding, recruitHero, markHintSeen]);

  const recruitRef = useRef<LottieView>(null);
  const prevCount = useRef(state.heroes.length);
  useEffect(() => {
    if (state.heroes.length > prevCount.current) {
      recruitRef.current?.play();
    }
    prevCount.current = state.heroes.length;
  }, [state.heroes.length]);

  if (!isLoaded) {
    return <LoadingScreen message="Carregando guilda..." />;
  }

  const renderHero = ({ item }: { item: Hero }) => (
    <HeroCard
      hero={item}
      actions={getHeroActions(item)}
      equippedCosmetics={state.cosmetics?.equipped}
    />
  );

  return (
    <ScreenContainer
      scroll={false}
      banner={
        <Banner
          title="Guilda"
          subtitle={`${state.heroes.length} herói${state.heroes.length !== 1 ? 's' : ''}`}
          right={<AnimatedGold gold={state.gold} />}
        />
      }
    >
      <View style={styles.recruitSection} ref={recruitBtnRef} collapsable={false}>
        <RecruitButton cost={nextRecruitCost} canAfford={canAfford} onPress={onRecruitGuarded} />
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Icon name="sword" size={14} color={theme.colors.statAtk} />
          <Text style={styles.summaryText}>
            {state.heroes.filter((h) => h.currentTask !== 'IDLE').length} Ativos
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Icon name="sleep" size={14} color={theme.colors.textMuted} />
          <Text style={styles.summaryText}>
            {state.heroes.filter((h) => h.currentTask === 'IDLE').length} Ociosos
          </Text>
        </View>
      </View>

      {state.heroes.length === 0 ? (
        <GuildEmptyState />
      ) : (
        <FlatList
          data={state.heroes}
          renderItem={renderHero}
          keyExtractor={(hero) => hero.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.recruitFx} pointerEvents="none">
        <LottieView
          ref={recruitRef}
          source={LOTTIE_ASSETS.RECRUIT}
          style={StyleSheet.absoluteFillObject}
          loop={false}
        />
      </View>

      <OfflineSummaryModal
        visible={!!offlineSummary}
        summary={offlineSummary}
        onApply={applyOfflineSummary}
        onDismiss={clearOfflineSummary}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  recruitSection: { marginBottom: theme.spacing.md },
  summaryRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryText: { ...theme.type.caption, color: theme.colors.textSecondary },
  listContent: { paddingBottom: theme.spacing.xl },
  recruitFx: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
});
