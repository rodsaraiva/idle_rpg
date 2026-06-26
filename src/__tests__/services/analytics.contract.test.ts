/**
 * Contrato de analytics de retenção — Task 8 do SPEC 8.
 * Garante que os 4 novos eventos existem no union AnalyticsEvent.
 * Emissão real (sink PostHog/Amplitude) fica como débito no SPEC 9.
 */
import { analytics, AnalyticsEvent } from '../../services/analytics';

const RETENTION_EVENTS: AnalyticsEvent[] = [
  'daily_login_claimed',
  'key_chest_opened',
  'cosmetic_equipped',
  'notification_prefs_updated',
];

test('os 4 eventos de retenção fazem parte do contrato AnalyticsEvent', () => {
  for (const ev of RETENTION_EVENTS) {
    expect(() => analytics.track(ev)).not.toThrow();
  }
});

test('cosmetic_equipped aceita props sem lançar', () => {
  expect(() =>
    analytics.track('cosmetic_equipped', { cosmeticId: 'x' })
  ).not.toThrow();
});

test('daily_login_claimed aceita props sem lançar', () => {
  expect(() =>
    analytics.track('daily_login_claimed', { streakDay: 3 })
  ).not.toThrow();
});

test('key_chest_opened aceita props sem lançar', () => {
  expect(() =>
    analytics.track('key_chest_opened', { tier: 'bronze' })
  ).not.toThrow();
});

test('notification_prefs_updated aceita props sem lançar', () => {
  expect(() =>
    analytics.track('notification_prefs_updated', { optedIn: true })
  ).not.toThrow();
});
