// simulate_grid.js
// Grid search over ref, exponent, synergyK, scale for missions.
// Writes results to results/grid_results.csv
const fs = require('fs');
const path = require('path');

const ITER = 5000;

const BASE = { hp: 10, atk: 5, mp: 3 };
const BASE_TRAIN_TIME_MS = 10000; // fixed
const TRAIN_INFLATION_FACTOR = 0.5; // fixed

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

function computePointsFromMs(baseMs, inflationK, availableMs) {
  if (availableMs <= 0) return { points: 0, leftoverMs: 0 };
  if (inflationK === 0) {
    const n = Math.floor(availableMs / baseMs);
    return { points: n, leftoverMs: availableMs - n * baseMs };
  }
  let remaining = availableMs;
  let points = 0;
  while (remaining > 0) {
    const timeForNextPoint = baseMs * (1 + inflationK * Math.log(points + 1));
    if (remaining < timeForNextPoint) break;
    remaining -= timeForNextPoint;
    points++;
    if (points > 10000) break;
  }
  return { points, leftoverMs: remaining };
}

function calcMissionReward(template, heroes, opts) {
  opts = opts || {};
  const weights = template.statWeights;
  const healerBuff = opts.healerBuffMultiplier || 1;
  const statSumBase = heroes.reduce((acc, h) => {
    return acc + (h.hp * (weights.hp || 0)) + (h.atk * (weights.atk || 0)) + (h.mp * (weights.mp || 0));
  }, 0);
  const statSum = statSumBase * healerBuff;
  const ref = opts.ref;
  const exponent = opts.exponent;
  const synergyK = opts.synergyK;
  const n = Math.max(1, heroes.length);
  const statAvg = statSum / n;
  const synergy = 1 + synergyK * (n > 1 ? Math.log(n) : 0);
  const effectiveStat = statAvg * synergy;
  const normalized = Math.max(0, Math.min(effectiveStat / ref, 1));
  const curved = Math.pow(normalized, exponent);
  const dynamicScale = (opts.scale || template.scale || 1) * Math.max(0, 1 - 0.1 * n);
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

function statsFromArray(arr) {
  arr.sort((a, b) => a - b);
  const n = arr.length;
  const sum = arr.reduce((s, x) => s + x, 0);
  const mean = sum / n;
  const sq = arr.reduce((s, x) => s + (x - mean) * (x - mean), 0);
  const std = Math.sqrt(sq / n);
  const median = arr[Math.floor(n / 2)];
  const p10 = arr[Math.floor(n * 0.1)];
  const p90 = arr[Math.floor(n * 0.9)];
  const min = arr[0];
  const max = arr[n - 1];
  return { mean, std, median, p10, p90, min, max };
}

// Grid definitions (5 values each)
const REFS = [50, 100, 150, 250, 400];
const EXPONENTS = [1.4, 1.6, 1.8, 2.0, 2.4];
const SYNERGYS = [0.01, 0.03, 0.05, 0.08, 0.12];
const SCALES = [0.8, 1.0, 1.15, 1.3, 1.5];

const OUT_DIR = path.join(__dirname, '..', 'results');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_FILE = path.join(OUT_DIR, 'grid_results.csv');
const header = 'ref,exponent,synergyK,scale,mission_id,team,train,mean,std,median,p10,p90,min,max\n';
fs.writeFileSync(OUT_FILE, header);

function runForCombo(ref, exponent, synergyK, scale) {
  for (const mission of MISSIONS) {
    const teams = mission.minHeroes === 1 ? CLASS_IDS.map(c => [c]) : combinations(CLASS_IDS, mission.minHeroes);
    for (const team of teams) {
      for (const d of DURATIONS) {
        // build heroes with training points allocated to ATK (as before)
        const heroes = team.map((cid) => {
          const def = CLASS_DEFS[cid];
          const base = { hp: BASE.hp + def.base.hp, atk: BASE.atk + def.base.atk, mp: BASE.mp + def.base.mp, classId: cid };
          const { points } = computePointsFromMs(BASE_TRAIN_TIME_MS, TRAIN_INFLATION_FACTOR, d.ms);
          return { ...base, atk: base.atk + points };
        });
        const results = [];
        for (let i = 0; i < ITER; i++) {
          const countHealers = heroes.filter(h => CLASS_DEFS[h.classId].healer).length;
          const countRogues = heroes.filter(h => CLASS_DEFS[h.classId].rogue).length;
          const healerBuffMultiplier = 1 + Math.min(0.3, countHealers * 0.1);
          const rogueRngBonus = Math.min(0.08, countRogues * 0.02);
          const reward = calcMissionReward(mission, heroes, { healerBuffMultiplier, rogueRngBonus, ref, exponent, synergyK, scale });
          results.push(reward);
        }
        const s = statsFromArray(results);
        const line = `${ref},${exponent},${synergyK},${scale},${mission.id},"${team.join('+')}",${d.name},${s.mean.toFixed(4)},${s.std.toFixed(4)},${s.median},${s.p10},${s.p90},${s.min},${s.max}\n`;
        fs.appendFileSync(OUT_FILE, line);
      }
    }
  }
}

async function main() {
  const total = REFS.length * EXPONENTS.length * SYNERGYS.length * SCALES.length;
  let idx = 0;
  console.log(`Starting grid: ${total} combos, ITER=${ITER}. Output: ${OUT_FILE}`);
  for (const ref of REFS) {
    for (const exponent of EXPONENTS) {
      for (const synergyK of SYNERGYS) {
        for (const scale of SCALES) {
          idx++;
          console.log(`Combo ${idx}/${total}: ref=${ref}, exp=${exponent}, synergy=${synergyK}, scale=${scale}`);
          runForCombo(ref, exponent, synergyK, scale);
        }
      }
    }
  }
  console.log('Grid finished.');
}

main();

