/**
 * Task 7 — Telas de Privacidade/Termos + toggle de consentimento na Settings.
 * Visual validado manualmente no device.
 */

// Mock de dependências do componente ANTES dos imports (jest.mock é hoisted)
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: () => null,
}));
jest.mock('react-native-reanimated', () => ({}));
jest.mock('../../hooks/useGame', () => ({
  useGame: () => ({
    state: { notificationPrefs: undefined, consent: undefined },
    dispatch: jest.fn(),
  }),
}));

import { PRIVACY_TEXT, TERMS_TEXT } from '../../constants/legalContent';
import { buildConsentHandler } from '../../screens/SettingsScreen';
import type { GameAction } from '../../types';

// ── legalContent ───────────────────────────────────────────────────────────────

test('PRIVACY_TEXT é não-vazio e menciona "analytics" e "dados"', () => {
  expect(PRIVACY_TEXT.length).toBeGreaterThan(50);
  expect(PRIVACY_TEXT.toLowerCase()).toMatch(/analytics/);
  expect(PRIVACY_TEXT.toLowerCase()).toMatch(/dados/);
});

test('TERMS_TEXT é não-vazio e menciona "analytics" e "dados"', () => {
  expect(TERMS_TEXT.length).toBeGreaterThan(50);
  expect(TERMS_TEXT.toLowerCase()).toMatch(/analytics/);
  expect(TERMS_TEXT.toLowerCase()).toMatch(/dados/);
});

// ── Settings: handler de consentimento ─────────────────────────────────────────

test('buildConsentHandler: toggle analytics=true dispara SET_CONSENT correto', () => {
  const mockDispatch = jest.fn() as jest.MockedFunction<React.Dispatch<GameAction>>;
  const handle = buildConsentHandler(mockDispatch);
  handle(true);
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_CONSENT', analytics: true });
});

test('buildConsentHandler: toggle analytics=false dispara SET_CONSENT correto', () => {
  const mockDispatch = jest.fn() as jest.MockedFunction<React.Dispatch<GameAction>>;
  const handle = buildConsentHandler(mockDispatch);
  handle(false);
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_CONSENT', analytics: false });
});
