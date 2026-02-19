import { computeBattleOutcome } from '../../utils/battleSim';
import { MISSIONS } from '../../constants/missions';

describe('battleSim computeBattleOutcome', () => {
  test('strong hero defeats single orc (deterministic hits)', () => {
    const template = MISSIONS.find((m) => m.id === 'mission_1')!;
    const hero = { id: 'h1', name: 'Strong', hpMax: 30, hpCurrent: 30, atk: 12, mp: 0, currentTask: 'IDLE' as any, classId: 'WARRIOR' as any };
    // rng that always returns 0 (all hits, crits possible)
    const rng = () => 0;
    const outcome = computeBattleOutcome(template, [hero], { rng });
    expect(outcome.success).toBe(true);
    expect(outcome.enemyCasualties).toBeGreaterThanOrEqual(1);
    expect(outcome.reward).toBeGreaterThanOrEqual(template.rewardMin);
  });

  test('weak hero likely fails vs two orcs (deterministic misses/hits)', () => {
    const template = MISSIONS.find((m) => m.id === 'mission_2')!;
    const hero = { id: 'h2', name: 'Weak', hpMax: 5, hpCurrent: 5, atk: 1, mp: 0, currentTask: 'IDLE' as any, classId: 'WARRIOR' as any };
    // rng generator that alternates: hero misses (0.99), enemy hits (0.0)
    let i = 0;
    const seq = [0.99, 0.0];
    const rng = () => {
      const v = seq[i % seq.length];
      i++;
      return v;
    };
    const outcome = computeBattleOutcome(template, [hero], { rng });
    expect(outcome.success).toBe(false);
    expect(outcome.casualties.find((c) => c.heroId === 'h2')?.hpAfter ?? 0).toBeLessThanOrEqual(hero.hpCurrent);
  });
});

