import { gameReducer } from '../../context/gameReducer';

test('SET_NOTIFICATION_PREFS faz merge e default é opt-out', () => {
  const base: any = {
    heroes: [],
    notificationPrefs: {
      optedIn: false,
      categories: { missionReady: false, bossReady: false, dailyReset: false, idle: false },
      quietHours: { start: 22, end: 9 },
    },
  };
  const s = gameReducer(base, { type: 'SET_NOTIFICATION_PREFS', prefs: { optedIn: true } } as any);
  expect(s.notificationPrefs!.optedIn).toBe(true);
  expect(s.notificationPrefs!.quietHours.start).toBe(22); // merge preserva resto
});

test('SET_NOTIFICATION_PREFS mantém categories quando não especificado', () => {
  const base: any = {
    heroes: [],
    notificationPrefs: {
      optedIn: false,
      categories: { missionReady: true, bossReady: false, dailyReset: true, idle: false },
      quietHours: { start: 22, end: 9 },
    },
  };
  const s = gameReducer(base, { type: 'SET_NOTIFICATION_PREFS', prefs: { optedIn: false } } as any);
  expect(s.notificationPrefs!.categories.missionReady).toBe(true);
  expect(s.notificationPrefs!.categories.dailyReset).toBe(true);
});

test('SET_NOTIFICATION_PREFS não mexe em gold', () => {
  const base: any = {
    gold: 42,
    heroes: [],
    notificationPrefs: {
      optedIn: false,
      categories: { missionReady: false, bossReady: false, dailyReset: false, idle: false },
      quietHours: { start: 22, end: 9 },
    },
  };
  const s = gameReducer(base, { type: 'SET_NOTIFICATION_PREFS', prefs: { optedIn: true } } as any);
  expect(s.gold).toBe(42); // invariante: sem gold passivo
});
