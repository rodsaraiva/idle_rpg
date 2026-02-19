// simulate_full.js
// Monte Carlo simulations for missions with various classes, compositions and training durations.
// Usage: node scripts/simulate_full.js
const ITER = 10000;

const BASE = { hp: 10, atk: 5, mp: 3 };
const BASE_TRAIN_TIME_MS = 10000;
const TRAIN_INFLATION_FACTOR = 0.1;

const MISSIONS = [
  { id: 'mission_1', name: 'Primeira Patrulha', minHeroes: 1, durationMs: 10000, rewardMin: 1, rewardMax: 10, statWeights: { hp: 0.2, atk: 1.0, mp: 0.1 }, scale: 1.0 },
  { id: 'mission_2', name: 'Expedição', minHeroes: 2, durationMs: 30000, rewardMin: 5, rewardMax: 50, statWeights: { hp: 0.3, atk: 1.2, mp: 0.2 }, scale: 1.15 },
  { id: 'mission_3', name: 'Assalto à Caravana', minHeroes: 3, durationMs: 60000, rewardMin: 10, rewardMax: 100, statWeights: { hp: 0.25, atk: 1.25, mp: 0.15 }, scale: 1.25 },
];

const CLASS_DEFS = {
  WARRIOR: { base: { hp: 3, atk: 2, mp: 0 }, healer: false, rogue: false },
  TANK: { base: { hp: 8, atk: 0, mp: 0 }, healer: false, rogue: false },
  ROGUE: { base: { hp: 0, atk: 1, mp: 0 }, healer: false, rogue: true },
  ARCHER: { base: { hp: 0, atk: 2, mp: 0 }, healer: false, rogue: false },
  MAGE: { base: { hp: 0, atk: 0, mp: 4 }, healer: false, rogue: false },
  HEALER: { base: { hp: 0, atk: 0, mp: 2 }, healer: true, rogue: false },
};

const CLASS_IDS = Object.keys(CLASS_DEFS);
const DURATIONS = [
  { name: '0min', ms: 0 },
  { name: '30min', ms: 30 * 60 * 1000 },
  { name: '2h', ms: 2 * 60 * 60 * 1000 },
];

function computePointsFromMs(baseMs, inflation, availableMs) {
  if (availableMs <= 0) return { points: 0, leftoverMs: 0 };
  const r = 1 + inflation;
  if (inflation === 0) {
    const n = Math.floor(availableMs / baseMs);
    return { points: n, leftoverMs: availableMs - n * baseMs };
  }
  const limit = 1 + (availableMs * (r - 1)) / baseMs;
  if (limit <= 1) return { points: 0, leftoverMs: availableMs };
  const n = Math.floor(Math.log(limit) / Math.log(r));
  const sumTime = baseMs * (Math.pow(r, n) - 1) / (r - 1);
  const leftover = availableMs - sumTime;
  return { points: n, leftoverMs: leftover };
}

function calcMissionReward(template, heroes, opts) {
  opts = opts || {};
  const weights = template.statWeights;
  const healerBuff = opts.healerBuffMultiplier || 1;
  const statSumBase = heroes.reduce((acc, h) => {
    return acc + (h.hp * (weights.hp || 0)) + (h.atk * (weights.atk || 0)) + (h.mp * (weights.mp || 0));
  }, 0);
  const statSum = statSumBase * healerBuff;
  const ref = opts.ref || 250;
  const exponent = opts.exponent || 2;
  const synergyK = opts.synergyK || 0.05;
  const n = Math.max(1, heroes.length);
  const statAvg = statSum / n;
  const synergy = 1 + synergyK * (n > 1 ? Math.log(n) : 0);
  const effectiveStat = statAvg * synergy;
  const normalized = Math.max(0, Math.min(effectiveStat / ref, 1));
  const curved = Math.pow(normalized, exponent);
  const dynamicScale = (template.scale || 1) * Math.max(0, 1 - 0.1 * n);
  const baseMappedRaw = template.rewardMin + (template.rewardMax - template.rewardMin) * curved;
  const baseMapped = baseMappedRaw * dynamicScale;
  const rogueBonus = opts.rogueRngBonus || 0;
  const baseRandom = 0.9 + Math.random() * 0.2;
  const randomFactor = Math.min(1.1 + rogueBonus, Math.max(0.9, baseRandom + rogueBonus));
  const raw = baseMapped * randomFactor;
  const value = Math.round(Math.max(template.rewardMin, Math.min(template.rewardMax, raw)));
  return value;
}

function combinations(arr, k) {
  const res = [];
  function helper(start, comb) {
    if (comb.length === k) {
      res.push([...comb]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      comb.push(arr[i]);
      helper(i + 1, comb);
      comb.pop();
    }
  }
  helper(0, []);
  return res;
}

function runScenario(template, teamClassIds, durationMs) {
  // compute hero stats after training (we simulate training focused on ATK)
  const heroes = teamClassIds.map((cid) => {
    const def = CLASS_DEFS[cid];
    const base = { hp: BASE.hp + def.base.hp, atk: BASE.atk + def.base.atk, mp: BASE.mp + def.base.mp, classId: cid };
    const { points } = computePointsFromMs(BASE_TRAIN_TIME_MS, TRAIN_INFLATION_FACTOR, durationMs);
    // assume all points go to ATK for this sim
    return { ...base, atk: base.atk + points };
  });

  const n = ITER;
  const minR = template.rewardMin;
  const maxR = template.rewardMax;
  const freq = Array(maxR + 1).fill(0);
  let mean = 0, M2 = 0;
  for (let i = 0; i < n; i++) {
    const countHealers = heroes.filter(h => CLASS_DEFS[h.classId].healer).length;
    const countRogues = heroes.filter(h => CLASS_DEFS[h.classId].rogue).length;
    const healerBuffMultiplier = 1 + Math.min(0.3, countHealers * 0.1);
    const rogueRngBonus = Math.min(0.08, countRogues * 0.02);
    const reward = calcMissionReward(template, heroes, { healerBuffMultiplier, rogueRngBonus, ref:250, exponent:2, synergyK:0.05 });
    freq[reward] = (freq[reward] || 0) + 1;
    // Welford
    const delta = reward - mean;
    mean += delta / (i + 1);
    M2 += delta * (reward - mean);
  }
  const variance = M2 / n;
  const std = Math.sqrt(variance);
  // percentiles from freq
  let cum = 0;
  const pcts = { p10: null, median: null, p90: null, min: null, max: null };
  for (let v = minR; v <= maxR; v++) {
    cum += freq[v] || 0;
    if (pcts.p10 === null && cum >= n * 0.10) pcts.p10 = v;
    if (pcts.median === null && cum >= n * 0.50) pcts.median = v;
    if (pcts.p90 === null && cum >= n * 0.90) pcts.p90 = v;
    if (pcts.min === null && freq[v]) pcts.min = v;
    if (freq[v]) pcts.max = v;
  }
  return { mean, std, median: pcts.median, p10: pcts.p10, p90: pcts.p90, min: pcts.min, max: pcts.max };
}

function main() {
  console.log(`Running ${ITER} iterations per scenario...`);
  for (const mission of MISSIONS) {
    console.log(`\n=== Mission: ${mission.id} (${mission.name}) [minHeroes=${mission.minHeroes}] ===`);
    if (mission.minHeroes === 1) {
      // single hero scenarios: each class, each duration
      for (const cid of CLASS_IDS) {
        for (const d of DURATIONS) {
          const res = runScenario(mission, [cid], d.ms);
          console.log(`Class ${cid} | Train ${d.name} | mean=${res.mean.toFixed(2)}, std=${res.std.toFixed(2)}, median=${res.median}, p10=${res.p10}, p90=${res.p90}, min=${res.min}, max=${res.max}`);
        }
      }
    } else {
      // combinations of classes of size minHeroes
      const combs = combinations(CLASS_IDS, mission.minHeroes);
      for (const comb of combs) {
        for (const d of DURATIONS) {
          const res = runScenario(mission, comb, d.ms);
          console.log(`Team ${comb.join('+')} | Train ${d.name} | mean=${res.mean.toFixed(2)}, std=${res.std.toFixed(2)}, median=${res.median}, p10=${res.p10}, p90=${res.p90}, min=${res.min}, max=${res.max}`);
        }
      }
    }
  }
}

main();

