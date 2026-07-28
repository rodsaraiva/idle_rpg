import { LOTTIE_ASSETS } from '../../constants/assets';

describe('assets', () => {
  test('LOTTIE_ASSETS tem as 6 chaves esperadas', () => {
    expect(Object.keys(LOTTIE_ASSETS).sort()).toEqual(
      ['CHEST_PULSE', 'CONFETTI', 'FORGE_COMPLETE', 'LEVEL_UP', 'RECRUIT', 'SPARKLE_BURST'].sort()
    );
  });

  test('cada Lottie resolve (require não-nulo)', () => {
    for (const key of Object.keys(LOTTIE_ASSETS)) {
      expect((LOTTIE_ASSETS as Record<string, unknown>)[key]).toBeTruthy();
    }
  });
});
