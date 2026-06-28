/**
 * Invariante de segurança: gold NÃO cresce passivamente no tick.
 *
 * Legado (reward_1/haste_1) e evento ativo só multiplicam ouro de missão
 * concluída. Sem missão completada no tick, gold permanece idêntico ao inicial.
 */

import { handleTick } from '../../context/tickHandler';
import { HeroTask, Hero } from '../../types';
import { TICK_INTERVAL_MS } from '../../constants/game';

// seed 202512 % 5 = 2 → event_celestial_blessing (missionRewardPct +10%) → activeEventRewardMultiplier > 1
const NOW_DEC_2025 = new Date(2025, 11, 15).getTime();

function makeHero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: overrides.id ?? 'h1',
    name: overrides.name ?? 'Herói',
    hpMax: 50,
    hpCurrent: 50,
    atk: 15,
    mp: 5,
    defense: 3,
    crit: 5,
    agility: 5,
    currentTask: overrides.currentTask ?? HeroTask.IDLE,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
    ...overrides,
  } as Hero;
}

/** Estado base: sem missões ativas, com Legado comprado e evento ativo. */
function makeStateWithBonuses(now: number): any {
  const seed = Math.floor(now / (1000 * 60 * 60 * 24 * 30)) % 100 + 202501; // aproximação — usamos refreshActiveEvent
  // Construir activeEvent consistente com now para que refreshActiveEvent seja no-op:
  // Mesma lógica de getEventSeed: seed = year*100 + (month+1).
  const d = new Date(now);
  const eventSeed = d.getFullYear() * 100 + (d.getMonth() + 1);
  const events = ['event_goblin_invasion', 'event_forge_festival', 'event_celestial_blessing', 'event_blood_moon', 'event_ancient_dragon'];
  const eventId = events[eventSeed % events.length];
  const endsAt = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() - 1;

  return {
    gold: 200,
    heroes: [makeHero()],
    heroesRecruited: 1,
    lastSavedAt: 0,
    inventory: [],
    activeMissions: [], // NENHUMA missão ativa
    tickIntervalMs: TICK_INTERVAL_MS,
    // Legado: reward_1 rank 2 (+10% reward) + haste_1 rank 1 (-10% duração)
    legacyUpgrades: { reward_1: 2, haste_1: 1 },
    legacy: { level: 3, xp: 0 },
    // Evento ativo com seed do mês correspondente a `now`
    activeEvent: {
      id: eventId,
      startedAt: now - 1000,
      endsAt,
      seed: eventSeed,
    },
    unlockedAchievements: [
      'recruit_1', 'recruit_5', 'recruit_10',
      'gold_100', 'gold_1000',
      'mission_first', 'mission_10', 'mission_50',
      'forge_1', 'forge_5', 'boss_slayer',
    ],
  };
}

describe('invariante "sem gold passivo" no caminho do tick', () => {
  test('gold permanece EXATAMENTE igual após 10 ticks sem missões (Legado + evento ativos)', () => {
    const now = NOW_DEC_2025;
    let state = makeStateWithBonuses(now) as any;
    const goldInicial = state.gold;

    for (let i = 0; i < 10; i++) {
      state = handleTick(state, now + i * TICK_INTERVAL_MS);
    }

    expect(state.gold).toBe(goldInicial);
    expect(state.activeMissions).toHaveLength(0);
  });

  test('ouro de missão concluída SÍ aumenta quando Legado e evento estão ativos (prova que multiplicadores funcionam)', () => {
    const now = NOW_DEC_2025;
    const hero = makeHero({ id: 'h1', currentTask: HeroTask.MISSION });
    const state = {
      ...makeStateWithBonuses(now),
      gold: 0,
      heroes: [hero],
      activeMissions: [
        {
          id: 'miss-ctrl',
          templateId: 'mission_1',
          heroIds: ['h1'],
          startedAt: now - 100_000,
          finishAt: now - 1000,
          looping: false,
          scheduledActions: [],
          enemiesState: [],
          precomputedOutcome: {
            reward: 100,
            rounds: 3,
            actions: [],
            log: [],
            success: true,
            casualties: [],
            enemyCasualties: 1,
          },
        },
      ],
    } as any;

    const next = handleTick(state, now);

    // Com reward_1 rank 2 (+10%) e celestial_blessing (+10%), multiplicador total > 1
    // → gold > 100 (o valor base da recompensa)
    expect(next.gold).toBeGreaterThan(100);
  });
});
