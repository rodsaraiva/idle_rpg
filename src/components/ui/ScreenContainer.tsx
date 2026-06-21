import React from 'react';
import { View, ScrollView, StatusBar, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { Parchment } from './Parchment';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  banner?: React.ReactNode;
  texture?: 'leather' | 'none';
}

export function ScreenContainer({
  children,
  scroll = true,
  banner,
  texture = 'none',
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.viewContent]}>{children}</View>
  );

  const content = (
    <Animated.View style={styles.flex} entering={FadeInDown.duration(280)}>
      {banner}
      {body}
    </Animated.View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.bgDeep} />
      {texture === 'leather' ? <Parchment style={StyleSheet.absoluteFill} /> : null}
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgBase,
  },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  viewContent: {
    paddingHorizontal: theme.spacing.md,
  },
});
