import { handleSetTickInterval, handleSetTrainInflation } from '../../context/systemHandler';
import { initialGameState } from '../../context/gameReducer';

describe('systemHandler', () => {
  test('handleSetTickInterval updates tickIntervalMs', () => {
    const next = handleSetTickInterval(initialGameState, 500);
    expect(next.tickIntervalMs).toBe(500);
  });

  test('handleSetTrainInflation updates trainInflationFactor', () => {
    const next = handleSetTrainInflation(initialGameState, 0.2);
    expect(next.trainInflationFactor).toBe(0.2);
  });
});
