import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated, Dimensions, Platform } from 'react-native';
import LottieView from 'lottie-react-native';
import { useGame } from '../hooks/useGame';
import { theme } from '../theme';
import { MAX_BATTLE_ROUNDS } from '../constants/game';
import { BattleRunner } from '../services/battleRunner';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';
import { lightTap, successNotification } from '../services/haptics';
import { LOTTIE_ASSETS } from '../constants/assets';
import { Icon } from './ui/Icon';
import { MissionResult } from '../types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  result?: MissionResult;
  onDismiss?: () => void;
}

/** Sem props, lê `recentMissionResults` do estado — é como a MissionsScreen usa hoje. */
export function MissionResultModal({ result: resultProp, onDismiss }: Props = {}) {
  const { state, dispatch } = useGame();
  const results = state.recentMissionResults ?? [];
  const [displayedLog, setDisplayedLog] = useState<string[]>([]);
  const runnerRef = useRef<BattleRunner | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const confettiRef = useRef<LottieView>(null);

  const result = resultProp ?? results[0] ?? null;

  useEffect(() => {
    if (!result) {
      fadeAnim.setValue(0);
      slideAnim.setValue(SCREEN_HEIGHT);
      return;
    }

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();

    if (result.success) {
      setTimeout(() => confettiRef.current?.play(), 500);
    }

    setDisplayedLog([]);
    if (result.actions && result.actions.length > 0) {
      runnerRef.current = new BattleRunner(result.actions as any, 600); // Faster playback

      const handleAction = (action: any) => {
        setDisplayedLog((s) => [...s, action.text]);

        if (action.actionType === 'hit' && action.amount) {
          emit(FEEDBACK_EVENTS.FLOAT, { text: `-${Math.floor(action.amount)}`, color: theme.colors.danger });
          lightTap();
        } else if (action.actionType === 'heal' && action.amount) {
          emit(FEEDBACK_EVENTS.FLOAT, { text: `+${Math.floor(action.amount)}`, color: theme.colors.success });
          lightTap();
        }

        if (action.targetId) {
          emit(FEEDBACK_EVENTS.BATTLE_HIGHLIGHT, { id: action.targetId, duration: 600 });
        }
      };

      const handleComplete = () => {
        setDisplayedLog((s) => {
          if (!result.log) return s;
          const remaining = result.log.slice(s.length);
          return [...s, ...remaining];
        });
        if (result.success) {
          successNotification();
        }
      };

      startTimerRef.current = setTimeout(() => {
        startTimerRef.current = null;
        runnerRef.current?.start(handleAction, handleComplete);
      }, 800);
    } else {
      setDisplayedLog(result.log ?? []);
    }

    return () => {
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
      }
      runnerRef.current?.stop();
    };
  }, [result]);

  if (!result) return null;

  const handleClose = () => {
    runnerRef.current?.stop();
    (onDismiss ?? (() => dispatch({ type: 'DISMISS_MISSION_RESULT', missionId: result.missionId })))();
  };

  const handleSkip = () => {
    runnerRef.current?.skip((a) => {
      setDisplayedLog((s) => [...s, a.text]);
    });
  };

  // Battle summary label
  const isTimeout = result.rounds >= MAX_BATTLE_ROUNDS && !result.success;
  const battleSummaryText = isTimeout
    ? `Timeout apos ${MAX_BATTLE_ROUNDS} rounds`
    : result.success
      ? `Vitoria em ${result.rounds} rounds`
      : `Derrota no round ${result.rounds}`;

  // Enemy summary
  const totalEnemies = result.totalEnemies ?? 0;
  const enemySummaryText = totalEnemies > 0
    ? `${result.enemyCasualties}/${totalEnemies} inimigos derrotados`
    : `${result.enemyCasualties} inimigos derrotados`;

  return (
    <Modal visible={true} animationType="none" transparent={true}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {result.success && (
            <LottieView
              ref={confettiRef}
              source={LOTTIE_ASSETS.CONFETTI}
              style={[styles.confetti, { pointerEvents: 'none' }]}
              loop={false}
            />
          )}

          <View style={[styles.header, { backgroundColor: result.success ? theme.colors.success : theme.colors.statHp }]}>
            <Icon name={result.success ? 'trophy' : 'skull'} size={40} color={theme.colors.textPrimary} />
            <Text style={styles.title}>{result.success ? 'Vitoria Real' : 'Missao Fracassada'}</Text>
            <Text style={styles.battleSummary}>{battleSummaryText}</Text>
          </View>

          <View style={styles.summaryContainer}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Ouro Ganho</Text>
              <View style={styles.goldRow}>
                <Icon name="gold-coin" size={18} color={theme.colors.gold} />
                <Text style={styles.goldValue}>{Math.floor(result.reward)}</Text>
              </View>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Duracao</Text>
              <Text style={styles.summaryValue}>{result.rounds} Turnos</Text>
            </View>
            <View style={[styles.summaryBox, { borderRightWidth: 0 }]}>
              <Text style={styles.summaryLabel}>Inimigos</Text>
              <View style={styles.enemyRow}>
                <Icon name="sword" size={13} color={result.enemyCasualties === totalEnemies && totalEnemies > 0 ? theme.colors.success : theme.colors.textPrimary} />
                <Text style={[
                  styles.summaryValue,
                  { color: result.enemyCasualties === totalEnemies && totalEnemies > 0 ? theme.colors.success : theme.colors.textPrimary }
                ]}>
                  {enemySummaryText}
                </Text>
              </View>
            </View>
          </View>

          {result.activeSynergies && result.activeSynergies.length > 0 && (
            <View style={styles.synergiesContainer}>
              <Text style={styles.synergiesLabel}>Sinergias Ativas</Text>
              <View style={styles.synergiesBadges}>
                {result.activeSynergies.map((name) => (
                  <View key={name} style={styles.synergyBadge}>
                    <Text style={styles.synergyText}>{name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Relatorio do Comandante</Text>
            <View style={styles.logContainer}>
              <ScrollView
                style={styles.log}
                contentContainerStyle={styles.logContent}
                ref={(ref) => ref?.scrollToEnd({ animated: true })}
              >
                {displayedLog.map((line, i) => (
                  <Text key={i} style={styles.logLine}>{line}</Text>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.sectionTitle}>Estado da Tropa</Text>
            <View style={styles.casualties}>
              {result.casualties.map((c) => {
                const hero = state.heroes.find(h => h.id === c.heroId);
                const heroName = hero?.name || 'Heroi';
                const heroMaxHp = hero?.hpMax ?? 0;
                const isIncapacitated = c.hpAfter <= 0;
                const isUnharmed = c.hpLost === 0;

                return (
                  <View key={c.heroId} style={styles.casualtyRow}>
                    <View style={styles.heroInfo}>
                      <Text style={styles.heroName}>{heroName}</Text>
                      {isIncapacitated && (
                        <View style={styles.incapBadge}>
                          <Icon name="skull" size={9} color={theme.colors.textPrimary} />
                          <Text style={styles.incapText}>INCAPACITADO</Text>
                        </View>
                      )}
                      {isUnharmed && !isIncapacitated && (
                        <View style={styles.ilesoBadge}>
                          <Icon name="unharmed" size={9} color={theme.colors.success} />
                          <Text style={styles.ilesoText}>ILESO</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.hpDetail}>
                      {!isUnharmed && (
                        <View style={styles.hpLostRow}>
                          <Icon name="heart" size={12} color={theme.colors.danger} />
                          <Text style={styles.hpLost}>-{Math.floor(c.hpLost)} HP</Text>
                        </View>
                      )}
                      <Text style={[
                        styles.hpRemaining,
                        { color: isIncapacitated ? theme.colors.danger : isUnharmed ? theme.colors.success : theme.colors.textSecondary }
                      ]}>
                        {Math.floor(Math.max(0, c.hpAfter))}/{heroMaxHp}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipText}>Pular Relato</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeButtonText}>Retornar a Guilda</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlayDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '92%',
    maxHeight: '85%',
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.surfaceRaised,
    elevation: 10,
  },
  confetti: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  header: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...theme.type.h1,
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  battleSummary: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSubdued,
    marginTop: 6,
  },
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.overlayMid,
    paddingVertical: 12,
  },
  summaryBox: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.colors.dividerLight,
    paddingHorizontal: 4,
  },
  summaryLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 4,
  },
  goldRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goldValue: {
    color: theme.colors.gold,
    fontSize: 18,
    fontWeight: '900',
  },
  enemyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hpLostRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryValue: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  synergiesContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  synergiesLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  synergiesBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  synergyBadge: {
    backgroundColor: theme.colors.goldDark,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.goldBright,
  },
  synergyText: {
    color: theme.colors.goldBright,
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    ...theme.type.label,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  logContainer: {
    height: 150,
    backgroundColor: theme.colors.overlayLight,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.dividerFaint,
  },
  log: {
    padding: 12,
  },
  logContent: {
    paddingBottom: 8,
  },
  logLine: {
    color: theme.colors.textSubduedMid,
    fontSize: 12,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  casualties: {
    gap: 8,
  },
  casualtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.rowHover,
    padding: 12,
    borderRadius: 8,
  },
  heroInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  heroName: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  incapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  incapText: {
    color: theme.colors.textPrimary,
    fontSize: 9,
    fontWeight: '900',
  },
  ilesoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  ilesoText: {
    color: theme.colors.success,
    fontSize: 9,
    fontWeight: '900',
  },
  hpDetail: {
    alignItems: 'flex-end',
  },
  hpLost: {
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  hpRemaining: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: theme.colors.overlayFaint,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceRaised,
  },
  skipText: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  closeButton: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: theme.colors.gold,
  },
  closeButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '900',
    fontSize: 15,
    textTransform: 'uppercase',
  },
});
