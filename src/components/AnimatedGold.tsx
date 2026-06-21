import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { theme } from '../theme';
import { formatNumber } from '../utils/math';
import { Icon } from './ui/Icon';

interface AnimatedGoldProps {
  gold: number;
}

export function AnimatedGold({ gold }: AnimatedGoldProps) {
  const animated = useSharedValue(gold);
  const scale = useSharedValue(1);
  const [display, setDisplay] = useState(gold);

  useEffect(() => {
    if (gold > animated.value) {
      scale.value = withSequence(
        withTiming(1.12, { duration: 150 }),
        withTiming(1, { duration: 250 })
      );
    }
    animated.value = withTiming(gold, { duration: 600, easing: Easing.out(Easing.cubic) });
    // Garante que `display` converge ao valor final (fallback quando env de teste não anima)
    setDisplay(gold);
  }, [gold, animated, scale]);

  useDerivedValue(() => {
    runOnJS(setDisplay)(Math.floor(animated.value));
  }, [animated]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.container, scaleStyle]}>
      <View style={styles.iconCircle}>
        <Icon name="coin" size={14} color={theme.colors.bgDeep} />
      </View>
      <Text
        style={styles.value}
        accessibilityLabel={`Ouro da guilda: ${formatNumber(gold)}`}
        accessible
      >
        {formatNumber(display)}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    paddingRight: 12,
    paddingLeft: 4,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.goldDark,
    alignSelf: 'flex-end',
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  value: {
    ...theme.type.stat,
    fontVariant: ['tabular-nums'] as import('react-native').TextStyle['fontVariant'],
    fontSize: 16,
    color: theme.colors.gold,
    textAlign: 'right',
  },
});

export default AnimatedGold;
