import { migrateState, CURRENT_VERSION } from '../../services/storage';

test('CURRENT_VERSION = 13', () => expect(CURRENT_VERSION).toBe(13));

test('save v11 migra com defaults seguros e push opt-OUT', () => {
  const old: any = { __version: 11, gold: 7, heroes: [], legacy: { level: 0, totalExp: 0, sealsEarned: [] }, activeEvent: null, legacyUpgrades: {} };
  const m = migrateState(old);
  expect(m.loginStreak).toEqual({ count: 0, lastClaimedSeed: 0, lastSeenSeed: 0 });
  expect(m.keys).toEqual({ bronze: 0, silver: 0, gold: 0 });
  expect(m.cosmetics).toEqual({ owned: [], equipped: {} });
  expect(m.notificationPrefs!.optedIn).toBe(false); // ético: opt-out default
  expect(m.gold).toBe(7);
});
