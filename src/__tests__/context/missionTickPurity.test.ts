import { processMissions } from '../../context/missionTickHandler';
import { MISSIONS } from '../../constants/missions';
import { HeroTask } from '../../types';

function makeHero(id: string, over: any = {}): any {
  return {
    id, name: `Hero ${id}`, hpMax: 50, hpCurrent: 50, atk: 12, mp: 5,
    defense: 5, crit: 10, agility: 5, currentTask: HeroTask.MISSION,
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, equippedItems: [],
    ...over,
  };
}

function makeState(over: any = {}): any {
  return {
    gold: 0, heroes: [], heroesRecruited: 0, lastSavedAt: 0,
    inventory: [], activeMissions: [], perHeroGold: {}, ...over,
  };
}

describe('processMissions — pureza do reducer (enemiesState e heroPositions)', () => {
  test('não muta enemiesState nem heroPositions do estado anterior', () => {
    const now = 1_000_000;
    const hero = makeHero('h1');
    const templateId = MISSIONS.find(m => m.id === 'mission_1')!.id;

    const enemiesState = [{ id: 'e1', hp: 30, alive: true, position: 2 }];
    const heroPositions: Record<string, number> = { h1: 0 };

    // Freeze the nested state that this task protects (scheduledActions NOT frozen — out of scope)
    Object.freeze(enemiesState[0]);
    Object.freeze(enemiesState);
    Object.freeze(heroPositions);

    // Deep snapshots for belt-and-suspenders: mutation caught even in sloppy mode
    const snapshotEnemies = JSON.parse(JSON.stringify(enemiesState));
    const snapshotPositions = JSON.parse(JSON.stringify(heroPositions));

    // scheduledActions are NOT frozen — the code legitimately sets applied=true on them
    const scheduledActions = [
      {
        atMsFromStart: 100,
        applied: false,
        // hero hit on e1 → triggers m.enemiesState[eidx] = {...} mutation path
        action: { actorType: 'hero', actionType: 'hit', actorId: 'h1', targetId: 'e1', amount: 5 },
      },
      {
        atMsFromStart: 200,
        applied: false,
        // hero move → triggers m.heroPositions[actorId] = toPosition mutation path
        action: { actorType: 'hero', actionType: 'move', actorId: 'h1', toPosition: 7 },
      },
    ];

    const state = makeState({
      heroes: [hero],
      activeMissions: [{
        id: 'mPurity',
        templateId,
        heroIds: ['h1'],
        // elapsed = 50_000ms >> all atMsFromStart values → both actions fire
        startedAt: now - 50_000,
        looping: false,
        scheduledActions,
        enemiesState,
        heroPositions,
      }],
    });

    // RED: current shallow clone shares the frozen array/object references → TypeError on mutation
    // GREEN: after fix, processMissions clones enemiesState and heroPositions → no throw
    expect(() => processMissions(state, [hero], now)).not.toThrow();

    // Belt-and-suspenders: originals must be unchanged regardless of JS mode
    expect(enemiesState).toEqual(snapshotEnemies);
    expect(heroPositions).toEqual(snapshotPositions);
  });
});
