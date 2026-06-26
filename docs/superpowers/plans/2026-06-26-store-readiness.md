# SPEC 9 — Store Readiness — Plano de Implementação (slices codáveis)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar o que **código** pode preparar para publicação: identidade de pacote + `eas.json`, limpeza de `expo-av`, camada de **analytics com gate de consentimento LGPD** (sink plugável, no-op até aceite), instrumentação dos marcos, tela/gate de consentimento no boot, telas de Privacidade/Termos, contrato de `SOUND_KEYS`, e checklist de submissão. Tudo que é **device/externo** (EAS Build real, áudio licenciado, chave PostHog, contas de loja, keystore, arte de ícone/splash/screenshots) fica como **débito** explícito.

**Architecture:** Config estática (`app.json`/`eas.json`). Analytics vira serviço com **gate de consentimento** (flag de módulo sincronizada do estado) e **sink injetável** (default console/no-op; PostHog real = débito). Consentimento é campo opcional novo em `GameState` (migração v13) e deve bloquear emissão até decisão do jogador no 1º boot. Privacidade/Termos são telas estáticas linkadas na `SettingsScreen` (entregue pelo SPEC 8).

**Tech Stack:** TypeScript, Expo (`~54`), Jest. `expo-audio` (já migrado).

## Global Constraints

- **Analytics opt-in / consent-gated:** `analytics.track` é **no-op até consentimento explícito**. Sem aceite → zero emissão (testável). Default de `consent.analytics` = `false`/indeciso.
- **Nenhum dado a terceiro sem aceite:** o sink real (PostHog) é débito; o que entra agora é a abstração + gate. Nada de chave/SDK externo neste plano.
- **Device/externo = débito (fora do plano):** EAS Build real, arquivos de áudio licenciados, chave/SDK PostHog, contas Apple/Google, keystore, arte (ícone/splash/screenshots/feature graphic), preenchimento de formulários de loja/age rating. Registrar na Task 9.
- **Sem regressão de jogo:** nenhuma mudança de balanço/regra. `npx tsc --noEmit` → 0; suíte unit verde a cada task; 3 snapshots de combate intactos.
- **bundleId/package:** `com.v4smc.idlerpg` (imutável pós-release — o dono confirma antes do 1º submit; usado aqui como valor planejado).
- **Rodapé de commit:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Identidade de pacote (app.json) + eas.json

**Files:**
- Modify: `app.json` (`ios.bundleIdentifier`, `android.package`)
- Create: `eas.json`
- Test: `src/__tests__/config/storeConfig.test.ts`

**Interfaces:**
- Produces: `app.json` com `ios.bundleIdentifier = 'com.v4smc.idlerpg'` e `android.package = 'com.v4smc.idlerpg'`; `eas.json` com perfis `development`, `preview`, `production`.

- [ ] **Step 1: Teste falhando**

```typescript
// src/__tests__/config/storeConfig.test.ts
import app from '../../../app.json';
import eas from '../../../eas.json';

test('app.json tem identidade de pacote iOS/Android', () => {
  expect((app as any).expo.ios.bundleIdentifier).toBe('com.v4smc.idlerpg');
  expect((app as any).expo.android.package).toBe('com.v4smc.idlerpg');
  expect((app as any).expo.userInterfaceStyle).toBe('dark');
});

test('eas.json tem os 3 perfis de build', () => {
  for (const p of ['development', 'preview', 'production']) {
    expect((eas as any).build[p]).toBeDefined();
  }
});
```

> Confirme que o tsconfig permite importar JSON (`resolveJsonModule`). Se não, ajuste o teste para ler via `fs.readFileSync` + `JSON.parse` com caminho relativo ao `process.cwd()`.

- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** os campos em `app.json` e criar `eas.json`:
```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal" },
    "production": { "autoIncrement": true }
  },
  "submit": { "production": {} }
}
```
- [ ] **Step 4: Ver passar** + `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git add app.json eas.json src/__tests__/config/storeConfig.test.ts
git commit -m "feat(spec9): identidade de pacote (bundleId/package) + eas.json (3 perfis de build)"
```

---

### Task 2: Remover `expo-av` (não usado)

**Files:**
- Modify: `package.json` (remover `expo-av`)
- Test: `src/__tests__/config/noExpoAv.test.ts`

**Interfaces:**
- Consumes: confirmação de 0 imports de `expo-av` em `src/` (o áudio usa `expo-audio`).

- [ ] **Step 1: Teste falhando**

```typescript
// src/__tests__/config/noExpoAv.test.ts
import pkg from '../../../package.json';
test('expo-av não está mais nas dependências', () => {
  expect((pkg as any).dependencies['expo-av']).toBeUndefined();
});
```

- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** — ANTES de remover, rode `grep -rn "expo-av" src/` e confirme **0 imports**. Se houver algum, migre para `expo-audio` primeiro. Remova `expo-av` de `package.json` (dependencies). Rode `npm install` para atualizar o lockfile (se o ambiente permitir; senão, edite o lockfile coerentemente ou note no commit).
- [ ] **Step 4: Ver passar** + `npx tsc --noEmit` + suíte.
- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/__tests__/config/noExpoAv.test.ts
git commit -m "chore(spec9): remove expo-av não usado (áudio usa expo-audio)"
```

---

### Task 3: Estado de consentimento + migração v13

**Files:**
- Modify: `src/types/index.ts` (GameState; GameAction)
- Modify: `src/services/storage.ts` (`CURRENT_VERSION`, `migrations`)
- Test: `src/__tests__/services/storage.consent-migration.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  // GameState
  consent?: { analytics: boolean; decided: boolean; decidedAt: number };
  // GameAction
  | { type: 'SET_CONSENT'; analytics: boolean }
  ```

- [ ] **Step 1: Teste falhando**

```typescript
// src/__tests__/services/storage.consent-migration.test.ts
import { migrateState, CURRENT_VERSION } from '../../services/storage';
test('CURRENT_VERSION = 13', () => expect(CURRENT_VERSION).toBe(13));
test('save v12 migra com consentimento indeciso (analytics off)', () => {
  const old: any = { __version: 12, gold: 3, heroes: [] };
  const m = migrateState(old);
  expect(m.consent).toEqual({ analytics: false, decided: false, decidedAt: 0 });
});
```

- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** o campo `consent`, a action `SET_CONSENT`, `CURRENT_VERSION = 13` e a migration 13:
```typescript
13: (data) => {
  if (data.consent === undefined) data.consent = { analytics: false, decided: false, decidedAt: 0 };
  return data;
},
```
- [ ] **Step 4: Ver passar** + `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/services/storage.ts src/__tests__/services/storage.consent-migration.test.ts
git commit -m "feat(spec9): estado de consentimento LGPD + migração save v13 (analytics off por default)"
```

---

### Task 4: Analytics com gate de consentimento + sink injetável + eventos SPEC 9

**Files:**
- Modify: `src/services/analytics.ts`
- Modify: `src/context/gameReducer.ts` (`SET_CONSENT`)
- Test: `src/__tests__/services/analytics.consent.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type AnalyticsEvent = /* FTUE + SPEC8 + */
    | 'app_open' | 'mission_completed' | 'hero_recruited' | 'hero_fused' | 'boss_defeated' | 'equipment_crafted';
  export function setAnalyticsConsent(granted: boolean): void; // gate
  export function setAnalyticsSink(sink: (e: AnalyticsEvent, p?: Record<string, unknown>) => void): void; // injeção (PostHog real = débito)
  // analytics.track no-op enquanto consent não concedido
  ```

- [ ] **Step 1: Teste falhando**

```typescript
// src/__tests__/services/analytics.consent.test.ts
import { analytics, setAnalyticsConsent, setAnalyticsSink } from '../../services/analytics';

test('track é no-op sem consentimento', () => {
  const calls: string[] = [];
  setAnalyticsSink((e) => calls.push(e));
  setAnalyticsConsent(false);
  analytics.track('app_open');
  expect(calls).toEqual([]);
});

test('com consentimento, emite ao sink', () => {
  const calls: string[] = [];
  setAnalyticsSink((e) => calls.push(e));
  setAnalyticsConsent(true);
  analytics.track('mission_completed', { goldEarned: 10 });
  expect(calls).toEqual(['mission_completed']);
  setAnalyticsConsent(false); // restaura para não vazar a outros testes
});
```

- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** o union estendido; um `let consentGranted = false` de módulo + `setAnalyticsConsent`; um `let sink` default (`__DEV__` → console; prod → no-op) + `setAnalyticsSink`; `track` early-return se `!consentGranted`, senão chama `sink`. Adicione o case `SET_CONSENT` no reducer (seta `state.consent` + chama `setAnalyticsConsent(action.analytics)`).
- [ ] **Step 4: Ver passar** + `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git add src/services/analytics.ts src/context/gameReducer.ts src/__tests__/services/analytics.consent.test.ts
git commit -m "feat(spec9): analytics com gate de consentimento + sink injetável + eventos de marco (PostHog real = débito)"
```

---

### Task 5: Instrumentar marcos com `analytics.track`

**Files:**
- Modify: pontos de marco (ex.: `src/hooks/useGameFeedback.ts`, `src/services/milestones.ts`, e/ou os handlers de missão/recrutamento/fusão/boss/forja)
- Test: `src/__tests__/services/analytics.instrumentation.test.ts`

**Interfaces:**
- Consumes: `analytics.track`, `setAnalyticsConsent`, `setAnalyticsSink` (Task 4).
- Produces: emissão de `mission_completed`, `hero_recruited`, `hero_fused`, `boss_defeated`, `equipment_crafted`, `app_open` nos pontos certos — **sempre via o gate** (silenciosos sem consentimento).

- [ ] **Step 1: Teste falhando** — com consentimento + sink-spy, simular cada marco (chamar o ponto que dispara) e asentir que o evento correspondente foi emitido; com consentimento off, nenhum evento.
- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** as chamadas `analytics.track(...)` nos pontos de marco (reusando a detecção que já existe em `useGameFeedback`/`milestones`/handlers — não duplicar lógica de detecção). `app_open` emitido uma vez no boot (após consentimento).
- [ ] **Step 4: Ver passar** + `npx tsc --noEmit` + suíte.
- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGameFeedback.ts src/services/milestones.ts src/__tests__/services/analytics.instrumentation.test.ts
git commit -m "feat(spec9): instrumenta marcos (missão/recruta/fusão/boss/forja) via analytics consent-gated"
```

---

### Task 6: Gate de consentimento no boot

**Files:**
- Create: `src/components/ConsentGate.tsx`
- Modify: `App.tsx` (montar o gate antes do `OnboardingProvider` emitir analytics)
- Test: `src/__tests__/components/consentGate.logic.test.ts`

**Interfaces:**
- Consumes: `state.consent`, `SET_CONSENT`.
- Produces: lógica pura `needsConsentDecision(state)` (true se `!consent.decided`); o componente mostra prompt de consentimento no 1º boot (aceitar/recusar → `SET_CONSENT` + `decided: true`), e **sincroniza `setAnalyticsConsent`** ao montar com base no estado carregado.

> Visual **manual-pending**. O importante codável: o gate impede analytics até decisão e sincroniza o flag de módulo.

- [ ] **Step 1: Teste de lógica falhando** — `needsConsentDecision({consent:{decided:false}})===true`; `===false` quando decided; ao montar com `consent.analytics=true`, `setAnalyticsConsent(true)` é chamado.
- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** `needsConsentDecision` + `ConsentGate` (prompt com link às telas de Privacidade/Termos da Task 7; botões Aceitar/Recusar; texto curto e honesto sobre analytics anônimo). Montar em `App.tsx` envolvendo/precedendo o conteúdo. Sincronizar `setAnalyticsConsent` num `useEffect` quando `state.consent` carrega.
- [ ] **Step 4: Ver passar** (lógica) + `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git add src/components/ConsentGate.tsx App.tsx src/__tests__/components/consentGate.logic.test.ts
git commit -m "feat(spec9): gate de consentimento LGPD no boot (bloqueia analytics até decisão) — visual manual-pending"
```

---

### Task 7: Telas de Privacidade + Termos + links na SettingsScreen

**Files:**
- Create: `src/screens/PrivacyScreen.tsx`, `src/screens/TermsScreen.tsx`
- Create: `src/constants/legalContent.ts` (texto pt-BR de privacidade e termos)
- Modify: `src/navigation/AppNavigator.tsx` (rotas ocultas), `src/screens/VillageScreen.tsx` (entry-point) e/ou `src/screens/SettingsScreen.tsx` (links + toggle de consentimento)
- Test: `src/__tests__/screens/legal.content.test.ts`

**Interfaces:**
- Consumes: `legalContent` (texto), `SET_CONSENT` (toggle na Settings).
- Produces: telas estáticas que renderizam o texto; `SettingsScreen` ganha um toggle "Compartilhar analytics anônimo" (dispatch `SET_CONSENT`) e links para Privacidade/Termos.

> Validação visual **manual-pending**. O texto legal é placeholder honesto (coleta de analytics anônimo via PostHog [débito], base legal, contato) — o dono revisa/hospeda a versão final.

- [ ] **Step 1: Teste falhando** — `PRIVACY_TEXT` e `TERMS_TEXT` não-vazios e mencionam "analytics"/"dados"; Settings expõe um handler de consentimento que despacha `SET_CONSENT`.
- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** `legalContent.ts`, as duas telas (DS tokens, `ScrollView`), registrar rotas, adicionar hotspot/entry-point (ou itens na Settings) + o toggle de consentimento na `SettingsScreen` (sincroniza `state.consent.analytics`).
- [ ] **Step 4: Ver passar** + `npx tsc --noEmit` + suíte (atualize o teste de HOTSPOTS se adicionar entradas).
- [ ] **Step 5: Commit**

```bash
git add src/screens/PrivacyScreen.tsx src/screens/TermsScreen.tsx src/constants/legalContent.ts src/navigation/AppNavigator.tsx src/screens/SettingsScreen.tsx src/screens/VillageScreen.tsx src/__tests__/screens/legal.content.test.ts
git commit -m "feat(spec9): telas de Privacidade/Termos + toggle de consentimento na Settings — visual manual-pending"
```

---

### Task 8: Contrato `SOUND_KEYS` + auditoria de call sites

**Files:**
- Modify: `src/constants/assets.ts` (declarar `SOUND_KEYS`/tipo `SoundKey`)
- Modify: `src/services/sound.ts` (tipar `play`/`stop` por `SoundKey`)
- Test: `src/__tests__/services/soundKeys.test.ts`

**Interfaces:**
- Produces: `export type SoundKey` enumerando todas as chaves referenciadas no app (ex.: `chest_suspense`, `chest_open`, `chest_reveal`, `battle_hit`, `death`, `forge_craft`, `mission_reward`, `level_up`, `ambient`); `SOUND_KEYS: SoundKey[]`. `SOUND_ASSETS` continua mapeando só as chaves com arquivo real (vazio até áudio licenciado = **débito**), mas o **contrato** fica fixado e auditável.

- [ ] **Step 1: Teste falhando**

```typescript
// src/__tests__/services/soundKeys.test.ts
import { SOUND_KEYS } from '../../constants/assets';
test('toda chave referateixada no app está declarada em SOUND_KEYS', () => {
  // chaves usadas hoje em ChestRevealModal e demais call sites
  const referenced = ['chest_suspense', 'chest_open', 'chest_reveal'];
  for (const k of referenced) expect(SOUND_KEYS).toContain(k);
});
```

- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** o tipo + a lista, tipar a API de `sound.ts`, e fazer um grep dos `playSound('...')`/`play('...')` no app para garantir que toda chave referenciada está em `SOUND_KEYS` (corrija divergências de nome). `SOUND_ASSETS` permanece como está (vazio/parcial) — os arquivos são débito.
- [ ] **Step 4: Ver passar** + `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git add src/constants/assets.ts src/services/sound.ts src/__tests__/services/soundKeys.test.ts
git commit -m "feat(spec9): contrato SOUND_KEYS tipado + auditoria de call sites (arquivos de áudio = débito)"
```

---

### Task 9: Checklist de submissão + verificação + débito

**Files:**
- Create: `docs/store/SUBMISSION-CHECKLIST.md`
- Modify: `.superpowers/sdd/progress.md`, `docs/superpowers/DEBITO-2026-H2.md`

- [ ] **Step 1:** `npx tsc --noEmit` → 0; `./node_modules/.bin/jest --config jest.unit.config.js --runInBand` → verde; 3 snapshots intactos.
- [ ] **Step 2:** Criar `docs/store/SUBMISSION-CHECKLIST.md` com: passo-a-passo Apple (App ID, TestFlight, App Privacy "Usage Data", age rating) e Google (package, Internal testing, Data Safety, IARC); copy de ASO pt-BR (nome ≤30, subtítulo, descrição curta ≤80, longa, keywords) posicionando "idle RPG medieval com progresso offline"; declaração "no paid loot boxes".
- [ ] **Step 3:** Atualizar `progress.md` (SPEC9 Task 1..8) e a seção de débito com o **device/externo**: EAS Build real (conta Expo) · arquivos de áudio licenciados + popular `SOUND_ASSETS` · chave/SDK PostHog (`posthog-react-native`) no sink real · contas Apple($99)/Google($25) · keystore (deixar EAS gerenciar ou guardar fora do repo) · ícone/splash/screenshots/feature graphic (designer + captura em device pós-SPEC3) · preenchimento de App Privacy/Data Safety/age rating nos consoles · hospedagem das URLs de Privacidade/Termos.
- [ ] **Step 4: Commit**

```bash
git add docs/store/SUBMISSION-CHECKLIST.md .superpowers/sdd/progress.md docs/superpowers/DEBITO-2026-H2.md
git commit -m "docs(spec9): checklist de submissão + verificação estática + registro de débito device/externo"
```

---

## Self-Review (cobertura)

- EAS Build (config) → Task 1 ✅ (build real = débito)
- Identidade de pacote → Task 1 ✅
- Remover expo-av → Task 2 ✅
- Áudio: contrato `SOUND_KEYS` + integração → Task 8 ✅ (arquivos reais = débito)
- Analytics: serviço + gate de consentimento + eventos + instrumentação → Tasks 4–5 ✅ (sink PostHog real = débito)
- Consentimento LGPD: estado + gate no boot + toggle → Tasks 3, 6, 7 ✅
- Privacidade/Termos → Task 7 ✅ (hospedagem/URL = débito)
- Checklist de submissão + ASO copy → Task 9 ✅
- Migração de save → Task 3 ✅

**Débito device/externo (registrado na Task 9):** build EAS real, áudio licenciado, chave/SDK PostHog, contas de loja, keystore, arte (ícone/splash/screenshots/feature graphic), formulários de loja/age rating, hospedagem de URLs legais, validação visual em emulador das telas novas.
