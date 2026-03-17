import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated, Dimensions, Platform } from 'react-native';
import LottieView from 'lottie-react-native';
import { useGame } from '../hooks/useGame';
import { theme } from '../theme';
import { INCAPACITATED_HP_THRESHOLD } from '../constants/game';
import { BattleRunner } from '../services/battleRunner';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';
import { playSound } from '../services/sound';
import { lightTap, successNotification } from '../services/haptics';
import { LOTTIE_ASSETS } from '../constants/assets';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function MissionResultModal() {
  const { state, dispatch } = useGame();
  const results = state.recentMissionResults ?? [];
  const [displayedLog, setDisplayedLog] = useState<string[]>([]);
  const runnerRef = useRef<BattleRunner | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const confettiRef = useRef<LottieView>(null);

  const result = results[0] ?? null;

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
          emit(FEEDBACK_EVENTS.FLOAT, { text: `-${Math.floor(action.amount)}`, color: '#ff4d4d' });
          lightTap();
        } else if (action.actionType === 'heal' && action.amount) {
          emit(FEEDBACK_EVENTS.FLOAT, { text: `+${Math.floor(action.amount)}`, color: '#2ecc71' });
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
    dispatch({ type: 'DISMISS_MISSION_RESULT', missionId: result.missionId });
  };

  const handleSkip = () => {
    runnerRef.current?.skip((a) => {
      setDisplayedLog((s) => [...s, a.text]);
    });
  };

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
              style={styles.confetti}
              loop={false}
              pointerEvents="none"
            />
          )}

          <View style={[styles.header, { backgroundColor: result.success ? '#27AE60' : '#C0392B' }]}>
            <Text style={styles.headerEmoji}>{result.success ? '🏆' : '💀'}</Text>
            <Text style={styles.title}>{result.success ? 'Vitória Real' : 'Missão Fracassada'}</Text>
          </View>

          <View style={styles.summaryContainer}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Ouro Ganho</Text>
              <Text style={styles.goldValue}>💰 {Math.floor(result.reward)}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Duração</Text>
              <Text style={styles.summaryValue}>{result.rounds} Turnos</Text>
            </View>
          </View>

          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Relatório do Comandante</Text>
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
              {result.casualties.map((c) => (
                <View key={c.heroId} style={styles.casualtyRow}>
                  <View style={styles.heroInfo}>
                    <Text style={styles.heroName}>
                      {state.heroes.find(h => h.id === c.heroId)?.name || 'Herói'}
                    </Text>
                    {c.hpAfter < INCAPACITATED_HP_THRESHOLD && (
                      <View style={styles.incapBadge}>
                        <Text style={styles.incapText}>FERIDO</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.hpChange, { color: c.hpLost > 0 ? '#ff4d4d' : '#2ecc71' }]}>
                    {c.hpLost > 0 ? `-${Math.floor(c.hpLost)} HP` : 'INTACTO'}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipText}>Pular Relato</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeButtonText}>Retornar à Guilda</Text>
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
    backgroundColor: 'rgba(0,0,0,0.85)',
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
    borderColor: theme.colors.surfaceLight,
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
  },
  headerEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  title: { 
    fontSize: 22, 
    fontWeight: '900', 
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingVertical: 16,
  },
  summaryBox: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.1)',
  },
  summaryLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 4,
  },
  goldValue: {
    color: theme.colors.gold,
    fontSize: 20,
    fontWeight: '900',
  },
  summaryValue: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  sectionTitle: { 
    fontWeight: '800', 
    color: theme.colors.textSecondary, 
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  logContainer: {
    height: 150,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  log: { 
    padding: 12,
  },
  logContent: {
    paddingBottom: 8,
  },
  logLine: { 
    color: 'rgba(255,255,255,0.7)', 
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
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 12,
    borderRadius: 8,
  },
  heroInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroName: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  incapBadge: {
    backgroundColor: '#ff4d4d',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  incapText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  hpChange: {
    fontSize: 13,
    fontWeight: '800',
  },
  actions: { 
    flexDirection: 'row', 
    padding: 16,
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
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
    backgroundColor: theme.colors.primary,
  },
  closeButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '900',
    fontSize: 15,
    textTransform: 'uppercase',
  },
});
