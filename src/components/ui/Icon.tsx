import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ClassId } from '../../types';
import { theme } from '../../theme';
import { HpIcon, AtkIcon, MpIcon, DefIcon, SvgIconProps } from './icons/StatIcons';
import { ClassSeal } from './icons/ClassSeals';

export type IconName =
  | 'sword' | 'shield' | 'castle' | 'anvil' | 'potion' | 'coin' | 'scroll' | 'trophy'
  | 'stat-hp' | 'stat-atk' | 'stat-mp' | 'stat-def'
  | 'class-warrior' | 'class-tank' | 'class-rogue' | 'class-archer' | 'class-mage' | 'class-healer';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

const MCI_MAP: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  sword: 'sword',
  shield: 'shield',
  castle: 'castle',
  anvil: 'anvil',
  potion: 'bottle-tonic',
  coin: 'circle-multiple',
  scroll: 'script-text',
  trophy: 'trophy',
};

const STAT_MAP: Record<string, (p: SvgIconProps) => React.JSX.Element> = {
  'stat-hp': HpIcon,
  'stat-atk': AtkIcon,
  'stat-mp': MpIcon,
  'stat-def': DefIcon,
};

const CLASS_MAP: Record<string, ClassId> = {
  'class-warrior': 'WARRIOR',
  'class-tank': 'TANK',
  'class-rogue': 'ROGUE',
  'class-archer': 'ARCHER',
  'class-mage': 'MAGE',
  'class-healer': 'HEALER',
};

export function Icon({ name, size = 20, color = theme.colors.textPrimary }: IconProps) {
  const Stat = STAT_MAP[name];
  if (Stat) return <Stat size={size} color={color} />;

  const classId = CLASS_MAP[name];
  if (classId) return <ClassSeal classId={classId} size={size} color={color} />;

  const mci = MCI_MAP[name];
  if (mci) return <MaterialCommunityIcons name={mci} size={size} color={color} />;

  return null; // nome desconhecido: degrada sem crash
}
