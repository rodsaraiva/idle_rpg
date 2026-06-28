/**
 * BUG H2 — Selos de Legado nunca concedidos no fluxo real
 *
 * Causa raiz: handleTick nunca chamava checkLegacySeals — só checkAchievements.
 * Resultado: legacy.sealsEarned ficava [] para sempre.
 *
 * Fix: tickHandler.ts retorna checkLegacySeals(checkAchievements(stateAfterTick)).
 */
import { handleTick } from '../../context/tickHandler';
import { initialGameState } from '../../context/gameReducer';
import { HeroTask, Hero, ActiveMission, MissionOutcome } from '../../types';

const FIXED_NOW = 1_700_000_000_000;

// Pre-unlock todas as conquistas conhecidas para isolar o efeito dos selos
const ALL_ACHIEVEMENTS = [
  'recruit_1', 'recruit_3', 'recruit_5', 'recruit_10',
  'gold_100', 'gold_1000', 'gold_10000',
  'mission_first', 'mission_10', 'mission_50',
  'forge_1', 'forge_5', 'boss_slayer',
  'first_mission', 'five_missions', 'twenty_missions',
  'mission_variety_3', 'all_mission_types',
];

function makeHero(id: string): Hero {
  return {
    id,
    name: `Hero ${id}`,
    hpMax: 50,
    hpCurrent: 50,
    atk: 30,
    mp: 10,
    defense: 10,
    crit: 10,
    agility: 10,
    currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    trainingCount: { hp: 0, atk: 0, mp: 0 },
  } as Hero;
}

/**
 * Monta um estado com missão z2_costa_1 já concluída (finishAt no passado)
 * pronta para ser processada pelo tick.
 * z2_costa_1 requer minHeroes: 4.
 */
function makeStateWithCostaFinishing() {
  const heroes = ['h1', 'h2', 'h3', 'h4'].map(makeHero);

  const precomputedOutcome: MissionOutcome = {
    reward: 0, // reward zero para isolar — não queremos gold de missão interferindo
    rounds: 5,
    actions: [],
    log: ['victory'],
    success: true,
    casualties: heroes.map(h => ({ heroId: h.id, hpLost: 0, hpAfter: 50 })),
    enemyCasualties: 5,
  };

  const mission: ActiveMission = {
    id: 'm-costa-1',
    templateId: 'z2_costa_1',
    heroIds: ['h1', 'h2', 'h3', 'h4'],
    startedAt: FIXED_NOW - 200_000,
    finishAt: FIXED_NOW - 1_000, // já terminou
    enemiesState: [],
    scheduledActions: [],
    precomputedOutcome,
    looping: false,
  };

  return {
    ...initialGameState,
    heroes,
    gold: 0,
    heroesRecruited: 4,
    activeMissions: [mission],
    completedMissionIds: [],
    legacy: { level: 0, totalExp: 0, sealsEarned: [] },
    unlockedAchievements: ALL_ACHIEVEMENTS,
  };
}

describe('BUG H2 — Selos de Legado via tick (RED → GREEN)', () => {
  test('tick que conclui z2_costa_1 concede seal_costa em legacy.sealsEarned', () => {
    const state = makeStateWithCostaFinishing();

    const result = handleTick(state, FIXED_NOW);

    // Pré-condição: a missão deve ter sido concluída e templateId registrado
    expect(result.completedMissionIds).toContain('z2_costa_1');

    // BUG H2: antes do fix → sealsEarned é [] porque checkLegacySeals não era chamado
    // Após o fix → seal_costa deve aparecer aqui
    expect(result.legacy?.sealsEarned).toContain('seal_costa');
  });

  test('tick que conclui z2_costa_1 reflete 50 exp do selo (sem subir de nível)', () => {
    // legacyExpThreshold(0) = 100; 50 exp < 100 → level permanece 0
    const state = makeStateWithCostaFinishing();

    const result = handleTick(state, FIXED_NOW);

    expect(result.legacy?.sealsEarned).toContain('seal_costa');
    expect(result.legacy?.level).toBe(0);
    expect(result.legacy?.totalExp).toBe(50);
  });

  test('Selos de Legado concedidos via tick NÃO alteram gold (invariante: sem gold passivo)', () => {
    const goldInicial = 0;
    const state = { ...makeStateWithCostaFinishing(), gold: goldInicial };

    const result = handleTick(state, FIXED_NOW);

    // reward da missão é 0 e achievements estão todos unlocked → gold deve ser 0
    expect(result.gold).toBe(goldInicial);
  });

  test('checkLegacySeals é idempotente: segundo tick não duplica o selo', () => {
    const state = makeStateWithCostaFinishing();

    const after1 = handleTick(state, FIXED_NOW);
    // Segundo tick com completedMissionIds já contendo z2_costa_1 e selo já concedido
    const stateForTick2 = { ...after1, activeMissions: [] };
    const after2 = handleTick(stateForTick2, FIXED_NOW + 60_000);

    expect(after2.legacy?.sealsEarned.filter(s => s === 'seal_costa')).toHaveLength(1);
  });
});
