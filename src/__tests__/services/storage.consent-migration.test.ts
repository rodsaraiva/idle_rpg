import { migrateState, CURRENT_VERSION } from '../../services/storage';
test('CURRENT_VERSION = 14', () => expect(CURRENT_VERSION).toBe(14));
test('save v12 migra com consentimento indeciso (analytics off)', () => {
  const old: any = { _version: 12, gold: 3, heroes: [] };
  const m = migrateState(old);
  expect(m.consent).toEqual({ analytics: false, decided: false, decidedAt: 0 });
});
test('migração v12→v13 preserva consent e notificationPrefs já decididos', () => {
  const old: any = {
    _version: 12,
    gold: 5,
    heroes: [],
    notificationPrefs: { optedIn: true, categories: { missionReady: true, bossReady: false, dailyReset: false, idle: false }, quietHours: { start: 22, end: 9 } },
    consent: { analytics: true, decided: true, decidedAt: 1700000000000 },
  };
  const m = migrateState(old);
  expect(m.notificationPrefs!.optedIn).toBe(true);
  expect(m.consent).toEqual({ analytics: true, decided: true, decidedAt: 1700000000000 });
});
