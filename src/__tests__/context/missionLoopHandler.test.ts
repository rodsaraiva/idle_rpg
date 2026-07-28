import { handleRecallMissionLoop } from '../../context/missionLoopHandler';
import { GameState } from '../../types';

function estado(): GameState {
  return {
    gold: 0, heroes: [], heroesRecruited: 0, lastSavedAt: 0,
    activeMissions: [
      { id: 'm1', templateId: 'mission_1', heroIds: ['h1'], startedAt: 0, loop: { mode: 'endless' } },
      { id: 'm2', templateId: 'mission_1', heroIds: ['h2'], startedAt: 0 },
    ],
  } as GameState;
}

test('marca só a missão pedida como recolhida', () => {
  const s = handleRecallMissionLoop(estado(), 'm1');
  expect(s.activeMissions?.[0].loopRecalled).toBe(true);
  expect(s.activeMissions?.[1].loopRecalled).toBeUndefined();
});

test('recolher missão sem loop é no-op de referência', () => {
  const antes = estado();
  expect(handleRecallMissionLoop(antes, 'm2')).toBe(antes);
});

test('missão inexistente é no-op de referência', () => {
  const antes = estado();
  expect(handleRecallMissionLoop(antes, 'inexistente')).toBe(antes);
});

test('recolher missão já recolhida é no-op de referência', () => {
  const antes = handleRecallMissionLoop(estado(), 'm1');
  expect(handleRecallMissionLoop(antes, 'm1')).toBe(antes);
});
