import { getRecruitCost, formatNumber, makeRng } from '../../utils/math';
import {
  RECRUIT_BASE_COST,
  RECRUIT_COST_MULTIPLIER,
} from '../../constants/game';

describe('math utils', () => {
  test('getRecruitCost grows exponentially', () => {
    expect(getRecruitCost(0)).toBe(Math.floor(RECRUIT_BASE_COST * Math.pow(RECRUIT_COST_MULTIPLIER, 0)));
    expect(getRecruitCost(1)).toBe(Math.floor(RECRUIT_BASE_COST * Math.pow(RECRUIT_COST_MULTIPLIER, 1)));
    expect(getRecruitCost(5)).toBe(Math.floor(RECRUIT_BASE_COST * Math.pow(RECRUIT_COST_MULTIPLIER, 5)));
  });

  test('formatNumber formats large numbers', () => {
    expect(formatNumber(123)).toBe('123');
    expect(formatNumber(1234)).toBe('1.2K');
    expect(formatNumber(1_234_567)).toBe('1.2M');
    expect(formatNumber(3_500_000_000)).toBe('3.5B');
  });
});

describe('makeRng (mulberry32)', () => {
  test('mesmo seed produz mesma sequência', () => {
    const r1 = makeRng(42);
    const r2 = makeRng(42);
    const seq1 = Array.from({ length: 20 }, () => r1());
    const seq2 = Array.from({ length: 20 }, () => r2());
    expect(seq1).toEqual(seq2);
  });

  test('seeds diferentes produzem sequências diferentes', () => {
    const r1 = makeRng(1);
    const r2 = makeRng(2);
    const seq1 = Array.from({ length: 10 }, () => r1());
    const seq2 = Array.from({ length: 10 }, () => r2());
    expect(seq1).not.toEqual(seq2);
  });

  test('retorna valores em [0, 1)', () => {
    const r = makeRng(99);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

