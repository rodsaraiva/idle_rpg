import { deriveStep, targetForStep, firstMissionStarted, isOnboardingActive } from '../../onboarding/onboardingSteps';
import { GameState, HeroTask } from '../../types';

function makeState(over: Partial<GameState> = {}): GameState {
  return {
    gold: 25,
    heroes: [],
    heroesRecruited: 1,
    lastSavedAt: 0,
    activeMissions: [],
    onboarding: { version: 1, step: 'intro', startedAt: 0, hintsSeen: {} },
    ...over,
  };
}

function hero(over: any = {}) {
  return {
    id: 'h' + Math.random(),
    name: 'H',
    hpMax: 15, hpCurrent: 15, atk: 6, mp: 2, defense: 5, crit: 5, agility: 10,
    currentTask: HeroTask.IDLE,
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    ...over,
  };
}

describe('deriveStep', () => {
  test('skipped permanece skipped', () => {
    const s = makeState({ onboarding: { version: 1, step: 'skipped', startedAt: 0, hintsSeen: {} } });
    expect(deriveStep(s)).toBe('skipped');
  });

  test('done permanece done', () => {
    const s = makeState({ onboarding: { version: 1, step: 'done', startedAt: 0, hintsSeen: {} } });
    expect(deriveStep(s)).toBe('done');
  });

  test('intro não avança sozinho (precisa de ação manual)', () => {
    const s = makeState({ heroes: [hero()] });
    expect(deriveStep(s)).toBe('intro');
  });

  test('após sair de intro com 1 herói, fica em recruit', () => {
    const s = makeState({ heroes: [hero()], onboarding: { version: 1, step: 'recruit', startedAt: 0, hintsSeen: {} } });
    expect(deriveStep(s)).toBe('recruit');
  });

  test('recruit avança para train quando heroes.length >= 2', () => {
    const s = makeState({
      heroes: [hero(), hero()],
      onboarding: { version: 1, step: 'recruit', startedAt: 0, hintsSeen: {} },
    });
    expect(deriveStep(s)).toBe('train');
  });

  test('train avança para mission quando algum hero treinou atk', () => {
    const s = makeState({
      heroes: [hero(), hero({ trainingCount: { hp: 0, atk: 1, mp: 0 } })],
      onboarding: { version: 1, step: 'train', startedAt: 0, hintsSeen: {} },
    });
    expect(deriveStep(s)).toBe('mission');
  });

  test('mission avança para collect quando mission_1 está ativa', () => {
    const s = makeState({
      heroes: [hero(), hero({ trainingCount: { hp: 0, atk: 1, mp: 0 } })],
      activeMissions: [{ id: 'm', templateId: 'mission_1', heroIds: ['x'], startedAt: 0 }],
      onboarding: { version: 1, step: 'mission', startedAt: 0, hintsSeen: {} },
    });
    expect(deriveStep(s)).toBe('collect');
  });

  test('collect avança para done quando completedMissionCount >= 1', () => {
    const s = makeState({
      heroes: [hero(), hero({ trainingCount: { hp: 0, atk: 1, mp: 0 } })],
      completedMissionCount: 1,
      onboarding: { version: 1, step: 'collect', startedAt: 0, hintsSeen: {} },
    });
    expect(deriveStep(s)).toBe('done');
  });

  test('idempotência: estado que já satisfez recruit+train pula direto para mission', () => {
    // jogador recrutou e treinou antes do overlay pedir; partindo de recruit, salta 2 passos
    const s = makeState({
      heroes: [hero({ trainingCount: { hp: 0, atk: 2, mp: 0 } }), hero()],
      onboarding: { version: 1, step: 'recruit', startedAt: 0, hintsSeen: {} },
    });
    expect(deriveStep(s)).toBe('mission');
  });

  test('sem bloco onboarding retorna done (defensivo)', () => {
    const s = makeState({ onboarding: undefined });
    expect(deriveStep(s)).toBe('done');
  });
});

describe('targetForStep', () => {
  test('mapeia cada passo guiado ao seu alvo de spotlight', () => {
    expect(targetForStep('recruit')).toBe('recruit-button');
    expect(targetForStep('train')).toBe('train-atk');
    expect(targetForStep('mission')).toBe('mission-1');
    expect(targetForStep('collect')).toBe('active-mission');
    expect(targetForStep('intro')).toBeNull();
    expect(targetForStep('done')).toBeNull();
  });
});

describe('firstMissionStarted', () => {
  test('true quando mission_1 está em activeMissions', () => {
    const s = makeState({ activeMissions: [{ id: 'm', templateId: 'mission_1', heroIds: ['x'], startedAt: 0 }] });
    expect(firstMissionStarted(s)).toBe(true);
  });
  test('false sem missões ativas', () => {
    expect(firstMissionStarted(makeState())).toBe(false);
  });
});

describe('isOnboardingActive — FTUE espera a decisão de consentimento', () => {
  const base = makeState();

  test('inativo enquanto o consentimento não foi decidido (1º boot)', () => {
    expect(isOnboardingActive('intro', base)).toBe(false);
  });

  test('ativo depois de decidido, mesmo recusando analytics', () => {
    const recusou = { ...base, consent: { analytics: false, decided: true, decidedAt: 1 } };
    expect(isOnboardingActive('intro', recusou)).toBe(true);
  });

  test('passos terminais continuam inativos mesmo com consentimento decidido', () => {
    const decidiu = { ...base, consent: { analytics: true, decided: true, decidedAt: 1 } };
    expect(isOnboardingActive('done', decidiu)).toBe(false);
    expect(isOnboardingActive('skipped', decidiu)).toBe(false);
  });
});
