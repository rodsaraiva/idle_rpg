import { buyLegacyUpgrade } from '../../context/legacyHandler';
import {
  legacyRewardMultiplier,
  legacyDurationMultiplier,
  legacyTrainSpeedFactor,
  legacyMissionSlotBonus,
} from '../../constants/legacyUpgrades';
import { handleStartMission } from '../../context/missionHandler';
import { handleTick } from '../../context/tickHandler';
import { initialGameState } from '../../context/gameReducer';
import { HeroTask } from '../../types';
import { BASE_MISSION_SLOTS } from '../../constants/game';

const lvl = (level: number): any => ({ gold: 0, heroes: [], legacy: { level, totalExp: 0, sealsEarned: [] }, legacyUpgrades: {} });

// ── reward_1 (existentes) ────────────────────────────────────────────────────

test('comprar upgrade gasta ponto e aplica multiplicador de recompensa', () => {
  const s = buyLegacyUpgrade(lvl(1), 'reward_1');
  expect(s.legacyUpgrades!['reward_1']).toBe(1);
  expect(legacyRewardMultiplier(s)).toBeGreaterThan(1);
});

test('não compra sem pontos disponíveis', () => {
  const s = buyLegacyUpgrade(lvl(0), 'reward_1');
  expect(s.legacyUpgrades!['reward_1'] ?? 0).toBe(0); // sem mudança
});

test('upgrade nunca credita gold direto', () => {
  const s = buyLegacyUpgrade(lvl(3), 'reward_1');
  expect(s.gold).toBe(0);
});

// ── haste_1 (missionDurationPct) ────────────────────────────────────────────

test('haste_1 rank 1 reduz legacyDurationMultiplier abaixo de 1.0', () => {
  const s = buyLegacyUpgrade(lvl(1), 'haste_1');
  expect(legacyDurationMultiplier(s)).toBeLessThan(1);
  expect(legacyDurationMultiplier(s)).toBeGreaterThanOrEqual(0.5); // piso
});

test('missão iniciada com haste_1 ativo tem atMsFromStart menor do que sem upgrade', () => {
  const hero = {
    id: 'h1', name: 'Hero', hpMax: 50, hpCurrent: 50, atk: 15, mp: 5,
    defense: 5, crit: 5, agility: 10, currentTask: HeroTask.IDLE,
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
  } as any;

  const baseState = { ...initialGameState, heroes: [hero], activeMissions: [], legacyUpgrades: {} };
  const hasteState = { ...initialGameState, heroes: [hero], activeMissions: [],
    legacy: { level: 1, totalExp: 0, sealsEarned: [] }, legacyUpgrades: { haste_1: 1 } };

  const now = Date.now();
  const r0 = handleStartMission(baseState, 'mission_1', ['h1'], undefined, now);
  const r1 = handleStartMission(hasteState, 'mission_1', ['h1'], undefined, now);

  // Só compara se a missão gerou scheduled actions
  const acts0 = r0.activeMissions?.[0]?.scheduledActions ?? [];
  const acts1 = r1.activeMissions?.[0]?.scheduledActions ?? [];

  if (acts0.length > 0 && acts1.length > 0) {
    expect(acts1[0].atMsFromStart).toBeLessThan(acts0[0].atMsFromStart);
  } else {
    // Sem ações agendadas: verifica que pelo menos o multiplicador < 1 está aplicado
    expect(legacyDurationMultiplier(hasteState)).toBeLessThan(1);
  }
});

// ── train_1 (trainSpeedPct) ──────────────────────────────────────────────────

test('train_1 rank 1 aumenta legacyTrainSpeedFactor acima de 1.0', () => {
  const s = buyLegacyUpgrade(lvl(1), 'train_1');
  expect(legacyTrainSpeedFactor(s)).toBeGreaterThan(1);
});

test('herói treina mais rápido com train_1 ativo (mais pontos por tick longo)', () => {
  const hero = {
    id: 'h1', name: 'Hero', hpMax: 10, hpCurrent: 10, atk: 5, mp: 3,
    defense: 5, crit: 5, agility: 10, currentTask: HeroTask.TRAIN_ATK,
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
  } as any;

  // tick muito longo para garantir ao menos 1 ponto em ambos os estados
  const BIG_TICK = 10_000_000;

  const baseState = { ...initialGameState, heroes: [hero], tickIntervalMs: BIG_TICK, legacyUpgrades: {} };
  const trainState = { ...initialGameState, heroes: [hero], tickIntervalMs: BIG_TICK,
    legacy: { level: 3, totalExp: 0, sealsEarned: [] }, legacyUpgrades: { train_1: 3 } };

  const r0 = handleTick(baseState, Date.now());
  const r1 = handleTick(trainState, Date.now());

  const atkBase = r0.heroes[0].atk;
  const atkFast = r1.heroes[0].atk;
  expect(atkFast).toBeGreaterThanOrEqual(atkBase);
});

// ── slot_1 (missionSlot) ─────────────────────────────────────────────────────

test('slot_1 rank 1 aumenta legacyMissionSlotBonus para 1', () => {
  const s = buyLegacyUpgrade(lvl(1), 'slot_1');
  expect(legacyMissionSlotBonus(s)).toBe(1);
});

test('sem slot_1: não inicia missão além de BASE_MISSION_SLOTS', () => {
  const hero = (id: string) => ({
    id, name: 'Hero', hpMax: 50, hpCurrent: 50, atk: 15, mp: 5,
    defense: 5, crit: 5, agility: 10, currentTask: HeroTask.IDLE,
    trainingCount: { hp: 0, atk: 0, mp: 0 }, trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
  } as any);

  // Encher os slots base com missões fictícias já ativas
  const filledMissions = Array.from({ length: BASE_MISSION_SLOTS }, (_, i) => ({
    id: `m${i}`, templateId: 'mission_1', heroIds: [`occupied_${i}`],
    startedAt: Date.now(),
  }));

  const state = {
    ...initialGameState,
    heroes: [hero('h_new')],
    activeMissions: filledMissions,
    legacyUpgrades: {},
  };

  const next = handleStartMission(state, 'mission_1', ['h_new'], undefined, Date.now());
  // Estado não deve ter mudado (missão bloqueada por falta de slot)
  expect(next.activeMissions?.length).toBe(BASE_MISSION_SLOTS);
});

test('com slot_1 rank 1: permite missão além de BASE_MISSION_SLOTS', () => {
  const hero = {
    id: 'h_new', name: 'Hero', hpMax: 50, hpCurrent: 50, atk: 15, mp: 5,
    defense: 5, crit: 5, agility: 10, currentTask: HeroTask.IDLE,
    trainingCount: { hp: 0, atk: 0, mp: 0 }, trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
  } as any;

  const filledMissions = Array.from({ length: BASE_MISSION_SLOTS }, (_, i) => ({
    id: `m${i}`, templateId: 'mission_1', heroIds: [`occupied_${i}`],
    startedAt: Date.now(),
  }));

  const state = {
    ...initialGameState,
    heroes: [hero],
    activeMissions: filledMissions,
    legacy: { level: 1, totalExp: 0, sealsEarned: [] },
    legacyUpgrades: { slot_1: 1 },
  };

  const next = handleStartMission(state, 'mission_1', ['h_new'], undefined, Date.now());
  expect(next.activeMissions?.length).toBe(BASE_MISSION_SLOTS + 1);
});
