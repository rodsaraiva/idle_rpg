/**
 * Eventos do funil de FTUE e de retenção/monetização ética.
 * SPEC 9 pluga o sink real (PostHog/Amplitude); emissão real é débito device-bound.
 */
export type AnalyticsEvent =
  // FTUE (SPEC 5)
  | 'ftue_started'
  | 'ftue_step_completed'           // props: { step }
  | 'ftue_first_mission_started'    // props: { elapsedMs }
  | 'ftue_completed'                // props: { elapsedMs }
  | 'ftue_skipped'                  // props: { step }
  // Retenção / monetização ética (SPEC 8)
  | 'daily_login_claimed'           // props: { streakDay }
  | 'key_chest_opened'              // props: { tier: 'bronze' | 'silver' | 'gold' }
  | 'cosmetic_equipped'             // props: { cosmeticId, slot }
  | 'notification_prefs_updated';   // props: { optedIn }

export interface Analytics {
  track(event: AnalyticsEvent, props?: Record<string, unknown>): void;
}

/** Default: no-op em produção, console em dev. SPEC 9 troca a impl pelo sink real. */
export const analytics: Analytics = {
  track(event, props) {
    if (__DEV__) console.log('[analytics]', event, props ?? {});
  },
};
