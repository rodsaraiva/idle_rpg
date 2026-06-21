# Onboarding & FTUE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um tutorial guiado dos primeiros minutos (recrutar → treinar → 1ª missão → coletar) com coach marks contextuais, estado inicial revisto, flags de first-time persistidas (migração v9) e instrumentação do tempo-até-1ª-missão, sem alterar nenhuma regra de jogo.

**Architecture:** Camada aditiva e desacoplada **acima** do jogo. Um `OnboardingProvider` envolve o `AppNavigator` dentro do `GameProvider` existente; ele deriva o passo ativo do `GameState` real (`heroes`, `activeMissions`, `completedMissionCount`, `trainingCount`) — nunca de sinal sintético — e expõe `useOnboarding()`. Um `OnboardingOverlay` desenha spotlight + balão por cima de tudo, resolvendo alvos via um `targetRegistry` simples. As flags vivem num bloco isolado e opcional `GameState.onboarding`, persistido pelo storage versionado (migração v9). Telas-alvo recebem 3-4 `registerTarget(...)` cirúrgicos; nenhuma tela é redesenhada.

**Tech Stack:** TypeScript, React Native (Expo), Jest (ts-jest, `jest.unit.config.js`), AsyncStorage (mock in-memory nos testes). Sem novas dependências.

**Spec:** [`docs/superpowers/specs/2026-06-20-onboarding-ftue-design.md`](../specs/2026-06-20-onboarding-ftue-design.md)

## Global Constraints
- Idioma de todo conteúdo (UI, comentários, mensagens de commit): **pt-BR**. Identificadores de código em inglês.
- `npx tsc --noEmit` → **0 erros** antes de cada commit.
- `npm test` (config `jest.unit.config.js`) → **verde** antes de cada commit.
- Alvo de produção: **mobile** (iOS/Android via Expo). Sem estilos web-only que bloqueiem boot.
- **Sem gold passivo:** ouro só de missão completada. O único delta econômico permitido aqui é o valor **estático** de `initialGameState` (`gold: 25`), aplicado **uma vez** no boot sem save. Nenhum `state.gold +=` em `src/onboarding/`.
- **DEF/CRIT/AGI não-treináveis:** o tutorial não introduz nenhum novo caminho de stat secundário. O passo "treinar" usa apenas a tela de Treinamento existente (hp/atk/mp).
- **Integração > mock:** persistência testada com AsyncStorage in-memory (mock existente em `jest-mocks/`), máquina de estados testada com o **reducer real** e `GameState` real.
- Overlay/coach mark herdam tokens de `src/theme` — **0 hex inline** (não cria dívida para SPEC 3).
- DRY, YAGNI, TDD onde há lógica; commits pequenos e frequentes (1 por task).

---

## Estrutura de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/types/index.ts` | Modify | `OnboardingStep`, `OnboardingState`, `onboarding?` no `GameState`, `SET_ONBOARDING` no `GameAction` |
| `src/context/onboardingHandler.ts` | Create | `handleSetOnboarding(state, patch)` com merge profundo de `hintsSeen` |
| `src/context/gameReducer.ts` | Modify | `case 'SET_ONBOARDING'`; estado inicial revisto (gold 25, herói semeado, bloco `onboarding`) |
| `src/services/storage.ts` | Modify | `CURRENT_VERSION 8→9`; `migrations[9]` |
| `src/services/analytics.ts` | Create | Interface `Analytics` + `analytics` no-op/console |
| `src/services/milestones.ts` | Modify | `emitForgeHint`, `emitInfirmaryHint`, `emitSecondRecruitHint` |
| `src/onboarding/targetRegistry.ts` | Create | `registerTarget` / `measureTarget` / `unregisterTarget` |
| `src/onboarding/OnboardingProvider.tsx` | Create | Máquina de estados; deriva passo de `state`; dispara analytics; observa dicas reativas |
| `src/onboarding/OnboardingOverlay.tsx` | Create | Spotlight + coach mark; herda `theme`; `pointerEvents="box-none"` |
| `src/context/GameContext.tsx` | Modify | Conveniências `advanceOnboarding`/`skipOnboarding`/`markHintSeen`/`resetOnboarding` |
| `App.tsx` | Modify | Envolve `AppNavigator` com `<OnboardingProvider>` + `<OnboardingOverlay/>` |
| `src/screens/GuildScreen.tsx` | Modify | `registerTarget('recruit-button', ...)`; dica `second_recruit` |
| `src/screens/TrainingScreen.tsx` | Modify | `registerTarget('train-atk', ...)` |
| `src/screens/MissionsScreen.tsx` | Modify | `registerTarget('mission-1', ...)` e `registerTarget('active-mission', ...)` |
| `src/screens/BlacksmithScreen.tsx` | Modify | Mount: dica `forge` |
| `src/__tests__/context/onboardingHandler.test.ts` | Create | Handler + máquina de estados (derivação de passo) |
| `src/__tests__/context/initialState.onboarding.test.ts` | Create | Estado inicial revisto + anti-trivialização |
| `src/__tests__/services/storage.onboarding.test.ts` | Create | Migração v9 (round-trip) |
| `src/__tests__/services/analytics.test.ts` | Create | Interface `track` + `ftue_first_mission_started` elapsedMs |
| `src/__tests__/services/milestones.onboarding.test.ts` | Create | Dicas pós-tutorial emitem toast |
| `src/onboarding/onboardingSteps.ts` | Create | Função pura `deriveStep(state)` (lógica testável sem React) |
| `src/__tests__/onboarding/deriveStep.test.ts` | Create | Testes de derivação/idempotência de passo |

**Decisão-chave (testabilidade):** a lógica da máquina de estados vive numa função **pura** `deriveStep(state)` em `src/onboarding/onboardingSteps.ts`, testável sem React. O `OnboardingProvider` é uma casca fina que chama `deriveStep` num efeito e dispara analytics/dispatch. Isso atende "integração > mock" sem precisar montar a árvore React nos testes unit.

---

## Task 1: Tipos do bloco `onboarding`

**Files:**
- Modify: `src/types/index.ts` (interface `GameState` linhas 64-105; union `GameAction` linhas 108-129)

**Interfaces:**
- Produces: `type OnboardingStep`, `interface OnboardingState`, `GameState.onboarding?: OnboardingState`, ação `{ type: 'SET_ONBOARDING'; patch: Partial<OnboardingState> }`.

Esta task é só de tipos; não há lógica para TDD. A verificação é o `tsc`.

- [ ] **Step 1: Adicionar os tipos `OnboardingStep` e `OnboardingState`**

Em `src/types/index.ts`, logo **antes** da declaração `export interface GameState {` (linha 64), inserir:

```ts
/** Passo guiado do tutorial; 'done' = concluído, 'skipped' = pulado pelo jogador. */
export type OnboardingStep =
  | 'intro'
  | 'recruit'
  | 'train'
  | 'mission'
  | 'collect'
  | 'done'
  | 'skipped';

/** Estado do onboarding / FTUE. Bloco isolado e opcional do GameState. */
export interface OnboardingState {
  /** Versão do fluxo; permite reexibir se o tutorial mudar muito. */
  version: number;
  /** Passo guiado atual. */
  step: OnboardingStep;
  /** Epoch ms do começo do tutorial (primeiro boot). Base do elapsedMs até a 1ª missão. */
  startedAt: number;
  /** Flags one-shot de dicas contextuais já mostradas (chave -> true). */
  hintsSeen: Record<string, boolean>;
}
```

- [ ] **Step 2: Adicionar o campo `onboarding?` ao `GameState`**

Em `src/types/index.ts`, dentro de `interface GameState`, após a linha `materials?: Record<string, number>;` (linha 104), inserir antes do `}`:

```ts
  onboarding?: OnboardingState;
```

- [ ] **Step 3: Adicionar a ação `SET_ONBOARDING` ao `GameAction`**

Em `src/types/index.ts`, no union `GameAction`, após a linha `| { type: 'LOAD_STATE'; state: GameState };` substituir o ponto-e-vírgula final para incluir a nova variante. Localizar (linha 129):

```ts
  | { type: 'LOAD_STATE'; state: GameState };
```

Substituir por:

```ts
  | { type: 'LOAD_STATE'; state: GameState }
  | { type: 'SET_ONBOARDING'; patch: Partial<OnboardingState> };
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros (os tipos novos não têm consumidores ainda; `onboarding?` é opcional, então `initialGameState` continua válido).

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(onboarding): tipos OnboardingState/OnboardingStep e ação SET_ONBOARDING"
```

---

## Task 2: Handler `handleSetOnboarding` (TDD)

**Files:**
- Create: `src/context/onboardingHandler.ts`
- Create: `src/__tests__/context/onboardingHandler.test.ts`

**Interfaces:**
- Consumes: `OnboardingState`, `GameState` (Task 1).
- Produces: `handleSetOnboarding(state: GameState, patch: Partial<OnboardingState>): GameState`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/context/onboardingHandler.test.ts`:

```ts
import { handleSetOnboarding } from '../../context/onboardingHandler';
import { GameState } from '../../types';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    gold: 0,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: 0,
    ...overrides,
  };
}

describe('handleSetOnboarding', () => {
  test('cria o bloco com defaults quando o estado não tem onboarding', () => {
    const state = makeState();
    const next = handleSetOnboarding(state, { step: 'recruit' });
    expect(next.onboarding).toBeDefined();
    expect(next.onboarding!.step).toBe('recruit');
    expect(next.onboarding!.version).toBe(1);
    expect(next.onboarding!.hintsSeen).toEqual({});
    expect(typeof next.onboarding!.startedAt).toBe('number');
  });

  test('patch parcial preserva campos não-tocados', () => {
    const state = makeState({
      onboarding: { version: 1, step: 'intro', startedAt: 123, hintsSeen: { forge: true } },
    });
    const next = handleSetOnboarding(state, { step: 'train' });
    expect(next.onboarding!.step).toBe('train');
    expect(next.onboarding!.startedAt).toBe(123);
    expect(next.onboarding!.hintsSeen).toEqual({ forge: true });
  });

  test('hintsSeen faz merge (não substitui)', () => {
    const state = makeState({
      onboarding: { version: 1, step: 'done', startedAt: 0, hintsSeen: { forge: true } },
    });
    const next = handleSetOnboarding(state, { hintsSeen: { fusion: true } });
    expect(next.onboarding!.hintsSeen).toEqual({ forge: true, fusion: true });
  });

  test('não muta o estado de entrada', () => {
    const state = makeState({
      onboarding: { version: 1, step: 'intro', startedAt: 0, hintsSeen: {} },
    });
    handleSetOnboarding(state, { step: 'recruit' });
    expect(state.onboarding!.step).toBe('intro');
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npx jest --config jest.unit.config.js --runInBand src/__tests__/context/onboardingHandler.test.ts`
Expected: FAIL com `Cannot find module '../../context/onboardingHandler'` — confirma que o teste roda antes da implementação.

- [ ] **Step 3: Implementação mínima**

Criar `src/context/onboardingHandler.ts`:

```ts
import { GameState, OnboardingState } from '../types';

const DEFAULT_ONBOARDING: OnboardingState = {
  version: 1,
  step: 'intro',
  startedAt: 0,
  hintsSeen: {},
};

/**
 * Aplica um patch parcial ao bloco onboarding, criando-o com defaults se ausente.
 * hintsSeen é mesclado (one-shot acumulativo), nunca substituído.
 */
export function handleSetOnboarding(state: GameState, patch: Partial<OnboardingState>): GameState {
  const base = state.onboarding ?? { ...DEFAULT_ONBOARDING, startedAt: Date.now() };
  return {
    ...state,
    onboarding: {
      ...base,
      ...patch,
      hintsSeen: { ...base.hintsSeen, ...(patch.hintsSeen ?? {}) },
    },
  };
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npx jest --config jest.unit.config.js --runInBand src/__tests__/context/onboardingHandler.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/context/onboardingHandler.ts src/__tests__/context/onboardingHandler.test.ts
git commit -m "feat(onboarding): handleSetOnboarding com merge profundo de hintsSeen"
```

---

## Task 3: Wire-up do reducer + estado inicial revisto (TDD)

**Files:**
- Modify: `src/context/gameReducer.ts` (imports linha 1-30; `initialGameState` linhas 33-41; `switch` ~linha 106)
- Create: `src/__tests__/context/initialState.onboarding.test.ts`

**Interfaces:**
- Consumes: `handleSetOnboarding` (Task 2), `createHero` (`src/utils/heroFactory.ts`), `getRecruitCost` (`src/utils/math.ts`).
- Produces: `case 'SET_ONBOARDING'` no reducer; `initialGameState` com `gold: 25`, `heroes: [createHero('WARRIOR')]`, `heroesRecruited: 1`, bloco `onboarding`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/context/initialState.onboarding.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npx jest --config jest.unit.config.js --runInBand src/__tests__/context/initialState.onboarding.test.ts`
Expected: FAIL — `initialGameState.heroes` tem length 0 e não há `onboarding`; o `case 'SET_ONBOARDING'` não existe.

- [ ] **Step 3: Implementar o estado inicial e o case do reducer**

Em `src/context/gameReducer.ts`, adicionar o import de `createHero` e do handler. Após a linha 30 (`import { TICK_INTERVAL_MS, TRAIN_INFLATION_FACTOR } from '../constants/game';`), inserir:

```ts
import { createHero } from '../utils/heroFactory';
import { handleSetOnboarding } from './onboardingHandler';
```

Substituir o bloco `initialGameState` (linhas 33-41):

```ts
/** Estado inicial quando não há save */
export const initialGameState: GameState = {
  gold: 20,
  heroes: [],
  heroesRecruited: 0,
  lastSavedAt: Date.now(),
  tickIntervalMs: TICK_INTERVAL_MS,
  trainInflationFactor: TRAIN_INFLATION_FACTOR,
  activeMissions: [],
};
```

Por:

```ts
/** Estado inicial quando não há save (boot do FTUE). */
export const initialGameState: GameState = {
  gold: 25, // cobre 1 recruta extra (15) só depois de a missão render ouro — não trivializa
  heroes: [createHero('WARRIOR')], // herói semeado determinístico: remove a vila de prédios inúteis
  heroesRecruited: 1, // o herói grátis conta como o 1º → próximo custa floor(10*1.5)=15 (preço cheio)
  lastSavedAt: Date.now(),
  tickIntervalMs: TICK_INTERVAL_MS,
  trainInflationFactor: TRAIN_INFLATION_FACTOR,
  activeMissions: [],
  onboarding: {
    version: 1,
    step: 'intro',
    startedAt: Date.now(),
    hintsSeen: {},
  },
};
```

Adicionar o `case` no `switch`, logo antes de `case 'LOAD_STATE':` (linha 106):

```ts
    case 'SET_ONBOARDING':
      return handleSetOnboarding(state, action.patch);

```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npx jest --config jest.unit.config.js --runInBand src/__tests__/context/initialState.onboarding.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Rodar a suíte completa (regressão do estado inicial)**

Run: `npm test`
Expected: PASS. Atenção a testes que assumiam `heroes: []` ou `gold: 20` no `initialGameState`. Se algum quebrar por assumir o estado vazio, corrigir o **teste** para construir seu próprio estado explícito (não relaxar o invariante do FTUE). Rodar antes:

```bash
grep -rn "initialGameState" src/__tests__ | grep -iE "heroes|gold|length"
```

para mapear os call sites afetados antes de rodar.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 7: Commit**

```bash
git add src/context/gameReducer.ts src/__tests__/context/initialState.onboarding.test.ts
git commit -m "feat(onboarding): estado inicial revisto (1 herói semeado, gold 25) e case SET_ONBOARDING"
```

---

## Task 4: Migração v9 da persistência (TDD)

**Files:**
- Modify: `src/services/storage.ts` (`CURRENT_VERSION` linha 5; `migrations` linhas 16-88)
- Create: `src/__tests__/services/storage.onboarding.test.ts`

**Interfaces:**
- Consumes: `OnboardingState` (Task 1), `loadGameState`/`saveGameState` (existentes).
- Produces: `CURRENT_VERSION = 9`; `migrations[9]` que adiciona `onboarding: { step: 'done', ... }` a saves antigos.

**Decisão:** save de veterano (v8, sem `onboarding`) → `step: 'done'` (não re-tutorializa). O tutorial é só para boot **sem** save (caminho `initialGameState`).

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/services/storage.onboarding.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveGameState, loadGameState } from '../../services/storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('migração v9 — bloco onboarding', () => {
  beforeEach(() => jest.clearAllMocks());

  test('save sem onboarding (veterano) migra para step "done"', async () => {
    const legacy = { _version: 8, gold: 100, heroes: [], heroesRecruited: 0, lastSavedAt: 5000 };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(legacy));
    const loaded = await loadGameState();
    expect(loaded).not.toBeNull();
    expect((loaded as any).onboarding).toBeDefined();
    expect((loaded as any).onboarding.step).toBe('done');
    expect((loaded as any).onboarding.startedAt).toBe(5000); // usa lastSavedAt do save
  });

  test('round-trip de save v9 preserva step e hintsSeen', async () => {
    const captured: Record<string, string> = {};
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (k: string, v: string) => {
      captured[k] = v;
    });
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) => captured[k] ?? null);

    await saveGameState({
      gold: 0,
      heroes: [],
      heroesRecruited: 0,
      lastSavedAt: 0,
      onboarding: { version: 1, step: 'collect', startedAt: 111, hintsSeen: { forge: true } },
    } as any);

    const loaded = await loadGameState();
    expect((loaded as any).onboarding.step).toBe('collect');
    expect((loaded as any).onboarding.hintsSeen).toEqual({ forge: true });
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npx jest --config jest.unit.config.js --runInBand src/__tests__/services/storage.onboarding.test.ts`
Expected: FAIL — o save legado v8 carrega sem `onboarding` (migração v9 ainda não existe), `onboarding` é `undefined`.

- [ ] **Step 3: Implementar `CURRENT_VERSION = 9` e `migrations[9]`**

Em `src/services/storage.ts`, linha 5, substituir:

```ts
const CURRENT_VERSION = 8; // Incremented for migrations
```

Por:

```ts
const CURRENT_VERSION = 9; // Incremented for migrations
```

Dentro do objeto `migrations`, após a entrada `8: (data) => { ... },` (linha 87), adicionar:

```ts
  9: (data) => {
    // Version 9: bloco de onboarding. Save antigo = veterano → tutorial concluído (não re-tutorializa).
    if (data.onboarding === undefined) {
      data.onboarding = {
        version: 1,
        step: 'done',
        startedAt: data.lastSavedAt ?? Date.now(),
        hintsSeen: {},
      };
    }
    return data;
  },
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npx jest --config jest.unit.config.js --runInBand src/__tests__/services/storage.onboarding.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Rodar a suíte de storage (regressão)**

Run: `npx jest --config jest.unit.config.js --runInBand src/__tests__/services/storage.test.ts`
Expected: PASS — as migrações 2-8 continuam funcionando.

- [ ] **Step 6: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: 0 erros.

```bash
git add src/services/storage.ts src/__tests__/services/storage.onboarding.test.ts
git commit -m "feat(onboarding): migração v9 — saves veteranos não re-tutorializam (step done)"
```

---

## Task 5: Serviço de analytics (interface + no-op) (TDD)

**Files:**
- Create: `src/services/analytics.ts`
- Create: `src/__tests__/services/analytics.test.ts`

**Interfaces:**
- Produces: `type AnalyticsEvent`, `interface Analytics`, `const analytics: Analytics`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/services/analytics.test.ts`:

```ts
import { analytics, AnalyticsEvent } from '../../services/analytics';

describe('analytics (sink default)', () => {
  test('track aceita evento sem props sem lançar', () => {
    expect(() => analytics.track('ftue_started')).not.toThrow();
  });

  test('track aceita evento com props sem lançar', () => {
    const ev: AnalyticsEvent = 'ftue_first_mission_started';
    expect(() => analytics.track(ev, { elapsedMs: 4200 })).not.toThrow();
  });

  test('em dev (__DEV__ true no jest) loga no console', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    analytics.track('ftue_completed', { elapsedMs: 12000 });
    expect(spy).toHaveBeenCalledWith('[analytics]', 'ftue_completed', { elapsedMs: 12000 });
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npx jest --config jest.unit.config.js --runInBand src/__tests__/services/analytics.test.ts`
Expected: FAIL com `Cannot find module '../../services/analytics'`.

- [ ] **Step 3: Implementação mínima**

Criar `src/services/analytics.ts`:

```ts
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
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npx jest --config jest.unit.config.js --runInBand src/__tests__/services/analytics.test.ts`
Expected: PASS (3 testes). (`__DEV__` está `true` no `globals` do `jest.unit.config.js`.)

- [ ] **Step 5: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: 0 erros.

```bash
git add src/services/analytics.ts src/__tests__/services/analytics.test.ts
git commit -m "feat(onboarding): serviço analytics (interface + sink no-op/console) para o funil FTUE"
```

---

## Task 6: Função pura `deriveStep` da máquina de estados (TDD)

**Files:**
- Create: `src/onboarding/onboardingSteps.ts`
- Create: `src/__tests__/onboarding/deriveStep.test.ts`

**Interfaces:**
- Consumes: `GameState`, `OnboardingStep`, `HeroTask` (Task 1 / tipos existentes).
- Produces:
  - `deriveStep(state: GameState): OnboardingStep` — passo "alvo" derivado do jogo real.
  - `targetForStep(step: OnboardingStep): TargetId | null` e `type TargetId = 'recruit-button' | 'train-atk' | 'mission-1' | 'active-mission'`.
  - `firstMissionStarted(state: GameState): boolean` — gatilho do evento de métrica.

**Regra de derivação (idempotente, nunca regride):** dado o `GameState`, `deriveStep` retorna o **primeiro** passo cujo gatilho ainda não foi cumprido, a partir de `intro`. Se o jogador pulou (`step === 'skipped'`) ou já concluiu (`step === 'done'`), retorna esse valor inalterado. O passo `intro` só avança por ação manual ("Começar"), então `deriveStep` **não** o ultrapassa sozinho enquanto o passo salvo for `intro`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/onboarding/deriveStep.test.ts`:

```ts
import { deriveStep, targetForStep, firstMissionStarted } from '../../onboarding/onboardingSteps';
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
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npx jest --config jest.unit.config.js --runInBand src/__tests__/onboarding/deriveStep.test.ts`
Expected: FAIL com `Cannot find module '../../onboarding/onboardingSteps'`.

- [ ] **Step 3: Implementação mínima**

Criar `src/onboarding/onboardingSteps.ts`:

```ts
import { GameState, OnboardingStep } from '../types';

export type TargetId = 'recruit-button' | 'train-atk' | 'mission-1' | 'active-mission';

/** mission_1 está em andamento. Gatilho do passo `mission` e da métrica de 1ª missão. */
export function firstMissionStarted(state: GameState): boolean {
  return (state.activeMissions ?? []).some(m => m.templateId === 'mission_1');
}

function recruitDone(state: GameState): boolean {
  return state.heroes.length >= 2;
}

function trainDone(state: GameState): boolean {
  return state.heroes.some(h => (h.trainingCount?.atk ?? 0) >= 1);
}

function collectDone(state: GameState): boolean {
  return (state.completedMissionCount ?? 0) >= 1;
}

/**
 * Passo "alvo" derivado do GameState real. Nunca regride.
 * - 'done'/'skipped' são terminais e retornam inalterados.
 * - 'intro' só sai por ação manual; deriveStep não o ultrapassa enquanto o passo salvo for 'intro'.
 * - A partir de 'recruit', retorna o primeiro passo cujo gatilho ainda não foi cumprido (idempotência).
 */
export function deriveStep(state: GameState): OnboardingStep {
  const ob = state.onboarding;
  if (!ob) return 'done';
  if (ob.step === 'skipped' || ob.step === 'done' || ob.step === 'intro') return ob.step;

  if (!recruitDone(state)) return 'recruit';
  if (!trainDone(state)) return 'train';
  if (!firstMissionStarted(state) && !collectDone(state)) return 'mission';
  if (!collectDone(state)) return 'collect';
  return 'done';
}

/** Alvo de spotlight de cada passo guiado (null = sem recorte, modo ponteiro de navegação). */
export function targetForStep(step: OnboardingStep): TargetId | null {
  switch (step) {
    case 'recruit': return 'recruit-button';
    case 'train': return 'train-atk';
    case 'mission': return 'mission-1';
    case 'collect': return 'active-mission';
    default: return null;
  }
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npx jest --config jest.unit.config.js --runInBand src/__tests__/onboarding/deriveStep.test.ts`
Expected: PASS (todos os describes).

- [ ] **Step 5: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: 0 erros.

```bash
git add src/onboarding/onboardingSteps.ts src/__tests__/onboarding/deriveStep.test.ts
git commit -m "feat(onboarding): deriveStep puro (máquina de estados do FTUE) + targets"
```

---

## Task 7: Registry de alvos do overlay (TDD)

**Files:**
- Create: `src/onboarding/targetRegistry.ts`
- Adicionar testes ao final de `src/__tests__/onboarding/deriveStep.test.ts` **não** — criar arquivo próprio: `src/__tests__/onboarding/targetRegistry.test.ts`

**Interfaces:**
- Produces:
  - `interface TargetLayout { x: number; y: number; width: number; height: number }`
  - `registerTarget(id: TargetId, measure: () => Promise<TargetLayout | null>): () => void`
  - `measureTarget(id: TargetId): Promise<TargetLayout | null>`

**Decisão:** o registry guarda uma **função de medição** por id (não uma ref crua), para o teste poder registrar um medidor fake sem React. No app, a tela passa `() => measureInWindow(ref)`. Se o id não está registrado (tela não montada), `measureTarget` resolve `null` → overlay cai no modo "ponteiro de navegação".

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/onboarding/targetRegistry.test.ts`:

```ts
import { registerTarget, measureTarget } from '../../onboarding/targetRegistry';

describe('targetRegistry', () => {
  test('measureTarget retorna null para id não registrado', async () => {
    expect(await measureTarget('train-atk')).toBeNull();
  });

  test('registerTarget permite medir; unregister remove', async () => {
    const layout = { x: 10, y: 20, width: 100, height: 40 };
    const unregister = registerTarget('recruit-button', async () => layout);
    expect(await measureTarget('recruit-button')).toEqual(layout);
    unregister();
    expect(await measureTarget('recruit-button')).toBeNull();
  });

  test('último registro do mesmo id vence (tela remontada)', async () => {
    registerTarget('mission-1', async () => ({ x: 1, y: 1, width: 1, height: 1 }));
    registerTarget('mission-1', async () => ({ x: 2, y: 2, width: 2, height: 2 }));
    expect(await measureTarget('mission-1')).toEqual({ x: 2, y: 2, width: 2, height: 2 });
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npx jest --config jest.unit.config.js --runInBand src/__tests__/onboarding/targetRegistry.test.ts`
Expected: FAIL com `Cannot find module '../../onboarding/targetRegistry'`.

- [ ] **Step 3: Implementação mínima**

Criar `src/onboarding/targetRegistry.ts`:

```ts
import { TargetId } from './onboardingSteps';

export interface TargetLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Measurer = () => Promise<TargetLayout | null>;

const registry = new Map<TargetId, Measurer>();

/** Registra um medidor para um alvo. Retorna função de desregistro (chamar no unmount). */
export function registerTarget(id: TargetId, measure: Measurer): () => void {
  registry.set(id, measure);
  return () => {
    // só remove se ainda for o mesmo medidor (evita apagar registro de uma remontagem mais nova)
    if (registry.get(id) === measure) registry.delete(id);
  };
}

/** Mede o alvo; null se não registrado (tela não montada) → modo ponteiro de navegação. */
export async function measureTarget(id: TargetId): Promise<TargetLayout | null> {
  const measure = registry.get(id);
  if (!measure) return null;
  return measure();
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npx jest --config jest.unit.config.js --runInBand src/__tests__/onboarding/targetRegistry.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: 0 erros.

```bash
git add src/onboarding/targetRegistry.ts src/__tests__/onboarding/targetRegistry.test.ts
git commit -m "feat(onboarding): targetRegistry (registerTarget/measureTarget) para spotlight"
```

---

## Task 8: Conveniências de onboarding no `GameContext`

**Files:**
- Modify: `src/context/GameContext.tsx` (interface `GameContextValue` linhas 19-30; default linhas 32-43; corpo linhas 109-119; value linhas 138-152)

**Interfaces:**
- Consumes: `OnboardingState`, `OnboardingStep`, ação `SET_ONBOARDING` (Task 1).
- Produces, no `useGame()`:
  - `advanceOnboarding(step: OnboardingStep): void`
  - `skipOnboarding(): void`
  - `markHintSeen(key: string): void`
  - `resetOnboarding(): void`

Sem teste unit (camada React fina; a lógica testável está em `deriveStep`/handler). Verificação = `tsc`.

- [ ] **Step 1: Importar os tipos**

Em `src/context/GameContext.tsx`, linha 10, substituir:

```ts
import { GameState, GameAction, HeroTask, OfflineSummaryFull } from '../types';
```

Por:

```ts
import { GameState, GameAction, HeroTask, OfflineSummaryFull, OnboardingStep } from '../types';
```

- [ ] **Step 2: Estender a interface `GameContextValue`**

Em `src/context/GameContext.tsx`, na interface `GameContextValue` (após a linha `setTrainInflationFactor?: (inflation: number) => void;`, linha 29), adicionar:

```ts
  advanceOnboarding: (step: OnboardingStep) => void;
  skipOnboarding: () => void;
  markHintSeen: (key: string) => void;
  resetOnboarding: () => void;
```

- [ ] **Step 3: Adicionar os defaults no `createContext`**

No objeto default de `createContext` (após `setTrainInflationFactor: () => {},`, linha 42), adicionar:

```ts
  advanceOnboarding: () => {},
  skipOnboarding: () => {},
  markHintSeen: () => {},
  resetOnboarding: () => {},
```

- [ ] **Step 4: Implementar os callbacks no corpo do provider**

Em `src/context/GameContext.tsx`, após o bloco `recruitHero` (linha 111), adicionar:

```ts
  const advanceOnboarding = useCallback((step: OnboardingStep) => {
    dispatch({ type: 'SET_ONBOARDING', patch: { step } });
  }, [dispatch]);

  const skipOnboarding = useCallback(() => {
    dispatch({ type: 'SET_ONBOARDING', patch: { step: 'skipped' } });
  }, [dispatch]);

  const markHintSeen = useCallback((key: string) => {
    dispatch({ type: 'SET_ONBOARDING', patch: { hintsSeen: { [key]: true } } });
  }, [dispatch]);

  const resetOnboarding = useCallback(() => {
    dispatch({ type: 'SET_ONBOARDING', patch: { step: 'intro', startedAt: Date.now(), hintsSeen: {} } });
  }, [dispatch]);
```

- [ ] **Step 5: Expor no `value`**

No objeto `value` do `GameContext.Provider` (após `setTrainInflationFactor,`, linha 150), adicionar:

```ts
        advanceOnboarding,
        skipOnboarding,
        markHintSeen,
        resetOnboarding,
```

- [ ] **Step 6: Type-check + suíte**

Run: `npx tsc --noEmit`
Expected: 0 erros.

Run: `npm test`
Expected: PASS (nenhum teste novo, mas garante que a mudança no contexto não quebra montagens existentes).

- [ ] **Step 7: Commit**

```bash
git add src/context/GameContext.tsx
git commit -m "feat(onboarding): conveniências advance/skip/markHint/reset no GameContext"
```

---

## Task 9: Dicas pós-tutorial em `milestones.ts` (TDD)

**Files:**
- Modify: `src/services/milestones.ts` (após linha 29)
- Create: `src/__tests__/services/milestones.onboarding.test.ts`

**Interfaces:**
- Consumes: `emitMilestone` interno (`milestones.ts:3-5`), `FeedbackEvent.TOAST`.
- Produces: `emitForgeHint()`, `emitInfirmaryHint()`, `emitSecondRecruitHint()`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/services/milestones.onboarding.test.ts`:

```ts
import { FeedbackService, FeedbackEvent, ToastPayload } from '../../services/feedback';
import { emitForgeHint, emitInfirmaryHint, emitSecondRecruitHint } from '../../services/milestones';

describe('dicas pós-tutorial', () => {
  let handler: jest.Mock;
  let unsubscribe: () => void;

  beforeEach(() => {
    handler = jest.fn();
    unsubscribe = FeedbackService.on(FeedbackEvent.TOAST, handler);
  });
  afterEach(() => unsubscribe());

  test('emitForgeHint emite toast de marco com texto da forja', () => {
    emitForgeHint();
    expect(handler).toHaveBeenCalledTimes(1);
    const p: ToastPayload = handler.mock.calls[0][0];
    expect(p.type).toBe('milestone');
    expect(p.text).toContain('Forje');
  });

  test('emitInfirmaryHint emite toast sobre Enfermaria', () => {
    emitInfirmaryHint();
    const p: ToastPayload = handler.mock.calls[0][0];
    expect(p.type).toBe('milestone');
    expect(p.text).toContain('Enfermaria');
  });

  test('emitSecondRecruitHint emite toast sobre juntar ouro', () => {
    emitSecondRecruitHint();
    const p: ToastPayload = handler.mock.calls[0][0];
    expect(p.type).toBe('milestone');
    expect(p.text).toContain('ouro');
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npx jest --config jest.unit.config.js --runInBand src/__tests__/services/milestones.onboarding.test.ts`
Expected: FAIL — os 3 `emit*Hint` não existem.

- [ ] **Step 3: Implementação mínima**

Em `src/services/milestones.ts`, após `emitRareMaterialDrop` (linha 33), adicionar:

```ts
export const emitForgeHint = () => {
  emitMilestone('🔨 Forje equipamentos com o ouro das missões para fortalecer a guilda.');
};

export const emitInfirmaryHint = () => {
  emitMilestone('🩺 Heróis feridos se recuperam na Enfermaria.');
};

export const emitSecondRecruitHint = () => {
  emitMilestone('Complete missões para juntar ouro e recrutar mais heróis.');
};
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npx jest --config jest.unit.config.js --runInBand src/__tests__/services/milestones.onboarding.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: 0 erros.

```bash
git add src/services/milestones.ts src/__tests__/services/milestones.onboarding.test.ts
git commit -m "feat(onboarding): emitForgeHint/emitInfirmaryHint/emitSecondRecruitHint (dicas pós-tutorial)"
```

---

## Task 10: `OnboardingProvider` (lógica de orquestração)

**Files:**
- Create: `src/onboarding/OnboardingProvider.tsx`

**Interfaces:**
- Consumes: `useGame()` (Task 8), `deriveStep`/`targetForStep`/`firstMissionStarted`/`TargetId` (Task 6), `analytics` (Task 5), `emitInfirmaryHint`/`markHintSeen` (Tasks 9/8), `HeroTask`.
- Produces:
  - `useOnboarding(): { step: OnboardingStep; isActive: boolean; target: TargetId | null; advance(): void; skip(): void; reset(): void }`
  - `<OnboardingProvider>{children}</OnboardingProvider>`

**Comportamento:** num `useEffect([state])`, o provider compara `deriveStep(state)` com `state.onboarding.step`; se mudou, despacha `advanceOnboarding(derived)` e `analytics.track('ftue_step_completed', { step: derived })`. Dispara `ftue_started` uma vez (montagem com `step === 'intro'`). No avanço para `mission` (i.e., `firstMissionStarted(state)` virou true e o evento ainda não foi disparado), chama `ftue_first_mission_started` com `elapsedMs = Date.now() - startedAt`. No avanço para `done`, chama `ftue_completed`. Observa `state.heroes.some(h => h.currentTask === HeroTask.INFIRMARY)` e, no gate `!hintsSeen.infirmary`, emite `emitInfirmaryHint()` + `markHintSeen('infirmary')`. Sem timers.

Não há teste unit React (a lógica pura está coberta em `deriveStep`/`analytics`/handler). Verificação = `tsc` + validação no emulador (Task 16).

- [ ] **Step 1: Criar o provider completo**

Criar `src/onboarding/OnboardingProvider.tsx`:

```ts
import React, { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { useGame } from '../hooks/useGame';
import { HeroTask, OnboardingStep } from '../types';
import { deriveStep, targetForStep, firstMissionStarted, TargetId } from './onboardingSteps';
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

  const isActive = step !== 'done' && step !== 'skipped';
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros. (`jsx: 'react'` está no `tsconfig` do jest e o `app` usa o `tsconfig` raiz com Expo; ambos compilam `.tsx`.)

- [ ] **Step 3: Suíte completa (garante que nada quebrou)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/onboarding/OnboardingProvider.tsx
git commit -m "feat(onboarding): OnboardingProvider (deriva passo, dispara analytics, dica de enfermaria)"
```

---

## Task 11: `OnboardingOverlay` (spotlight + coach mark)

**Files:**
- Create: `src/onboarding/OnboardingOverlay.tsx`

**Interfaces:**
- Consumes: `useOnboarding()` (Task 10), `measureTarget`/`TargetLayout` (Task 7), `theme` (`src/theme`).
- Produces: `<OnboardingOverlay />` (sem props).

**Comportamento:** quando `isActive`, renderiza um `Modal` transparente com fundo `rgba` derivado de token (ver nota de cor) cobrindo a tela; mede o alvo via `measureTarget(target)` num efeito (re-mede quando `step`/`target` muda). Se há layout, desenha o recorte do spotlight ao redor dele; se `null`, mostra o balão em modo "ponteiro de navegação" ("Toque em **X**"). O balão exibe o texto do passo + botão "Pular" (sempre) e "Começar"/"Entendi". `pointerEvents="box-none"` no container para o toque passar e o jogador navegar.

**Nota de cor (0 hex inline):** o escurecimento de fundo usa `theme.colors.background` com opacidade via `StyleSheet`/`rgba` **derivado do token**, não um hex novo. Implementação: `backgroundColor: theme.colors.overlay ?? 'rgba(15,13,35,0.6)'` — porém, para não introduzir hex inline, esta task **adiciona o token `overlay` ao tema** (Step 1) e o usa. Assim o overlay herda do DS.

- [ ] **Step 1: Adicionar o token `overlay` ao tema**

Em `src/theme/index.ts`, dentro do objeto `colors` (após `textMuted: '#64748B',`), adicionar:

```ts
    overlay: 'rgba(15, 13, 35, 0.72)',
```

(Token único de escurecimento de modal/overlay; SPEC 2/3 o reestiliza trocando o valor. Mantém o overlay sem hex inline.)

- [ ] **Step 2: Criar o overlay completo**

Criar `src/onboarding/OnboardingOverlay.tsx`:

```ts
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { theme } from '../theme';
import { useOnboarding } from './OnboardingProvider';
import { measureTarget, TargetLayout } from './targetRegistry';
import { OnboardingStep } from '../types';

const STEP_COPY: Record<OnboardingStep, { title: string; body: string; cta: string }> = {
  intro: {
    title: 'Bem-vindo à sua guilda',
    body: 'Vamos formar sua primeira equipe e enviá-la em missão.',
    cta: 'Começar',
  },
  recruit: {
    title: 'Recrute um aliado',
    body: 'Você já tem 1 herói. Recrute mais um na Guilda.',
    cta: 'Entendi',
  },
  train: {
    title: 'Fortaleça seu herói',
    body: 'Treine +1 de ATK no Treinamento.',
    cta: 'Entendi',
  },
  mission: {
    title: 'Hora da ação',
    body: 'Envie sua equipe na Primeira Patrulha.',
    cta: 'Entendi',
  },
  collect: {
    title: 'Equipe em campo',
    body: 'Sua equipe luta por ~10s. Aguarde a recompensa.',
    cta: 'Entendi',
  },
  done: { title: '', body: '', cta: '' },
  skipped: { title: '', body: '', cta: '' },
};

export function OnboardingOverlay() {
  const { step, isActive, target, advance, skip } = useOnboarding();
  const [layout, setLayout] = useState<TargetLayout | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!target) {
      setLayout(null);
      return;
    }
    measureTarget(target).then(l => {
      if (!cancelled) setLayout(l);
    });
    return () => { cancelled = true; };
  }, [target, step]);

  if (!isActive) return null;

  const copy = STEP_COPY[step];

  return (
    <Modal transparent visible animationType="fade" onRequestClose={skip}>
      <View style={styles.scrim} pointerEvents="box-none">
        {layout && (
          <View
            pointerEvents="none"
            style={[
              styles.spotlight,
              {
                left: layout.x - theme.spacing.sm,
                top: layout.y - theme.spacing.sm,
                width: layout.width + theme.spacing.sm * 2,
                height: layout.height + theme.spacing.sm * 2,
              },
            ]}
          />
        )}
        <View style={styles.card} pointerEvents="auto">
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={skip} style={styles.skipBtn} activeOpacity={0.7}>
              <Text style={styles.skipText}>Pular tutorial</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={advance} style={styles.ctaBtn} activeOpacity={0.8}>
              <Text style={styles.ctaText}>{copy.cta}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  spotlight: {
    position: 'absolute',
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.gold,
  },
  card: {
    margin: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
    maxWidth: width - theme.spacing.lg * 2,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  body: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipBtn: { paddingVertical: theme.spacing.sm },
  skipText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
  ctaBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  ctaText: { color: theme.colors.textPrimary, fontWeight: theme.fontWeight.bold, fontSize: theme.fontSize.md },
});
```

- [ ] **Step 3: Verificar que os tokens usados existem no tema**

Run: `grep -nE "fontSize:|fontWeight:|borderRadius:|spacing|overlay" src/theme/index.ts | grep -iE "md:|lg:|sm:|xs:|bold|overlay"`
Expected: confirmar que `theme.fontSize.{sm,md,lg}`, `theme.fontWeight.bold`, `theme.borderRadius.{md,lg}`, `theme.spacing.{xs,sm,md,lg}` e `theme.colors.overlay` existem. Se algum token faltar (ex.: `fontSize.md` se chamar diferente), ajustar o nome no overlay para o token real **sem** introduzir literal numérico/hex. (Os componentes existentes — `RecruitButton` usa `theme.fontSize.lg/sm`, `theme.fontWeight.bold/medium`, `theme.borderRadius.lg`, `theme.spacing.md/lg` — confirmam esses nomes.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 5: Commit**

```bash
git add src/theme/index.ts src/onboarding/OnboardingOverlay.tsx
git commit -m "feat(onboarding): OnboardingOverlay (spotlight + coach mark) com token overlay no tema"
```

---

## Task 12: Montar o provider e o overlay no `App.tsx`

**Files:**
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `OnboardingProvider` (Task 10), `OnboardingOverlay` (Task 11).

- [ ] **Step 1: Editar `App.tsx`**

Substituir o conteúdo de `App.tsx`:

```tsx
import React from 'react';
import { GameProvider } from './src/context/GameContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { FeedbackLayer } from './src/components/FeedbackLayer';

export default function App() {
  return (
    <GameProvider>
      <AppNavigator />
      <FeedbackLayer />
    </GameProvider>
  );
}
```

Por:

```tsx
import React from 'react';
import { GameProvider } from './src/context/GameContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { FeedbackLayer } from './src/components/FeedbackLayer';
import { OnboardingProvider } from './src/onboarding/OnboardingProvider';
import { OnboardingOverlay } from './src/onboarding/OnboardingOverlay';

export default function App() {
  return (
    <GameProvider>
      <OnboardingProvider>
        <AppNavigator />
        <FeedbackLayer />
        <OnboardingOverlay />
      </OnboardingProvider>
    </GameProvider>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 3: Boot smoke no web (não trava o boot)**

Run: `pkill -f "expo start" 2>/dev/null; nohup npx expo start --web --port 8081 > /tmp/expo-ftue.log 2>&1 & disown; sleep 25; grep -iE "web compiled|error|bundling failed" /tmp/expo-ftue.log | tail -20`
Expected: ver "web compiled" / bundle ok, sem "bundling failed". (A validação visual completa é a Task 16.)

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(onboarding): montar OnboardingProvider + OnboardingOverlay no App"
```

---

## Task 13: Call sites de `registerTarget` na Guilda + dica do 2º recruta

**Files:**
- Modify: `src/screens/GuildScreen.tsx` (`recruitSection` linhas 56-62)

**Interfaces:**
- Consumes: `registerTarget` (Task 7), `getRecruitCost` (`src/utils/math.ts`), `emitSecondRecruitHint`/`markHintSeen` (Tasks 9/8), `useGame`.
- Produces: alvo `'recruit-button'` registrado; dica `second_recruit` ao tentar recrutar sem ouro.

- [ ] **Step 1: Adicionar imports na `GuildScreen`**

Em `src/screens/GuildScreen.tsx`, após a linha 19 (`import { LoadingScreen } from '../components/ui/LoadingScreen';`), adicionar:

```ts
import { registerTarget } from '../onboarding/targetRegistry';
import { getRecruitCost } from '../utils/math';
import { emitSecondRecruitHint } from '../services/milestones';
import { useGame } from '../hooks/useGame';
```

(`View` já é importado de `react-native` na linha 3 — a ref no Step 3 usa esse `View` existente. `state` vem de `useGuild()`; de `useGame()` só consumimos `markHintSeen`.)

- [ ] **Step 2: Adicionar a ref e o registro do alvo**

Em `src/screens/GuildScreen.tsx`, dentro de `GuildScreen`, logo após o desestruturar de `useGuild()` (linha 32), adicionar:

```ts
  const { markHintSeen } = useGame();
  const recruitRef = React.useRef<View>(null);

  React.useEffect(() => {
    return registerTarget('recruit-button', () =>
      new Promise((resolve) => {
        const node = recruitRef.current as any;
        if (!node?.measureInWindow) return resolve(null);
        node.measureInWindow((x: number, y: number, width: number, height: number) =>
          resolve({ x, y, width, height })
        );
      })
    );
  }, []);

  const onRecruitGuarded = React.useCallback(() => {
    const cost = getRecruitCost(state.heroesRecruited);
    if (state.gold < cost && !state.onboarding?.hintsSeen.second_recruit) {
      emitSecondRecruitHint();
      markHintSeen('second_recruit');
    }
    recruitHero();
  }, [state.heroesRecruited, state.gold, state.onboarding, recruitHero, markHintSeen]);
```

(`state` aqui é o mesmo `GameState` global, exposto por `useGuild()` — que internamente usa `useGame()` — então `state.onboarding.hintsSeen` reflete a flag persistida.)

- [ ] **Step 3: Aplicar a ref e o handler guardado**

Em `src/screens/GuildScreen.tsx`, substituir a `recruitSection` (linhas 56-62):

```tsx
        <View style={styles.recruitSection}>
          <RecruitButton
            cost={nextRecruitCost}
            canAfford={canAfford}
            onPress={recruitHero}
          />
        </View>
```

Por:

```tsx
        <View style={styles.recruitSection} ref={recruitRef} collapsable={false}>
          <RecruitButton
            cost={nextRecruitCost}
            canAfford={canAfford}
            onPress={onRecruitGuarded}
          />
        </View>
```

(`collapsable={false}` garante que o `View` exista como nó nativo mensurável no Android.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 5: Suíte (garante que a tela não quebra import)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/GuildScreen.tsx
git commit -m "feat(onboarding): registerTarget recruit-button e dica do 2º recruta na Guilda"
```

---

## Task 14: Call sites de `registerTarget` em Treinamento e Missões

**Files:**
- Modify: `src/screens/TrainingScreen.tsx`
- Modify: `src/screens/MissionsScreen.tsx` (`MissionActiveItem` map linhas 55-61; `MissionListItem` map linhas 72-79)

**Interfaces:**
- Consumes: `registerTarget` (Task 7).
- Produces: alvos `'train-atk'`, `'mission-1'`, `'active-mission'` registrados.

- [ ] **Step 1: Registrar `train-atk` na `TrainingScreen`**

Em `src/screens/TrainingScreen.tsx`, após a linha 12 (`import { LoadingScreen } from '../components/ui/LoadingScreen';`), adicionar:

```ts
import { registerTarget } from '../onboarding/targetRegistry';
```

Dentro de `TrainingScreen`, após `const navigation = useNavigation<any>();` (linha 26), adicionar a ref e o registro:

```ts
  const trainAtkRef = React.useRef<View>(null);
  React.useEffect(() => {
    return registerTarget('train-atk', () =>
      new Promise((resolve) => {
        const node = trainAtkRef.current as any;
        if (!node?.measureInWindow) return resolve(null);
        node.measureInWindow((x: number, y: number, width: number, height: number) =>
          resolve({ x, y, width, height })
        );
      })
    );
  }, []);
```

Localizar o `BatchButton` de treino de ATK (o botão batch com ATK). Como `BatchButton` é renderizado mais abaixo no JSX, envolver **apenas** o botão de ATK num `View ref={trainAtkRef} collapsable={false}`. Na seção de botões batch do `return`, localizar a invocação que treina ATK (texto/ícone de ATK — ex.: `<BatchButton title="Treinar ATK" ... />` ou equivalente; abrir o arquivo para achar o rótulo exato) e envolvê-la:

```tsx
          <View ref={trainAtkRef} collapsable={false}>
            <BatchButton title="ATK" icon="⚔️" color={theme.colors.atk} onPress={/* handler de ATK existente */} />
          </View>
```

**Verificação do rótulo real:** `grep -nE "BatchButton|TRAIN_ATK|Treinar|ATK" src/screens/TrainingScreen.tsx` para achar a invocação exata do botão de ATK antes de envolver. Não alterar o handler — só envolver no `View` com ref.

- [ ] **Step 2: Registrar `mission-1` e `active-mission` na `MissionsScreen`**

Em `src/screens/MissionsScreen.tsx`, após a linha 14 (`import { MissionPlaybackModal } ...`), adicionar:

```ts
import { registerTarget } from '../onboarding/targetRegistry';
```

Adicionar dentro de `MissionsScreen`, após o destructure de `useMissions()` (linha 31):

```ts
  const mission1Ref = React.useRef<View>(null);
  const activeMissionRef = React.useRef<View>(null);

  React.useEffect(() => {
    const measure = (ref: React.RefObject<View>) => () =>
      new Promise<{ x: number; y: number; width: number; height: number } | null>((resolve) => {
        const node = ref.current as any;
        if (!node?.measureInWindow) return resolve(null);
        node.measureInWindow((x: number, y: number, width: number, height: number) =>
          resolve({ x, y, width, height })
        );
      });
    const un1 = registerTarget('mission-1', measure(mission1Ref));
    const un2 = registerTarget('active-mission', measure(activeMissionRef));
    return () => { un1(); un2(); };
  }, []);
```

- [ ] **Step 3: Envolver o `MissionListItem` de `mission_1`**

Em `src/screens/MissionsScreen.tsx`, substituir o `map` de `MISSIONS` (linhas 72-79):

```tsx
            {MISSIONS.map((mission) => (
              <MissionListItem
                key={mission.id}
                mission={mission}
                onSend={openSelectionModal}
                disabled={availableCount < mission.minHeroes}
              />
            ))}
```

Por:

```tsx
            {MISSIONS.map((mission) =>
              mission.id === 'mission_1' ? (
                <View key={mission.id} ref={mission1Ref} collapsable={false}>
                  <MissionListItem
                    mission={mission}
                    onSend={openSelectionModal}
                    disabled={availableCount < mission.minHeroes}
                  />
                </View>
              ) : (
                <MissionListItem
                  key={mission.id}
                  mission={mission}
                  onSend={openSelectionModal}
                  disabled={availableCount < mission.minHeroes}
                />
              )
            )}
```

- [ ] **Step 4: Envolver o primeiro `MissionActiveItem`**

Em `src/screens/MissionsScreen.tsx`, substituir o `map` de `activeMissions` (linhas 55-61):

```tsx
            {state.activeMissions.map((m) => (
              <MissionActiveItem 
                key={m.id} 
                mission={m} 
                onWatch={openPlaybackModal}
              />
            ))}
```

Por:

```tsx
            {state.activeMissions.map((m, i) =>
              i === 0 ? (
                <View key={m.id} ref={activeMissionRef} collapsable={false}>
                  <MissionActiveItem mission={m} onWatch={openPlaybackModal} />
                </View>
              ) : (
                <MissionActiveItem key={m.id} mission={m} onWatch={openPlaybackModal} />
              )
            )}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros. (`View` já é importado em ambas as telas — `MissionsScreen` linha 2, `TrainingScreen` linha 2.)

- [ ] **Step 6: Suíte**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/screens/TrainingScreen.tsx src/screens/MissionsScreen.tsx
git commit -m "feat(onboarding): registerTarget train-atk, mission-1 e active-mission"
```

---

## Task 15: Dica `forge` no mount da Ferraria

**Files:**
- Modify: `src/screens/BlacksmithScreen.tsx`

**Interfaces:**
- Consumes: `useGame` (já usado na tela), `emitForgeHint` (Task 9), `markHintSeen` (Task 8).
- Produces: dica `forge` emitida uma única vez ao montar a tela.

- [ ] **Step 1: Adicionar import de `emitForgeHint`**

Em `src/screens/BlacksmithScreen.tsx`, após a linha 18 (`import { MATERIALS, FORGE_RECIPES, ... } from '../constants/materials';`), adicionar:

```ts
import { emitForgeHint } from '../services/milestones';
```

- [ ] **Step 2: Disparar a dica no mount com gate**

Em `src/screens/BlacksmithScreen.tsx`, no corpo do componente, localizar onde `useGame()` é desestruturado (a tela já usa `const { ... } = useGame();`). Garantir que `state` e `markHintSeen` venham do hook; se a desestruturação atual não os inclui, expandir para `const { state, markHintSeen, /* ...resto existente... */ } = useGame();`. Em seguida, adicionar o efeito logo após a desestruturação:

```ts
  React.useEffect(() => {
    if (!state.onboarding?.hintsSeen.forge) {
      emitForgeHint();
      markHintSeen('forge');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

(Gate `!hintsSeen.forge` + `markHintSeen` = one-shot persistido. Deps vazias = "no mount"; a flag persistida garante que nem o remount nem o reload re-disparem.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros. (Se `BlacksmithScreen` importar `React` sem o namespace para `React.useEffect`, ele já importa `React, { useState, useEffect, useCallback }` na linha 1 — usar `useEffect` direto em vez de `React.useEffect`. Ajustar conforme o import existente.)

- [ ] **Step 4: Suíte**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/BlacksmithScreen.tsx
git commit -m "feat(onboarding): dica forge one-shot ao abrir a Ferraria"
```

---

## Task 16: Validação de UI no browser (emulador web) + cronômetro do funil

**Files:** nenhuma mudança de código (validação). Se algum defeito visual/lógico aparecer, corrigir na task correspondente e re-rodar.

**Objetivo:** confirmar o caminho feliz `intro → recruit → train → mission → collect → done` em < 60s, o "Pular" em cada passo, e que `done`/`skipped` persistem após reload.

- [ ] **Step 1: Subir o Expo web limpo**

Run: `pkill -f "expo start" 2>/dev/null; nohup npx expo start --web --port 8081 > /tmp/expo-ftue.log 2>&1 & disown; sleep 25; grep -iE "web compiled|bundling failed|error" /tmp/expo-ftue.log | tail`
Expected: "web compiled", sem "bundling failed".

- [ ] **Step 2: Boot limpo via Playwright e screenshot do `intro`**

Usar o MCP do Playwright: `browser_navigate` para `http://localhost:8081`, depois `browser_evaluate` para limpar storage e recarregar:

```js
() => { localStorage.clear(); location.reload(); }
```

Depois `browser_snapshot` + `browser_take_screenshot`. Verificar o balão "Bem-vindo à sua guilda" sobre a Vila e o botão "Começar".
Expected: overlay `intro` visível com 1 herói já presente na Guilda.

- [ ] **Step 3: Seguir o fluxo e cronometrar até a 1ª missão**

Anotar `T0 = Date.now()` via `browser_evaluate`. Clicar "Começar" → navegar à Guilda → recrutar (botão destacado pelo spotlight) → Treinamento → treinar ATK → Missões → iniciar "Primeira Patrulha". Capturar no console o log `[analytics] ftue_first_mission_started { elapsedMs: N }` (via `browser_console_messages`).
Expected: `elapsedMs < 60000`. Screenshot de cada passo (recruit/train/mission/collect).

- [ ] **Step 4: Coletar recompensa e ver `done`**

Aguardar ~10s a missão concluir; ver o `MissionResultModal` e, ao fechar, o overlay sumir (passo `done`). Confirmar no console `[analytics] ftue_completed { elapsedMs }`.
Expected: overlay não reaparece; toast/marco de conclusão.

- [ ] **Step 5: Testar "Pular tutorial" + persistência**

Recarregar com storage limpo (Step 2). No `intro`, clicar "Pular tutorial". Confirmar overlay some. Recarregar a página (sem limpar storage).
Expected: o tutorial **não** reaparece (`step: 'skipped'` persistido). Verificar via `browser_evaluate`:

```js
() => JSON.parse(localStorage.getItem('@idle_rpg_game_state') || '{}').onboarding?.step
```

Expected: `'skipped'`.

- [ ] **Step 6: Persistência do `done`**

Repetir o caminho feliz até `done`, recarregar (sem limpar). Expected: overlay não reaparece; `onboarding.step === 'done'`.

- [ ] **Step 7: Encerrar o servidor e commitar evidências (se houver)**

Run: `pkill -f "expo start" 2>/dev/null; true`

Se foram salvos screenshots em `docs/superpowers/`, commitar; senão, registrar o resultado no PR. Nenhuma mudança de código nesta task se tudo passou.

```bash
git add -A docs/superpowers 2>/dev/null; git commit -m "docs(onboarding): evidências de validação do FTUE no emulador web" --allow-empty
```

---

## Verificação Final

- [ ] **Step 1: Suíte completa**

Run: `npm test`
Expected: PASS, incluindo os novos arquivos: `onboardingHandler.test.ts`, `initialState.onboarding.test.ts`, `storage.onboarding.test.ts`, `analytics.test.ts`, `deriveStep.test.ts`, `targetRegistry.test.ts`, `milestones.onboarding.test.ts`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 3: Grep anti-gold-passivo (critério de aceitação #4)**

Run: `grep -rnE "gold\s*[+]?=|state\.gold" src/onboarding/`
Expected: **nenhum resultado** — o overlay/provider não tocam em `gold`. O único delta econômico é o `gold: 25` estático de `initialGameState`.

- [ ] **Step 4: Grep anti-hex-inline no overlay (critério #9)**

Run: `grep -nE "#[0-9a-fA-F]{6}|rgba\(" src/onboarding/OnboardingOverlay.tsx`
Expected: **nenhum resultado** (o `rgba` do escurecimento vive em `theme.colors.overlay`, não no overlay).

- [ ] **Step 5: Simulações de batalha (smoke de regressão do estado inicial)**

Run: `npm run simulate:m1`
Expected: finaliza sem erro com log de batalha.

- [ ] **Step 6: Commit de encerramento**

```bash
git add -A
git commit -m "chore(onboarding): FTUE completo — tutorial, estado inicial revisto, migração v9, analytics do funil" --allow-empty
git push
```

---

## Resumo das Decisões de Design

| Decisão | Justificativa |
|---|---|
| Lógica da máquina em `deriveStep` puro | Testável sem React; atende "integração > mock" usando `GameState` real |
| Passo derivado do `GameState`, nunca de sinal sintético | Evita dessincronização entre "tutorial acha que fez" e "jogo fez" |
| `intro` só avança por ação manual | O tutorial não pode "começar sozinho" antes de o jogador tocar "Começar" |
| Estado inicial: 1 herói WARRIOR + gold 25 + heroesRecruited 1 | Remove vila inútil; preço cheio do 2º recruta (15); só 1 recruta extra → não trivializa, respeita "sem gold passivo" |
| Migração v9 → `step: 'done'` para veteranos | Não interrompe jogadores existentes; só boot sem save vê o tutorial |
| `analytics` como interface no-op/console | SPEC 9 pluga o sink real sem mexer nos call sites |
| Token `overlay` no tema (não hex inline) | Overlay herda o DS; SPEC 3 reestiliza trocando o token |
| `registerTarget` guarda função de medição, não ref crua | Testável sem React; tela passa `measureInWindow`; null → modo ponteiro de navegação |
| Dicas pós-tutorial reusam `milestones.ts` | Um único canal de toast; gate `hintsSeen` garante one-shot persistido |
| Sem timers no provider (passo `collect` reage ao tick) | Sem relógio paralelo = sem dessincronização com o motor de missão |
