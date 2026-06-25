import { WeeklyBossTemplate } from '../constants/weeklyBosses';
import { MissionTemplate } from '../constants/missions';

/**
 * Converte um WeeklyBossTemplate para MissionTemplate (formato esperado por
 * computeBattleOutcome e BattleEngine.createEnemies). Único adaptador — antes
 * duplicado em tickHandler.ts e missionHandler.ts.
 */
export function bossToMissionTemplate(boss: WeeklyBossTemplate): MissionTemplate {
  return {
    id: boss.id,
    name: boss.bossName,
    minHeroes: boss.minHeroes,
    durationMs: boss.durationMs,
    rewardMin: boss.rewardMin,
    rewardMax: boss.rewardMax,
    statWeights: boss.statWeights,
    difficulty: boss.difficulty,
    enemies: boss.enemies,
  };
}
