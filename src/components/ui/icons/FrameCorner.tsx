import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../../../theme';

interface FrameCornerProps {
  size?: number;
  color?: string;
}

export function FrameCorner({ size = 16, color = theme.colors.borderGold }: FrameCornerProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M0 0h16v3H3v13H0V0z" fill={color} />
      <Path d="M5 5h6v2H7v4H5V5z" fill={color} />
    </Svg>
  );
}
