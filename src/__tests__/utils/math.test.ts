import { getRecruitCost, getMissionGoldPerTick, formatNumber } from '../../utils/math';
import {
  RECRUIT_BASE_COST,
  RECRUIT_COST_MULTIPLIER,
  MISSION_BASE_GOLD,
  GOLD_PER_ATK,
} from '../../constants/game';

describe('math utils', () => {
  test('getRecruitCost grows exponentially', () => {
    expect(getRecruitCost(0)).toBe(Math.floor(RECRUIT_BASE_COST * Math.pow(RECRUIT_COST_MULTIPLIER, 0)));
    expect(getRecruitCost(1)).toBe(Math.floor(RECRUIT_BASE_COST * Math.pow(RECRUIT_COST_MULTIPLIER, 1)));
    expect(getRecruitCost(5)).toBe(Math.floor(RECRUIT_BASE_COST * Math.pow(RECRUIT_COST_MULTIPLIER, 5)));
  });

  test('getMissionGoldPerTick follows formula', () => {
    const atk = 10;
    expect(getMissionGoldPerTick(atk)).toBe(MISSION_BASE_GOLD + atk * GOLD_PER_ATK);
  });

  test('formatNumber formats large numbers', () => {
    expect(formatNumber(123)).toBe('123');
    expect(formatNumber(1234)).toBe('1.2K');
    expect(formatNumber(1_234_567)).toBe('1.2M');
    expect(formatNumber(3_500_000_000)).toBe('3.5B');
  });
});

