import { computePointsFromMs } from '../../utils/trainingMath';

describe('computePointsFromMs', () => {
  describe('k=0 (sem inflação)', () => {
    test('retorna 0 pontos quando availableMs <= 0', () => {
      expect(computePointsFromMs(1000, 0, 0)).toEqual({ points: 0, leftoverMs: 0 });
      expect(computePointsFromMs(1000, 0, -500)).toEqual({ points: 0, leftoverMs: 0 });
    });

    test('retorna 1 ponto exato quando availableMs == baseMs', () => {
      expect(computePointsFromMs(1000, 0, 1000)).toEqual({ points: 1, leftoverMs: 0 });
    });

    test('retorna N pontos e leftover correto', () => {
      // 3500ms / 1000ms = 3 pontos, 500ms de sobra
      expect(computePointsFromMs(1000, 0, 3500)).toEqual({ points: 3, leftoverMs: 500 });
    });

    test('retorna 0 pontos quando availableMs < baseMs', () => {
      const result = computePointsFromMs(1000, 0, 500);
      expect(result.points).toBe(0);
      expect(result.leftoverMs).toBe(500);
    });
  });

  describe('k > 0 (com inflação logarítmica)', () => {
    test('primeiro ponto custa baseMs (ln(0+1)=0 → fator 1.0)', () => {
      // timeForPoint0 = 1000 * (1 + 0.2 * ln(1)) = 1000 * 1.0 = 1000
      const result = computePointsFromMs(1000, 0.2, 1000);
      expect(result.points).toBe(1);
    });

    test('pontos crescem mais devagar que linear com k=0.2', () => {
      // Com k=0, 10.000ms = 10 pontos exatos
      // Com k=0.2, deve render menos que 10 pontos
      const withoutInflation = computePointsFromMs(1000, 0, 10000);
      const withInflation = computePointsFromMs(1000, 0.2, 10000);
      expect(withInflation.points).toBeLessThan(withoutInflation.points);
    });

    test('leftoverMs é sempre < tempo do próximo ponto', () => {
      const { points, leftoverMs } = computePointsFromMs(1000, 0.5, 50000);
      // timeForNextPoint = 1000 * (1 + 0.5 * Math.log(points + 1))
      const timeForNext = 1000 * (1 + 0.5 * Math.log(points + 1));
      expect(leftoverMs).toBeGreaterThanOrEqual(0);
      expect(leftoverMs).toBeLessThan(timeForNext);
    });

    test('cap de segurança: não processa infinitamente (com inflação)', () => {
      // Com k>0, o loop tem safety cap: break quando points > 10000
      // O resultado máximo é 10001 (incrementa antes do break)
      const result = computePointsFromMs(1, 0.001, 999_999_999);
      expect(result.points).toBeLessThanOrEqual(10001);
    });
  });
});
