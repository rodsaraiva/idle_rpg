import { getClassSkills, getUnlockedSkills, getSkillsWithStatus, SKILL_DEFS } from '../../constants/skills';
import { Hero, HeroTask } from '../../types';

const makeHero = (classId: string, trainingCount: { hp: number; atk: number; mp: number }): Hero => ({
  id: 'h1',
  name: 'Test',
  hpMax: 50,
  hpCurrent: 50,
  atk: 10,
  mp: 5,
  defense: 5,
  crit: 10,
  agility: 5,
  currentTask: HeroTask.IDLE,
  classId: classId as any,
  trainingCount,
  trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
});

describe('skills', () => {
  test('each class has exactly 3 skills', () => {
    const classes = ['WARRIOR', 'TANK', 'ROGUE', 'ARCHER', 'MAGE', 'HEALER'] as const;
    for (const c of classes) {
      expect(getClassSkills(c)).toHaveLength(3);
    }
  });

  test('total skills is 18', () => {
    expect(SKILL_DEFS).toHaveLength(18);
  });

  test('getUnlockedSkills returns empty for untrained hero', () => {
    const hero = makeHero('WARRIOR', { hp: 0, atk: 0, mp: 0 });
    expect(getUnlockedSkills(hero)).toHaveLength(0);
  });

  test('getUnlockedSkills returns skill 1 at threshold 20', () => {
    const hero = makeHero('WARRIOR', { hp: 0, atk: 20, mp: 0 });
    const skills = getUnlockedSkills(hero);
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe('WARRIOR_GOLPE_PESADO');
  });

  test('getUnlockedSkills returns all 3 at threshold 100', () => {
    const hero = makeHero('WARRIOR', { hp: 0, atk: 100, mp: 0 });
    expect(getUnlockedSkills(hero)).toHaveLength(3);
  });

  test('getUnlockedSkills uses correct stat per class', () => {
    const mage = makeHero('MAGE', { hp: 0, atk: 100, mp: 0 });
    expect(getUnlockedSkills(mage)).toHaveLength(0); // mage uses mp, not atk

    const mage2 = makeHero('MAGE', { hp: 0, atk: 0, mp: 20 });
    expect(getUnlockedSkills(mage2)).toHaveLength(1);
  });

  test('getSkillsWithStatus returns progress fraction', () => {
    const hero = makeHero('WARRIOR', { hp: 0, atk: 10, mp: 0 });
    const statuses = getSkillsWithStatus(hero);
    expect(statuses).toHaveLength(3);
    expect(statuses[0].unlocked).toBe(false);
    expect(statuses[0].progress).toBe(0.5); // 10/20
  });

  test('getUnlockedSkills returns empty for hero without classId', () => {
    const hero = makeHero('WARRIOR', { hp: 0, atk: 100, mp: 0 });
    hero.classId = undefined;
    expect(getUnlockedSkills(hero)).toHaveLength(0);
  });
});
