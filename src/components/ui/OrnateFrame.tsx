import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../../theme';
import { FrameCorner } from './icons/FrameCorner';

interface OrnateFrameProps {
  children: React.ReactNode;
  corner?: 'gold' | 'wood';
  radius?: keyof typeof theme.borderRadius;
  padding?: keyof typeof theme.spacing;
  elevation?: keyof typeof theme.elevation;
}

export function OrnateFrame({ children, corner = 'gold', radius = 'md', padding = 'md', elevation = 'e2' }: OrnateFrameProps) {
  const cornerColor = corner === 'gold' ? theme.colors.borderGold : theme.colors.border;
  return (
    <View
      style={[
        styles.base,
        { borderRadius: theme.borderRadius[radius], padding: theme.spacing[padding], borderColor: cornerColor },
        theme.elevation[elevation],
      ]}
    >
      <View style={[styles.corner, styles.tl]}><FrameCorner color={cornerColor} /></View>
      <View style={[styles.corner, styles.tr]}><FrameCorner color={cornerColor} /></View>
      <View style={[styles.corner, styles.bl]}><FrameCorner color={cornerColor} /></View>
      <View style={[styles.corner, styles.br]}><FrameCorner color={cornerColor} /></View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: theme.colors.surface, borderWidth: 2 },
  corner: { position: 'absolute', width: 16, height: 16 },
  tl: { top: -1, left: -1 },
  tr: { top: -1, right: -1, transform: [{ scaleX: -1 }] },
  bl: { bottom: -1, left: -1, transform: [{ scaleY: -1 }] },
  br: { bottom: -1, right: -1, transform: [{ scaleX: -1 }, { scaleY: -1 }] },
});
