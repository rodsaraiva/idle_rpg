import { refreshLoginStreak, claimLoginReward } from '../../context/loginStreakHandler';
import { LOGIN_REWARDS } from '../../constants/loginRewards';
import { getDailySeed } from '../../constants/dailyQuests';

test('pool de login nunca contém gold', () => {
  for (const r of LOGIN_REWARDS) expect((r as any).kind).not.toBe('gold');
});

test('refresh marca dia visto idempotentemente', () => {
  const s1 = refreshLoginStreak({ gold: 5, heroes: [], loginStreak: { count: 0, lastClaimedSeed: 0, lastSeenSeed: 0 } } as any);
  expect(s1.loginStreak!.lastSeenSeed).toBe(getDailySeed());
  const s2 = refreshLoginStreak(s1);
  expect(s2).toBe(s1); // no-op no mesmo dia
});

test('claim concede recompensa não-gold e NÃO mexe em gold', () => {
  const seed = getDailySeed();
  const base: any = { gold: 100, heroes: [], materials: {}, keys: { bronze: 0, silver: 0, gold: 0 }, cosmetics: { owned: [], equipped: {} }, loginStreak: { count: 1, lastClaimedSeed: 0, lastSeenSeed: seed } };
  const s = claimLoginReward(base);
  expect(s.gold).toBe(100); // invariante sem gold passivo
  expect(s.loginStreak!.lastClaimedSeed).toBe(seed);
});

test('streak reseta ao pular um dia', () => {
  // lastSeenSeed de 2 dias atrás → nem ontem nem hoje → count volta a 1
  const d = new Date();
  d.setDate(d.getDate() - 2);
  const twoDaysAgoSeed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

  const base: any = {
    gold: 0,
    heroes: [],
    loginStreak: { count: 5, lastClaimedSeed: 0, lastSeenSeed: twoDaysAgoSeed },
  };

  const s = refreshLoginStreak(base);
  expect(s.loginStreak!.count).toBe(1); // streak resetado porque pulou um dia
  expect(s.loginStreak!.lastSeenSeed).toBe(getDailySeed()); // dia atual marcado
});
