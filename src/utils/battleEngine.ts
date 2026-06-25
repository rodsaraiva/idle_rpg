import { createEnemies, findMovePath } from './battle/grid';
import { calculateAttack, cleanExpiredBuffs } from './battle/resolution';
import { selectTarget } from './battle/targeting';
import { initializeBattle } from './battle/setup';
import { executeClassAbility, processHeroTurn, processEnemyTurn } from './battle/turns';

export type {
  SynergyId,
  BuffType,
  Buff,
  BattleEnemy,
  SynergyHandlers,
  BattleState,
} from './battle/types';

export const BattleEngine = {
  createEnemies,
  initializeBattle,
  cleanExpiredBuffs,
  findMovePath,
  selectTarget,
  calculateAttack,
  executeClassAbility,
  processHeroTurn,
  processEnemyTurn,
};
