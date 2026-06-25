import { Hero, ClassId } from '../../types';
import { MissionTemplate } from '../../constants/missions';
import { getActiveSynergies } from '../../constants/synergies';
import { createSynergyHandlers } from '../synergyEffects';
import { createEnemies } from './grid';
import { BattleState } from './types';

/**
 * Constrói um BattleState fresco com handlers de sinergia ligados e posições
 * inicializadas.
 * @param opts.rng PRNG a usar — default Math.random para retrocompatibilidade.
 */
export function initializeBattle(
  heroes: Hero[],
  template: MissionTemplate,
  opts: { heroPositions?: Record<string, number>; rng?: () => number } = {}
): BattleState {
  const rng = opts.rng ?? Math.random;
  const enemies = createEnemies(template, rng);
  const enemyPositions: Record<string, number> = {};
  enemies.forEach(e => { if (e.position !== undefined) enemyPositions[e.id] = e.position; });

  const classIds = heroes.map(h => h.classId).filter(Boolean) as ClassId[];
  const activeSynergyDefs = getActiveSynergies(classIds);
  const activeSynergies = activeSynergyDefs.map(s => s.id);
  const handlers = createSynergyHandlers(activeSynergies);

  const state: BattleState = {
    heroes,
    enemies,
    heroPositions: { ...(opts.heroPositions || {}) },
    enemyPositions,
    lastAttacker: {},
    threats: {},
    log: [],
    actions: [],
    rounds: 0,
    activeSynergies,
    buffs: {},
    flags: {},
    handlers,
    skillCooldowns: {},
    skillOnceUsed: {},
    rng,
  };

  handlers.onBattleStart(state);
  return state;
}
