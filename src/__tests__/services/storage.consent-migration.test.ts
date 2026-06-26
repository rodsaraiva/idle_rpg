import { migrateState, CURRENT_VERSION } from '../../services/storage';
test('CURRENT_VERSION = 13', () => expect(CURRENT_VERSION).toBe(13));
test('save v12 migra com consentimento indeciso (analytics off)', () => {
  const old: any = { __version: 12, gold: 3, heroes: [] };
  const m = migrateState(old);
  expect(m.consent).toEqual({ analytics: false, decided: false, decidedAt: 0 });
});
