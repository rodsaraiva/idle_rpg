import React from 'react';
import { act, create } from 'react-test-renderer';
import { GameProvider } from '../../context/GameContext';
import { loadGameState as realLoad } from '../../services/storage';
import { GameState, HeroTask } from '../../types';
import { TICK_INTERVAL_MS } from '../../constants/game';
import { getMissionGoldPerTick } from '../../utils/math';

jest.mock('../../services/storage');

const mockedLoad = realLoad as jest.MockedFunction<typeof realLoad>;

describe('GameContext offline application', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('applies offline progress and exposes offlineSummary', async () => {
    const twoHoursMs = 1000 * 60 * 60 * 2;
    // hero on mission with atk 10
    const savedState: GameState = {
      gold: 0,
      heroes: [
        {
          id: 'h1',
          name: 'OfflineHero',
          hp: 10,
          atk: 10,
          mp: 0,
          currentTask: HeroTask.MISSION,
        },
      ],
      heroesRecruited: 1,
      lastSavedAt: Date.now() - twoHoursMs,
    };

    mockedLoad.mockResolvedValue(savedState);

    let offlineSummary: any = null;
    // Consumer to expose context values
    function Consumer() {
      const { offlineSummary: s, isLoaded } = require('../../hooks/useGame').useGame();
      if (isLoaded && s) {
        offlineSummary = s;
      }
      return null;
    }

    let renderer: any;
    await act(async () => {
      renderer = create(
        <GameProvider>
          <Consumer />
        </GameProvider>
      );
      // let effects run once
      await new Promise((r) => setTimeout(r, 0));
    });

    // poll until offlineSummary is set (timeout after 5s)
    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (offlineSummary) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > 5000) {
          clearInterval(interval);
          reject(new Error('Timed out waiting for offlineSummary'));
        }
      }, 50);
    });

    await act(async () => {
      renderer.unmount();
    });

    const elapsedMs = Date.now() - savedState.lastSavedAt;
    const ticks = Math.floor(elapsedMs / TICK_INTERVAL_MS);
    const expectedGold = Math.floor(ticks * getMissionGoldPerTick(10));

    expect(offlineSummary.goldGained).toBe(expectedGold);
    expect(offlineSummary.heroesAffected).toBe(1);
    expect(offlineSummary.ticks).toBeGreaterThanOrEqual(1);
  }, 10000);
});

