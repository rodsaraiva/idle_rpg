/**
 * Eventos do funil de FTUE e de retenção/monetização ética.
 * SPEC 9 pluga o sink real (PostHog/Amplitude); emissão real é débito device-bound.
 *
 * Gate de consentimento LGPD: track é no-op até setAnalyticsConsent(true).
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
  | 'notification_prefs_updated'    // props: { optedIn }
  // Marcos de jogo (SPEC 9)
  | 'app_open'
  | 'mission_completed'             // props: { goldEarned }
  | 'hero_recruited'
  | 'hero_fused'
  | 'boss_defeated'
  | 'equipment_crafted';

export interface Analytics {
  track(event: AnalyticsEvent, props?: Record<string, unknown>): void;
}

/** Gate de consentimento LGPD. false por default = no-op até aceite explícito. */
let consentGranted = false;

/** Sink injetável. PostHog real = débito SPEC 9 device-bound. */
type Sink = (event: AnalyticsEvent, props?: Record<string, unknown>) => void;
let sink: Sink = __DEV__
  ? (event, props) => console.log('[analytics]', event, props ?? {})
  : () => {};

export function setAnalyticsConsent(granted: boolean): void {
  consentGranted = granted;
}

export function setAnalyticsSink(s: Sink): void {
  sink = s;
}

export const analytics: Analytics = {
  track(event, props) {
    if (!consentGranted) return;
    sink(event, props);
  },
};
