import React from 'react';
import { View, StyleSheet, Text, ViewStyle } from 'react-native';
import { HEX_WIDTH, HEX_HEIGHT } from '../constants/game';
import { theme } from '../theme';

interface HexagonProps {
  children?: React.ReactNode;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  style?: ViewStyle | ViewStyle[];
  label?: string;
  labelColor?: string;
}

/**
 * Componente Hexagon usando CSS puro para criar o formato.
 * Formato: Ponta para cima (Flat-top variation) ou Lados retos (Pointy-top).
 * Usaremos Pointy-top (ponta para cima) para melhor encaixe lateral 5x10.
 */
export const Hexagon: React.FC<HexagonProps> = ({ 
  children, 
  fill = theme.colors.surfaceLight, 
  stroke = theme.colors.border, 
  strokeWidth = 1,
  style,
  label,
  labelColor = theme.colors.textSecondary
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Parte superior (triângulo) */}
      <View style={[styles.before, { borderBottomColor: stroke }]} />
      <View style={[styles.before, { borderBottomColor: fill, top: strokeWidth, borderBottomWidth: HEX_HEIGHT / 4 - strokeWidth }]} />
      
      {/* Corpo central (retângulo) */}
      <View style={[styles.body, { backgroundColor: fill, borderColor: stroke, borderLeftWidth: strokeWidth, borderRightWidth: strokeWidth }]}>
        {children}
        {label && <Text style={[styles.label, { color: labelColor }]}>{label}</Text>}
      </View>
      
      {/* Parte inferior (triângulo invertido) */}
      <View style={[styles.after, { borderTopColor: stroke }]} />
      <View style={[styles.after, { borderTopColor: fill, bottom: strokeWidth, borderTopWidth: HEX_HEIGHT / 4 - strokeWidth }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: HEX_WIDTH,
    height: HEX_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    width: HEX_WIDTH,
    height: HEX_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 2,
  },
  before: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: HEX_WIDTH / 2,
    borderLeftColor: 'transparent',
    borderRightWidth: HEX_WIDTH / 2,
    borderRightColor: 'transparent',
    borderBottomWidth: HEX_HEIGHT / 4,
    zIndex: 1,
  },
  after: {
    position: 'absolute',
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftWidth: HEX_WIDTH / 2,
    borderLeftColor: 'transparent',
    borderRightWidth: HEX_WIDTH / 2,
    borderRightColor: 'transparent',
    borderTopWidth: HEX_HEIGHT / 4,
    zIndex: 1,
  },
  label: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  }
});
