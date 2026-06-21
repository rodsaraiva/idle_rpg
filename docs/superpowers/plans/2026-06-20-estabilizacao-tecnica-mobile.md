# Estabilização Técnica & Boot Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zerar os 17 erros de `tsc`, consertar o bug de gold de missão offline, endurecer a persistência (backup + distinção sem-save/corrompido), limpar a suíte (ignorar `.worktrees/` + threshold de cobertura) e validar boot em emulador iOS/Android.

**Architecture:** O motor vivo (`tickHandler`) já é fonte de verdade e progride missões por `startedAt + durationMs`. O caminho offline (`offlineProgress.ts`) ainda lê o campo legado `remainingMs` que ninguém grava — vamos reescrever esse bloco para espelhar o tick (resolução de boss via `WEEKLY_BOSS_POOL` + `bossToMissionTemplate`, reward via `precomputedOutcome?.reward ?? calcMissionReward`). A persistência ganha um `BACKUP_KEY`, um `CorruptSaveError` (em vez de retornar `null` silenciosamente) e um `validateShape` compartilhado entre `storage.load()` e o `LOAD_STATE` do reducer. Os erros de `tsc` são resolvidos por helpers cross-platform (`src/theme/elevation.ts`), re-tipagem dos exports `on`/`emit` do `feedback.ts`, instalação de `@expo/vector-icons` e reescrita de `sound.ts` contra a API atual do `expo-audio@1.1.1`.

**Tech Stack:** TypeScript, React Native (Expo SDK 54, newArch), Jest (ts-jest no `jest.unit.config.js`; jest-expo no `jest.config.js`), AsyncStorage in-memory real (`jest-mocks/async-storage-mock.js`), Playwright/emulador para validação de UI.

**Spec:** [`docs/superpowers/specs/2026-06-20-estabilizacao-tecnica-mobile-design.md`](../specs/2026-06-20-estabilizacao-tecnica-mobile-design.md)

## Global Constraints

- Todo conteúdo (comentários, mensagens de commit, docstrings) em **pt-BR**; identificadores de código em inglês como no codebase.
- `npx tsc --noEmit` → **0 erros** (baseline atual: 17) ao fim do plano.
- `npm test` (`jest --config jest.unit.config.js`) → **verde**, **≤ 60 suites** (sem duplicatas de `.worktrees/`).
- Alvo **mobile** (iOS/Android via Expo); web é só alvo de dev. Estilos web-only (`'fixed'`, `'84vh'`, `textShadow:'...'`, `boxShadow:'...'`) são bloqueadores e devem sair.
- **Sem gold passivo**: gold só de missão **completada** (cap de 72h respeitado). Missão em loop é o mecanismo offline.
- **DEF/CRIT/AGI não-treináveis**: crescem só por equipamento/passiva/fusão — nenhuma task altera isso.
- **Integração > mock**: AsyncStorage usa o mock in-memory real (`jest-mocks/async-storage-mock.js`); proibido `jest.mock('../../services/storage')` com retorno fixo.
- Sem over-engineering, sem comentário óbvio, sem error-handling preventivo em caminho interno confiável.
- `coverageThreshold.global.branches: 80` em **ambos** os configs ao final (Task 11), ligado por último para não travar o ciclo.

---

## Ordem de execução

As tasks são sequenciais. Tasks 1–9 são independentes entre si no resultado (cada uma fecha um subconjunto de erros/bugs) mas devem ser feitas em ordem para manter `tsc`/`npm test` verdes commit-a-commit. Tasks 10–11 (suíte/threshold) e 12 (app.json/boot) fecham o plano.

| Task | Tema | Erros/itens do spec cobertos |
|---|---|---|
| 1 | Suíte: ignorar `.worktrees/` | §3.4 (parte), objetivo 5 |
| 2 | `feedback.ts` re-tipa `on`/`emit` | §3.1-B (2 erros TS7006) |
| 3 | `src/theme/elevation.ts` + estilos de texto/sombra | §3.1-A (CombatantCard, FeedbackLayer, HPBar) |
| 4 | ChestRevealModal `'fixed'`/`'84vh'` | §3.1-A (2 erros) |
| 5 | Tokens `warning`/`accent` + cellStyle + HeroCard guard + MissionResultModal | §3.1-E/F/G + cellStyle |
| 6 | `HeroCard.stories.tsx` mock de `Hero` | §3.1-D (1 erro TS2739) |
| 7 | `@expo/vector-icons` instalado | §3.1-C (TS2307) |
| 8 | `sound.ts` API expo-audio atual | §3.1-C (TS2305) |
| 9 | Bug gold offline (TDD) | §3.2 (BUG CRÍTICO 1.2) |
| 10 | Persistência robusta (TDD) | §3.3 |
| 11 | Integração offline reescrita + coverageThreshold | §3.4/§3.5, objetivo 2 |
| 12 | app.json dark + checklist boot mobile | §3.5, objetivo 6/7 |

---

## Task 1: Suíte — ignorar `.worktrees/` em ambos os configs

**Files:**
- Modify: `jest.unit.config.js` (linha 15 `testMatch`, linha 16-20 `testPathIgnorePatterns`)
- Modify: `jest.config.js` (linha 20 `testPathIgnorePatterns`)

**Interfaces:**
- Consumes: nada.
- Produces: suíte unit roda **≤ 60 suites** (hoje `find src .worktrees -name '*.test.ts*'` = 106; só `src` = 60). O glob `**/src/__tests__/**` casa o worktree porque não está ancorado em `<rootDir>`.

- [ ] **Step 1: Rodar a suíte e contar suites antes da mudança**

Run:
```bash
cd /root/rodrigo/idle_rpg && npm test 2>&1 | grep -E "Test Suites:|Tests:" | head -2
```
Expected: número de suites > 60 (inclui duplicatas de `.worktrees/sinergias-qualitativas`).

- [ ] **Step 2: Ancorar `testMatch` e adicionar ignore de `.worktrees/` em `jest.unit.config.js`**

Substituir, em `jest.unit.config.js`, a linha 15:
```js
  testMatch: ['**/src/__tests__/**/?(*.)+(test).[jt]s?(x)'],
```
por:
```js
  testMatch: ['<rootDir>/src/__tests__/**/?(*.)+(test).[jt]s?(x)'],
```

E substituir o bloco `testPathIgnorePatterns` (linhas 16-20):
```js
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/src/__tests__/context/gameContext.offline.test.tsx',
  ],
```
por:
```js
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/.worktrees/',
    '<rootDir>/src/__tests__/context/gameContext.offline.test.tsx',
  ],
```
(A entrada de ignore do `gameContext.offline.test.tsx` será **removida** na Task 11, quando o teste for reescrito.)

- [ ] **Step 3: Adicionar ignore de `.worktrees/` em `jest.config.js`**

Substituir, em `jest.config.js`, a linha 20:
```js
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/src/__tests__/context/gameContext.offline.test.tsx'],
```
por:
```js
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.worktrees/', '/src/__tests__/context/gameContext.offline.test.tsx'],
```

- [ ] **Step 4: Rodar a suíte e confirmar ≤ 60 suites**

Run:
```bash
cd /root/rodrigo/idle_rpg && npm test 2>&1 | grep -E "Test Suites:|Tests:" | head -2
```
Expected: `Test Suites:` mostra no máximo 60 (todas verdes) — as ~46 duplicatas de `.worktrees/` desapareceram.

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/idle_rpg
git add jest.unit.config.js jest.config.js
git commit -m "test: ignorar .worktrees/ e ancorar testMatch — elimina ~46 suites duplicadas"
```

---

## Task 2: `feedback.ts` — re-tipar `on`/`emit` para propagar `PayloadMap`

**Files:**
- Modify: `src/services/feedback.ts` (linhas 84-89)

**Interfaces:**
- Consumes: `FeedbackEvent`, `PayloadMap` (já definidos em `feedback.ts:3-52`), `FeedbackService.on`/`.emit`.
- Produces: `export function on<T extends FeedbackEvent>(event: T, cb: (payload: PayloadMap[T]) => void)` e `export function emit<T extends FeedbackEvent>(event: T, payload: PayloadMap[T])`. Com isso, em `FeedbackLayer.tsx:25,31`, `payload` infere `FloatPayload`/`ToastPayload` automaticamente (os dois TS7006 somem **sem tocar no FeedbackLayer**).

> Nota: `PayloadMap` hoje é `type PayloadMap = {...}` **sem `export`** (`feedback.ts:45`). Como os novos `on`/`emit` referenciam `PayloadMap[T]` no mesmo arquivo, não é preciso exportá-lo. `FEEDBACK_EVENTS.FLOAT` é o valor `FeedbackEvent.FLOAT`; ao chamar `on(FEEDBACK_EVENTS.FLOAT, cb)`, `T` é inferido como `FeedbackEvent.FLOAT` e `payload` vira `FloatPayload`.

- [ ] **Step 1: Confirmar os dois erros TS7006 antes da mudança**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep "FeedbackLayer.tsx" | grep "TS7006"
```
Expected: duas linhas — `FeedbackLayer.tsx(25,51)` e `FeedbackLayer.tsx(31,51): error TS7006: Parameter 'payload' implicitly has an 'any' type.`

- [ ] **Step 2: Substituir os exports de compat `emit`/`on` por wrappers genéricos**

Em `src/services/feedback.ts`, substituir o bloco (linhas 84-89):
```ts
// Backward compatibility exports
export const emit = (event: any, payload: any) => 
  FeedbackService.emit(event as FeedbackEvent, payload);

export const on = (event: any, cb: any) => 
  FeedbackService.on(event as FeedbackEvent, cb);
```
por:
```ts
// Backward compatibility exports — preservam o PayloadMap para os chamadores
export function emit<T extends FeedbackEvent>(event: T, payload: PayloadMap[T]) {
  return FeedbackService.emit(event, payload);
}

export function on<T extends FeedbackEvent>(event: T, cb: (payload: PayloadMap[T]) => void) {
  return FeedbackService.on(event, cb);
}
```

- [ ] **Step 3: Confirmar que os dois TS7006 sumiram e nada novo quebrou**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -E "FeedbackLayer.tsx.*TS7006" ; echo "exit:$?"
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: a primeira linha não imprime nada (grep falha, `exit:1`); a contagem total cai de 17 para **15**.

- [ ] **Step 4: Rodar a suíte (regressão de feedback)**

Run:
```bash
cd /root/rodrigo/idle_rpg && npm test 2>&1 | grep -E "Test Suites:|Tests:" | head -2
```
Expected: verde (mesmo número de suites da Task 1).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/idle_rpg
git add src/services/feedback.ts
git commit -m "fix(feedback): re-tipar on/emit com PayloadMap — elimina 2 implicit any no FeedbackLayer"
```

---

## Task 3: `src/theme/elevation.ts` + trocar `textShadow`/`boxShadow` web-only por helpers RN

**Files:**
- Create: `src/theme/elevation.ts`
- Modify: `src/components/CombatantCard.tsx` (estilos `hpOverlayText:219`, `dmgText:264`)
- Modify: `src/components/FeedbackLayer.tsx` (estilo `floatText:165` e `toast:179`)
- Modify: `src/components/HPBar.tsx` (estilo `overlay:66`)

**Interfaces:**
- Consumes: `Platform`, `TextStyle`, `ViewStyle` de `react-native`.
- Produces:
  - `export function textShadow(color?: string, dx?: number, dy?: number, radius?: number): Pick<TextStyle, 'textShadowColor' | 'textShadowOffset' | 'textShadowRadius'>`
  - `export function elevation(level: 1 | 2 | 3 | 4): ViewStyle`

> Os 3 erros TS2345 (`CombatantCard.tsx:219`, `FeedbackLayer.tsx:165`, `HPBar.tsx:66`) vêm de `textShadow: '...'` (string CSS web) em objetos de `StyleSheet.create`. O `boxShadow: '0px 4px 6px ...'` em `FeedbackLayer toast` (`:179`) não está nos 17 erros hoje (RN 0.81 tolera parcialmente), mas é removido junto por consistência cross-platform exigida pelo spec (Critério: `grep boxShadow` → 0). O estilo `toast` já tem `elevation: 8` (`:180`) — substituímos a string `boxShadow` por `...elevation(3)` e removemos o `elevation: 8` redundante.

- [ ] **Step 1: Confirmar os 3 erros TS2345 de `textShadow`**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -E "CombatantCard.tsx\(219|FeedbackLayer.tsx\(165|HPBar.tsx\(66"
```
Expected: três linhas, todas `error TS2345 ... 'textShadow' does not exist in type 'ViewStyle | TextStyle | ImageStyle'`.

- [ ] **Step 2: Criar `src/theme/elevation.ts`**

```ts
import { Platform, TextStyle, ViewStyle } from 'react-native';

/** Sombra de texto cross-platform. Substitui o `textShadow: '...'` (CSS web). */
export function textShadow(
  color = 'rgba(0,0,0,0.45)',
  dx = 0,
  dy = 1,
  radius = 1
): Pick<TextStyle, 'textShadowColor' | 'textShadowOffset' | 'textShadowRadius'> {
  return {
    textShadowColor: color,
    textShadowOffset: { width: dx, height: dy },
    textShadowRadius: radius,
  };
}

/** Elevação cross-platform. Android: `elevation`; iOS/web: `shadow*`. Substitui o `boxShadow: '...'`. */
export function elevation(level: 1 | 2 | 3 | 4): ViewStyle {
  const map = { 1: 2, 2: 4, 3: 8, 4: 12 } as const;
  return Platform.select({
    android: { elevation: map[level] },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: map[level] / 2 },
      shadowOpacity: 0.3,
      shadowRadius: map[level] / 2,
    },
  })!;
}
```

- [ ] **Step 3: Trocar `textShadow` em `CombatantCard.tsx`**

Adicionar o import ao topo de `src/components/CombatantCard.tsx` (junto aos imports internos, depois do import de `theme`):
```ts
import { textShadow } from '../theme/elevation';
```
No estilo `hpOverlayText` (`:219`), substituir:
```ts
    textShadow: '0px 1px 2px rgba(0,0,0,0.45)',
```
por:
```ts
    ...textShadow('rgba(0,0,0,0.45)', 0, 1, 2),
```
No estilo `dmgText` (`:264`), substituir:
```ts
    textShadow: '0px 2px 3px rgba(0,0,0,0.5)',
```
por:
```ts
    ...textShadow('rgba(0,0,0,0.5)', 0, 2, 3),
```

- [ ] **Step 4: Trocar `textShadow` e `boxShadow` em `FeedbackLayer.tsx`**

Adicionar ao topo de `src/components/FeedbackLayer.tsx` (depois do import de `theme`):
```ts
import { textShadow, elevation } from '../theme/elevation';
```
No estilo `floatText` (`:165`), substituir:
```ts
    textShadow: '0px 2px 4px rgba(0,0,0,0.5)',
```
por:
```ts
    ...textShadow('rgba(0,0,0,0.5)', 0, 2, 4),
```
No estilo `toast` (`:179-180`), substituir as duas linhas:
```ts
    boxShadow: '0px 4px 6px rgba(0,0,0,0.3)',
    elevation: 8,
```
por:
```ts
    ...elevation(3),
```

- [ ] **Step 5: Trocar `textShadow` em `HPBar.tsx`**

Adicionar ao topo de `src/components/HPBar.tsx` (depois do import de `theme`):
```ts
import { textShadow } from '../theme/elevation';
```
No estilo `overlay` (`:66`), substituir:
```ts
    textShadow: '0px 1px 1px rgba(0,0,0,0.35)',
```
por:
```ts
    ...textShadow('rgba(0,0,0,0.35)', 0, 1, 1),
```

- [ ] **Step 6: Confirmar os 3 erros sumiram e `grep` de strings web zera nesses arquivos**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -E "CombatantCard|FeedbackLayer|HPBar" ; echo "exit:$?"
cd /root/rodrigo/idle_rpg && grep -rn "textShadow: '" src/components/CombatantCard.tsx src/components/FeedbackLayer.tsx src/components/HPBar.tsx ; echo "grep-exit:$?"
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: primeira sem saída (`exit:1`); segunda sem saída (`grep-exit:1`); contagem total cai de 15 para **12**.

- [ ] **Step 7: Commit**

```bash
cd /root/rodrigo/idle_rpg
git add src/theme/elevation.ts src/components/CombatantCard.tsx src/components/FeedbackLayer.tsx src/components/HPBar.tsx
git commit -m "fix(estilo): helpers textShadow/elevation cross-platform — remove textShadow/boxShadow web-only"
```

---

## Task 4: `ChestRevealModal` — `'fixed'`→`'absolute'` e `'84vh'`→número

**Files:**
- Modify: `src/components/ChestRevealModal.tsx` (import RN linha 2-10, estilo `backdrop:389`, estilo `content:404`)

**Interfaces:**
- Consumes: `Dimensions` de `react-native` (hoje **não importado** — `ChestRevealModal` só importa `Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Easing`; `Platform` vem de `import { Platform } from 'react-native'` na linha 19).
- Produces: estilos `backdrop`/`content` válidos em RN.

- [ ] **Step 1: Confirmar os 2 erros**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -E "ChestRevealModal.tsx\(389|ChestRevealModal.tsx\(404"
```
Expected: `(389,5)` TS2322 `"fixed"` e `(404,5)` TS2322 `"84vh"`.

- [ ] **Step 2: Adicionar `Dimensions` ao import de `react-native`**

Em `src/components/ChestRevealModal.tsx`, no bloco de import (linhas 2-10), adicionar `Dimensions` à lista:
```ts
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
```

- [ ] **Step 3: `backdrop.position` → `'absolute'`**

No estilo `backdrop` (`:389`), substituir:
```ts
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
```
por:
```ts
    position: 'absolute',
```
(O fallback web só existia para fugir do type-error; em mobile `'absolute'` cobre o backdrop sob o `Modal` overlay. `Platform` continua importado/usado em `:50,:72,:285`, então o import não fica órfão.)

- [ ] **Step 4: `content.maxHeight` → número**

No estilo `content` (`:404`), substituir:
```ts
    maxHeight: '84vh',
```
por:
```ts
    maxHeight: Dimensions.get('window').height * 0.84,
```

- [ ] **Step 5: Confirmar os 2 erros sumiram**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep "ChestRevealModal" ; echo "exit:$?"
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: sem saída (`exit:1`); contagem total cai de 12 para **10**.

- [ ] **Step 6: Commit**

```bash
cd /root/rodrigo/idle_rpg
git add src/components/ChestRevealModal.tsx
git commit -m "fix(chest): position absolute e maxHeight numérico — remove unidades web-only"
```

---

## Task 5: Tokens `warning`/`accent` + cellStyle tipado + HeroCard guard + MissionResultModal pointerEvents

**Files:**
- Modify: `src/theme/index.ts` (`colors`, depois de `danger:21`)
- Modify: `src/components/MissionHeroSelectionModal.tsx` (cellStyle `:241-249`; usos de `theme.colors.warning:420`, `theme.colors.accent:472` passam a compilar)
- Modify: `src/components/HeroCard.tsx` (`:74`, `:138`)
- Modify: `src/components/MissionResultModal.tsx` (`:144`)

**Interfaces:**
- Consumes: `theme.colors`; `CLASS_DEFS` (indexado por `ClassId`); `StyleProp`, `ViewStyle` de `react-native`.
- Produces: `theme.colors.warning` e `theme.colors.accent` existem; `cellStyle` tipado como `StyleProp<ViewStyle>` com `position: 'absolute'` literal; `CLASS_DEFS` indexado só quando `hero.classId` é definido.

> Os erros aqui: `MissionHeroSelectionModal.tsx(254)` TS2322 (cellStyle: `position: string` inferido), `(420)`/`(472)` TS2339 (`warning`/`accent` ausentes), `HeroCard.tsx(74)`/`(138)` TS2538 (`CLASS_DEFS[hero.classId ?? undefined]`), `MissionResultModal.tsx(144)` TS2322 (`pointerEvents` não é prop de `LottieView`). São 6 erros.

- [ ] **Step 1: Confirmar os 6 erros**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -E "MissionHeroSelectionModal.tsx\((254|420|472)|HeroCard.tsx\((74|138)|MissionResultModal.tsx\(144"
```
Expected: 6 linhas (TS2322 cellStyle, TS2339 warning, TS2339 accent, dois TS2538, TS2322 pointerEvents).

- [ ] **Step 2: Adicionar tokens `warning` e `accent` em `src/theme/index.ts`**

Em `src/theme/index.ts`, dentro de `colors`, após a linha `danger: '#EF4444',` (`:21`), adicionar:
```ts
    // TODO SPEC 2: revisar na paleta "Reino" (valores temporários alinhados ao tema atual)
    warning: '#F59E0B',
    accent: '#A78BFA',
```

- [ ] **Step 3: Tipar `cellStyle` com literal `'absolute'` em `MissionHeroSelectionModal.tsx`**

Confirmar que `StyleProp` e `ViewStyle` estão no import de `react-native` (o arquivo já importa de `react-native`; se não houver, adicionar `StyleProp, ViewStyle` à lista de imports do bloco `import { Modal, View, Text, StyleSheet, ... } from 'react-native'`).

Substituir o bloco `cellStyle` (`:241-249`):
```ts
    const cellStyle = [
      styles.cell,
      {
        position: 'absolute',
        left: (i % GRID_COLUMNS) * HEX_WIDTH + ((row % 2) * HEX_WIDTH) / 2,
        top: row * HEX_VERTICAL_SPACING,
      },
      hero && styles.cellFilled,
    ];
```
por:
```ts
    const cellStyle: StyleProp<ViewStyle> = [
      styles.cell,
      {
        position: 'absolute' as const,
        left: (i % GRID_COLUMNS) * HEX_WIDTH + ((row % 2) * HEX_WIDTH) / 2,
        top: row * HEX_VERTICAL_SPACING,
      },
      hero && styles.cellFilled,
    ];
```

- [ ] **Step 4: Guard de `classId` antes de indexar `CLASS_DEFS` em `HeroCard.tsx`**

Em `src/components/HeroCard.tsx`, substituir as **duas** ocorrências (`:74` e `:138`) de:
```tsx
            {CLASS_DEFS[hero.classId ?? undefined]?.displayName ?? ''}
```
por:
```tsx
            {(hero.classId ? CLASS_DEFS[hero.classId] : undefined)?.displayName ?? ''}
```

- [ ] **Step 5: Mover `pointerEvents` para `style` em `MissionResultModal.tsx`**

Em `src/components/MissionResultModal.tsx`, no `<LottieView>` (`:139-145`), substituir:
```tsx
            <LottieView
              ref={confettiRef}
              source={LOTTIE_ASSETS.CONFETTI}
              style={styles.confetti}
              loop={false}
              pointerEvents="none"
            />
```
por:
```tsx
            <LottieView
              ref={confettiRef}
              source={LOTTIE_ASSETS.CONFETTI}
              style={[styles.confetti, { pointerEvents: 'none' }]}
              loop={false}
            />
```

- [ ] **Step 6: Confirmar os 6 erros sumiram**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -E "MissionHeroSelectionModal|HeroCard.tsx|MissionResultModal" ; echo "exit:$?"
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: sem saída (`exit:1`); contagem total cai de 10 para **4**.

- [ ] **Step 7: Rodar a suíte (regressão)**

Run:
```bash
cd /root/rodrigo/idle_rpg && npm test 2>&1 | grep -E "Test Suites:|Tests:" | head -2
```
Expected: verde.

- [ ] **Step 8: Commit**

```bash
cd /root/rodrigo/idle_rpg
git add src/theme/index.ts src/components/MissionHeroSelectionModal.tsx src/components/HeroCard.tsx src/components/MissionResultModal.tsx
git commit -m "fix(tipos): tokens warning/accent, cellStyle tipado, guard de classId, pointerEvents em style"
```

---

## Task 6: `HeroCard.stories.tsx` — mock de `Hero` com `defense/crit/agility`

**Files:**
- Modify: `src/components/HeroCard.stories.tsx` (`baseHero:5-16`)

**Interfaces:**
- Consumes: `Hero` (`src/types/index.ts:24-49` — exige `defense`, `crit`, `agility` obrigatórios, além de `hpMax`/`hpCurrent` já presentes).
- Produces: `baseHero` válido como `Hero`.

> Erro: `HeroCard.stories.tsx(5,7)` TS2739 — faltam `defense, crit, agility`.

- [ ] **Step 1: Confirmar o erro**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep "HeroCard.stories.tsx"
```
Expected: `(5,7): error TS2739 ... is missing the following properties from type 'Hero': defense, crit, agility`.

- [ ] **Step 2: Adicionar os 3 stats secundários ao `baseHero`**

Em `src/components/HeroCard.stories.tsx`, substituir o objeto `baseHero` (`:5-16`):
```ts
const baseHero: Hero = {
  id: 'hero-1',
  name: 'Arthas',
  classId: 'WARRIOR',
  hpMax: 12,
  hpCurrent: 9,
  atk: 7,
  mp: 3,
  currentTask: HeroTask.IDLE,
  trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
  trainingCount: { hp: 0, atk: 0, mp: 0 },
};
```
por:
```ts
const baseHero: Hero = {
  id: 'hero-1',
  name: 'Arthas',
  classId: 'WARRIOR',
  hpMax: 12,
  hpCurrent: 9,
  atk: 7,
  mp: 3,
  defense: 4,
  crit: 5,
  agility: 3,
  currentTask: HeroTask.IDLE,
  trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
  trainingCount: { hp: 0, atk: 0, mp: 0 },
};
```

- [ ] **Step 3: Confirmar o erro sumiu**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep "HeroCard.stories" ; echo "exit:$?"
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: sem saída (`exit:1`); contagem total cai de 4 para **3**.

- [ ] **Step 4: Commit**

```bash
cd /root/rodrigo/idle_rpg
git add src/components/HeroCard.stories.tsx
git commit -m "fix(stories): HeroCard mock com defense/crit/agility — alinha ao tipo Hero"
```

---

## Task 7: Instalar `@expo/vector-icons` (pinado para SDK 54)

**Files:**
- Modify: `package.json` (`dependencies`)
- Sem mudança de código: `src/navigation/AppNavigator.tsx:16` passa a compilar.

**Interfaces:**
- Consumes: nada.
- Produces: `@expo/vector-icons` em `dependencies`; `import { Ionicons } from '@expo/vector-icons'` (`AppNavigator.tsx:16`) resolve.

> Erro: `AppNavigator.tsx(16,26)` TS2307 — módulo ausente. `npx expo install` deixa o Expo escolher a versão compatível com o SDK instalado.

- [ ] **Step 1: Confirmar o erro e que o pacote está ausente**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep "AppNavigator.tsx"
cd /root/rodrigo/idle_rpg && node -e "console.log(require('./package.json').dependencies['@expo/vector-icons'] ?? 'AUSENTE')"
```
Expected: `(16,26): error TS2307 Cannot find module '@expo/vector-icons'`; segunda linha imprime `AUSENTE`.

- [ ] **Step 2: Instalar via expo install**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx expo install @expo/vector-icons
```
Expected: instala e adiciona a dep pinada em `package.json`. (Se a rede do sandbox bloquear, rodar com `dangerouslyDisableSandbox: true` apenas neste comando de instalação.)

- [ ] **Step 3: Confirmar o erro sumiu e o pacote está em `dependencies`**

Run:
```bash
cd /root/rodrigo/idle_rpg && node -e "console.log(require('./package.json').dependencies['@expo/vector-icons'] ?? 'AUSENTE')"
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep "AppNavigator" ; echo "exit:$?"
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: primeira imprime uma versão (não `AUSENTE`); segunda sem saída (`exit:1`); contagem total cai de 3 para **2**.

- [ ] **Step 4: Verificar que os nomes de ícone usados existem em `Ionicons`**

Run:
```bash
cd /root/rodrigo/idle_rpg && grep -nE "name=|Ionicons" src/navigation/AppNavigator.tsx
```
Expected: lista os ícones usados (`fitness`, `map`, `medkit`, `home`, `cart` + variantes `-outline`). Conferir visualmente que são nomes válidos de `Ionicons` (validação real de render fica na Task 12 — boot no emulador).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/idle_rpg
git add package.json package-lock.json
git commit -m "fix(deps): instalar @expo/vector-icons (SDK 54) — desbloqueia boot da navegação"
```

---

## Task 8: Reescrever `sound.ts` contra a API atual do `expo-audio@1.1.1`

**Files:**
- Rewrite: `src/services/sound.ts`

**Interfaces:**
- Consumes (confirmado em `node_modules/expo-audio/build/ExpoAudio.d.ts` e `AudioModule.types.d.ts`):
  - `createAudioPlayer(source?, options?): AudioPlayer` (síncrono).
  - `setAudioModeAsync(mode: Partial<AudioMode>): Promise<void>` — `AudioMode` tem `playsInSilentMode: boolean` e `shouldRouteThroughEarpiece: boolean` (os antigos `playsInSilentModeIOS`/`shouldDuckAndroid` **não existem mais**).
  - `AudioPlayer` (tipo) com métodos `play(): void`, `pause(): void`, `seekTo(seconds): Promise<void>`, `remove(): void` (descarte — **não há `release()`**; usar `remove()`).
  - `SOUND_ASSETS` de `../constants/assets` (hoje é `Record<string, any> = {}` vazio — `preload` itera sem efeito até existirem assets; `play`/`stop` no-op por ausência de player).
- Produces: `SoundService` (`preload`/`play`/`stop`/`unload`) + exports de compat `preloadSounds`, `playSound`, `stopSound`, `unloadSounds` (mesma superfície de hoje, `sound.ts:70-74`).

> Erro: `sound.ts(1,10)` TS2305 — `'expo-audio'` não exporta `Audio`. `sound.ts` não roda em teste (mapeado para o stub vazio em ambos os configs), então não há teste unit; a validação é `tsc` + boot real (Task 12).

- [ ] **Step 1: Confirmar o erro e a API real**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep "sound.ts"
cd /root/rodrigo/idle_rpg && grep -nE "createAudioPlayer|setAudioModeAsync" node_modules/expo-audio/build/ExpoAudio.d.ts | head
cd /root/rodrigo/idle_rpg && grep -nE "play\(|pause\(|seekTo|remove\(" node_modules/expo-audio/build/AudioModule.types.d.ts | head
```
Expected: `sound.ts(1,10): error TS2305`; confirma `createAudioPlayer`/`setAudioModeAsync` exportados e os métodos `play/pause/seekTo/remove` no `AudioPlayer`.

- [ ] **Step 2: Reescrever `src/services/sound.ts`**

Substituir o conteúdo completo do arquivo por:
```ts
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { SOUND_ASSETS } from '../constants/assets';

type SoundKey = keyof typeof SOUND_ASSETS;

const players: Partial<Record<string, AudioPlayer>> = {};

export const SoundService = {
  async preload(): Promise<void> {
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldRouteThroughEarpiece: false });
    } catch (error) {
      console.warn('SoundService: Could not set audio mode', error);
    }
    for (const [key, asset] of Object.entries(SOUND_ASSETS)) {
      try {
        players[key] = createAudioPlayer(asset);
      } catch (error) {
        console.warn(`SoundService: Failed to preload ${key}`, error);
      }
    }
  },

  play(key: SoundKey): void {
    const player = players[key as string];
    if (!player) return;
    try {
      player.seekTo(0);
      player.play();
    } catch (error) {
      console.warn(`SoundService: Error playing ${String(key)}`, error);
    }
  },

  stop(key: SoundKey): void {
    players[key as string]?.pause();
  },

  unload(): void {
    for (const player of Object.values(players)) {
      try {
        player?.remove();
      } catch {
        // ignore
      }
    }
  },
};

// Backward compatibility exports
export const preloadSounds = SoundService.preload;
export const playSound = (key: any) => SoundService.play(String(key).toUpperCase());
export const stopSound = (key: any) => SoundService.stop(String(key).toUpperCase());
export const unloadSounds = SoundService.unload;
```

- [ ] **Step 3: Confirmar o erro sumiu — `tsc` zerado**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep "sound.ts" ; echo "exit:$?"
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: sem saída (`exit:1`); **contagem total = 0** (gate binário do objetivo 1 atingido).

- [ ] **Step 4: Confirmar que `sound.ts` importa só símbolos existentes (sem `Audio`)**

Run:
```bash
cd /root/rodrigo/idle_rpg && grep -n "Audio" src/services/sound.ts ; echo "exit:$?"
```
Expected: sem saída (`exit:1`) — nenhuma referência a `Audio`.

- [ ] **Step 5: Rodar a suíte (sound usa stub vazio — não deve quebrar nada)**

Run:
```bash
cd /root/rodrigo/idle_rpg && npm test 2>&1 | grep -E "Test Suites:|Tests:" | head -2
```
Expected: verde.

- [ ] **Step 6: Commit**

```bash
cd /root/rodrigo/idle_rpg
git add src/services/sound.ts
git commit -m "fix(sound): migrar para expo-audio atual (createAudioPlayer/setAudioModeAsync) — tsc 0 erros"
```

---

## Task 9: Bug de gold offline — unificar missão em `startedAt + durationMs` (TDD)

**Files:**
- Modify: `src/constants/weeklyBosses.ts` (exportar `bossToMissionTemplate`)
- Modify: `src/context/tickHandler.ts` (`:35-47` deixar de definir local; importar de `weeklyBosses`)
- Modify: `src/utils/offlineProgress.ts` (`:8-9` imports; bloco `:138-189`)
- Create: `src/__tests__/utils/offlineProgress.mission.test.ts`

**Interfaces:**
- Consumes: `MISSIONS` (`src/constants/missions.ts`), `WEEKLY_BOSS_POOL` + novo export `bossToMissionTemplate` (`src/constants/weeklyBosses.ts`), `calcMissionReward` (`src/utils/missionMath.ts`), `MAX_OFFLINE_MS`/`TICK_INTERVAL_MS` (`src/constants/game.ts`), `ActiveMission`/`HeroTask` (`src/types`).
- Produces: `export function bossToMissionTemplate(boss: WeeklyBossTemplate): MissionTemplate` em `weeklyBosses.ts`; `offlineProgress.ts` credita gold por `startedAt + durationMs + cap`, sem ler `remainingMs`.

> O motor vivo cria `ActiveMission` com `startedAt` + `precomputedOutcome`, **nunca** `remainingMs` (campo legado, `ActiveMission.remainingMs?` em `types/index.ts:153`). O bloco offline atual (`:140`) lê `m.remainingMs` → fica `undefined` → empurra a missão de volta → **zero gold**. Esta task espelha a semântica do tick.
> `WeeklyBossTemplate.enemies` exige `count: number` (obrigatório), compatível com `MissionTemplate.enemies` cujo `count?` é opcional — a atribuição `enemies: boss.enemies` é válida (já é assim no `bossToMissionTemplate` local de `tickHandler.ts:35`).

### Sub-passo A — extrair `bossToMissionTemplate` para `weeklyBosses.ts`

- [ ] **Step 1: Exportar `bossToMissionTemplate` em `src/constants/weeklyBosses.ts`**

No fim de `src/constants/weeklyBosses.ts` (após `getWeeklyBoss`, `:80-83`), adicionar:
```ts
/** Converte um boss semanal em MissionTemplate para reuso no tick e no offline. */
export function bossToMissionTemplate(boss: WeeklyBossTemplate): MissionTemplate {
  return {
    id: boss.id,
    name: boss.bossName,
    minHeroes: boss.minHeroes,
    durationMs: boss.durationMs,
    rewardMin: boss.rewardMin,
    rewardMax: boss.rewardMax,
    statWeights: boss.statWeights,
    difficulty: boss.difficulty,
    enemies: boss.enemies,
  };
}
```

- [ ] **Step 2: Remover a definição local em `tickHandler.ts` e importar de `weeklyBosses`**

Em `src/context/tickHandler.ts`, na linha 30, substituir:
```ts
import { getWeeklyBoss, WeeklyBossTemplate, WEEKLY_BOSS_POOL } from '../constants/weeklyBosses';
```
por:
```ts
import { getWeeklyBoss, WeeklyBossTemplate, WEEKLY_BOSS_POOL, bossToMissionTemplate } from '../constants/weeklyBosses';
```
E **remover** a função local `bossToMissionTemplate` (`tickHandler.ts:35-47`):
```ts
function bossToMissionTemplate(boss: WeeklyBossTemplate): MissionTemplate {
  return {
    id: boss.id,
    name: boss.bossName,
    minHeroes: boss.minHeroes,
    durationMs: boss.durationMs,
    rewardMin: boss.rewardMin,
    rewardMax: boss.rewardMax,
    statWeights: boss.statWeights,
    difficulty: boss.difficulty,
    enemies: boss.enemies,
  };
}
```
(`WeeklyBossTemplate` continua importado e usado na assinatura de `getWeeklyBoss`/outras refs; `MissionTemplate` continua importado de `../constants/missions:31`.)

- [ ] **Step 3: `tsc` + suíte verde após a relocação**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -c "error TS"
cd /root/rodrigo/idle_rpg && npm test 2>&1 | grep -E "Test Suites:|Tests:" | head -2
```
Expected: `0` erros; suíte verde (a relocação não muda comportamento do tick — mesma lógica).

- [ ] **Step 4: Commit da extração**

```bash
cd /root/rodrigo/idle_rpg
git add src/constants/weeklyBosses.ts src/context/tickHandler.ts
git commit -m "refactor(boss): exportar bossToMissionTemplate de weeklyBosses para reuso no offline"
```

### Sub-passo B — testes do novo bloco offline (falhando)

- [ ] **Step 5: Criar `src/__tests__/utils/offlineProgress.mission.test.ts` com testes falhando**

```ts
import { calculateOfflineProgress } from '../../utils/offlineProgress';
import { GameState, HeroTask, ActiveMission, Hero } from '../../types';
import { MISSIONS } from '../../constants/missions';
import { WEEKLY_BOSS_POOL } from '../../constants/weeklyBosses';
import { MAX_OFFLINE_MS } from '../../constants/game';

const TPL = MISSIONS.find((m) => m.id === 'mission_1')!; // durationMs 10_000
const DUR = TPL.durationMs;

function makeHero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 'h1',
    name: 'Test',
    hpMax: 50,
    hpCurrent: 50,
    atk: 10,
    mp: 5,
    defense: 5,
    crit: 10,
    agility: 5,
    currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
    ...overrides,
  };
}

function makeMission(overrides: Partial<ActiveMission> = {}): ActiveMission {
  return {
    id: 'm1',
    templateId: 'mission_1',
    heroIds: ['h1'],
    startedAt: 0,
    looping: false,
    scheduledActions: [],
    enemiesState: [],
    precomputedOutcome: {
      reward: 100,
      rounds: 1,
      actions: [],
      log: [],
      success: true,
      casualties: [],
      enemyCasualties: 0,
    },
    ...overrides,
  };
}

/** Monta um GameState salvo `elapsedSinceStartMs` atrás, com a missão iniciada em `startedAt`. */
function makeState(opts: {
  elapsedSinceSavedMs: number;
  mission: ActiveMission;
  heroes?: Hero[];
}): GameState {
  const now = Date.now();
  return {
    gold: 0,
    heroes: opts.heroes ?? [makeHero()],
    heroesRecruited: 1,
    lastSavedAt: now - opts.elapsedSinceSavedMs,
    activeMissions: [opts.mission],
  };
}

describe('calculateOfflineProgress — missões (startedAt + durationMs)', () => {
  test('loop, 1 ciclo: credita reward, herói segue em MISSION, startedAt re-armado', () => {
    const now = Date.now();
    // missão iniciada DUR antes do save; save 1ms atrás → nowOffline ≈ startedAt + DUR
    const startedAt = now - 1 - DUR;
    const mission = makeMission({ looping: true, startedAt });
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: 1 + DUR, mission }))!;
    expect(summary.goldGained).toBe(100);
    const newMission = summary.newState!.activeMissions![0];
    expect(newMission).toBeDefined();
    expect(summary.newState!.heroes[0].currentTask).toBe(HeroTask.MISSION);
    expect(newMission.startedAt).toBeGreaterThan(startedAt); // re-armado
  });

  test('loop, N ciclos: 3.5*DUR decorridos → 3*reward, leftover ~0.5*DUR', () => {
    const now = Date.now();
    const elapsed = Math.floor(3.5 * DUR);
    const startedAt = now - elapsed;
    const mission = makeMission({ looping: true, startedAt });
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: elapsed, mission }))!;
    expect(summary.goldGained).toBe(300); // 3 ciclos completos
  });

  test('não-loop, completa: credita 1x reward, herói volta a IDLE, missão sai de activeMissions', () => {
    const now = Date.now();
    const startedAt = now - 1 - DUR;
    const mission = makeMission({ looping: false, startedAt });
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: 1 + DUR, mission }))!;
    expect(summary.goldGained).toBe(100);
    expect(summary.newState!.activeMissions!.length).toBe(0);
    expect(summary.newState!.heroes[0].currentTask).toBe(HeroTask.IDLE);
  });

  test('em andamento: elapsed < DUR → gold 0, missão intacta com startedAt preservado', () => {
    const now = Date.now();
    const startedAt = now - Math.floor(DUR / 2);
    const mission = makeMission({ looping: true, startedAt });
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: Math.floor(DUR / 2), mission }));
    // ticks > 0 garantido porque elapsedSinceSaved = DUR/2 = 5000ms >> tickInterval 500ms
    expect(summary!.goldGained).toBe(0);
    expect(summary!.newState!.activeMissions![0].startedAt).toBe(startedAt);
  });

  test('cap 72h: 100h decorridas em loop → ciclos contados sobre MAX_OFFLINE_MS, não sobre 100h', () => {
    const now = Date.now();
    const hundredHours = 100 * 60 * 60 * 1000;
    const startedAt = now - hundredHours;
    const mission = makeMission({ looping: true, startedAt });
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: hundredHours, mission }))!;
    const cappedCycles = Math.floor(MAX_OFFLINE_MS / DUR);
    expect(summary.goldGained).toBe(100 * cappedCycles);
  });

  test('save do motor novo (sem remainingMs, só startedAt + precomputedOutcome) → gold creditado (regressão do bug 1.2)', () => {
    const now = Date.now();
    const startedAt = now - 1 - DUR;
    const mission = makeMission({ looping: false, startedAt });
    expect((mission as any).remainingMs).toBeUndefined();
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: 1 + DUR, mission }))!;
    expect(summary.goldGained).toBe(100);
  });

  test('split per-hero: reward 100 / 2 heróis → floor(50) por herói em perHeroGold', () => {
    const now = Date.now();
    const startedAt = now - 1 - DUR;
    const heroes = [makeHero({ id: 'h1' }), makeHero({ id: 'h2' })];
    const mission = makeMission({ looping: false, startedAt, heroIds: ['h1', 'h2'] });
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: 1 + DUR, mission, heroes }))!;
    expect(summary.newState!.perHeroGold!['h1']).toBe(50);
    expect(summary.newState!.perHeroGold!['h2']).toBe(50);
  });

  test('fonte do reward: usa precomputedOutcome.reward quando presente', () => {
    const now = Date.now();
    const startedAt = now - 1 - DUR;
    const mission = makeMission({
      looping: false,
      startedAt,
      precomputedOutcome: {
        reward: 777, rounds: 1, actions: [], log: [], success: true, casualties: [], enemyCasualties: 0,
      },
    });
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: 1 + DUR, mission }))!;
    expect(summary.goldGained).toBe(777);
  });

  test('fonte do reward: sem precomputedOutcome cai no fallback calcMissionReward (> 0)', () => {
    const now = Date.now();
    const startedAt = now - 1 - DUR;
    const mission = makeMission({ looping: false, startedAt, precomputedOutcome: undefined });
    const summary = calculateOfflineProgress(makeState({ elapsedSinceSavedMs: 1 + DUR, mission }))!;
    expect(summary.goldGained).toBeGreaterThan(0);
  });

  test('boss semanal: templateId só em WEEKLY_BOSS_POOL, isWeeklyBoss true → resolve via bossToMissionTemplate, credita gold, herói a IDLE', () => {
    const boss = WEEKLY_BOSS_POOL[0]; // wb_hydra, durationMs 180_000, minHeroes 4
    const now = Date.now();
    const startedAt = now - 1 - boss.durationMs;
    const heroes = ['h1', 'h2', 'h3', 'h4'].map((id) => makeHero({ id }));
    const mission = makeMission({
      templateId: boss.id,
      isWeeklyBoss: true,
      looping: false,
      startedAt,
      heroIds: ['h1', 'h2', 'h3', 'h4'],
      precomputedOutcome: {
        reward: 300, rounds: 1, actions: [], log: [], success: true, casualties: [], enemyCasualties: 0,
      },
    });
    const summary = calculateOfflineProgress(
      makeState({ elapsedSinceSavedMs: 1 + boss.durationMs, mission, heroes })
    )!;
    expect(summary.goldGained).toBe(300);
    expect(summary.newState!.activeMissions!.length).toBe(0);
    expect(summary.newState!.heroes[0].currentTask).toBe(HeroTask.IDLE);
  });
});
```

- [ ] **Step 6: Rodar e verificar que FALHA (bug ainda presente)**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx jest --config jest.unit.config.js src/__tests__/utils/offlineProgress.mission.test.ts 2>&1 | tail -25
```
Expected: FALHA — a maioria dos casos com `goldGained === 0` (motor novo não grava `remainingMs`; o bloco atual empurra a missão de volta). Confirma que o teste roda contra o código quebrado.

### Sub-passo C — reescrever o bloco offline

- [ ] **Step 7: Atualizar imports em `offlineProgress.ts`**

Em `src/utils/offlineProgress.ts`, substituir as linhas 8-9:
```ts
import { MISSIONS } from '../constants/missions';
import { calcMissionReward } from './missionMath';
```
por:
```ts
import { MISSIONS } from '../constants/missions';
import { WEEKLY_BOSS_POOL, bossToMissionTemplate } from '../constants/weeklyBosses';
import { calcMissionReward } from './missionMath';
```

- [ ] **Step 8: Reescrever o bloco de missões (`:138-189`)**

Em `src/utils/offlineProgress.ts`, substituir o bloco completo (`:138-189`):
```ts
  if (savedState.activeMissions && savedState.activeMissions.length > 0) {
    savedState.activeMissions.forEach((m: any) => {
      const remaining = typeof m.remainingMs === 'number' ? m.remainingMs - ticks * tickInterval : undefined;

      if (typeof remaining === 'number' && remaining <= 0) {
        const template = MISSIONS.find((t) => t.id === m.templateId);
        if (template) {
          const heroesForMission = newHeroes.filter((h) => m.heroIds.includes(h.id));
          const reward = calcMissionReward(template, heroesForMission, {
            healerBuffMultiplier: m.healerBuffMultiplier,
            rogueRngBonus: m.rogueRngBonus,
          });

          if (m.looping) {
            // For looping missions: calculate how many full cycles completed offline
            const timeForFirstCompletion = Math.abs(remaining); // time past first completion
            const cyclesAfterFirst = template.durationMs > 0 ? Math.floor(timeForFirstCompletion / template.durationMs) : 0;
            const totalCycles = 1 + cyclesAfterFirst;
            const totalReward = reward * totalCycles;
            additionalGold += totalReward;

            const n = m.heroIds.length || 1;
            const per = Math.floor(totalReward / n);
            m.heroIds.forEach((hid: string) => {
              perHeroGold[hid] = (perHeroGold[hid] || 0) + per;
            });

            // Keep mission active and looping with remaining time into the next cycle
            const leftoverMs = template.durationMs > 0
              ? template.durationMs - (timeForFirstCompletion % template.durationMs)
              : 0;
            newActiveMissions.push({
              ...m,
              remainingMs: leftoverMs > 0 ? leftoverMs : template.durationMs,
            });
          } else {
            additionalGold += reward;

            const n = m.heroIds.length || 1;
            const per = Math.floor(reward / n);
            m.heroIds.forEach((hid: string) => {
              const idx = newHeroes.findIndex((hh) => hh.id === hid);
              if (idx >= 0) newHeroes[idx] = { ...newHeroes[idx], currentTask: HeroTask.IDLE };
              perHeroGold[hid] = (perHeroGold[hid] || 0) + per;
            });
          }
        }
      } else {
        newActiveMissions.push(typeof remaining === 'number' ? { ...m, remainingMs: remaining } : { ...m });
      }
    });
  }
```
por:
```ts
  if (savedState.activeMissions && savedState.activeMissions.length > 0) {
    const nowOffline = savedAt + cappedMs; // "agora" limitado pelo cap de 72h

    savedState.activeMissions.forEach((m: any) => {
      // Resolução de template idêntica ao tick online (missão normal ou boss semanal)
      let template = MISSIONS.find((t) => t.id === m.templateId);
      if (!template && m.isWeeklyBoss) {
        const boss = WEEKLY_BOSS_POOL.find((b) => b.id === m.templateId);
        if (boss) template = bossToMissionTemplate(boss);
      }
      if (!template || template.durationMs <= 0) {
        newActiveMissions.push({ ...m });
        return;
      }

      const startedAt = m.startedAt;
      const endsAt = startedAt + template.durationMs;

      if (nowOffline < endsAt) {
        // ainda em andamento → mantém intacta (startedAt preservado)
        newActiveMissions.push({ ...m });
        return;
      }

      // completou >= 1 ciclo offline — reward espelha o tick online
      const heroesForMission = newHeroes.filter((h) => m.heroIds.includes(h.id));
      const reward = m.precomputedOutcome?.reward
        ?? calcMissionReward(template, heroesForMission, {
          healerBuffMultiplier: m.healerBuffMultiplier,
          rogueRngBonus: m.rogueRngBonus,
        });

      const n = m.heroIds.length || 1;
      const creditPerHero = (total: number) => {
        const per = Math.floor(total / n);
        m.heroIds.forEach((hid: string) => {
          perHeroGold[hid] = (perHeroGold[hid] || 0) + per;
        });
      };

      if (m.looping) {
        const totalElapsed = nowOffline - startedAt;
        const cycles = Math.floor(totalElapsed / template.durationMs); // >= 1
        const total = reward * cycles;
        creditPerHero(total);
        additionalGold += total;
        // re-armar: novo startedAt alinhado ao último ciclo (espelha o tick online)
        const leftover = totalElapsed % template.durationMs;
        newActiveMissions.push({ ...m, startedAt: nowOffline - leftover });
      } else {
        creditPerHero(reward);
        additionalGold += reward;
        // missão não-loop encerra: heróis voltam a IDLE, não re-empurra a missão
        m.heroIds.forEach((hid: string) => {
          const idx = newHeroes.findIndex((hh) => hh.id === hid);
          if (idx >= 0) newHeroes[idx] = { ...newHeroes[idx], currentTask: HeroTask.IDLE };
        });
      }
    });
  }
```

- [ ] **Step 9: Rodar os testes da Task 9 — devem PASSAR**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx jest --config jest.unit.config.js src/__tests__/utils/offlineProgress.mission.test.ts 2>&1 | tail -15
```
Expected: PASS (11 testes).

- [ ] **Step 10: Confirmar que `remainingMs` não é mais lido em `offlineProgress.ts` e `tsc`/suíte verdes**

Run:
```bash
cd /root/rodrigo/idle_rpg && grep -n "remainingMs" src/utils/offlineProgress.ts ; echo "exit:$?"
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -c "error TS"
cd /root/rodrigo/idle_rpg && npm test 2>&1 | grep -E "Test Suites:|Tests:" | head -2
```
Expected: grep sem saída (`exit:1`); `0` erros de `tsc`; suíte verde.

- [ ] **Step 11: Commit**

```bash
cd /root/rodrigo/idle_rpg
git add src/utils/offlineProgress.ts src/__tests__/utils/offlineProgress.mission.test.ts
git commit -m "fix(offline): creditar gold de missão por startedAt+durationMs+cap — corrige bug de remainingMs morto"
```

---

## Task 10: Persistência robusta — backup, `CorruptSaveError`, `validateShape`, migração v9 (TDD)

**Files:**
- Modify: `src/services/storage.ts` (`CURRENT_VERSION:5`; `save:110-121`; `load:124-137`; migração; novos exports)
- Modify: `src/context/gameReducer.ts` (`LOAD_STATE:107`; import de `validateShape`)
- Create: `src/__tests__/services/storage.persistence.test.ts`

**Interfaces:**
- Consumes: `AsyncStorage` (mock in-memory real `jest-mocks/async-storage-mock.js`), `GameState` (`src/types`), `applyMigrations` (interno a `storage.ts`).
- Produces:
  - `export class CorruptSaveError extends Error {}`
  - `export function validateShape(state: any): GameState` — lança se inválido; retorna `state` se ok.
  - `StorageService.load(): Promise<GameState | null>` — `null` só para "sem save"; corrupção lança `CorruptSaveError` (tentando `.bak` antes).
  - `StorageService.save` grava `BACKUP_KEY` com o save anterior antes de sobrescrever `STORAGE_KEY`.
  - `CURRENT_VERSION = 9` com migração `9` que descarta `remainingMs` e garante `startedAt`.
  - `gameReducer` `LOAD_STATE` chama `validateShape` (fallback para `state` atual se inválido).

> A persistência não tem teste hoje. TDD aqui é viável porque o mock de AsyncStorage é in-memory real (sem stub de retorno fixo — respeita "integração > mock").

### Sub-passo A — testes (falhando)

- [ ] **Step 1: Criar `src/__tests__/services/storage.persistence.test.ts` com testes falhando**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService, CorruptSaveError, validateShape } from '../../services/storage';
import { GameState, HeroTask, Hero } from '../../types';

const STORAGE_KEY = '@idle_rpg_game_state';
const BACKUP_KEY = '@idle_rpg_game_state.bak';

function makeHero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 'h1', name: 'T', hpMax: 50, hpCurrent: 50, atk: 10, mp: 5,
    defense: 5, crit: 10, agility: 5, currentTask: HeroTask.IDLE,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { gold: 10, heroes: [makeHero()], heroesRecruited: 1, lastSavedAt: Date.now(), ...overrides };
}

describe('StorageService — persistência robusta', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('sem save: load() retorna null', async () => {
    const result = await StorageService.load();
    expect(result).toBeNull();
  });

  test('corrompido: JSON truncado → load() lança CorruptSaveError (não retorna null)', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{trunc');
    await expect(StorageService.load()).rejects.toBeInstanceOf(CorruptSaveError);
  });

  test('backup recupera: principal corrompido + .bak válido v8 → load() retorna estado do backup', async () => {
    const valid = { ...makeState({ gold: 999 }), _version: 8, lastSavedAt: Date.now() };
    await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify(valid));
    await AsyncStorage.setItem(STORAGE_KEY, '{trunc');
    const loaded = await StorageService.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.gold).toBe(999);
  });

  test('backup escrito no save: dois save() consecutivos → .bak contém o penúltimo JSON', async () => {
    await StorageService.save(makeState({ gold: 1 }));
    await StorageService.save(makeState({ gold: 2 }));
    const bak = await AsyncStorage.getItem(BACKUP_KEY);
    expect(bak).not.toBeNull();
    expect(JSON.parse(bak!).gold).toBe(1);
  });

  test('migração v9: save v8 com remainingMs → após load(), missão sem remainingMs e com startedAt', async () => {
    const started = 123456;
    const v8 = {
      ...makeState(),
      _version: 8,
      activeMissions: [{ id: 'm1', templateId: 'mission_1', heroIds: ['h1'], remainingMs: 5000, startedAt: started }],
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(v8));
    const loaded = await StorageService.load();
    const mission: any = loaded!.activeMissions![0];
    expect(mission.remainingMs).toBeUndefined();
    expect(mission.startedAt).toBe(started);
  });

  test('migração v9: missão sem startedAt ganha startedAt numérico', async () => {
    const v8 = {
      ...makeState(),
      _version: 8,
      activeMissions: [{ id: 'm1', templateId: 'mission_1', heroIds: ['h1'], remainingMs: 1000 }],
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(v8));
    const loaded = await StorageService.load();
    const mission: any = loaded!.activeMissions![0];
    expect(typeof mission.startedAt).toBe('number');
    expect(mission.remainingMs).toBeUndefined();
  });

  test('validateShape rejeita: heroes não-array → corrupção (load lança)', async () => {
    const bad = { gold: 10, heroes: 'nope', heroesRecruited: 0, lastSavedAt: Date.now(), _version: 9 };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bad));
    await expect(StorageService.load()).rejects.toBeInstanceOf(CorruptSaveError);
  });

  test('validateShape aceita estado válido e o retorna', () => {
    const s = makeState();
    expect(validateShape(s)).toBe(s);
  });
});
```

- [ ] **Step 2: Rodar e verificar FALHA (símbolos ausentes)**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx jest --config jest.unit.config.js src/__tests__/services/storage.persistence.test.ts 2>&1 | tail -20
```
Expected: FALHA — `CorruptSaveError`/`validateShape` ainda não são exportados de `storage.ts`; vários casos quebram. Confirma que o teste roda antes da implementação.

### Sub-passo B — implementação

- [ ] **Step 3: Reescrever `src/services/storage.ts`**

Substituir o conteúdo completo do arquivo por:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameState } from '../types';

const STORAGE_KEY = '@idle_rpg_game_state';
const BACKUP_KEY = '@idle_rpg_game_state.bak';
const CURRENT_VERSION = 9; // Incremented for migrations

interface SaveData extends GameState {
  _version: number;
  lastSavedAt: number;
}

/** Lançada quando um save existe mas não pôde ser lido/validado — distinto de "sem save" (null). */
export class CorruptSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CorruptSaveError';
  }
}

/**
 * Migration functions for different versions.
 * Each function transforms data from version (N-1) to version N.
 */
const migrations: Record<number, (data: any) => any> = {
  2: (data) => {
    if (data && Array.isArray(data.heroes)) {
      data.heroes = data.heroes.map((h: any) => ({
        trainingProgressMs: h.trainingProgressMs ?? { hp: 0, atk: 0, mp: 0 },
        trainingCount: h.trainingCount ?? { hp: 0, atk: 0, mp: 0 },
        ...h,
      }));
    }
    data.perHeroGold = data.perHeroGold ?? {};
    return data;
  },
  3: (data) => {
    if (data && Array.isArray(data.heroes)) {
      data.heroes = data.heroes.map((h: any) => ({
        ...h,
        hpCurrent: h.hpCurrent ?? h.hpMax ?? h.hp ?? 0,
        hpRegenProgressMs: h.hpRegenProgressMs ?? 0,
      }));
    }
    return data;
  },
  4: (data) => {
    if (data && Array.isArray(data.heroes)) {
      data.heroes = data.heroes.map((h: any) => ({
        ...h,
        trainingProgressMs: { hp: 0, atk: 0, mp: 0, ...(h.trainingProgressMs ?? {}) },
        trainingCount: { hp: 0, atk: 0, mp: 0, ...(h.trainingCount ?? {}) },
      }));
    }
    return data;
  },
  5: (data) => {
    data.inventory = data.inventory ?? [];
    data.forgingQueue = data.forgingQueue ?? [];
    if (data && Array.isArray(data.heroes)) {
      data.heroes = data.heroes.map((h: any) => ({ ...h, equippedItems: h.equippedItems ?? [] }));
    }
    return data;
  },
  6: (data) => {
    if (data && Array.isArray(data.heroes)) {
      for (const hero of data.heroes) {
        if (hero.stars === undefined) hero.stars = 0;
      }
    }
    if (data.pantheonFusions === undefined) data.pantheonFusions = 0;
    return data;
  },
  7: (data) => data,
  8: (data) => {
    if (data.materials === undefined) data.materials = {};
    return data;
  },
  9: (data) => {
    // Version 9: remove o campo legado remainingMs e garante startedAt nas missões ativas
    if (Array.isArray(data.activeMissions)) {
      data.activeMissions = data.activeMissions.map((m: any) => {
        const { remainingMs, ...rest } = m;
        return { ...rest, startedAt: typeof rest.startedAt === 'number' ? rest.startedAt : Date.now() };
      });
    }
    return data;
  },
};

function applyMigrations(data: any): GameState {
  let version = data._version || 1;
  while (version < CURRENT_VERSION) {
    version++;
    if (migrations[version]) {
      if (__DEV__) console.log(`Applying storage migration to version ${version}`);
      data = migrations[version](data);
    }
  }
  data._version = version;
  return data as GameState;
}

/**
 * Validação mínima de shape. Lança se o estado for estruturalmente inválido.
 * Compartilhada entre load() e o LOAD_STATE do reducer.
 */
export function validateShape(state: any): GameState {
  if (!state || typeof state !== 'object') throw new Error('estado não é objeto');
  if (typeof state.gold !== 'number') throw new Error('gold inválido');
  if (!Array.isArray(state.heroes)) throw new Error('heroes não é array');
  for (const h of state.heroes) {
    if (typeof h?.id !== 'string') throw new Error('hero.id inválido');
    if (typeof h.hpMax !== 'number') throw new Error('hero.hpMax inválido');
    if (typeof h.atk !== 'number') throw new Error('hero.atk inválido');
  }
  return state as GameState;
}

export const StorageService = {
  /** Salva o estado do jogo, mantendo backup do save válido anterior. */
  async save(state: GameState): Promise<void> {
    try {
      const saveData: SaveData = { ...state, _version: CURRENT_VERSION, lastSavedAt: Date.now() };
      const prev = await AsyncStorage.getItem(STORAGE_KEY);
      if (prev) await AsyncStorage.setItem(BACKUP_KEY, prev);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    } catch (error) {
      if (__DEV__) console.error('StorageService: Erro ao salvar estado:', error);
    }
  },

  /**
   * Carrega o estado. Retorna null APENAS quando não há save.
   * Save existente mas ilegível → tenta o backup; se também falhar, lança CorruptSaveError.
   */
  async load(): Promise<GameState | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    try {
      return validateShape(applyMigrations(JSON.parse(raw)));
    } catch (e) {
      const bak = await AsyncStorage.getItem(BACKUP_KEY);
      if (bak) {
        try {
          return validateShape(applyMigrations(JSON.parse(bak)));
        } catch {
          // backup também inválido — segue para lançar
        }
      }
      throw new CorruptSaveError(String(e));
    }
  },

  /** Limpa o estado do jogo salvo (mantém o backup intacto). */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      if (__DEV__) console.error('StorageService: Erro ao limpar estado:', error);
    }
  },
};

// Deprecated functions for backward compatibility with existing imports
export const saveGameState = StorageService.save;
export const loadGameState = StorageService.load;
export const clearGameState = StorageService.clear;
```

- [ ] **Step 4: Rodar os testes de persistência — devem PASSAR**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx jest --config jest.unit.config.js src/__tests__/services/storage.persistence.test.ts 2>&1 | tail -15
```
Expected: PASS (8 testes).

- [ ] **Step 5: `LOAD_STATE` no reducer valida shape (fallback para `state` atual)**

Em `src/context/gameReducer.ts`, na linha 1, adicionar o import de `validateShape`:
```ts
import { GameState, GameAction } from '../types';
import { validateShape } from '../services/storage';
```
E substituir o `case 'LOAD_STATE'` (`:106-107`):
```ts
    case 'LOAD_STATE':
      return { ...action.state };
```
por:
```ts
    case 'LOAD_STATE':
      try {
        return validateShape({ ...action.state });
      } catch {
        return state; // estado inválido não derruba o reducer
      }
```

- [ ] **Step 6: `tsc` + suíte completa verdes**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -c "error TS"
cd /root/rodrigo/idle_rpg && npm test 2>&1 | grep -E "Test Suites:|Tests:" | head -2
```
Expected: `0` erros; suíte verde.

- [ ] **Step 7: Commit**

```bash
cd /root/rodrigo/idle_rpg
git add src/services/storage.ts src/context/gameReducer.ts src/__tests__/services/storage.persistence.test.ts
git commit -m "feat(persist): backup .bak, CorruptSaveError, validateShape e migração v9 (descarta remainingMs)"
```

---

## Task 11: Integração offline reescrita + `CorruptSaveError` no boot + coverageThreshold

**Files:**
- Modify: `src/context/GameContext.tsx` (`initialize:72-91`; usa `StorageService`/`CorruptSaveError`/`emit`)
- Rewrite: `src/__tests__/context/gameContext.offline.test.tsx`
- Modify: `jest.unit.config.js` (remover ignore do teste; `collectCoverage`/`coverageThreshold`)
- Modify: `jest.config.js` (`coverageThreshold`)

**Interfaces:**
- Consumes: `StorageService.load`, `CorruptSaveError` (Task 10), `calculateOfflineProgress` (Task 9), `emit`/`FEEDBACK_EVENTS` (`feedback.ts`).
- Produces: boot que trata `CorruptSaveError` sem apagar progresso em silêncio (toast + começa do `initialGameState` **sem** sobrescrever o save corrompido/`.bak`); teste de integração save→offline→reload ponta a ponta com AsyncStorage real; `coverageThreshold.global.branches: 80` em ambos os configs.

> O teste atual usa `jest.mock('../../services/storage')` (mock de DB — proibido) e modelo `Hero` legado com `hp`. Será reescrito para persistir via `StorageService.save` (AsyncStorage in-memory real) e carregar via `GameProvider`.

### Sub-passo A — boot trata corrupção

- [ ] **Step 1: Tratar `CorruptSaveError` no `initialize` de `GameContext.tsx`**

Em `src/context/GameContext.tsx`, na linha 12, ampliar o import de storage:
```ts
import { loadGameState, saveGameState } from '../services/storage';
```
para:
```ts
import { loadGameState, saveGameState, CorruptSaveError } from '../services/storage';
```
E substituir o corpo de `initialize` (`:73-89`):
```ts
    async function initialize() {
      try {
      const savedState = await loadGameState();
      if (savedState) {
          const summary = calculateOfflineProgress(savedState);
          if (summary) {
            setOfflineSummary(summary);
          } else {
            dispatch({ type: 'LOAD_STATE', state: savedState });
          }
        }
      } catch (error) {
        console.error('GameProvider: Error during initialization', error);
      } finally {
        setIsLoaded(true);
      }
    }
```
por:
```ts
    async function initialize() {
      try {
        const savedState = await loadGameState();
        if (savedState) {
          const summary = calculateOfflineProgress(savedState);
          if (summary) {
            setOfflineSummary(summary);
          } else {
            dispatch({ type: 'LOAD_STATE', state: savedState });
          }
        }
      } catch (error) {
        if (error instanceof CorruptSaveError) {
          // Save ilegível: inicia do estado inicial SEM sobrescrever o save/.bak (preserva diagnóstico)
          emit(FEEDBACK_EVENTS.TOAST, {
            text: 'Save corrompido — iniciando novo jogo (backup preservado)',
            type: 'error',
          });
        } else {
          console.error('GameProvider: Error during initialization', error);
        }
      } finally {
        setIsLoaded(true);
      }
    }
```
(`emit` e `FEEDBACK_EVENTS` já estão importados em `GameContext.tsx:13`.)

### Sub-passo B — teste de integração reescrito

- [ ] **Step 2: Reescrever `src/__tests__/context/gameContext.offline.test.tsx`**

Substituir o conteúdo completo do arquivo por:
```tsx
import React from 'react';
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameProvider } from '../../context/GameContext';
import { StorageService } from '../../services/storage';
import { GameState, HeroTask, Hero, ActiveMission } from '../../types';
import { MISSIONS } from '../../constants/missions';

const TPL = MISSIONS.find((m) => m.id === 'mission_1')!; // durationMs 10_000

function makeHero(): Hero {
  return {
    id: 'h1', name: 'OfflineHero', hpMax: 50, hpCurrent: 50, atk: 10, mp: 5,
    defense: 5, crit: 10, agility: 5, currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  };
}

function makeMission(startedAt: number): ActiveMission {
  return {
    id: 'm1', templateId: 'mission_1', heroIds: ['h1'], startedAt, looping: true,
    scheduledActions: [], enemiesState: [],
    precomputedOutcome: {
      reward: 100, rounds: 1, actions: [], log: [], success: true, casualties: [], enemyCasualties: 0,
    },
  };
}

describe('GameContext — integração save → offline → reload', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('save do motor novo (sem remainingMs) credita gold de missão offline ao recarregar', async () => {
    const twoHoursMs = 1000 * 60 * 60 * 2;
    const now = Date.now();
    const savedState: GameState = {
      gold: 0,
      heroes: [makeHero()],
      heroesRecruited: 1,
      lastSavedAt: now - twoHoursMs,
      // missão iniciada 2h atrás, loop de 10s → muitos ciclos offline
      activeMissions: [makeMission(now - twoHoursMs)],
    };
    // persiste no AsyncStorage real (sem mock de retorno fixo)
    await StorageService.save(savedState);
    // StorageService.save sobrescreve lastSavedAt com Date.now(); reescrevemos para o passado:
    const raw = JSON.parse((await AsyncStorage.getItem('@idle_rpg_game_state'))!);
    raw.lastSavedAt = now - twoHoursMs;
    await AsyncStorage.setItem('@idle_rpg_game_state', JSON.stringify(raw));

    let captured: any = null;
    function Consumer() {
      const { offlineSummary: s, isLoaded } = require('../../hooks/useGame').useGame();
      if (isLoaded && s) captured = s;
      return null;
    }

    let renderer: any;
    await act(async () => {
      renderer = create(
        <GameProvider>
          <Consumer />
        </GameProvider>
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (captured) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > 5000) {
          clearInterval(interval);
          reject(new Error('Timed out waiting for offlineSummary'));
        }
      }, 50);
    });

    await act(async () => {
      renderer.unmount();
    });

    // 2h / 10s = 720 ciclos * 100 reward
    expect(captured.goldGained).toBeGreaterThan(0);
    expect(captured.newState.gold).toBeGreaterThan(0);
    expect(captured.newState.gold).toBe(captured.goldGained);
  }, 10000);
});
```

- [ ] **Step 3: Remover o ignore específico do teste em `jest.unit.config.js`**

Em `jest.unit.config.js`, no `testPathIgnorePatterns` (editado na Task 1), remover a linha:
```js
    '<rootDir>/src/__tests__/context/gameContext.offline.test.tsx',
```
mantendo `'/node_modules/'`, `'/dist/'`, `'/.worktrees/'`.

- [ ] **Step 4: Rodar o teste de integração — deve PASSAR**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx jest --config jest.unit.config.js src/__tests__/context/gameContext.offline.test.tsx 2>&1 | tail -15
```
Expected: PASS (1 teste). Cobre o objetivo 2 do roadmap (save→offline→reload credita gold).

### Sub-passo C — coverageThreshold

- [ ] **Step 5: Medir o baseline de cobertura ANTES de fixar o threshold**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx jest --config jest.unit.config.js --coverage --collectCoverageFrom='src/**/*.{ts,tsx}' --collectCoverageFrom='!src/**/*.stories.tsx' --collectCoverageFrom='!src/**/*.test.{ts,tsx}' 2>&1 | grep -E "All files|Branch" | head
```
Expected: imprime a linha `All files` com `% Branch`. **Se `% Branch` < 80**, escrever testes adicionais dos branches descobertos (priorizar `src/utils`, `src/context`, `src/services`) ANTES do Step 6; se mesmo assim não atingir 80% global, escopar o `coverageThreshold` para esses três diretórios em vez de `global` (documentar o motivo no commit). **Não** baixar abaixo de 80 sem registrar.

- [ ] **Step 6: Ligar `collectCoverage` + `coverageThreshold` em `jest.unit.config.js`**

Em `jest.unit.config.js`, adicionar ao objeto exportado (após `testPathIgnorePatterns`):
```js
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.stories.tsx',
    '!src/**/*.test.{ts,tsx}',
  ],
  coverageThreshold: { global: { branches: 80 } },
```

- [ ] **Step 7: Adicionar `coverageThreshold` em `jest.config.js`**

Em `jest.config.js`, adicionar ao objeto exportado (após `testPathIgnorePatterns`):
```js
  coverageThreshold: { global: { branches: 80 } },
```

- [ ] **Step 8: Rodar a suíte completa com cobertura — gate deve PASSAR**

Run:
```bash
cd /root/rodrigo/idle_rpg && npm test 2>&1 | grep -E "Test Suites:|Tests:|Jest: \"global\"|threshold" | head
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: suíte verde, ≤ 60 suites, sem mensagem de threshold reprovado; `0` erros de `tsc`.

- [ ] **Step 9: Commit**

```bash
cd /root/rodrigo/idle_rpg
git add jest.unit.config.js jest.config.js src/context/GameContext.tsx src/__tests__/context/gameContext.offline.test.tsx
git commit -m "test(offline): integração save→offline→reload com AsyncStorage real + coverageThreshold branches 80; boot trata CorruptSaveError"
```

---

## Task 12: `app.json` dark + checklist de boot mobile

**Files:**
- Modify: `app.json` (`userInterfaceStyle`, `splash.backgroundColor`, `android.adaptiveIcon.backgroundColor`)

**Interfaces:**
- Consumes: nada.
- Produces: `app.json` com `userInterfaceStyle: "dark"`, splash/adaptive background `#15100B` (Design Language §3.8). Não troca PNGs (isso é SPEC 2).

> Esta task fecha com validação de **boot real** no emulador (não há teste unit para `app.json`). O ciclo é: mudança → boot/screenshot → commit.

- [ ] **Step 1: Editar `app.json` — dark + background `#15100B`**

Em `app.json`, aplicar três trocas:

`userInterfaceStyle`:
```json
    "userInterfaceStyle": "light",
```
→
```json
    "userInterfaceStyle": "dark",
```

`splash.backgroundColor`:
```json
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
```
→
```json
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#15100B"
    },
```

`android.adaptiveIcon.backgroundColor`:
```json
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
```
→
```json
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#15100B"
      },
```

- [ ] **Step 2: Confirmar os valores via grep**

Run:
```bash
cd /root/rodrigo/idle_rpg && node -e "const a=require('./app.json').expo; console.log('uiStyle', a.userInterfaceStyle, '| splash', a.splash.backgroundColor, '| adaptive', a.android.adaptiveIcon.backgroundColor)"
```
Expected: `uiStyle dark | splash #15100B | adaptive #15100B`.

- [ ] **Step 3: Gates finais (tsc + suíte) antes do boot**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -c "error TS"
cd /root/rodrigo/idle_rpg && npm test 2>&1 | grep -E "Test Suites:|Tests:" | head -2
```
Expected: `0` erros; suíte verde.

- [ ] **Step 4: Boot smoke no emulador/browser (validação de UI)**

Subir o app e validar visualmente. Para web (smoke rápido via Playwright):
```bash
cd /root/rodrigo/idle_rpg && pkill -f "expo start" 2>/dev/null; nohup npx expo start --web --port 8081 > /tmp/expo-spec1.log 2>&1 & disown
```
Depois navegar com Playwright para `http://localhost:8081` e tirar screenshots. Para mobile real (recomendado): `npx expo start` (Expo Go) ou `npx eas build --profile development --platform android|ios`.

Checklist (marcar cada item após observar no device/emulador):
- [ ] Splash sem flash branco (background `#15100B`).
- [ ] 5 abas navegam; `Ionicons` renderizam (não quadrado/tofu).
- [ ] Tela de chest abre (modal centralizado, sem erro de `'fixed'`/`'84vh'`).
- [ ] 1 efeito sonoro toca (preload + play sem crash de `expo-audio`) — ou confirmar que `SOUND_ASSETS` vazio = no-op silencioso, sem crash.
- [ ] Missão em loop → app em background > `durationMs` → reabrir → gold creditado + toast de resumo offline.
- [ ] Forçar save corrompido (injetar `'{trunc'` em `@idle_rpg_game_state` via dev) → app recupera/inicia novo sem apagar progresso em silêncio (toast de save corrompido).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/idle_rpg
git add app.json
git commit -m "feat(boot): app.json dark + splash/adaptive #15100B — elimina flash branco (Design Language 3.8)"
```

---

## Verificação final

- [ ] **Step 1: `tsc` zerado**

Run:
```bash
cd /root/rodrigo/idle_rpg && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: `0` (era 17).

- [ ] **Step 2: Suíte completa verde, ≤ 60 suites, threshold passando**

Run:
```bash
cd /root/rodrigo/idle_rpg && npm test 2>&1 | grep -E "Test Suites:|Tests:|threshold" | head
```
Expected: todas verdes, ≤ 60 suites, sem reprovação de threshold.

- [ ] **Step 3: Critérios de grep do spec**

Run:
```bash
cd /root/rodrigo/idle_rpg
echo "remainingMs lido em offlineProgress:"; grep -n "remainingMs" src/utils/offlineProgress.ts; echo "exit:$?"
echo "textShadow string em components:"; grep -rn "textShadow: '" src/components; echo "exit:$?"
echo "boxShadow string em components:"; grep -rn "boxShadow: '" src/components; echo "exit:$?"
echo "Audio em sound.ts:"; grep -n "Audio" src/services/sound.ts; echo "exit:$?"
echo "@expo/vector-icons em deps:"; node -e "console.log(require('./package.json').dependencies['@expo/vector-icons'] ?? 'AUSENTE')"
```
Expected: os quatro greps sem saída (`exit:1`); `@expo/vector-icons` com versão.

- [ ] **Step 4: Smoke de regressão de batalha**

Run:
```bash
cd /root/rodrigo/idle_rpg && npm run simulate:m1 2>&1 | tail -5
```
Expected: finaliza sem erro, com log de resultado de batalha.

- [ ] **Step 5: Push**

```bash
cd /root/rodrigo/idle_rpg
git status
git push
```

---

## Resumo das decisões de design

| Decisão | Justificativa |
|---|---|
| Unificar missão offline em `startedAt + durationMs` (não reconstruir `remainingMs`) | O motor vivo já é fonte de verdade por `startedAt + elapsed` (`tickHandler.ts:158`); reintroduzir `remainingMs` duplicaria a progressão e re-criaria o campo morto que ninguém grava. |
| Reward offline via `precomputedOutcome?.reward ?? calcMissionReward` | Mesma fonte que o tick online (`tickHandler.ts:229-243`) → crédito offline bate com o que o jogador veria online. |
| `bossToMissionTemplate` extraída para `weeklyBosses.ts` | Reuso no tick e no offline sem duplicar a conversão; `weeklyBosses` não importa `tickHandler`, então não há ciclo. |
| `load()` lança `CorruptSaveError` em vez de retornar `null` | `null` significava ambiguamente "sem save" E "corrompido" → corrupção apagava progresso em silêncio. Agora são caminhos distintos. |
| `validateShape` compartilhado entre `storage` e reducer | Um único ponto de verdade de "shape mínimo válido"; `LOAD_STATE` não derruba o reducer com estado inválido. |
| Tokens `warning`/`accent` temporários (`#F59E0B`/`#A78BFA`) | Destravam `tsc` sem antecipar a paleta "Reino" do SPEC 2 (marcados `// TODO SPEC 2`). |
| `position:'absolute'` em vez de `'fixed'` no ChestRevealModal | `'fixed'` só existe na web; mobile é o alvo. Web valida visualmente que o modal ainda centraliza. |
| `sound.ts` usa `remove()` para descarte (não `release()`) | A API do `expo-audio@1.1.1` expõe `AudioPlayer.remove()`; não existe `release()`. |
| `coverageThreshold` ligado por último (Task 11) | Evita travar o ciclo TDD das tasks anteriores; baseline é medido antes de fixar 80%. |
