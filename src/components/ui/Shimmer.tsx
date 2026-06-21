import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../../theme';

interface ShimmerProps {
  width?: number | string;
  height: number;
  radius?: keyof typeof theme.borderRadius;
}

export function Shimmer({ width = '100%', height, radius = 'md' }: ShimmerProps) {
  const offset = useSharedValue(-1);

  useEffect(() => {
    offset.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );
  }, [offset]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${offset.value * 100}%` as any }],
  }));

  return (
    <View
      style={[
        styles.base,
        { width: width as any, height, borderRadius: theme.borderRadius[radius] },
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            theme.colors.borderGold,
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.surfaceRaised,
    overflow: 'hidden',
  },
});
