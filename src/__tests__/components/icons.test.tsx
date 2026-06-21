import React from 'react';
import { render } from '@testing-library/react-native';
import { HpIcon, AtkIcon, MpIcon, DefIcon } from '../../components/ui/icons/StatIcons';
import { ClassSeal } from '../../components/ui/icons/ClassSeals';
import { FrameCorner } from '../../components/ui/icons/FrameCorner';

describe('SVGs custom', () => {
  test('os 4 stat icons renderizam sem throw', () => {
    expect(() => render(<HpIcon size={16} />)).not.toThrow();
    expect(() => render(<AtkIcon size={16} />)).not.toThrow();
    expect(() => render(<MpIcon size={16} />)).not.toThrow();
    expect(() => render(<DefIcon size={16} />)).not.toThrow();
  });

  test('ClassSeal resolve as 6 classes reais', () => {
    const classes = ['WARRIOR', 'TANK', 'ROGUE', 'ARCHER', 'MAGE', 'HEALER'] as const;
    for (const c of classes) {
      expect(() => render(<ClassSeal classId={c} size={24} />)).not.toThrow();
    }
  });

  test('FrameCorner renderiza sem throw', () => {
    expect(() => render(<FrameCorner size={16} />)).not.toThrow();
  });
});
