import { MissionTemplate } from '../constants/missions';
import { Hero } from '../types';

export interface MissionRewardOptions {
  healerBuffMultiplier?: number; // multiplicative buff to statSum (e.g. 1.1)
  rogueRngBonus?: number; // additive bonus to rng max (e.g. 0.02)
  rng?: () => number;
  // non-linear curve parameters
  ref?: number; // reference statSum that maps to 1.0 before exponent
  exponent?: number; // curve exponent (>1 compresses lows)
  synergyK?: number; // team synergy coefficient
  scale?: number; // optional override for template.scale
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
  const ref = opts?.ref ?? 250;
  const exponent = opts?.exponent ?? 2;

  // apply team composition adjustment: use average stat + synergy bonus based on team size
  // apply team composition adjustment: use average stat + synergy bonus based on team size
  const n = Math.max(1, heroes.length);
  const statAvg = statSum / n;
  const synergyK = opts?.synergyK ?? 0.05; // default synergy coefficient
  const synergy = 1 + synergyK * (n > 1 ? Math.log(n) : 0); // small bonus as team grows
  const effectiveStat = statAvg * synergy;
  const normalized = Math.max(0, Math.min(effectiveStat / ref, 1));
  const curved = Math.pow(normalized, exponent); // 0..1
  // dynamic scale decreases with team size: scaleMultiplier = max(0.1, 1 - 0.1 * n)
  const scaleMultiplier = Math.max(0.1, 1 - 0.1 * n);
  const dynamicScale = (template.scale ?? 1) * scaleMultiplier;

  // base mapped reward in [rewardMin, rewardMax] before RNG (apply dynamicScale)
  const baseMapped = template.rewardMin + (template.rewardMax - template.rewardMin) * curved * dynamicScale;

  // RNG with optional rogue bonus
  const rogueBonus = opts?.rogueRngBonus ?? 0;
  const baseRandom = 0.9 + rngFn() * 0.2; // [0.9,1.1]
  const randomFactor = Math.min(1.1 + rogueBonus, Math.max(0.9, baseRandom + rogueBonus));

  const raw = baseMapped * randomFactor;
  const value = Math.round(Math.max(template.rewardMin, Math.min(template.rewardMax, raw)));
  return value;
}
 

