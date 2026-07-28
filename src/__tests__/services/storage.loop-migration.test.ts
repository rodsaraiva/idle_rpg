import { migrateState, CURRENT_VERSION } from '../../services/storage';

test('save v13 com missão em loop vira plano endless na v14', () => {
  const antigo: any = {
    _version: 13, gold: 10, heroes: [], legacy: { level: 0, totalExp: 0, sealsEarned: [] },
    activeEvent: null, legacyUpgrades: {}, consent: { analytics: false, decided: false, decidedAt: 0 },
    activeMissions: [
      { id: 'm1', templateId: 'mission_1', heroIds: ['h1'], startedAt: 0, looping: true },
      { id: 'm2', templateId: 'mission_1', heroIds: ['h2'], startedAt: 0, looping: false },
    ],
  };

  const novo: any = migrateState(antigo);

  expect(novo._version).toBe(CURRENT_VERSION);
  expect(novo.activeMissions[0].loop).toEqual({ mode: 'endless' });
  expect(novo.activeMissions[0].looping).toBeUndefined();
  expect(novo.activeMissions[1].loop).toBeUndefined();
  expect(novo.activeMissions[1].looping).toBeUndefined();
});

test('save sem activeMissions migra sem quebrar', () => {
  const novo: any = migrateState({ _version: 13, gold: 0, heroes: [] });
  expect(novo._version).toBe(CURRENT_VERSION);
});
