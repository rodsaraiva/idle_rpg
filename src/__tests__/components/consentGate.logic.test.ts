/**
 * Task 6 — Gate de consentimento LGPD: testes de lógica pura + sync de módulo.
 * Visual validado manualmente no device.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

// Mock de analytics ANTES do import do componente (jest.mock é hoisted)
jest.mock('../../services/analytics', () => ({
  setAnalyticsConsent: jest.fn(),
  setAnalyticsSink: jest.fn(),
  analytics: { track: jest.fn() },
  trackAppOpen: jest.fn(),
}));

import { needsConsentDecision, ConsentGate } from '../../components/ConsentGate';
import { setAnalyticsConsent, trackAppOpen } from '../../services/analytics';
import { GameContext } from '../../context/GameContext';
import { initialGameState } from '../../context/gameReducer';
import type { GameState } from '../../types';

// ── Lógica pura ────────────────────────────────────────────────────────────────

describe('needsConsentDecision — lógica pura', () => {
  test('retorna true quando campo consent ausente (1º boot, sem save)', () => {
    expect(needsConsentDecision({} as GameState)).toBe(true);
  });

  test('retorna true quando decided=false', () => {
    const state = { consent: { analytics: false, decided: false, decidedAt: 0 } } as GameState;
    expect(needsConsentDecision(state)).toBe(true);
  });

  test('retorna false quando decided=true', () => {
    const state = { consent: { analytics: true, decided: true, decidedAt: 1 } } as GameState;
    expect(needsConsentDecision(state)).toBe(false);
  });
});

// ── Sync de módulo ao montar ───────────────────────────────────────────────────

function makeContextValue(stateOverride: Partial<GameState>) {
  return {
    state: { ...initialGameState, ...stateOverride } as GameState,
    dispatch: jest.fn(),
    isLoaded: true,
    setHeroTask: jest.fn(),
    recruitHero: jest.fn(),
    offlineSummary: null,
    clearOfflineSummary: jest.fn(),
    applyOfflineSummary: jest.fn(),
    advanceOnboarding: jest.fn(),
    skipOnboarding: jest.fn(),
    markHintSeen: jest.fn(),
    resetOnboarding: jest.fn(),
  } as any;
}

test('ao montar com consent.analytics=true (decided), setAnalyticsConsent(true) é chamado', () => {
  (setAnalyticsConsent as jest.Mock).mockClear();

  render(
    React.createElement(
      GameContext.Provider,
      { value: makeContextValue({ consent: { analytics: true, decided: true, decidedAt: 1 } }) },
      React.createElement(ConsentGate),
    ),
  );

  expect(setAnalyticsConsent).toHaveBeenCalledWith(true);
});

test('ao montar com consent.analytics=false (decided), setAnalyticsConsent(false) é chamado', () => {
  (setAnalyticsConsent as jest.Mock).mockClear();

  render(
    React.createElement(
      GameContext.Provider,
      { value: makeContextValue({ consent: { analytics: false, decided: true, decidedAt: 1 } }) },
      React.createElement(ConsentGate),
    ),
  );

  expect(setAnalyticsConsent).toHaveBeenCalledWith(false);
});

test('sem decisão (decided=false), setAnalyticsConsent NÃO é chamado ao montar', () => {
  (setAnalyticsConsent as jest.Mock).mockClear();

  render(
    React.createElement(
      GameContext.Provider,
      { value: makeContextValue({ consent: { analytics: false, decided: false, decidedAt: 0 } }) },
      React.createElement(ConsentGate),
    ),
  );

  expect(setAnalyticsConsent).not.toHaveBeenCalled();
});

// ── trackAppOpen: disparo no boot ──────────────────────────────────────────────

test('com consent.analytics=true (decided), trackAppOpen é chamado exatamente uma vez no boot', () => {
  (trackAppOpen as jest.Mock).mockClear();

  render(
    React.createElement(
      GameContext.Provider,
      { value: makeContextValue({ consent: { analytics: true, decided: true, decidedAt: 1 } }) },
      React.createElement(ConsentGate),
    ),
  );

  expect(trackAppOpen).toHaveBeenCalledTimes(1);
});

test('com consent.analytics=false (decided), trackAppOpen NÃO é chamado no boot', () => {
  (trackAppOpen as jest.Mock).mockClear();

  render(
    React.createElement(
      GameContext.Provider,
      { value: makeContextValue({ consent: { analytics: false, decided: true, decidedAt: 1 } }) },
      React.createElement(ConsentGate),
    ),
  );

  expect(trackAppOpen).not.toHaveBeenCalled();
});
