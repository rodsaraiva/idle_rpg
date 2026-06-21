import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../../../theme';

export interface SvgIconProps {
  size?: number;
  color?: string;
}

export function HpIcon({ size = 16, color = theme.colors.statHp }: SvgIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 21s-7.5-4.9-10-9.6C.4 8 2.4 4 6 4c2 0 3.4 1.1 4 2 .6-.9 2-2 4-2 3.6 0 5.6 4 4 7.4C19.5 16.1 12 21 12 21z" fill={color} />
    </Svg>
  );
}

export function AtkIcon({ size = 16, color = theme.colors.statAtk }: SvgIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 2 4 4l11 11 2-2L6 2zm12 14-2 2 2 2 2-2-2-2zM2 18l4-4 2 2-4 4-2-2z" fill={color} />
    </Svg>
  );
}

export function MpIcon({ size = 16, color = theme.colors.statMp }: SvgIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2C8 7 6 10 6 14a6 6 0 0 0 12 0c0-4-2-7-6-12z" fill={color} />
    </Svg>
  );
}

export function DefIcon({ size = 16, color = theme.colors.statDef }: SvgIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3z" fill={color} />
    </Svg>
  );
}
