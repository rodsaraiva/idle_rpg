import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { Hero, ClassId } from '../types';
import { theme } from '../theme';
import { CLASS_DEFS } from '../constants/classes';
import { createHero } from '../utils/heroFactory';
import { playSound, stopSound, preloadSounds } from '../services/sound';
import { lightTap, heavyTap, successNotification } from '../services/haptics';
import { Platform } from 'react-native';

type RevealPhase = 'suspense' | 'opening' | 'revealed';

const SUSPENSE_DURATION_MS = 2200;
const OPENING_DURATION_MS = 500;

const CLASS_EMOJI: Record<ClassId, string> = {
  WARRIOR: '⚔️',
  TANK: '🛡️',
  ROGUE: '🗡️',
  ARCHER: '🏹',
  MAGE: '🔮',
  HEALER: '💚',
};

interface ChestRevealModalProps {
  visible: boolean;
  chestLabel: string;
  onComplete: (hero: Hero) => void;
  onCancel: () => void;
}

export function ChestRevealModal({
  visible,
  chestLabel,
  onComplete,
  onCancel,
}: ChestRevealModalProps) {
  const [phase, setPhase] = useState<RevealPhase>('suspense');
  const [revealedHero, setRevealedHero] = useState<Hero | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const cardScale = useRef(new Animated.Value(0.5)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const chestPulseRef = useRef<LottieView>(null);
  const sparkleBurstRef = useRef<LottieView>(null);
  const confettiRef = useRef<LottieView>(null);

  const runningAnims = useRef<Animated.CompositeAnimation[]>([]);
  const suspenseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    preloadSounds();
  }, []);

  // Respect user/system preference for reduced motion and degrade on web for perf
  const prefersReducedMotion =
    (Platform as any).OS === 'web' ||
    (typeof window !== 'undefined' && (window as any).matchMedia && (window as any).matchMedia('(prefers-reduced-motion: reduce)').matches);

  const resetState = useCallback(() => {
    runningAnims.current.forEach((a) => a.stop());
    runningAnims.current = [];
    if (suspenseTimer.current) clearTimeout(suspenseTimer.current);
    suspenseTimer.current = null;

    setPhase('suspense');
    setRevealedHero(null);
    pulseAnim.setValue(1);
    glowAnim.setValue(0.3);
    cardScale.setValue(0.5);
    cardOpacity.setValue(0);
  }, [pulseAnim, glowAnim, cardScale, cardOpacity]);

  useEffect(() => {
    if (!visible) {
      stopSound('chest_suspense');
      resetState();
      return;
    }
    // If reduced motion is preferred, skip suspense Lottie loops and play minimal reveal
    if (prefersReducedMotion) {
      const hero = generateHero();
      setRevealedHero(hero);
      setPhase('revealed');
      playSound('chest_reveal');
      successNotification();
      // run minimal reveal animation
      cardScale.setValue(1);
      cardOpacity.setValue(1);
      return;
    }
    startSuspense();
    return () => {
      stopSound('chest_suspense');
      resetState();
    };
  }, [visible]);

  const startSuspense = () => {
    setPhase('suspense');
    lightTap();
    playSound('chest_suspense');
    chestPulseRef.current?.play();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    runningAnims.current = [pulse, glow];
    pulse.start();
    glow.start();

    suspenseTimer.current = setTimeout(() => {
      pulse.stop();
      glow.stop();
      runningAnims.current = [];
      startOpening();
    }, SUSPENSE_DURATION_MS);
  };

  const startOpening = () => {
    setPhase('opening');
    stopSound('chest_suspense');
    playSound('chest_open');
    heavyTap();

    const hero = generateHero();
    setRevealedHero(hero);

    const openAnim = Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.3,
        duration: OPENING_DURATION_MS * 0.4,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 0,
        duration: OPENING_DURATION_MS * 0.6,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]);

    runningAnims.current = [openAnim];
    openAnim.start(() => {
      runningAnims.current = [];
      startReveal();
    });
  };

  const startReveal = () => {
    setPhase('revealed');
    playSound('chest_reveal');
    successNotification();
    // play visual effects only when allowed
    if (!prefersReducedMotion) {
      sparkleBurstRef.current?.play();
      confettiRef.current?.play();
    }

    const revealAnim = Animated.parallel([
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);

    runningAnims.current = [revealAnim];
    revealAnim.start(() => {
      runningAnims.current = [];
    });
  };

  const generateHero = (): Hero => {
    const classKeys = Object.keys(CLASS_DEFS) as ClassId[];
    const randClass = classKeys[Math.floor(Math.random() * classKeys.length)];
    return createHero(randClass);
  };

  const handleConfirm = () => {
    if (revealedHero) {
      lightTap();
      onComplete(revealedHero);
    }
  };

  const handleSkip = () => {
    if (phase !== 'revealed') {
      runningAnims.current.forEach((a) => a.stop());
      runningAnims.current = [];
      if (suspenseTimer.current) clearTimeout(suspenseTimer.current);
      suspenseTimer.current = null;
      stopSound('chest_suspense');

      const hero = revealedHero ?? generateHero();
      setRevealedHero(hero);
      setPhase('revealed');
      cardScale.setValue(1);
      cardOpacity.setValue(1);

      playSound('chest_reveal');
      successNotification();
      if (!prefersReducedMotion) {
        sparkleBurstRef.current?.play();
        confettiRef.current?.play();
      }
    }
  };

  // cleanup audio resources when modal unmounts to free memory on low-end devices
  useEffect(() => {
    return () => {
      stopSound('chest_suspense');
      stopSound('chest_open');
      stopSound('chest_reveal');
    };
  }, []);

  if (!visible) return null;

  const classDef = revealedHero?.classId ? CLASS_DEFS[revealedHero.classId] : null;
  const classEmoji = revealedHero?.classId ? CLASS_EMOJI[revealedHero.classId] : '❓';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.content}>
          {phase !== 'revealed' && (
            <>
              <Text style={styles.chestLabel}>{chestLabel}</Text>

              <View style={styles.chestContainer}>
                <LottieView
                  ref={chestPulseRef}
                  source={require('../../assets/lottie/chest_pulse.json')}
                  style={styles.lottiePulse}
                  loop
                  autoPlay={false}
                />
                <Animated.View
                  style={[
                    styles.chestIcon,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                >
                  <Animated.Text style={[styles.chestEmoji, { opacity: glowAnim }]}>
                    🎁
                  </Animated.Text>
                </Animated.View>
              </View>

              <Text style={styles.suspenseText}>
                {phase === 'suspense' ? 'Abrindo baú...' : 'Revelando...'}
              </Text>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                accessibilityRole="button"
                accessibilityLabel="Pular animação"
              >
                <Text style={styles.skipText}>Pular</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'revealed' && revealedHero && (
            <>
              <LottieView
                ref={sparkleBurstRef}
                source={require('../../assets/lottie/sparkle_burst.json')}
                style={styles.lottieBurst}
                loop={false}
                autoPlay={false}
              />
              <LottieView
                ref={confettiRef}
                source={require('../../assets/lottie/confetti.json')}
                style={styles.lottieConfetti}
                loop={false}
                autoPlay={false}
              />

              <Animated.View
                style={[
                  styles.heroCard,
                  {
                    transform: [{ scale: cardScale }],
                    opacity: cardOpacity,
                  },
                ]}
              >
                <Text style={styles.revealTitle}>Novo Herói!</Text>
                <Text style={styles.heroEmoji}>{classEmoji}</Text>
                <Text style={styles.heroName}>{revealedHero.name}</Text>
                <Text style={styles.heroClass}>{classDef?.displayName ?? 'Desconhecido'}</Text>

                <View style={styles.statsRow}>
                  <Text style={[styles.statText, { color: theme.colors.hp }]}>
                    HP {revealedHero.hpMax}
                  </Text>
                  <Text style={[styles.statText, { color: theme.colors.atk }]}>
                    ATK {revealedHero.atk}
                  </Text>
                  <Text style={[styles.statText, { color: theme.colors.mp }]}>
                    MP {revealedHero.mp}
                  </Text>
                </View>
              </Animated.View>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirm}
                accessibilityRole="button"
                accessibilityLabel="Aceitar herói"
              >
                <Text style={styles.confirmText}>Aceitar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    width: '100%',
  },
  chestLabel: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.gold,
    marginBottom: theme.spacing.lg,
  },
  chestContainer: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  lottiePulse: {
    position: 'absolute',
    width: 200,
    height: 200,
  },
  chestIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  chestEmoji: {
    fontSize: 80,
  },
  suspenseText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  skipButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  skipText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  lottieBurst: {
    position: 'absolute',
    width: 300,
    height: 300,
  },
  lottieConfetti: {
    position: 'absolute',
    width: 420,
    height: 420,
  },
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: theme.colors.gold,
    padding: theme.spacing.lg,
    alignItems: 'center',
    width: '85%',
    marginBottom: theme.spacing.lg,
  },
  revealTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.gold,
    marginBottom: theme.spacing.sm,
  },
  heroEmoji: {
    fontSize: 56,
    marginBottom: theme.spacing.sm,
  },
  heroName: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  heroClass: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  statText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  confirmButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
  },
  confirmText: {
    color: theme.colors.textPrimary,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.lg,
  },
});
