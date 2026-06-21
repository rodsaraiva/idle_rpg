import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../../theme';

interface DividerProps {
  variant?: 'plain' | 'ornament';
  color?: string;
}

export function Divider({ variant = 'plain', color = theme.colors.borderGold }: DividerProps) {
  if (variant === 'plain') {
    return <View style={[styles.line, { backgroundColor: color }]} />;
  }
  return (
    <View style={styles.ornamentRow}>
      <View style={[styles.lineFlex, { backgroundColor: color }]} />
      <Svg width={16} height={16} viewBox="0 0 16 16">
        <Path d="M8 1l7 7-7 7-7-7 7-7z" fill={color} />
      </Svg>
      <View style={[styles.lineFlex, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: { height: 1, width: '100%', marginVertical: theme.spacing.sm },
  ornamentRow: { flexDirection: 'row', alignItems: 'center', marginVertical: theme.spacing.sm },
  lineFlex: { flex: 1, height: 1 },
});
