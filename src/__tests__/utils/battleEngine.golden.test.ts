import { computeBattleOutcome } from '../../utils/battleSim';
import { MISSIONS } from '../../constants/missions';

function makeHero(id: string, classId: string, over: any = {}): any {
  return {
    id, name: `${classId}-${id}`, hpMax: 40, hpCurrent: 40, atk: 12, mp: 6,
    defense: 5, crit: 10, agility: 8, currentTask: 'IDLE',
    classId, range: 1, movement: 2, ...over,
  };
}

function digest(o: any) {
  return {
    success: o.success,
    reward: o.reward,
    rounds: o.rounds,
    enemyCasualties: o.enemyCasualties,
    casualties: o.casualties,
    actionsLength: o.actions.length,
    first10Actions: o.actions.slice(0, 10).map((a: any) => ({
      round: a.round, actorType: a.actorType, actorId: a.actorId,
      actionType: a.actionType, targetId: a.targetId, amount: a.amount, isCrit: a.isCrit,
    })),
  };
}

const M1 = MISSIONS.find(m => m.id === 'mission_1')!;

describe('battleEngine golden (determinismo por seed — gate da modularização)', () => {
  test('cenário sem sinergia (1 WARRIOR) — seed 12345', () => {
    const heroes = [makeHero('h1', 'WARRIOR')];
    const o = computeBattleOutcome(M1, heroes, { seed: 12345, heroPositions: { h1: 45 } });
    expect(digest(o)).toMatchSnapshot();
  });

  test('cenário com sinergia ativa (TANK+ARCHER) — seed 777', () => {
    const heroes = [makeHero('t1', 'TANK'), makeHero('a1', 'ARCHER', { range: 3 })];
    const o = computeBattleOutcome(M1, heroes, { seed: 777, heroPositions: { t1: 45, a1: 49 } });
    expect(digest(o)).toMatchSnapshot();
  });

  test('cenário com personalidade não-neutra (AGGRESSIVE) — seed 9001', () => {
    const heroes = [makeHero('h1', 'ROGUE', { personality: 'AGGRESSIVE' })];
    const o = computeBattleOutcome(M1, heroes, { seed: 9001, heroPositions: { h1: 45 } });
    expect(digest(o)).toMatchSnapshot();
  });
});
