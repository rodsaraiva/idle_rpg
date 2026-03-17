import { createHero } from '../heroFactory';
import { INITIAL_HERO_STATS } from '../../constants/game';
import { CLASS_DEFS } from '../../constants/classes';

describe('HeroFactory - Generation with Gaussian Variance', () => {
  test('should create a hero with all required properties', () => {
    const hero = createHero('WARRIOR');
    expect(hero.id).toBeDefined();
    expect(hero.name).toBeDefined();
    expect(hero.hpMax).toBeGreaterThan(0);
    expect(hero.atk).toBeGreaterThan(0);
    expect(hero.classId).toBe('WARRIOR');
    expect(hero.personality).toBeDefined();
    expect(hero.range).toBeDefined();
    expect(hero.attackType).toBeDefined();
  });

  test('should respect Gaussian variance limits (±50% of base)', () => {
    // Run 100 times to ensure limits are never crossed
    // Variance is applied to INITIAL_HERO_STATS before CLASS_DEFS.baseStatDelta
    for (let i = 0; i < 100; i++) {
      const hero = createHero(); // No class delta
      
      // Min: Base * 0.5, Max: Base * 1.5
      expect(hero.hpMax).toBeGreaterThanOrEqual(Math.floor(INITIAL_HERO_STATS.hp * 0.5));
      expect(hero.hpMax).toBeLessThanOrEqual(Math.floor(INITIAL_HERO_STATS.hp * 1.5));
      
      expect(hero.atk).toBeGreaterThanOrEqual(Math.floor(INITIAL_HERO_STATS.atk * 0.5));
      expect(hero.atk).toBeLessThanOrEqual(Math.floor(INITIAL_HERO_STATS.atk * 1.5));
    }
  });

  test('should apply class deltas correctly', () => {
    const tank = createHero('TANK');
    const classDef = CLASS_DEFS.TANK;
    
    // Tank has +20 HP delta
    // Min expected: (Base * 0.5) + 20 = (15 * 0.5) + 20 = 27.5 -> floor(7.5)+20 = 27
    // Max expected: (Base * 1.5) + 20 = (15 * 1.5) + 20 = 42.5 -> floor(22.5)+20 = 42
    expect(tank.hpMax).toBeGreaterThanOrEqual(Math.floor(INITIAL_HERO_STATS.hp * 0.5) + (classDef.baseStatDelta?.hp ?? 0));
    expect(tank.hpMax).toBeLessThanOrEqual(Math.floor(INITIAL_HERO_STATS.hp * 1.5) + (classDef.baseStatDelta?.hp ?? 0));
    
    // Tank has -2 ATK delta
    // Min expected: floor(6 * 0.5) - 2 = 3 - 2 = 1
    // Max expected: floor(6 * 1.5) - 2 = 9 - 2 = 7
    expect(tank.atk).toBeGreaterThanOrEqual(Math.floor(INITIAL_HERO_STATS.atk * 0.5) + (classDef.baseStatDelta?.atk ?? 0));
    expect(tank.atk).toBeLessThanOrEqual(Math.floor(INITIAL_HERO_STATS.atk * 1.5) + (classDef.baseStatDelta?.atk ?? 0));
  });

  test('should assign correct movement and range based on class', () => {
    const mage = createHero('MAGE');
    expect(mage.range).toBe(CLASS_DEFS.MAGE.range);
    expect(mage.attackType).toBe('RANGED');
    
    const rogue = createHero('ROGUE');
    expect(rogue.range).toBe(CLASS_DEFS.ROGUE.range);
    expect(rogue.attackType).toBe('MELEE');
  });
});
