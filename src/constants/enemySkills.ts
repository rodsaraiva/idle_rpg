export interface EnemySkillDef {
  id: string;
  name: string;
  icon: string;
  /** 0 = conditional, -1 = once per battle, N = every N rounds */
  cooldownRounds: number;
  minDifficulty: number;
}

export const ENEMY_SKILL_POOL: EnemySkillDef[] = [
  { id: 'CHARGE',       name: 'Investida',         icon: '💨', cooldownRounds: -1, minDifficulty: 1 },
  { id: 'CARAPACE',     name: 'Couraça',            icon: '🛡️', cooldownRounds:  0, minDifficulty: 2 },
  { id: 'INTIMIDATE',   name: 'Grito Intimidante',  icon: '😱', cooldownRounds: -1, minDifficulty: 3 },
  { id: 'REGEN',        name: 'Regeneração',        icon: '💚', cooldownRounds:  3, minDifficulty: 3 },
  { id: 'POISON',       name: 'Veneno',             icon: '🧪', cooldownRounds:  0, minDifficulty: 4 },
  { id: 'AOE_ATTACK',   name: 'Ataque em Área',     icon: '💥', cooldownRounds:  4, minDifficulty: 5 },
  { id: 'MAGIC_SHIELD', name: 'Escudo Mágico',      icon: '🔮', cooldownRounds:  4, minDifficulty: 5 },
  { id: 'BOSS_FURY',    name: 'Fúria do Boss',      icon: '🔥', cooldownRounds: -1, minDifficulty: 6 },
];

/**
 * Assigns enemy skills based on mission difficulty.
 *
 * @param missionDifficulty - The difficulty level of the mission
 * @param isBoss - Whether the enemy is a boss (always gets BOSS_FURY)
 * @param rng - A seeded random function returning [0, 1)
 */
export function assignEnemySkills(
  missionDifficulty: number,
  isBoss: boolean,
  rng: () => number,
): EnemySkillDef[] {
  // Determine max skills based on difficulty
  let maxSkills: number;
  if (missionDifficulty <= 2) {
    maxSkills = 1;
  } else if (missionDifficulty <= 4) {
    maxSkills = 2;
  } else {
    maxSkills = 3;
  }

  // Early exit for low difficulty: 50% chance of no skills
  if (missionDifficulty <= 2 && rng() > 0.5) {
    if (isBoss) {
      const bossFury = ENEMY_SKILL_POOL.find(s => s.id === 'BOSS_FURY')!;
      return [bossFury];
    }
    return [];
  }

  // Filter pool by minDifficulty
  const eligible = ENEMY_SKILL_POOL.filter(s => s.minDifficulty <= missionDifficulty);

  // Shuffle using Fisher-Yates with provided rng
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const picked = shuffled.slice(0, maxSkills);

  // Bosses always get BOSS_FURY
  if (isBoss) {
    const bossFury = ENEMY_SKILL_POOL.find(s => s.id === 'BOSS_FURY')!;
    if (!picked.some(s => s.id === 'BOSS_FURY')) {
      picked.push(bossFury);
    }
  }

  return picked;
}
