import { handleRecallMissionLoop, handleDismissLoopSummary } from '../../context/missionLoopHandler';
import { GameState, LoopSummary } from '../../types';

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

function resumo(missionId: string): LoopSummary {
  return {
    missionId, templateId: 'mission_1', heroIds: ['h1'],
    tally: { cycles: 1, gold: 100, materials: {}, casualties: [] },
    reason: 'completed',
  };
}

function estadoComResumos(): GameState {
  return { ...estado(), completedLoops: [resumo('m1'), resumo('m2')] };
}

test('dispensar remove só o resumo alvo de completedLoops', () => {
  const s = handleDismissLoopSummary(estadoComResumos(), 'm1');
  expect(s.completedLoops?.map((r) => r.missionId)).toEqual(['m2']);
});

test('dispensar missionId ausente é no-op de referência', () => {
  const antes = estadoComResumos();
  expect(handleDismissLoopSummary(antes, 'inexistente')).toBe(antes);
});
