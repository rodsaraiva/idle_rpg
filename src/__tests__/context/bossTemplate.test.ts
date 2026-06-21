import { bossToMissionTemplate } from '../../context/bossTemplate';
import { WEEKLY_BOSS_POOL } from '../../constants/weeklyBosses';

describe('bossToMissionTemplate', () => {
  test('copia os 9 campos de cada boss do pool para MissionTemplate', () => {
    for (const boss of WEEKLY_BOSS_POOL) {
      const tpl = bossToMissionTemplate(boss);
      expect(tpl.id).toBe(boss.id);
      expect(tpl.name).toBe(boss.bossName);
      expect(tpl.minHeroes).toBe(boss.minHeroes);
      expect(tpl.durationMs).toBe(boss.durationMs);
      expect(tpl.rewardMin).toBe(boss.rewardMin);
      expect(tpl.rewardMax).toBe(boss.rewardMax);
      expect(tpl.statWeights).toBe(boss.statWeights);
      expect(tpl.difficulty).toBe(boss.difficulty);
      expect(tpl.enemies).toBe(boss.enemies);
    }
  });

  test('saída casa a forma consumida por createEnemies (tem enemies array)', () => {
    const tpl = bossToMissionTemplate(WEEKLY_BOSS_POOL[0]);
    expect(Array.isArray(tpl.enemies)).toBe(true);
  });
});
