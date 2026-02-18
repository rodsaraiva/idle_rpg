import { MissionTemplate } from '../constants/missions';
import { Hero } from '../types';

export function calcMissionReward(template: MissionTemplate, heroes: Hero[], rng = Math.random) {
  const weights = template.statWeights ?? { hp: 0.2, atk: 1.0, mp: 0.1 };
  const scale = template.scale ?? 1;
  const statSum = heroes.reduce((acc, h) => {
    return (
      acc +
      (h.hp * (weights.hp ?? 0)) +
      (h.atk * (weights.atk ?? 0)) +
      (h.mp * (weights.mp ?? 0))
    );
  }, 0);
  const randomFactor = 0.9 + rng() * 0.2; // 0.9 - 1.1
  let raw = statSum * scale * randomFactor;
  // clamp to template bounds
  const value = Math.round(Math.max(template.rewardMin, Math.min(template.rewardMax, raw)));
  return value;
}

