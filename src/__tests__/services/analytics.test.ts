import { analytics, AnalyticsEvent, setAnalyticsConsent, resetAnalytics } from '../../services/analytics';

describe('analytics (sink default)', () => {
  afterEach(() => {
    resetAnalytics(); // restaura sink default + consent off — não vaza estado global
  });

  test('track aceita evento sem props sem lançar', () => {
    expect(() => analytics.track('ftue_started')).not.toThrow();
  });

  test('track aceita evento com props sem lançar', () => {
    const ev: AnalyticsEvent = 'ftue_first_mission_started';
    expect(() => analytics.track(ev, { elapsedMs: 4200 })).not.toThrow();
  });

  test('em dev (__DEV__ true no jest) loga no console quando consent concedido', () => {
    setAnalyticsConsent(true);
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    analytics.track('ftue_completed', { elapsedMs: 12000 });
    expect(spy).toHaveBeenCalledWith('[analytics]', 'ftue_completed', { elapsedMs: 12000 });
    spy.mockRestore();
  });
});
