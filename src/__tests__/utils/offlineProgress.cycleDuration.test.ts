// I2 — o caminho offline tem que usar a MESMA duração de ciclo que o motor online deriva do
// combate pré-computado (computeCycleDurationMs), nunca template.durationMs — que o motor
// online não lê em lugar nenhum (era só um rótulo antigo, dessincronizado da execução real).
// Este teste é o "canário": ele quebra se alguém reintroduzir template.durationMs offline.
import { calculateOfflineProgress } from '../../utils/offlineProgress';
import { computeCycleDurationMs } from '../../utils/missionLoop';
import { MISSIONS } from '../../constants/missions';
import { GameState, Hero, HeroTask, ActiveMission, MissionAction } from '../../types';

const TPL = MISSIONS.find((m) => m.id === 'mission_1')!; // durationMs vestigial: 10_000

// 5 ações pré-computadas → duração real do ciclo bem maior que o durationMs vestigial
// (mede o mesmo efeito que o revisor mediu: mission_1 online >> mission_1.durationMs).
const ACTIONS_COUNT = 5;
const REAL_CYCLE_MS = computeCycleDurationMs(ACTIONS_COUNT);

function acao(): MissionAction {
  return { actorType: 'hero', actionType: 'hit', actorId: 'h1', text: 'golpe' };
}

function heroi(): Hero {
  return {
    id: 'h1', name: 'Herói', hpMax: 100, hpCurrent: 100, atk: 20, mp: 10,
    defense: 5, crit: 5, agility: 5, currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  } as Hero;
}

function estadoComMissao(startedAt: number, lastSavedAt: number): GameState {
  const mission: ActiveMission = {
    id: 'm1', templateId: TPL.id, heroIds: ['h1'], startedAt,
    scheduledActions: [], enemiesState: [],
    precomputedOutcome: {
      reward: 100, rounds: 1, actions: Array.from({ length: ACTIONS_COUNT }, acao),
      log: [], success: true, casualties: [], enemyCasualties: 1,
    },
  };
  return {
    gold: 0, heroes: [heroi()], heroesRecruited: 1,
    lastSavedAt, activeMissions: [mission],
  } as GameState;
}

describe('I2 — duração do ciclo offline = duração real do online (computeCycleDurationMs)', () => {
  test('sanity: com 5 ações, a duração real do ciclo é maior que o durationMs vestigial do template', () => {
    // Se isso falhar, o cenário do teste não está mais medindo o que devia — ver ACTIONS_COUNT.
    expect(REAL_CYCLE_MS).toBeGreaterThan(TPL.durationMs);
  });

  test('elapsed > durationMs vestigial mas < duração real: NÃO completa (pegaria o bug de volta)', () => {
    // Entre o durationMs antigo (10_000) e a duração real (~11_200): só completa se alguém
    // reintroduzir template.durationMs como base do cálculo.
    const elapsed = TPL.durationMs + 500;
    expect(elapsed).toBeLessThan(REAL_CYCLE_MS); // garante que o cenário testa a janela certa
    const startedAt = Date.now() - elapsed;
    const estado = estadoComMissao(startedAt, startedAt);

    const resumo = calculateOfflineProgress(estado)!;

    expect(resumo.goldGained).toBe(0);
    expect(resumo.newState!.activeMissions).toHaveLength(1);
    expect(resumo.newState!.activeMissions![0].startedAt).toBe(startedAt);
  });

  test('elapsed > duração real: completa exatamente no limite calculado por computeCycleDurationMs', () => {
    const elapsed = REAL_CYCLE_MS + 1;
    const startedAt = Date.now() - elapsed;
    const estado = estadoComMissao(startedAt, startedAt);

    const resumo = calculateOfflineProgress(estado)!;

    expect(resumo.goldGained).toBe(100);
    expect(resumo.newState!.activeMissions).toHaveLength(0);
    expect(resumo.newState!.heroes[0].currentTask).toBe(HeroTask.IDLE);
  });
});
