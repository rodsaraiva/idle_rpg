import { MissionTemplate } from '../constants/missions';
import { Hero } from '../types';

export interface MissionRewardOptions {
  healerBuffMultiplier?: number; // multiplicative buff to statSum (e.g. 1.1)
  rogueRngBonus?: number; // additive bonus to rng max (e.g. 0.02)
  rng?: () => number;
}

export function calcMissionReward(
  template: MissionTemplate,
  heroes: Hero[],
  opts?: MissionRewardOptions
) {
  const rngFn = opts?.rng ?? Math.random;
  const weights = template.statWeights ?? { hp: 0.2, atk: 1.0, mp: 0.1 };
  const scale = template.scale ?? 1;
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

  const rogueBonus = opts?.rogueRngBonus ?? 0;
  // base random factor in [0.9, 1.1], allow small increase up to cap via rogueBonus
  const baseRandom = 0.9 + rngFn() * 0.2; // [0.9,1.1]
  const randomFactor = Math.min(1.1 + rogueBonus, Math.max(0.9, baseRandom + rogueBonus));

  const raw = statSum * scale * randomFactor;
  const value = Math.round(Math.max(template.rewardMin, Math.min(template.rewardMax, raw)));
  return value;
}

