import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MissionHeroSelectionModal } from '../../components/MissionHeroSelectionModal';
import { HeroTask, Hero } from '../../types';

function makeHero(id: string, name = 'Hero', incapacitated = false): Hero {
  return {
    id,
    name,
    hpMax: 10,
    hpCurrent: 10,
    atk: 5,
    mp: 3,
    currentTask: HeroTask.IDLE,
    classId: 'WARRIOR',
    avatarUrl: undefined,
    ...(incapacitated ? { incapacitatedUntilMs: Date.now() + 10000 } : {}),
  } as Hero;
}

test('slots are cleared when selectableHeroes list changes (hero removed)', async () => {
  const h1 = makeHero('h1', 'Alpha');
  const h2 = makeHero('h2', 'Beta');
  const onConfirm = jest.fn();
  const onClose = jest.fn();

  const { getByText, queryByText, rerender } = render(
    <MissionHeroSelectionModal
      visible
      onClose={onClose}
      selectableHeroes={[h1, h2]}
      minHeroes={0}
      templateId="mission_1"
      onConfirm={onConfirm}
    />
  );

  // place Alpha
  fireEvent.press(getByText('Alpha'));
  // ensure it's in the grid (name appears)
  expect(getByText('Alpha')).toBeTruthy();

  // now simulate external removal: rerender with selectableHeroes only containing Beta
  rerender(
    <MissionHeroSelectionModal
      visible
      onClose={onClose}
      selectableHeroes={[h2]}
      minHeroes={0}
      templateId="mission_1"
      onConfirm={onConfirm}
    />
  );

  // Alpha should be removed from the grid
  await waitFor(() => {
    expect(queryByText('Alpha')).toBeNull();
  });
});

