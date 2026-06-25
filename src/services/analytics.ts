/** Eventos do funil de FTUE. SPEC 9 pluga o sink real (PostHog/Amplitude). */
export type AnalyticsEvent =
  | 'ftue_started'
  | 'ftue_step_completed'         // props: { step }
  | 'ftue_first_mission_started'  // props: { elapsedMs }
  | 'ftue_completed'              // props: { elapsedMs }
  | 'ftue_skipped';               // props: { step }

export interface Analytics {
  track(event: AnalyticsEvent, props?: Record<string, unknown>): void;
}

/** Default: no-op em produção, console em dev. SPEC 9 troca a impl pelo sink real. */
export const analytics: Analytics = {
  track(event, props) {
    if (__DEV__) console.log('[analytics]', event, props ?? {});
  },
};
