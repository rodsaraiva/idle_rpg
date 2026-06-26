import { GameState } from '../types';

/**
 * Status de desbloqueio por zona.
 * `'unlocked'` = acessível para iniciar missões; `'locked'` = pré-requisito pendente.
 */
export type ZoneId = 'z1' | 'z2' | 'z3' | 'z4';
export type ZoneUnlockStatus = 'unlocked' | 'locked';
export type ZoneStatusMap = Record<ZoneId, ZoneUnlockStatus>;

/**
 * Deriva o status de desbloqueio de cada zona a partir de `completedMissionIds`.
 * Zona 1 é sempre acessível. As demais exigem o boss da zona anterior:
 *   z2 → mission_boss_1 (Dragão)
 *   z3 → z2_costa_2 (Capitão da Costa)
 *   z4 → z3_picos_2 (Tempestade Glacial)
 *
 * Função pura — sem efeitos colaterais.
 */
export function zoneStatus(state: GameState): ZoneStatusMap {
  const cleared = state.completedMissionIds ?? [];
  return {
    z1: 'unlocked',
    z2: cleared.includes('mission_boss_1') ? 'unlocked' : 'locked',
    z3: cleared.includes('z2_costa_2') ? 'unlocked' : 'locked',
    z4: cleared.includes('z3_picos_2') ? 'unlocked' : 'locked',
  };
}
