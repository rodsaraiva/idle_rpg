// Simulation script for mission 1 rewards per hero class
// Run with: node scripts/simulate_missions.js
const ITER = 10000;

const CLASSES = {
  WARRIOR: { baseStatDelta: { hp: 3, atk: 2, mp: 0 } , trainSpeed: { atk:1.1 } },
  TANK: { baseStatDelta: { hp: 8, atk: 0, mp: 0 }, trainSpeed: { hp:1.15 } },
  ROGUE: { baseStatDelta: { hp: 0, atk: 1, mp: 0 }, trainSpeed: { atk:1.05 }, ability: 'ROGUE_BONUS' },
  ARCHER: { baseStatDelta: { hp: 0, atk: 2, mp: 0 }, trainSpeed: { atk:1.07 } },
  MAGE: { baseStatDelta: { hp: 0, atk: 0, mp: 4 }, trainSpeed: { mp:1.2 } },
  HEALER: { baseStatDelta: { hp: 0, atk: 0, mp: 2 }, trainSpeed: { mp:1.05 }, ability: 'HEALER_BUFF' },
};

const INITIAL = { hp:10, atk:5, mp:3 };

const MISSION = {
  id: 'mission_1',
  name: 'Primeira Patrulha',
  minHeroes: 1,
  durationMs: 30000,
  rewardMin: 2,
  rewardMax: 20,
  statWeights: { hp: 0.2, atk: 1.0, mp: 0.1 },
  scale: 1.0,
};

function calcMissionReward(template, heroes, opts) {
  opts = opts || {};
  const weights = template.statWeights || { hp:0.2, atk:1.0, mp:0.1 };
  const scale = template.scale || 1;
  const statSumBase = heroes.reduce((acc,h) => {
    return acc + (h.hp * (weights.hp||0)) + (h.atk * (weights.atk||0)) + (h.mp * (weights.mp||0));
  }, 0);
  const healerBuff = opts.healerBuffMultiplier || 1;
  const statSum = statSumBase * healerBuff;
  const rngFn = opts.rng || Math.random;
  const rogueBonus = opts.rogueRngBonus || 0;
  const baseRandom = 0.9 + rngFn() * 0.2;
  const randomFactor = Math.min(1.1 + rogueBonus, Math.max(0.9, baseRandom + rogueBonus));
  const raw = statSum * scale * randomFactor;
  const value = Math.round(Math.max(template.rewardMin, Math.min(template.rewardMax, raw)));
  return value;
}

function stats(arr) {
  arr.sort((a,b)=>a-b);
  const n = arr.length;
  const sum = arr.reduce((s,x)=>s+x,0);
  const mean = sum/n;
  const sq = arr.reduce((s,x)=>s+(x-mean)*(x-mean),0);
  const std = Math.sqrt(sq/n);
  const median = arr[Math.floor(n/2)];
  const p10 = arr[Math.floor(n*0.1)];
  const p90 = arr[Math.floor(n*0.9)];
  const min = arr[0];
  const max = arr[n-1];
  const probMax = arr.filter(x=>x===MISSION.rewardMax).length / n;
  return { mean, std, median, p10, p90, min, max, probMax };
}

function simulateForClass(classId) {
  const classDef = CLASSES[classId];
  const hero = {
    hp: INITIAL.hp + (classDef.baseStatDelta.hp||0),
    atk: INITIAL.atk + (classDef.baseStatDelta.atk||0),
    mp: INITIAL.mp + (classDef.baseStatDelta.mp||0),
    classId,
  };
  const results = [];
  for (let i=0;i<ITER;i++) {
    const opts = {};
    if (classId === 'HEALER') opts.healerBuffMultiplier = 1 + Math.min(0.3, 1*0.1);
    if (classId === 'ROGUE') opts.rogueRngBonus = Math.min(0.08, 1*0.02);
    results.push(calcMissionReward(MISSION, [hero], opts));
  }
  return { classId, hero, stats: stats(results) };
}

function main() {
  const classes = Object.keys(CLASSES);
  const out = [];
  for (const c of classes) {
    const r = simulateForClass(c);
    out.push(r);
  }
  console.log(`Simulações por classe (n=${ITER}) para Missão 1 (1 herói):\n`);
  out.forEach(o=>{
    console.log(`Classe: ${o.classId}`);
    console.log(` Hero stats: hp=${o.hero.hp}, atk=${o.hero.atk}, mp=${o.hero.mp}`);
    const s = o.stats;
    console.log(`  mean=${s.mean.toFixed(2)}, std=${s.std.toFixed(2)}, median=${s.median}, p10=${s.p10}, p90=${s.p90}, min=${s.min}, max=${s.max}, probMax=${(s.probMax*100).toFixed(2)}%`);
    console.log('');
  });
}

main();

