import { analytics, setAnalyticsConsent, setAnalyticsSink } from '../../services/analytics';

test('track é no-op sem consentimento', () => {
  const calls: string[] = [];
  setAnalyticsSink((e) => calls.push(e));
  setAnalyticsConsent(false);
  analytics.track('app_open');
  expect(calls).toEqual([]);
});

test('com consentimento, emite ao sink', () => {
  const calls: string[] = [];
  setAnalyticsSink((e) => calls.push(e));
  setAnalyticsConsent(true);
  analytics.track('mission_completed', { goldEarned: 10 });
  expect(calls).toEqual(['mission_completed']);
  setAnalyticsConsent(false); // restaura para não vazar a outros testes
});
