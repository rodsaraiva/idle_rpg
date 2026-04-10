import { 
  RECRUIT_BASE_COST, 
  RECRUIT_COST_MULTIPLIER, 
  MISSION_BASE_GOLD, 
  GOLD_PER_ATK,
  REWARD_REF_STAT_SUM,
  REWARD_CURVE_EXPONENT,
  TEAM_SYNERGY_COEFFICIENT,
  MIN_TEAM_SCALE_MULTIPLIER,
  TEAM_SIZE_SCALE_IMPACT,
  BASE_HIT_CHANCE,
  HIT_CHANCE_PER_ATK,
  HIT_CHANCE_DISTANCE_PENALTY,
  CRIT_BASE_CHANCE,
  CRIT_MULTIPLIER,
  GRID_COLUMNS
} from '../constants/game';
import { Hero } from '../types';
import { MissionTemplate } from '../constants/missions';

export const GameMath = {
  // --- Recruitment ---
  getRecruitCost(heroesRecruited: number): number {
    return Math.floor(
      RECRUIT_BASE_COST * Math.pow(RECRUIT_COST_MULTIPLIER, heroesRecruited)
    );
  },

  // --- Missions ---
  getMissionGoldPerTick(atk: number): number {
    return MISSION_BASE_GOLD + atk * GOLD_PER_ATK;
  },

  calcMissionReward(
    template: MissionTemplate,
    heroes: Hero[],
    opts?: {
      healerBuffMultiplier?: number;
      rogueRngBonus?: number;
      rng?: () => number;
      ref?: number;
      exponent?: number;
      synergyK?: number;
      scale?: number;
    }
  ): number {
    const rngFn = opts?.rng ?? Math.random;
    const weights = template.statWeights ?? { hp: 0.2, atk: 1.0, mp: 0.1 };

    const statSumBase = heroes.reduce((acc, h) => {
      const hpForCalc = h.hpMax || h.hpCurrent || 0;
      return (
        acc +
        (hpForCalc * (weights.hp ?? 0)) +
        (h.atk * (weights.atk ?? 0)) +
        (h.mp * (weights.mp ?? 0))
      );
    }, 0);

    const healerBuff = opts?.healerBuffMultiplier ?? 1;
    const statSum = statSumBase * healerBuff;

    const ref = opts?.ref ?? REWARD_REF_STAT_SUM;
    const exponent = opts?.exponent ?? REWARD_CURVE_EXPONENT;

    const n = Math.max(1, heroes.length);
    const statAvg = statSum / n;
    const synergyK = opts?.synergyK ?? TEAM_SYNERGY_COEFFICIENT;
    const synergy = 1 + synergyK * (n > 1 ? Math.log(n) : 0);
    const effectiveStat = statAvg * synergy;
    const normalized = Math.max(0, Math.min(effectiveStat / ref, 1));
    const curved = Math.pow(normalized, exponent);

    const scaleMultiplier = Math.max(MIN_TEAM_SCALE_MULTIPLIER, 1 - TEAM_SIZE_SCALE_IMPACT * n);
    const dynamicScale = (template.scale ?? 1) * scaleMultiplier;

    const baseMapped = template.rewardMin + (template.rewardMax - template.rewardMin) * curved * dynamicScale;

    const rogueBonus = opts?.rogueRngBonus ?? 0;
    const baseRandom = 0.9 + rngFn() * 0.2;
    const randomFactor = Math.min(1.1 + rogueBonus, Math.max(0.9, baseRandom + rogueBonus));

    const raw = baseMapped * randomFactor;
    return Math.round(Math.max(template.rewardMin, Math.min(template.rewardMax, raw)));
  },

  // --- Combat ---
  calcHitChance(atk: number, targetAgility: number = 0, distance: number = 1): number {
    const baseChance = Math.min(0.98, BASE_HIT_CHANCE + atk * HIT_CHANCE_PER_ATK);
    // Agilidade fornece uma curva de esquiva com retornos decrescentes
    // Formula: Esquiva = Agi / (Agi + 50)
    const evasion = targetAgility / (targetAgility + 50);
    // Penalidade por distância (além do primeiro hexágono)
    const distancePenalty = Math.max(0, distance - 1) * HIT_CHANCE_DISTANCE_PENALTY;
    return Math.max(0.05, baseChance - evasion - distancePenalty);
  },

  calcCritChance(classId?: string, critAttribute: number = 0): number {
    const base = CRIT_BASE_CHANCE + (classId === 'ROGUE' ? 0.05 : 0);
    // Crítico com retornos decrescentes: Crit% = CritAttr / (CritAttr + 100)
    const critBonus = critAttribute / (critAttribute + 100);
    return base + critBonus;
  },

  calcDamage(atk: number, targetDefense: number = 0, isCrit: boolean = false): number {
    const baseDmg = isCrit ? atk * CRIT_MULTIPLIER : atk;
    // Defesa com retornos decrescentes: Redução = Def / (Def + 50)
    // DEF=5: ~9%, DEF=20: ~29%, DEF=35 (Tank): ~41%, DEF=50: 50%
    const mitigationFactor = 1 - targetDefense / (targetDefense + 50);
    return Math.max(1, Math.floor(baseDmg * mitigationFactor));
  },

  // --- Formatting ---
  formatNumber(value: number): string {
    if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1) + 'B';
    if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
    if (value >= 1_000) return (value / 1_000).toFixed(1) + 'K';
    return Math.floor(value).toString();
  },

  // --- Hex Grid Geometry ---
  getHexCoords(pos: number) {
    const r = Math.floor(pos / GRID_COLUMNS);
    const c = pos % GRID_COLUMNS;
    // Convert axial coordinates for easier distance calculation
    // Using "odd-r" horizontal layout (odd rows shifted right)
    const x = c - (r >> 1);
    const z = r;
    const y = -x - z;
    return { x, y, z };
  },

  getHexDistance(p1: number, p2: number): number {
    const a = this.getHexCoords(p1);
    const b = this.getHexCoords(p2);
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
  },

  getHexNeighbors(pos: number, rows: number, cols: number): number[] {
    const coords = this.getHexCoords(pos);
    const neighbors: number[] = [];
    const directions = [
      { x: +1, y: -1, z: 0 }, { x: +1, y: 0, z: -1 }, { x: 0, y: +1, z: -1 },
      { x: -1, y: +1, z: 0 }, { x: -1, y: 0, z: +1 }, { x: 0, y: -1, z: +1 }
    ];

    for (const d of directions) {
      const nx = coords.x + d.x;
      const nz = coords.z + d.z;
      // Convert axial back to offset
      const r = nz;
      const c = nx + (r + (r & 1)) / 2;
      
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        neighbors.push(r * cols + c);
      }
    }
    return neighbors;
  },
};
