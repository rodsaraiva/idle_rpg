import React, { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { useGame } from '../hooks/useGame';
import { HeroTask, OnboardingStep } from '../types';
import { deriveStep, targetForStep, firstMissionStarted, isOnboardingActive, TargetId } from './onboardingSteps';
import { analytics } from '../services/analytics';
import { emitInfirmaryHint } from '../services/milestones';

interface OnboardingContextValue {
  step: OnboardingStep;
  isActive: boolean;
  target: TargetId | null;
  advance: () => void;
  skip: () => void;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue>({
  step: 'done',
  isActive: false,
  target: null,
  advance: () => {},
  skip: () => {},
  reset: () => {},
});

export function useOnboarding(): OnboardingContextValue {
  return useContext(OnboardingContext);
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { state, advanceOnboarding, skipOnboarding, markHintSeen, resetOnboarding } = useGame();
  const ob = state.onboarding;
  const step: OnboardingStep = ob?.step ?? 'done';

  const startedFired = useRef(false);
  const firstMissionFired = useRef(false);
  const completedFired = useRef(false);

  // ftue_started — uma vez, ao entrar no fluxo em 'intro'
  useEffect(() => {
    if (step === 'intro' && !startedFired.current) {
      startedFired.current = true;
      analytics.track('ftue_started');
    }
  }, [step]);

  // Núcleo: deriva o passo do jogo real e avança quando muda
  useEffect(() => {
    if (!ob) return;
    if (ob.step === 'skipped' || ob.step === 'done') return;

    const derived = deriveStep(state);
    if (derived !== ob.step) {
      advanceOnboarding(derived);
      analytics.track('ftue_step_completed', { step: derived });
    }

    // Métrica: 1ª missão iniciada (independe de o passo salvo já ter avançado)
    if (!firstMissionFired.current && firstMissionStarted(state)) {
      firstMissionFired.current = true;
      analytics.track('ftue_first_mission_started', { elapsedMs: Date.now() - ob.startedAt });
    }

    // Conclusão do funil
    if (!completedFired.current && derived === 'done') {
      completedFired.current = true;
      analytics.track('ftue_completed', { elapsedMs: Date.now() - ob.startedAt });
    }
  }, [state, ob, advanceOnboarding]);

  // Dica reativa: 1º herói ferido (gate one-shot)
  useEffect(() => {
    if (!ob || ob.hintsSeen.infirmary) return;
    const anyInjured = state.heroes.some(h => h.currentTask === HeroTask.INFIRMARY);
    if (anyInjured) {
      emitInfirmaryHint();
      markHintSeen('infirmary');
    }
  }, [state.heroes, ob, markHintSeen]);

  const isActive = isOnboardingActive(step, state);
  const target = targetForStep(step);

  const value: OnboardingContextValue = {
    step,
    isActive,
    target,
    advance: () => advanceOnboarding(nextManualStep(step)),
    skip: skipOnboarding,
    reset: resetOnboarding,
  };

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

/** Avanço manual (botão "Começar"/"Entendi"). Só 'intro' avança por ação; os demais por derivação. */
function nextManualStep(step: OnboardingStep): OnboardingStep {
  return step === 'intro' ? 'recruit' : step;
}
