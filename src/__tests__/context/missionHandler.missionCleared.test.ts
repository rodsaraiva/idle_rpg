import { validateMissionRequirements } from '../../context/missionHandler';
import type { GameState } from '../../types';

const baseState = (cleared: string[]): GameState => ({
  gold: 0, heroes: [], heroesRecruited: 0, lastSavedAt: 0,
  completedMissionIds: cleared,
} as any);

test('mission_cleared bloqueia quando pré-requisito não foi limpo', () => {
  const tmpl: any = { id: 'z2_1', requirements: [{ type: 'mission_cleared', missionId: 'mission_boss_1', label: 'Derrote o Dragão antes' }] };
  expect(validateMissionRequirements(tmpl, [], baseState([]))).toBe('Derrote o Dragão antes');
});

test('mission_cleared libera quando pré-requisito foi limpo', () => {
  const tmpl: any = { id: 'z2_1', requirements: [{ type: 'mission_cleared', missionId: 'mission_boss_1', label: 'Derrote o Dragão antes' }] };
  expect(validateMissionRequirements(tmpl, [], baseState(['mission_boss_1']))).toBeNull();
});
