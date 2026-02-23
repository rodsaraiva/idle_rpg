import { computeBattleOutcome } from '../../utils/battleSim';
import { MISSIONS } from '../../constants/missions';

test('battleSim handles zero heroes gracefully', () => {
  const template = MISSIONS.find((m) => m.id === 'mission_1')!;
  const outcome = computeBattleOutcome(template, [], { rng: () => 0.5 });
  expect(outcome).toBeDefined();
  expect(typeof outcome.reward).toBe('number');
});

test('battleSim handles many rounds without throwing (stress)', () => {
  const template = MISSIONS.find((m) => m.id === 'mission_1')!;
  const heroes = Array.from({ length: 6 }, (_, i) => ({ id: `h${i}`, name: `H${i}`, hpMax: 20, hpCurrent: 20, atk: 5, mp: 0, currentTask: 'IDLE' as any, classId: 'WARRIOR' as any }));
  const rng = () => 0.42;
  const outcome = computeBattleOutcome(template, heroes, { rng });
  expect(outcome).toBeDefined();
  expect(Array.isArray(outcome.actions)).toBeTruthy();
});

