import { initialGameState, gameReducer } from '../../context/gameReducer';
import { getRecruitCost } from '../../utils/math';

describe('estado inicial revisto (FTUE)', () => {
  test('semeia exatamente 1 herói WARRIOR', () => {
    expect(initialGameState.heroes).toHaveLength(1);
    expect(initialGameState.heroes[0].classId).toBe('WARRIOR');
  });

  test('heroesRecruited = 1 (herói grátis conta como o 1º)', () => {
    expect(initialGameState.heroesRecruited).toBe(1);
  });

  test('gold inicial = 25', () => {
    expect(initialGameState.gold).toBe(25);
  });

  test('bloco onboarding começa em intro', () => {
    expect(initialGameState.onboarding).toBeDefined();
    expect(initialGameState.onboarding!.step).toBe('intro');
    expect(initialGameState.onboarding!.version).toBe(1);
  });

  test('próximo recruta custa preço cheio: getRecruitCost(1) === 15', () => {
    expect(getRecruitCost(initialGameState.heroesRecruited)).toBe(15);
  });

  test('anti-trivialização: 25 de ouro permite exatamente 1 recruta, não 2', () => {
    const gold = initialGameState.gold;
    const c1 = getRecruitCost(1); // 15
    const c2 = getRecruitCost(2); // 22
    expect(gold).toBeGreaterThanOrEqual(c1);
    expect(gold).toBeLessThan(c1 + c2); // 25 < 37 → não consegue o 3º herói de cara
  });
});

describe('reducer SET_ONBOARDING', () => {
  test('avança o passo via ação', () => {
    const next = gameReducer(initialGameState, { type: 'SET_ONBOARDING', patch: { step: 'recruit' } });
    expect(next.onboarding!.step).toBe('recruit');
  });

  test('marca hint sem perder o passo atual', () => {
    const next = gameReducer(initialGameState, { type: 'SET_ONBOARDING', patch: { hintsSeen: { forge: true } } });
    expect(next.onboarding!.hintsSeen.forge).toBe(true);
    expect(next.onboarding!.step).toBe('intro');
  });
});
