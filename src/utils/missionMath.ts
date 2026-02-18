import { MissionTemplate } from '../constants/missions';
import { Hero } from '../types';

export interface MissionRewardOptions {
  healerBuffMultiplier?: number; // multiplicative buff to statSum (e.g. 1.1)
  rogueRngBonus?: number; // additive bonus to rng max (e.g. 0.02)
  rng?: () => number;
  // non-linear curve parameters
  ref?: number; // reference statSum that maps to 1.0 before exponent
  exponent?: number; // curve exponent (>1 compresses lows)
}

export function calcMissionReward(
  template: MissionTemplate,
  heroes: Hero[],
  opts?: MissionRewardOptions
) {
  const rngFn = opts?.rng ?? Math.random;
  const weights = template.statWeights ?? { hp: 0.2, atk: 1.0, mp: 0.1 };

  // base stat sum (weighted)
  const statSumBase = heroes.reduce((acc, h) => {
    return (
      acc +
      (h.hp * (weights.hp ?? 0)) +
      (h.atk * (weights.atk ?? 0)) +
      (h.mp * (weights.mp ?? 0))
    );
  }, 0);

  const healerBuff = opts?.healerBuffMultiplier ?? 1;
  const statSum = statSumBase * healerBuff;

  // non-linear mapping parameters (defaults)
  const ref = opts?.ref ?? 20;
  const exponent = opts?.exponent ?? 1.6;

  // normalize and apply exponent to compress low values
  const normalized = Math.max(0, Math.min(statSum / ref, 1));
  const curved = Math.pow(normalized, exponent); // 0..1

  // base mapped reward in [rewardMin, rewardMax] before RNG
  const baseMapped = template.rewardMin + (template.rewardMax - template.rewardMin) * curved;

  // RNG with optional rogue bonus
  const rogueBonus = opts?.rogueRngBonus ?? 0;
  const baseRandom = 0.9 + rngFn() * 0.2; // [0.9,1.1]
  const randomFactor = Math.min(1.1 + rogueBonus, Math.max(0.9, baseRandom + rogueBonus));

  const raw = baseMapped * randomFactor;
  const value = Math.round(Math.max(template.rewardMin, Math.min(template.rewardMax, raw)));
  return value;
}
 

