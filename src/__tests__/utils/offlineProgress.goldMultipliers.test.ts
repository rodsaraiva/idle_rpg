// I3 — o caminho offline tem que passar pelos MESMOS multiplicadores de ouro que o online
// (pantheon → Legado → Evento, via computeFinalGold), aplicados por ciclo antes de somar.
// Em vez de fixar números mágicos, cada teste roda os dois motores (processMissions e
// calculateOfflineProgress) sobre o MESMO estado e compara o resultado — é a paridade que
// importa, e ela precisa continuar valendo se as regras de multiplicador mudarem.
import { calculateOfflineProgress } from '../../utils/offlineProgress';
import { processMissions } from '../../context/missionTickHandler';
import { computeFinalGold } from '../../utils/rewards';
import { getEventSeed } from '../../constants/events';
import { MISSIONS } from '../../constants/missions';
import { GameState, Hero, HeroTask, ActiveMission, MissionOutcome } from '../../types';

const TPL = MISSIONS[0]; // mission_1, durationMs 10_000

function heroi(id: string): Hero {
  return {
    id, name: `Herói ${id}`, hpMax: 100, hpCurrent: 100, atk: 20, mp: 10,
    defense: 5, crit: 5, agility: 5, currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  } as Hero;
}

function outcome(reward: number): MissionOutcome {
  return { reward, rounds: 1, actions: [], log: [], success: true, casualties: [], enemyCasualties: 1 };
}

/** Estado com pantheon goldPercent 10% + evento sazonal ativo (mult multiplicativo, não trivial). */
function estadoComBonus(overrides: Partial<GameState> = {}): GameState {
  const seed = getEventSeed(Date.now());
  return {
    gold: 0, heroes: [], heroesRecruited: 1, lastSavedAt: Date.now(),
    activeMissions: [],
    pantheonBonuses: { goldPercent: 10, atkPercent: 0, hpPercent: 0 },
    activeEvent: { id: 'event_goblin_invasion', seed, startedAt: 0, endsAt: Date.now() + 60_000 },
    ...overrides,
  } as GameState;
}

describe('I3 — paridade de ouro online × offline (computeFinalGold)', () => {
  test('missão avulsa (1 ciclo): offline credita o mesmo que processMissions credita online', () => {
    const REWARD = 100;
    const now = Date.now();
    const heroes = [heroi('h1')];

    // ONLINE: mission já com finishAt vencido — processMissions completa direto via precomputedOutcome.
    const missaoOnline: ActiveMission = {
      id: 'm1', templateId: TPL.id, heroIds: ['h1'],
      startedAt: now - 1000, finishAt: now - 1, scheduledActions: [], enemiesState: [],
      precomputedOutcome: outcome(REWARD),
    };
    const estadoOnline = estadoComBonus({ heroes, activeMissions: [missaoOnline] });
    const resultadoOnline = processMissions(estadoOnline, heroes, now);

    // OFFLINE: mesma missão, decorrido = 1 ciclo (mesmo template, sem loop).
    // lastSavedAt PRECISA ter o mesmo offset de startedAt — calculateOfflineProgress usa
    // Date.now() - lastSavedAt como "tempo decorrido"; se lastSavedAt for recente, ticks vira 0
    // e a função retorna null antes mesmo de olhar pra missão.
    const startedAtOffline = now - 1 - TPL.durationMs;
    const missaoOffline: ActiveMission = {
      id: 'm1', templateId: TPL.id, heroIds: ['h1'],
      startedAt: startedAtOffline, scheduledActions: [], enemiesState: [],
      precomputedOutcome: outcome(REWARD),
    };
    const estadoOffline = estadoComBonus({
      heroes, lastSavedAt: startedAtOffline, activeMissions: [missaoOffline],
    });
    const resumoOffline = calculateOfflineProgress(estadoOffline)!;

    // Confirma que o bônus realmente está em jogo (não é um teste que passaria com mult=1).
    expect(computeFinalGold(REWARD, estadoOnline)).toBeGreaterThan(REWARD);
    expect(resultadoOnline.goldGained).toBe(computeFinalGold(REWARD, estadoOnline));
    expect(resumoOffline.goldGained).toBe(resultadoOnline.goldGained);
  });

  test('loop de N ciclos: offline soma floor-por-ciclo, igual a N conclusões online somadas (não floor do total)', () => {
    const REWARD = 9;
    const CICLOS = 3;
    const now = Date.now();
    const heroes = [heroi('h1')];
    // Só pantheon (40%), sem evento: isola a mecânica de arredondamento sem somar mais um fator.
    const bonusIsolado = (over: Partial<GameState>): GameState => ({
      gold: 0, heroes: [], heroesRecruited: 1, lastSavedAt: Date.now(), activeMissions: [],
      pantheonBonuses: { goldPercent: 40, atkPercent: 0, hpPercent: 0 },
      activeEvent: null,
      ...over,
    } as GameState);

    // ONLINE: simula os 3 ciclos como 3 conclusões independentes (mesma fórmula que o
    // motor de loop usa por ciclo: computeFinalGold aplicado e somado a cada conclusão).
    let onlineTotal = 0;
    for (let i = 0; i < CICLOS; i++) {
      const missao: ActiveMission = {
        id: `m${i}`, templateId: TPL.id, heroIds: ['h1'],
        startedAt: now - 1000, finishAt: now - 1, scheduledActions: [], enemiesState: [],
        precomputedOutcome: outcome(REWARD),
      };
      const estado = bonusIsolado({ heroes, activeMissions: [missao] });
      const resultado = processMissions(estado, heroes, now);
      onlineTotal += resultado.goldGained;
    }

    // OFFLINE: 1 missão em loop "times", decorrido cobre exatamente os 3 ciclos.
    const decorrido = TPL.durationMs * CICLOS + 1;
    const missaoLoop: ActiveMission = {
      id: 'mloop', templateId: TPL.id, heroIds: ['h1'],
      startedAt: now - decorrido, scheduledActions: [], enemiesState: [],
      precomputedOutcome: outcome(REWARD),
      loop: { mode: 'times', remaining: CICLOS, total: CICLOS },
    };
    const estadoOffline = bonusIsolado({ heroes, lastSavedAt: now - decorrido, activeMissions: [missaoLoop] });
    const resumoOffline = calculateOfflineProgress(estadoOffline)!;

    // floor(9*1.4) = 12 por ciclo × 3 = 36. Um bug que floreasse o TOTAL antes (floor(27*1.4)=37)
    // creditaria 1 a mais — é exatamente esse tipo de divergência de arredondamento que o item cita.
    const floorPorCiclo = computeFinalGold(REWARD, estadoOffline);
    const floorDoTotalIngenuo = computeFinalGold(REWARD * CICLOS, estadoOffline);
    expect(floorPorCiclo).toBe(12);
    expect(floorDoTotalIngenuo).toBe(37);

    expect(onlineTotal).toBe(floorPorCiclo * CICLOS); // 36
    expect(resumoOffline.goldGained).toBe(onlineTotal);
    // Prova que a ordem de arredondamento importa: se alguém trocar por floor(total), este teste quebra.
    expect(resumoOffline.goldGained).not.toBe(floorDoTotalIngenuo);
  });
});
