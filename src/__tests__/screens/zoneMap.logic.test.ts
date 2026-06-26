import { zoneStatus } from '../../utils/zoneUtils';
import { getEventBannerProps } from '../../components/EventBanner';
import type { GameState } from '../../types';

function makeState(completedMissionIds: string[], activeEvent?: GameState['activeEvent']): GameState {
  return {
    gold: 0,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: 0,
    completedMissionIds,
    activeEvent,
  } as unknown as GameState;
}

// ── zoneStatus ────────────────────────────────────────────────────────────────

describe('zoneStatus', () => {
  test('z1 sempre desbloqueado, z2-z4 bloqueados sem pré-requisitos', () => {
    const s = zoneStatus(makeState([]));
    expect(s.z1).toBe('unlocked');
    expect(s.z2).toBe('locked');
    expect(s.z3).toBe('locked');
    expect(s.z4).toBe('locked');
  });

  test('z2 desbloqueada após mission_boss_1 completada', () => {
    const s = zoneStatus(makeState(['mission_boss_1']));
    expect(s.z1).toBe('unlocked');
    expect(s.z2).toBe('unlocked');
    expect(s.z3).toBe('locked');
    expect(s.z4).toBe('locked');
  });

  test('z3 desbloqueada após z2_costa_2 completada', () => {
    const s = zoneStatus(makeState(['mission_boss_1', 'z2_costa_1', 'z2_costa_2']));
    expect(s.z3).toBe('unlocked');
    expect(s.z4).toBe('locked');
  });

  test('z4 desbloqueada após z3_picos_2 completada', () => {
    const s = zoneStatus(makeState(['mission_boss_1', 'z2_costa_1', 'z2_costa_2', 'z3_picos_1', 'z3_picos_2']));
    expect(s.z4).toBe('unlocked');
  });

  test('funciona sem completedMissionIds no estado (salvo antigo)', () => {
    const s = zoneStatus({ gold: 0, heroes: [] } as unknown as GameState);
    expect(s.z1).toBe('unlocked');
    expect(s.z2).toBe('locked');
  });
});

// ── EventBanner ───────────────────────────────────────────────────────────────

describe('getEventBannerProps', () => {
  test('retorna null quando não há activeEvent', () => {
    expect(getEventBannerProps(makeState([]))).toBeNull();
  });

  test('retorna null quando activeEvent é null', () => {
    expect(getEventBannerProps(makeState([], null))).toBeNull();
  });

  test('retorna dados do evento quando activeEvent presente', () => {
    const state = makeState([], {
      id: 'event_goblin_invasion',
      startedAt: 0,
      endsAt: 999_999,
      seed: 202601,
    });
    const props = getEventBannerProps(state);
    expect(props).not.toBeNull();
    expect(props!.id).toBe('event_goblin_invasion');
    expect(props!.name).toBeDefined();
    expect(props!.icon).toBeDefined();
  });

  test('retorna null para id de evento desconhecido', () => {
    const state = makeState([], {
      id: 'evento_inexistente',
      startedAt: 0,
      endsAt: 999_999,
      seed: 202601,
    });
    expect(getEventBannerProps(state)).toBeNull();
  });
});
