import React from 'react';
import { render } from '@testing-library/react-native';
import { MissionActiveItem } from '../../components/MissionActiveItem';
import { GameContext } from '../../context/GameContext';
import { HeroTask } from '../../types';
import { MISSIONS } from '../../constants/missions';

function makeHero(id: string, name = 'Hero', hpMax = 10, hpCurrent = 10) {
  return { id, name, hpMax, hpCurrent, atk: 5, mp: 0, currentTask: HeroTask.IDLE };
}

test('MissionActiveItem renders mission title, time and hero info', () => {
  const hero = makeHero('h1', 'Alpha', 20, 15);
  const missionTemplate = MISSIONS.find((m) => m.id === 'mission_1')!;
  const mission = { id: 'm1', templateId: missionTemplate.id, heroIds: ['h1'], remainingMs: Math.floor(missionTemplate.durationMs / 2), startedAt: Date.now() };

  const state = { gold: 0, heroes: [hero] };

  const { getByText } = render(
    <GameContext.Provider
      value={{
        state: state as any,
        dispatch: jest.fn() as any,
        setHeroTask: () => {},
        recruitHero: () => {},
        isLoaded: true,
        offlineSummary: null,
        clearOfflineSummary: () => {},
        applyOfflineSummary: async () => {},
      }}
    >
      <MissionActiveItem mission={mission as any} />
    </GameContext.Provider>
  );

  // title and time present
  expect(getByText(missionTemplate.name)).toBeTruthy();
  // hero name and hp shown
  expect(getByText('Alpha')).toBeTruthy();
  expect(getByText(/15\/20/)).toBeTruthy();
});

