import { migrateState, CURRENT_VERSION } from '../../services/storage';

test('save v10 migra para versão atual com legacy/activeEvent default', () => {
  const old: any = { _version: 10, gold: 100, heroes: [], onboarding: { version: 1, step: 'done', startedAt: 1, hintsSeen: {} } };
  const migrated = migrateState(old);
  expect(migrated.legacy).toEqual({ level: 0, totalExp: 0, sealsEarned: [] });
  expect(migrated.activeEvent).toBeNull();
  expect(migrated.legacyUpgrades).toEqual({});
  expect(migrated.gold).toBe(100); // progresso preservado
});

test('CURRENT_VERSION avançou para 14', () => {
  expect(CURRENT_VERSION).toBe(14);
});
