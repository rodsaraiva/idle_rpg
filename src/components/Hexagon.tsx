import React from 'react';
import { View, StyleSheet, Text, ViewStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { HEX_WIDTH, HEX_HEIGHT } from '../constants/game';
import { theme } from '../theme';

interface HexagonProps {
  children?: React.ReactNode;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Componente Hexagon usando SVG para evitar artefatos visuais e garantir cores sólidas.
 * Pointy-top layout.
 */
export const Hexagon: React.FC<HexagonProps> = ({ 
  children, 
  fill = theme.colors.surfaceLight, 
  stroke = theme.colors.border, 
  strokeWidth = 1,
  style,
}) => {
  // Coordenadas dos pontos para um hexágono "pointy-top" (ponta para cima)
  // O SVG usa um sistema de coordenadas 0,0 no topo esquerdo.
  const w = HEX_WIDTH;
  const h = HEX_HEIGHT;
  
  // Pontos (x,y):
  // 1: Topo Central
  // 2: Médio Direita Superior
  // 3: Médio Direita Inferior
  // 4: Base Central
  // 5: Médio Esquerda Inferior
  // 6: Médio Esquerda Superior
  const points = `
    ${w / 2},0 
    ${w},${h / 4} 
    ${w},${(3 * h) / 4} 
    ${w / 2},${h} 
    0,${(3 * h) / 4} 
    0,${h / 4}
  `;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.svgWrapper}>
        <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <Polygon
            points={points}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        </Svg>
      </View>
      <View style={styles.content}>
        {children}
      </View>
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
  svgWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: HEX_WIDTH,
    height: HEX_HEIGHT,
  },
  content: {
    width: HEX_WIDTH,
    height: HEX_HEIGHT * 0.5, // Foca o conteúdo na parte central retangular
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
