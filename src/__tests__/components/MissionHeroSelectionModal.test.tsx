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

test('modal disables start when a positioned hero is incapacitated', async () => {
  const good = makeHero('h1', 'Alpha', false);
  const bad = makeHero('h2', 'Beta', true);
  const onConfirm = jest.fn();
  const onClose = jest.fn();

  const { getByText, queryByText } = render(
    <MissionHeroSelectionModal
      visible
      onClose={onClose}
      selectableHeroes={[good, bad]}
      minHeroes={1}
      templateId="mission_1"
      onConfirm={onConfirm}
    />
  );

  // place the incapacitated hero by tapping its item
  const badItem = getByText('Beta');
  fireEvent.press(badItem);

  // attempt to start mission - button should be disabled and error text shown
  const start = getByText('Iniciar missão');
  expect(start.props.accessibilityState?.disabled || start.props.disabled).toBeTruthy();

  await waitFor(() => {
    expect(queryByText(/não estão disponíveis/i)).toBeTruthy();
  });

  // place a good hero as well
  fireEvent.press(getByText('Alpha'));

  // Now both present but bad is invalid; still disabled
  expect(start.props.accessibilityState?.disabled || start.props.disabled).toBeTruthy();

  // remove bad by tapping its cell: find the plus or cell with its name in modal grid
  // The modal shows the hero name in the grid; pressing should remove it.
  const badInGrid = getByText('Beta');
  fireEvent.press(badInGrid);

  // After removal, start should be enabled (since Alpha is present)
  await waitFor(() => {
    // re-query start because RN Button props may not update reference
    const start2 = getByText('Iniciar missão');
    expect(start2.props.accessibilityState?.disabled || start2.props.disabled).toBeFalsy();
  });
});

test('modal resets slots when reopened', async () => {
  const hero = makeHero('h3', 'Gamma', false);
  const onConfirm = jest.fn();
  const onClose = jest.fn();

  const { getByText, rerender } = render(
    <MissionHeroSelectionModal
      visible
      onClose={onClose}
      selectableHeroes={[hero]}
      minHeroes={0}
      templateId="mission_1"
      onConfirm={onConfirm}
    />
  );

  fireEvent.press(getByText('Gamma'));
  // close and reopen modal
  rerender(
    <MissionHeroSelectionModal
      visible={false}
      onClose={onClose}
      selectableHeroes={[hero]}
      minHeroes={0}
      templateId="mission_1"
      onConfirm={onConfirm}
    />
  );
  rerender(
    <MissionHeroSelectionModal
      visible
      onClose={onClose}
      selectableHeroes={[hero]}
      minHeroes={0}
      templateId="mission_1"
      onConfirm={onConfirm}
    />
  );

  // when reopened, grid should be empty; pressing start should succeed (minHeroes=0)
  const start = getByText('Iniciar missão');
  fireEvent.press(start);
  expect(onConfirm).toHaveBeenCalled();
});

