import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { ClassId } from '../../../types';
import { theme } from '../../../theme';

interface ClassSealProps {
  classId: ClassId;
  size?: number;
  color?: string;
}

// Glifo simples por classe (substituído por arte final em SPEC 3 se necessário).
const GLYPHS: Record<ClassId, string> = {
  WARRIOR: 'M12 3l3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1z',
  TANK: 'M12 3 5 6v5c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3z',
  ROGUE: 'M5 4l8 8-2 2-8-8 2-2zm14 14-5-5-2 2 5 5 2-2z',
  ARCHER: 'M4 20 20 4M14 4h6v6M9 15l-5 5',
  MAGE: 'M12 2 9 9l-7 1 5 5-1 7 6-3 6 3-1-7 5-5-7-1-3-7z',
  HEALER: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4z',
  COMMANDER: 'M12 3l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z M8 14h8v1H8z M9 16h6v4H9z',
};

export function ClassSeal({ classId, size = 24, color = theme.colors.gold }: ClassSealProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={11} fill="none" stroke={color} strokeWidth={1.5} />
      <Path d={GLYPHS[classId]} fill={color} stroke={color} strokeWidth={1} />
    </Svg>
  );
}
