/**
 * Gate de consentimento LGPD — Task 6 (SPEC 9).
 *
 * - needsConsentDecision: lógica pura (testável sem render).
 * - ConsentGate: sincroniza o flag de módulo analytics ao montar com estado carregado;
 *   exibe prompt no 1º boot (antes de qualquer emissão).
 *
 * Visual: manual-pending (validar no emulador/device após Task 7 adicionar links legais).
 */
import React, { useContext, useEffect, useRef } from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { GameContext } from '../context/GameContext';
import { GameState } from '../types';
import { setAnalyticsConsent, trackAppOpen } from '../services/analytics';

// ── Lógica pura ──────────────────────────────────────────────────────────────

/**
 * Retorna true se o jogador ainda não tomou uma decisão de consentimento.
 * Funciona com estado parcial (ex.: GameState sem campo consent = 1º boot).
 */
export function needsConsentDecision(state: Pick<GameState, 'consent'>): boolean {
  return !state.consent?.decided;
}

// ── Componente ───────────────────────────────────────────────────────────────

/**
 * Renderiza um modal de consentimento LGPD no 1º boot.
 * - Enquanto não decidido: exibe prompt (aceitar/recusar).
 * - Após decisão ou boot subsequente: sincroniza setAnalyticsConsent e retorna null.
 *
 * Deve ser montado dentro de <GameProvider> (usa GameContext).
 * Colocar em App.tsx antes de OnboardingProvider para garantir gate antes de analytics.
 */
export function ConsentGate(): React.ReactElement | null {
  const { state, dispatch, isLoaded } = useContext(GameContext);
  // Guarda de sessão: garante que trackAppOpen dispara no máximo uma vez por boot.
  const hasTrackedOpen = useRef(false);

  // Sincroniza o gate de módulo quando o estado carrega do save (boot subsequente)
  useEffect(() => {
    if (isLoaded && state.consent?.decided) {
      setAnalyticsConsent(state.consent.analytics);
      if (state.consent.analytics && !hasTrackedOpen.current) {
        hasTrackedOpen.current = true;
        trackAppOpen();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, state.consent]);

  // Não exibe antes do carregamento (evita flash) e quando já decidido
  if (!isLoaded || !needsConsentDecision(state)) {
    return null;
  }

  function handleAccept() {
    dispatch({ type: 'SET_CONSENT', analytics: true });
  }

  function handleDecline() {
    dispatch({ type: 'SET_CONSENT', analytics: false });
  }

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Compartilhar dados anônimos?</Text>
          <Text style={styles.body}>
            {'Este jogo pode coletar dados anônimos de uso (ex.: missões completadas, heróis recrutados) para melhorar a experiência. Nenhum dado pessoal identificável é coletado.\n\nVocê pode alterar essa escolha a qualquer momento em Configurações → Privacidade.'}
          </Text>
          {/* Links para Privacidade/Termos adicionados na Task 7 */}
          <View style={styles.buttons}>
            <Pressable style={styles.btnDecline} onPress={handleDecline}>
              <Text style={styles.btnDeclineText}>Recusar</Text>
            </Pressable>
            <Pressable style={styles.btnAccept} onPress={handleAccept}>
              <Text style={styles.btnAcceptText}>Aceitar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Estilos inline (sem depender do ThemeProvider que pode não estar acima) ──

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1a1206',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#c9a227',
    maxWidth: 360,
    width: '100%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f4d582',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#d4c5a0',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  btnDecline: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5a4a2a',
    alignItems: 'center',
  },
  btnDeclineText: {
    color: '#a09070',
    fontWeight: '600',
    fontSize: 14,
  },
  btnAccept: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#c9a227',
    alignItems: 'center',
  },
  btnAcceptText: {
    color: '#1a1206',
    fontWeight: '700',
    fontSize: 14,
  },
});
