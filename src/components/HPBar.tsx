import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface HPBarProps {
  current: number;
  max: number;
  showText?: boolean;
}

export function HPBar({ current, max, showText = true }: HPBarProps) {
  const percentage = Math.max(0, Math.min(100, Math.round((current / Math.max(1, max)) * 100)));
  
  const getBarColor = () => {
    const ratio = current / Math.max(1, max);
    if (ratio > 0.6) return '#3CB371';
    if (ratio > 0.3) return '#FFD24D';
    return '#FF7A7A';
  };

  return (
    <View style={styles.container}>
      <View style={styles.barWrap}>
        <View
          style={[
            styles.fill,
            {
              width: `${percentage}%`,
              backgroundColor: getBarColor(),
            },
          ]}
        />
        {showText && (
          <Text style={styles.overlay}>
            {Math.floor(current)}/{Math.floor(max)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  barWrap: {
    width: '100%',
    height: 14,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
  },
  fill: {
    height: '100%',
    alignSelf: 'flex-start',
  },
  overlay: {
    position: 'absolute',
    alignSelf: 'center',
    color: '#fff',
    fontWeight: '700',
    fontSize: 10,
    textShadow: '0px 1px 1px rgba(0,0,0,0.35)',
  },
});
