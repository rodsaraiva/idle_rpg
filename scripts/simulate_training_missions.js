// Simulação Monte Carlo: missão 1 com 3 durações de treino (0, 30min, 2h) por classe
// Run: node scripts/simulate_training_missions.js
const ITER = 10000;

const BASE = { hp: 10, atk: 5, mp: 3 };
const BASE_TRAIN_TIME_MS = 10000;
const TRAIN_INFLATION_FACTOR = 0.1;

const MISSION = {
  rewardMin: 2,
  rewardMax: 20,
  statWeights: { hp: 0.2, atk: 1.0, mp: 0.1 },
  scale: 1.0,
};

const CLASS_DEFS = {
  WARRIOR: { base: { hp: 3, atk: 2, mp: 0 }, healer: false, rogue: false },
  TANK: { base: { hp: 8, atk: 0, mp: 0 }, healer: false, rogue: false },
  ROGUE: { base: { hp: 0, atk: 1, mp: 0 }, healer: false, rogue: true },
  ARCHER: { base: { hp: 0, atk: 2, mp: 0 }, healer: false, rogue: false },
  MAGE: { base: { hp: 0, atk: 0, mp: 4 }, healer: false, rogue: false },
  HEALER: { base: { hp: 0, atk: 0, mp: 2 }, healer: true, rogue: false },
};

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
  const normalized = Math.max(0, Math.min(statSum / ref, 1));
  // apply synergy as in game logic
  const n = Math.max(1, heroes.length);
  const statAvg = statSum / n;
  const synergy = 1 + synergyK * (n > 1 ? Math.log(n) : 0);
  const effectiveStat = statAvg * synergy;
  const normalizedEffective = Math.max(0, Math.min(effectiveStat / ref, 1));
  const curved = Math.pow(normalizedEffective, exponent);
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

function stats(arr) {
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
  const probMax = arr.filter((x) => x === MISSION.rewardMax).length / n;
  return { mean, std, median, p10, p90, min, max, probMax };
}

function simulateForClassAndDuration(classId, durationMs) {
  const def = CLASS_DEFS[classId];
  const baseHero = {
    hp: BASE.hp + def.base.hp,
    atk: BASE.atk + def.base.atk,
    mp: BASE.mp + def.base.mp,
    classId,
  };
  // compute training points for ATK only (simulate focused training)
  const { points } = computePointsFromMs(BASE_TRAIN_TIME_MS, TRAIN_INFLATION_FACTOR, durationMs);
  const hero = { ...baseHero, atk: baseHero.atk + points };

  const opts = { ref: 250, exponent: 2, synergyK: 0.05 };
  if (def.healer) opts.healerBuffMultiplier = 1 + Math.min(0.3, 1 * 0.1);
  if (def.rogue) opts.rogueRngBonus = Math.min(0.08, 1 * 0.02);

  const results = [];
  for (let i = 0; i < ITER; i++) {
    results.push(calcMissionReward(MISSION, [hero], opts));
  }
  return { classId, durationMs, hero, stats: stats(results), points };
}

function main() {
  const classes = Object.keys(CLASS_DEFS);
  console.log(`Simulações (n=${ITER}) - Missão 1 - 3 durações de treino\n`);
  for (const c of classes) {
    for (const d of DURATIONS) {
      const r = simulateForClassAndDuration(c, d.ms);
      console.log(`Classe: ${r.classId} | Treino: ${d.name} | pontos ganhos ATK=${r.points}`);
      const s = r.stats;
      console.log(` mean=${s.mean.toFixed(2)}, std=${s.std.toFixed(2)}, median=${s.median}, p10=${s.p10}, p90=${s.p90}, min=${s.min}, max=${s.max}`);
      console.log('');
    }
  }
}

main();

