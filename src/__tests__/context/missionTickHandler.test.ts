import { processMissions } from '../../context/missionTickHandler';
import { applyGoldBonus } from '../../utils/heroUtils';
import { HeroTask } from '../../types';
import { MISSIONS } from '../../constants/missions';
import { WEEKLY_BOSS_POOL } from '../../constants/weeklyBosses';

function makeHero(id: string, over: any = {}): any {
  return {
    id, name: `Hero ${id}`, hpMax: 50, hpCurrent: 50, atk: 12, mp: 5,
    defense: 5, crit: 10, agility: 5, currentTask: HeroTask.MISSION,
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, equippedItems: [],
    ...over,
  };
}

function outcome(over: any = {}): any {
  return {
    success: true, reward: 100, casualties: [], enemyCasualties: 1,
    rounds: 3, log: [], actions: [], materialDrops: {}, ...over,
  };
}

function makeState(over: any = {}): any {
  return {
    gold: 0, heroes: [], heroesRecruited: 0, lastSavedAt: 0,
    inventory: [], activeMissions: [], perHeroGold: {}, ...over,
  };
}

const M1 = MISSIONS.find(m => m.id === 'mission_1')!;

describe('processMissions (caracterização da unidade isolada)', () => {
  test('golden path: missão não-loop atinge finishAt → gold creditado, herói volta a IDLE', () => {
    const now = 1_000_000;
    const hero = makeHero('h1');
    const state = makeState({
      heroes: [hero],
      activeMissions: [{
        id: 'mA', templateId: M1.id, heroIds: ['h1'],
        startedAt: now - 100_000, finishAt: now - 1000,
        looping: false, scheduledActions: [], enemiesState: [],
        precomputedOutcome: outcome({ reward: 100 }),
      }],
    });

    const r = processMissions(state, [hero], now);
    expect(r.goldGained).toBe(applyGoldBonus(100, state));
    expect(r.newResults.length).toBe(1);
    expect(r.newHeroes[0].currentTask).toBe(HeroTask.IDLE);
    expect(r.activeMissions.length).toBe(0);
  });

  test('loop com sobreviventes ≥ minHeroes → nova missão com startedAt=now, heróis seguem em missão', () => {
    const now = 2_000_000;
    const heroes = Array.from({ length: Math.max(1, M1.minHeroes) }, (_, i) => makeHero(`h${i}`));
    const heroIds = heroes.map(h => h.id);
    const state = makeState({
      heroes,
      activeMissions: [{
        id: 'mLoop', templateId: M1.id, heroIds,
        startedAt: now - 100_000, finishAt: now - 1000,
        looping: true, scheduledActions: [], enemiesState: [], heroPositions: {},
        precomputedOutcome: outcome({ reward: 80, success: true }),
      }],
    });

    const r = processMissions(state, heroes, now);
    expect(r.activeMissions.length).toBe(1);
    const next = r.activeMissions[0];
    expect(next.startedAt).toBe(now);
    expect(next.looping).toBe(true);
    expect(next.precomputedOutcome).toBeDefined();
    expect(Array.isArray(next.scheduledActions)).toBe(true);
    // heróis NÃO voltam a IDLE no loop
    expect(r.newHeroes.every(h => h.currentTask === HeroTask.MISSION)).toBe(true);
  });

  test('loop sem sobreviventes suficientes → heróis liberados a IDLE, sem missão nova', () => {
    const now = 3_000_000;
    // todos mortos (hpCurrent 0) → 0 sobreviventes < minHeroes
    const dead = makeHero('d1', { hpCurrent: 0 });
    const state = makeState({
      heroes: [dead],
      activeMissions: [{
        id: 'mDead', templateId: M1.id, heroIds: ['d1'],
        startedAt: now - 100_000, finishAt: now - 1000,
        looping: true, scheduledActions: [], enemiesState: [],
        precomputedOutcome: outcome({
          reward: 50, success: true,
          casualties: [{ heroId: 'd1', hpLost: 50, hpAfter: 0 }],
        }),
      }],
    });

    const r = processMissions(state, [dead], now);
    expect(r.activeMissions.length).toBe(0);
    expect(r.newHeroes[0].currentTask).toBe(HeroTask.IDLE);
  });

  test('boss semanal vitorioso → weeklyBossDefeated=true e templateId correto', () => {
    const now = 4_000_000;
    const boss = WEEKLY_BOSS_POOL[0];
    const hero = makeHero('hb');
    const state = makeState({
      heroes: [hero],
      activeMissions: [{
        id: 'mBoss', templateId: boss.id, heroIds: ['hb'],
        isWeeklyBoss: true,
        startedAt: now - 100_000, finishAt: now - 1000,
        looping: false, scheduledActions: [], enemiesState: [],
        precomputedOutcome: outcome({ reward: 200, success: true }),
      }],
    });

    const r = processMissions(state, [hero], now);
    expect(r.weeklyBossDefeated).toBe(true);
    expect(r.weeklyBossTemplateId).toBe(boss.id);
  });

  test('baixas aplicadas: hpCurrent do herói vira casualties.hpAfter', () => {
    const now = 5_000_000;
    const hero = makeHero('h1', { hpCurrent: 50 });
    const state = makeState({
      heroes: [hero],
      activeMissions: [{
        id: 'mCas', templateId: M1.id, heroIds: ['h1'],
        startedAt: now - 100_000, finishAt: now - 1000,
        looping: false, scheduledActions: [], enemiesState: [],
        precomputedOutcome: outcome({
          reward: 100, success: true,
          casualties: [{ heroId: 'h1', hpLost: 20, hpAfter: 30 }],
        }),
      }],
    });

    const r = processMissions(state, [hero], now);
    expect(r.newHeroes[0].hpCurrent).toBe(30);
  });

  test('drops acumulados em materialDrops', () => {
    const now = 6_000_000;
    const hero = makeHero('h1');
    const state = makeState({
      heroes: [hero],
      activeMissions: [{
        id: 'mDrop', templateId: M1.id, heroIds: ['h1'],
        startedAt: now - 100_000, finishAt: now - 1000,
        looping: false, scheduledActions: [], enemiesState: [],
        precomputedOutcome: outcome({ reward: 100, materialDrops: { iron: 2, leather: 1 } }),
      }],
    });

    const r = processMissions(state, [hero], now);
    expect(r.materialDrops).toEqual({ iron: 2, leather: 1 });
  });
});
