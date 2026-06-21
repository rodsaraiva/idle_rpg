# Estabilização Técnica & Boot Mobile — Design Spec

> **Data:** 2026-06-20 · **Referência:** SPEC 1 do `docs/superpowers/ROADMAP-2026-H2.md` (Horizonte 1 — "Fundação Sólida").
> **Princípio condutor do roadmap:** não construir conteúdo novo sobre uma base quebrada. Este SPEC zera os bloqueadores de boot mobile, conserta o bug de gold offline, endurece a persistência e limpa a suíte.
> **Estratégia escolhida (resumo):** UNIFICAR o modelo de missão em `startedAt + durationMs` (eliminar `remainingMs` do caminho offline), com migração de saves; trocar `expo-audio.Audio` pela API top-level atual (`createAudioPlayer`/`setAudioModeAsync`); estilos web-only via `Platform.select`/tokens RN; backup do save anterior + distinção "sem save" vs "corrompido".

---

## 1. Contexto e Problema

O projeto é funcionalmente rico e bem arquitetado (reducer puro + handlers, combate determinístico por seed após #47, ~426 testes unit). Mas o `git log` esconde quatro problemas que **bloqueiam o alvo mobile** declarado no roadmap (iOS/Android via Expo). Tudo abaixo foi confirmado lendo o código real:

### 1.1 `tsc --noEmit` vermelho — 17 erros (confirmado: `npx tsc --noEmit` reporta exatamente 17 erros)

Categorizados:

| Cat. | Erro | Arquivo:LOC | Causa raiz |
|---|---|---|---|
| **A. Estilo web-only `position:'fixed'`** | TS2322 `"fixed"` não atribuível a position RN | `src/components/ChestRevealModal.tsx:389` | `position: Platform.OS === 'web' ? 'fixed' : 'absolute'` — o tipo do StyleSheet RN não aceita o literal `'fixed'`. |
| **A. Estilo web-only `'84vh'`** | TS2322 `"84vh"` não é `DimensionValue` | `src/components/ChestRevealModal.tsx:404` | `maxHeight: '84vh'` — unidade CSS web (`vh`) inexistente em RN. |
| **A. Estilo web-only `textShadow`** | TS2345 `textShadow` não existe em `TextStyle` | `src/components/CombatantCard.tsx:219` (+`:264`), `src/components/FeedbackLayer.tsx:165` (style `floatText:textShadow`), `src/components/HPBar.tsx:66` (style `overlay:textShadow`) | Propriedade CSS web `textShadow: '0px 1px 1px rgba(...)'`. RN usa `textShadowColor`/`textShadowOffset`/`textShadowRadius`. Há também `boxShadow` inline (`FeedbackLayer` `toast`) que o RN 0.81 aceita parcialmente mas é inconsistente cross-platform. |
| **B. Implicit `any`** | TS7006 `payload` implicitamente `any` | `src/components/FeedbackLayer.tsx:25` e `:31` | `on(FEEDBACK_EVENTS.FLOAT, (payload) => ...)`. A causa é que `src/services/feedback.ts:88` exporta `on` como `(event: any, cb: any)`, perdendo o `PayloadMap` que já existe tipado em `feedback.ts:45-54`. |
| **C. `@expo/vector-icons` ausente** | TS2307 Cannot find module `@expo/vector-icons` | `src/navigation/AppNavigator.tsx:16` | `import { Ionicons } from '@expo/vector-icons'` — pacote **não está em `package.json`** (confirmado: ausente de `dependencies`). Quebra boot da navegação. |
| **C. API `Audio` removida do expo-audio** | TS2305 `'expo-audio'` não exporta `Audio` | `src/services/sound.ts:1` | `import { Audio } from 'expo-audio'`. Confirmado lendo `node_modules/expo-audio@1.1.1`: a API top-level é `createAudioPlayer`, `useAudioPlayer`, `setAudioModeAsync` (sem namespace `Audio`, sem `Audio.Sound`). Todo `sound.ts` está escrito contra a API antiga (`Audio.Sound.createAsync`, `sound.playAsync`, `setPositionAsync`). |
| **D. `hp` em `Hero` (teste morto)** | TS2353 `'hp'` não existe em `Hero` | `src/__tests__/context/gameContext.offline.test.tsx:27` | O teste monta um herói com `{ id, name, hp: 10, atk, mp, currentTask }` — modelo legado. `Hero` (`src/types/index.ts:24-49`) usa `hpMax`/`hpCurrent` e **exige** `defense`, `crit`, `agility`. O teste já está **ignorado** em ambos os configs (`jest.unit.config.js:19`, `jest.config.js:18`), mas o `tsc` ainda o type-checka. |
| **D. `HeroCard.stories.tsx` desatualizado** | TS2739 faltam `defense`, `crit`, `agility` | `src/components/HeroCard.stories.tsx:5` | Mesma causa: mock de `Hero` sem os 3 stats secundários obrigatórios. |
| **E. Index `undefined`** | TS2538 `undefined` não pode ser index | `src/components/HeroCard.tsx:74` e `:138` | `CLASS_DEFS[hero.classId ?? undefined]`. O `?? undefined` é no-op e `classId?` é opcional → indexar `CLASS_DEFS` com `undefined`. |
| **E. Style array web** | TS2322 array de styles não atribuível a `StyleProp<ViewStyle>` | `src/components/MissionHeroSelectionModal.tsx:254` | `cellStyle` inclui objeto com `position: string` (inferido string, não literal `'absolute'`). |
| **F. Token de cor inexistente** | TS2339 `warning`/`accent` não existem em `theme.colors` | `src/components/MissionHeroSelectionModal.tsx:420` (`theme.colors.warning`), `:472` (`theme.colors.accent`) | Confirmado lendo `src/theme/index.ts`: `colors` tem `primary/gold/hp/atk/mp/success/danger/textPrimary/...` mas **não** `warning` nem `accent`. |
| **G. Prop inválida em LottieView** | TS2322 `pointerEvents` não existe nas props | `src/components/MissionResultModal.tsx:144` | `<LottieView ... pointerEvents="none" />`. `pointerEvents` deve ir em `style`. |

### 1.2 BUG CRÍTICO — gold de missão offline não creditado

`src/utils/offlineProgress.ts:138-189` decide se uma missão completou offline lendo **`m.remainingMs`**:

```ts
// offlineProgress.ts:140
const remaining = typeof m.remainingMs === 'number' ? m.remainingMs - ticks * tickInterval : undefined;
if (typeof remaining === 'number' && remaining <= 0) { /* credita gold */ }
else { newActiveMissions.push(typeof remaining === 'number' ? {...} : { ...m }); }
```

Mas o motor vivo **não grava `remainingMs`**. `handleStartMission` (`src/context/missionHandler.ts:78-88`) e `handleStartWeeklyBoss` (`:216-227`) criam `ActiveMission` com `startedAt: timestamp` + `scheduledActions` + `precomputedOutcome`. O loop de tick (`src/context/tickHandler.ts:158-159`) usa `elapsed = now - startedAt` para avançar. **`remainingMs` é apenas um campo opcional legado** (`ActiveMission.remainingMs?` em `src/types/index.ts:153`) que nenhum caminho do motor novo escreve.

**Consequência:** num save do motor atual, `m.remainingMs` é `undefined` → `remaining` fica `undefined` → o `else` empurra a missão de volta intacta → **zero gold creditado offline**. Para um idle RPG cuja regra de produto (memória do dono) é *"gold só vem de missão completada; missão em loop é o mecanismo offline"*, isto quebra a retenção idle inteira. O único caminho que ainda funciona é um save antigo que por acaso tenha `remainingMs`.

### 1.3 Persistência frágil

`src/services/storage.ts` + `gameReducer.ts:107`:

- `load()` (`storage.ts:124-137`): qualquer exceção no `JSON.parse`/migração → `catch` retorna `null`. O chamador trata `null` como **"sem save"** → começa do `initialGameState`. **Save corrompido apaga progresso em silêncio**, indistinguível de primeira execução.
- Sem backup do save anterior antes de `setItem` (`storage.ts:117`): uma escrita interrompida (app morto no meio) pode deixar JSON truncado sem rede de segurança.
- `LOAD_STATE` (`gameReducer.ts:107`) faz `return { ...action.state }` — **zero validação de shape**. Um save migrado mas estruturalmente inválido (ex.: `heroes` não-array) entra direto no reducer e quebra no primeiro tick.
- A migração (`applyMigrations`, `storage.ts:93-106`) roda em `load()`, mas o caminho `applyOfflineSummary` constrói `newState` a partir de `savedState` já carregado — se um save vier de versão antiga com `hp` em vez de `hpMax`, `offlineProgress.ts:29-30` faz fallback `(h as any).hp` em runtime, mascarando dados não-migrados em vez de migrá-los de fato.

### 1.4 Suíte inflada + sem threshold

- `git worktree list` confirma `.worktrees/sinergias-qualitativas` (branch `feature/sinergias-qualitativas`). `find src .worktrees -name "*.test.ts*"` → **106 suites**; `find src` → **60**. Logo **~46 duplicatas** vêm do worktree. Nem `jest.unit.config.js` nem `jest.config.js` ignoram `.worktrees/` (`testMatch: '**/src/__tests__/**'` em `jest.unit.config.js:15` casa o worktree porque o glob não está ancorado em `<rootDir>/src`).
- Coverage commitado em `coverage/` está stale (aparece como `M` no `git status`) e **nenhum** config tem `collectCoverage`/`coverageThreshold`. Métrica do roadmap exige branches ≥ 80%.

---

## 2. Objetivos e Não-Objetivos

### Objetivos (mensuráveis)
1. `npx tsc --noEmit` → **0 erros** (de 17).
2. Save→offline→reload **credita gold de missão corretamente**, coberto por teste de integração com AsyncStorage in-memory real (sem mock de DB).
3. Modelo de missão **unificado**: online e offline usam `startedAt + durationMs`. `remainingMs` removido do caminho offline; saves antigos migrados.
4. `load()` distingue **"sem save"** (`null`) de **"corrompido"** (lança/retorna sinal distinto); mantém **backup** do save anterior; `LOAD_STATE` valida shape mínimo.
5. `npm test` verde **sem duplicatas de worktree** (≤ 60 suites no unit), com `coverageThreshold.branches ≥ 80%` aplicado.
6. App **builda e dá boot** em emulador Android e iOS (Expo Go ou EAS dev build), **sem crash de ícones/áudio**; checklist preenchido.
7. `@expo/vector-icons` instalado e pinado; `expo-audio` migrado para a API atual; `app.json` `userInterfaceStyle: "dark"` + splash/adaptive em `#15100B` (fim do flash branco, alinhado ao Design Language §3.8).

### Não-Objetivos (YAGNI — fora deste SPEC)
- **Redesign visual / Design System** (tokens Cinzel, OrnateFrame, paleta "Reino"): SPEC 2 e 3. Aqui só se adiciona o **mínimo** de tokens que destrava `tsc` (`warning`, `accent`) e o `userInterfaceStyle: dark` — sem migrar a paleta inteira.
- **Balance/economia** (sinergias, personalidades, equipamentos): SPEC 4.
- **Refatoração de `tickHandler`/`battleEngine`** (deus-handlers): SPEC 6. Aqui só se **lê** o tickHandler para fixar o contrato `startedAt+durationMs`; não se quebra o arquivo.
- **Onboarding/FTUE** e revisão do estado inicial de produto: SPEC 5.
- **EAS Build de produção assinado / assets de loja / áudio final**: SPEC 9 (H3). Aqui só **dev build/Expo Go** para validar boot.
- Reescrever o `feedback.ts` inteiro — só re-tipar os exports `on`/`emit` para propagar `PayloadMap`.

---

## 3. Design Detalhado

### 3.1 Correção dos 17 erros de `tsc`

#### (A) Estilos web-only → equivalentes cross-platform RN

Criar `src/theme/elevation.ts` com helpers puros (sem dependência de RN além de `Platform`):

```ts
import { Platform, TextStyle, ViewStyle } from 'react-native';

/** Sombra de texto cross-platform. Substitui `textShadow: '...'`. */
export function textShadow(
  color = 'rgba(0,0,0,0.45)', dx = 0, dy = 1, radius = 1
): Pick<TextStyle, 'textShadowColor' | 'textShadowOffset' | 'textShadowRadius'> {
  return { textShadowColor: color, textShadowOffset: { width: dx, height: dy }, textShadowRadius: radius };
}

/** Elevação cross-platform. iOS/web: shadow*; Android: elevation. Substitui `boxShadow` inline. */
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

- `ChestRevealModal.tsx:389` `position: Platform.OS === 'web' ? 'fixed' : 'absolute'` → `position: 'absolute'`. (`'fixed'` só existe na web; em mobile `'absolute'` cobre o modal por baixo do `Modal` overlay. O fallback web já estava só evitando o type-error errado.) Tipar o objeto de estilo com `as const`/`ViewStyle` para o literal não alargar.
- `ChestRevealModal.tsx:404` `maxHeight: '84vh'` → `maxHeight: Dimensions.get('window').height * 0.84` (número, `DimensionValue` válido).
- `CombatantCard.tsx:219,264`, `FeedbackLayer.tsx` `floatText`, `HPBar.tsx` `overlay`: trocar `textShadow: '...'` por `...textShadow(...)` (spread do helper).
- `FeedbackLayer.tsx` `toast` `boxShadow: '...'` → `...elevation(3)` (mantém o `elevation: 8` que já existe lá ou usa o helper; remover a string `boxShadow`).
- `MissionHeroSelectionModal.tsx:254`: tipar `cellStyle` como `StyleProp<ViewStyle>` e garantir literais (`position: 'absolute' as const`) nos objetos do array.

#### (B) `payload` implicit any → re-tipar `on`/`emit` em `feedback.ts`

`feedback.ts:85-89` exporta `on`/`emit` como `any`, descartando o `PayloadMap` (já definido em `:45-54`). Substituir por wrappers genéricos preservando o tipo:

```ts
export function on<T extends FeedbackEvent>(event: T, cb: (payload: PayloadMap[T]) => void) {
  return FeedbackService.on(event, cb);
}
export function emit<T extends FeedbackEvent>(event: T, payload: PayloadMap[T]) {
  return FeedbackService.emit(event, payload);
}
```

Com isso `FeedbackLayer.tsx:25,31` inferem `payload: FloatPayload`/`ToastPayload` automaticamente — **os dois TS7006 somem sem tocar no FeedbackLayer**.

#### (C) Pacotes / API

- **`@expo/vector-icons`**: instalar via `npx expo install @expo/vector-icons` (deixa o Expo pinar a versão compatível com SDK 54). Resolve `AppNavigator.tsx:16`. Validar que `Ionicons` tem os nomes usados (`fitness`, `map`, `medkit`, `home`, `cart` + `-outline`).
- **`expo-audio` → API atual.** Reescrever `src/services/sound.ts` contra `createAudioPlayer`/`setAudioModeAsync` (top-level, confirmado em `node_modules/expo-audio@1.1.1`):

```ts
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { SOUND_ASSETS } from '../constants/assets';

type SoundKey = keyof typeof SOUND_ASSETS;
const players: Partial<Record<string, AudioPlayer>> = {};

export const SoundService = {
  async preload(): Promise<void> {
    await setAudioModeAsync({ playsInSilentMode: true, shouldRouteThroughEarpiece: false });
    for (const [key, asset] of Object.entries(SOUND_ASSETS)) {
      players[key] = createAudioPlayer(asset); // síncrono na API nova
    }
  },
  play(key: SoundKey) {
    const p = players[key];
    if (!p) return;
    p.seekTo(0);
    p.play();
  },
  stop(key: SoundKey) { players[key]?.pause(); },
  unload() { for (const p of Object.values(players)) p?.release(); },
};
```

> Nota de API: na API nova `playsInSilentModeIOS`/`shouldDuckAndroid` foram substituídos pelo `AudioMode` atual (`playsInSilentMode`, `interruptionMode*`). Os métodos do player são `play()/pause()/seekTo()/release()` (não mais `playAsync`/`stopAsync`/`unloadAsync`/`setPositionAsync`). Confirmar contra `node_modules/expo-audio/build/AudioModule.types.d.ts` na implementação (assinatura exata de `AudioMode`). Manter os exports de compat (`playSound`, `stopSound`, etc.) que `sound.ts:70-74` já expõe, ajustando para a nova superfície.

#### (D)/(E)/(F)/(G) Tipos e tokens

- `HeroCard.tsx:74,138`: `CLASS_DEFS[hero.classId ?? undefined]` → guard `hero.classId ? CLASS_DEFS[hero.classId] : undefined` (e seguir com `?.displayName ?? ''`).
- `HeroCard.stories.tsx:5` e `gameContext.offline.test.tsx:27`: ver §3.2 (modelo de Hero) — adicionar `hpMax/hpCurrent/defense/crit/agility` ou (no teste) reescrever o mock.
- `MissionHeroSelectionModal.tsx:420,472`: adicionar **dois tokens mínimos** a `src/theme/index.ts` `colors`: `warning` e `accent`. Para não antecipar a paleta "Reino" do SPEC 2, usar valores neutros temporários alinhados ao tema atual: `warning: '#F59E0B'` (= gold atual), `accent: '#A78BFA'` (= primaryLight). Comentário `// TODO SPEC 2: revisar na paleta Reino` é aceito aqui pois é dívida cross-SPEC explícita.
- `MissionResultModal.tsx:144`: mover `pointerEvents="none"` para dentro de `style={[styles.confetti, { pointerEvents: 'none' }]}` (RN 0.81 aceita `pointerEvents` em style) **ou** envolver em `<View pointerEvents="none">`. Preferir style.

### 3.2 Bug de gold offline — UNIFICAÇÃO do modelo de missão

**Decisão de design: unificar em `startedAt + durationMs`.** Razão: o motor vivo (online) já é a fonte de verdade e usa `startedAt`+`elapsed` (`tickHandler.ts:158-159`); reconstruir `remainingMs` no offline duplicaria a lógica de progressão e re-introduziria o campo legado que ninguém mais grava. O offline deve espelhar exatamente a semântica do tick.

`MissionTemplate` (definido em `src/constants/missions.ts:11`) já tem `durationMs`; o boss semanal tem o seu em `src/constants/weeklyBosses.ts:8`. Reescrever o bloco `offlineProgress.ts:138-189`.

**Resolução de template (espelhar o tick online).** O tickHandler resolve o template assim (`tickHandler.ts:151-155`): tenta `MISSIONS.find((t) => t.id === m.templateId)`; se falhar e `m.isWeeklyBoss`, usa `WEEKLY_BOSS_POOL.find(b => b.id === m.templateId)` + `bossToMissionTemplate(boss)`. O offline DEVE usar exatamente o mesmo caminho. `bossToMissionTemplate` hoje é uma função privada de `tickHandler.ts:35`; extraí-la para `src/constants/weeklyBosses.ts` (export) e importá-la nos dois lados, evitando duplicar a conversão (sem ciclo de import: `weeklyBosses` não importa `tickHandler`).

**Fonte do reward (consistência online↔offline).** O tick online credita `outcome.reward` — vindo de `m.precomputedOutcome` quando existe (`tickHandler.ts:228-243`), com fallback para `computeBattleOutcome`. Para o crédito offline bater com o que o jogador veria online, usar **`m.precomputedOutcome?.reward`** como fonte primária, caindo para `calcMissionReward(template, heroesForMission, {...})` quando o save não tiver `precomputedOutcome` (saves antigos / boss sem precompute).

```ts
import { WEEKLY_BOSS_POOL, bossToMissionTemplate } from '../constants/weeklyBosses';

// Para cada missão ativa: progressão por tempo decorrido desde startedAt.
savedState.activeMissions.forEach((m: ActiveMission) => {
  let template = MISSIONS.find((t) => t.id === m.templateId);
  if (!template && m.isWeeklyBoss) {
    const boss = WEEKLY_BOSS_POOL.find((b) => b.id === m.templateId);
    if (boss) template = bossToMissionTemplate(boss);
  }
  if (!template || template.durationMs <= 0) { newActiveMissions.push(m); return; }

  const startedAt = m.startedAt;                  // fonte de verdade
  const endsAt = startedAt + template.durationMs; // 1ª conclusão
  const nowOffline = savedAt + cappedMs;          // "agora" limitado pelo cap

  if (nowOffline < endsAt) {
    // ainda em andamento → mantém intacta (startedAt preservado)
    newActiveMissions.push(m);
    return;
  }

  // completou ≥1 ciclo offline — reward espelha o tick online
  const heroesForMission = newHeroes.filter((h) => m.heroIds.includes(h.id));
  const reward = m.precomputedOutcome?.reward
    ?? calcMissionReward(template, heroesForMission, {
      healerBuffMultiplier: m.healerBuffMultiplier, rogueRngBonus: m.rogueRngBonus,
    });

  // split per-hero, idêntico ao tick (floor(totalReward / n))
  const creditPerHero = (total: number) => {
    const n = m.heroIds.length || 1;
    const per = Math.floor(total / n);
    m.heroIds.forEach((hid) => { perHeroGold[hid] = (perHeroGold[hid] ?? 0) + per; });
  };

  if (m.looping) {
    const totalElapsed = nowOffline - startedAt;
    const cycles = Math.floor(totalElapsed / template.durationMs); // ≥1
    const total = reward * cycles;
    creditPerHero(total);
    additionalGold += total;
    // re-armar: novo startedAt alinhado ao último ciclo (espelha tickHandler online)
    const leftover = totalElapsed % template.durationMs;
    newActiveMissions.push({ ...m, startedAt: nowOffline - leftover });
  } else {
    creditPerHero(reward);
    additionalGold += reward;
    // missão não-loop encerra: heróis voltam a IDLE, não re-empurra em newActiveMissions
    m.heroIds.forEach((hid) => {
      const idx = newHeroes.findIndex((hh) => hh.id === hid);
      if (idx >= 0) newHeroes[idx] = { ...newHeroes[idx], currentTask: HeroTask.IDLE };
    });
  }
});
```

Pontos-chave:
- **`nowOffline = savedAt + cappedMs`** respeita o cap de 72h (`MAX_OFFLINE_MS`) já calculado em `offlineProgress.ts:17`. Não usar `Date.now()` direto.
- **Loop:** `cycles = floor(totalElapsed / durationMs)`, sempre ≥1 quando `nowOffline ≥ endsAt`. Credita `reward * cycles` (não `1 + cyclesAfterFirst` em cima de `remainingMs` como hoje).
- **Re-armar startedAt** preserva o resto do ciclo, casando com o que o tickHandler faria online (que cria nova missão com `startedAt: now`).
- **Split per-hero inline** (`floor(total / n)` em `perHeroGold`) e **volta a IDLE inline** (`newHeroes[idx].currentTask = IDLE`) reproduzem o que o código atual já faz em `offlineProgress.ts:159-182` — sem criar helpers novos (evita over-engineering).
- **Regra de produto preservada:** gold só de missão **completada** (cap respeitado, sem gold passivo). Loop continua sendo o mecanismo offline. **Não viola** a memória do dono.
- `remainingMs` **deixa de ser lido/escrito** no offline. O campo continua opcional no tipo (não removê-lo agora evita quebrar saves antigos no parse), mas a migração v9 (§3.3) o descarta.

### 3.3 Persistência robusta

`src/services/storage.ts`:

```ts
const STORAGE_KEY = '@idle_rpg_game_state';
const BACKUP_KEY  = '@idle_rpg_game_state.bak';
const CURRENT_VERSION = 9;

class CorruptSaveError extends Error {}

async save(state) {
  const json = JSON.stringify({ ...state, _version: CURRENT_VERSION, lastSavedAt: Date.now() });
  // backup do save válido anterior ANTES de sobrescrever
  const prev = await AsyncStorage.getItem(STORAGE_KEY);
  if (prev) await AsyncStorage.setItem(BACKUP_KEY, prev);
  await AsyncStorage.setItem(STORAGE_KEY, json);
}

async load(): Promise<GameState | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw == null) return null;            // SEM SAVE (distinto de corrompido)
  try {
    return validateShape(applyMigrations(JSON.parse(raw)));
  } catch (e) {
    // CORROMPIDO: tenta backup antes de desistir
    const bak = await AsyncStorage.getItem(BACKUP_KEY);
    if (bak) { try { return validateShape(applyMigrations(JSON.parse(bak))); } catch {} }
    throw new CorruptSaveError(String(e)); // NÃO retorna null silenciosamente
  }
}
```

- **`validateShape`**: checagem mínima — `typeof state.gold === 'number'`, `Array.isArray(state.heroes)`, e cada hero tem `id` string + `hpMax`/`atk` numéricos. Falha → lança (tratada como corrupção). É a mesma validação chamada no `LOAD_STATE`.
- **`LOAD_STATE`** (`gameReducer.ts:107`): `return validateShape({ ...action.state })`. Se inválido, retornar `state` atual (não derrubar). A validação vive em `storage.ts` e é importada pelo reducer.
- **Migração no caminho offline:** `applyOfflineSummary` deve receber um `savedState` **já migrado** por `applyMigrations`. Hoje `offlineProgress.ts:29-30` faz fallback `(h as any).hp` — após a migração v3 garantir `hpCurrent`/`hpMax`, esses fallbacks viram desnecessários, mas mantê-los como cinto-de-segurança é aceitável. O essencial: `load()` migra **antes** de qualquer cálculo offline.
- **Migração v9:** remover `remainingMs` de `activeMissions` (campo legado) e garantir `startedAt` (default `Date.now()` se ausente, para saves muito antigos):

```ts
9: (data) => {
  if (Array.isArray(data.activeMissions)) {
    data.activeMissions = data.activeMissions.map((m: any) => {
      const { remainingMs, ...rest } = m;
      return { ...rest, startedAt: typeof rest.startedAt === 'number' ? rest.startedAt : Date.now() };
    });
  }
  return data;
}
```

- **Tratamento de `CorruptSaveError` na UI:** o caller (GameContext/boot) ao pegar `CorruptSaveError` deve **iniciar do `initialGameState` mas NÃO sobrescrever o save imediatamente** (preserva o `.bak` e o corrompido para diagnóstico) e emitir um toast ("Save corrompido — recuperado backup / iniciado novo"). Sem perder progresso em silêncio.

### 3.4 Suíte e coverage

- **`jest.unit.config.js`**: ancorar o `testMatch` e adicionar ignore:
  ```js
  testMatch: ['<rootDir>/src/__tests__/**/?(*.)+(test).[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.worktrees/', '<rootDir>/src/__tests__/context/gameContext.offline.test.tsx'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.stories.tsx', '!src/**/*.test.{ts,tsx}'],
  coverageThreshold: { global: { branches: 80 } },
  ```
- **`jest.config.js`**: adicionar `'/.worktrees/'` em `testPathIgnorePatterns` e o mesmo `coverageThreshold`.
- Após reativar (ou reescrever) `gameContext.offline.test.tsx` (§3.5), remover a entrada de ignore específica dele.

### 3.5 Estado inicial / app.json (mínimo de boot)

- `app.json`: `userInterfaceStyle: "light"` → `"dark"`; `splash.backgroundColor` e `android.adaptiveIcon.backgroundColor` `#ffffff` → `#15100B` (Design Language §3.8). **Não** trocar os PNGs (isso é SPEC 2); só o background color para eliminar o flash branco no boot.

---

## 4. Mudanças por Arquivo

| Arquivo | Ação | O que muda |
|---|---|---|
| `package.json` | modificar | `npx expo install @expo/vector-icons` adiciona a dep pinada para SDK 54. |
| `src/theme/elevation.ts` | **criar** | Helpers `textShadow()` e `elevation()` cross-platform (§3.1-A). |
| `src/theme/index.ts` | modificar | Adicionar `colors.warning` e `colors.accent` (§3.1-F). `// TODO SPEC 2`. |
| `src/services/feedback.ts` | modificar | `:85-89` — re-tipar `on`/`emit` como genéricos sobre `PayloadMap` (§3.1-B). |
| `src/components/ChestRevealModal.tsx` | modificar | `:389` `'fixed'`→`'absolute'`; `:404` `'84vh'`→`Dimensions...*0.84`. |
| `src/components/CombatantCard.tsx` | modificar | `:219,:264` `textShadow:'...'`→`...textShadow(...)`. |
| `src/components/FeedbackLayer.tsx` | modificar | `floatText.textShadow`→helper; `toast.boxShadow`→`...elevation(3)`; `:25,:31` payload passa a inferir tipo (via feedback.ts). |
| `src/components/HPBar.tsx` | modificar | `:66` `overlay.textShadow`→helper. |
| `src/components/HeroCard.tsx` | modificar | `:74,:138` guard de `classId` antes de indexar `CLASS_DEFS`. |
| `src/components/HeroCard.stories.tsx` | modificar | `:5` mock de `Hero` ganha `defense/crit/agility` (+`hpMax/hpCurrent` já presentes). |
| `src/components/MissionHeroSelectionModal.tsx` | modificar | `:254` tipar `cellStyle` + literais `'absolute'`; `:420,:472` usam tokens novos. |
| `src/components/MissionResultModal.tsx` | modificar | `:144` `pointerEvents` move para `style`. |
| `src/navigation/AppNavigator.tsx` | sem mudança de código | Passa a compilar quando `@expo/vector-icons` estiver instalado. |
| `src/services/sound.ts` | **reescrever** | API expo-audio atual (`createAudioPlayer`/`setAudioModeAsync`/`play/pause/seekTo/release`), mantendo exports de compat (§3.1-C). |
| `src/utils/offlineProgress.ts` | modificar | `:138-189` — reescrever bloco de missões para `startedAt+durationMs+cap` (§3.2); resolução de boss via `WEEKLY_BOSS_POOL`+`bossToMissionTemplate`; reward via `precomputedOutcome?.reward ?? calcMissionReward`; split per-hero e volta-a-IDLE inline (sem helpers novos). |
| `src/constants/weeklyBosses.ts` | modificar | Exportar `bossToMissionTemplate` (hoje privado em `tickHandler.ts:35`) para reuso no offline sem duplicar a conversão. `tickHandler.ts` passa a importá-la em vez de defini-la. |
| `src/context/tickHandler.ts` | sem mudança de comportamento | Substituir a `bossToMissionTemplate` local (`:35`) pela importada de `weeklyBosses` (mesma lógica; só relocação para reuso). Não é a refatoração do SPEC 6. |
| `src/services/storage.ts` | modificar | Backup `.bak`; `load()` distingue null vs `CorruptSaveError`; `validateShape`; migração v9 (`CURRENT_VERSION=9`). |
| `src/context/gameReducer.ts` | modificar | `:107` `LOAD_STATE` valida shape; fallback para `state` se inválido. |
| `src/context/GameContext.tsx` (boot) | modificar | `try/catch` de `CorruptSaveError` no carregamento; toast; garante `applyMigrations` antes do cálculo offline. |
| `src/types/index.ts` | sem mudança estrutural | `remainingMs?` permanece opcional (migração v9 o descarta); sem remover para não quebrar parse de saves antigos. |
| `jest.unit.config.js` | modificar | `testMatch` ancorado, ignore `.worktrees`, `collectCoverage`+`coverageThreshold.branches:80` (§3.4). |
| `jest.config.js` | modificar | ignore `.worktrees`, `coverageThreshold` igual. |
| `src/__tests__/context/gameContext.offline.test.tsx` | **reescrever** | Mock de `Hero` corrigido (sem `hp` legado); novo cenário save→offline→reload credita gold (§3.5). Remover do ignore. |
| `src/__tests__/utils/offlineProgress.mission.test.ts` | **criar** | Testes unit do novo bloco de missões (§5). |
| `src/__tests__/services/storage.persistence.test.ts` | **criar** | Backup, corrupção, validateShape, migração v9 (§5). |
| `app.json` | modificar | `userInterfaceStyle:"dark"`; splash/adaptive background `#15100B` (§3.5). |

---

## 5. Estratégia de Teste

**TDD onde crítico** (offline + persistência) — escrever o teste antes da correção. **Integração > mock**: AsyncStorage usa o mock in-memory **real** já existente (`jest-mocks/async-storage-mock.js`), não stub de retorno fixo.

### Unit — `offlineProgress.mission.test.ts` (novo)
1. **Loop, 1 ciclo:** save com missão loop `startedAt = savedAt - durationMs`, `lastSavedAt = savedAt`. Após offline → `goldGained === reward`, herói segue em MISSION, `startedAt` re-armado.
2. **Loop, N ciclos:** `elapsed = 3.5 * durationMs` → `goldGained === reward*3`, leftover = `0.5*durationMs` no novo `startedAt`.
3. **Não-loop, completa:** `elapsed ≥ durationMs` → credita 1× reward, herói volta a IDLE, missão sai de `activeMissions`.
4. **Em andamento:** `elapsed < durationMs` → gold 0, missão intacta (`startedAt` preservado).
5. **Cap 72h:** `elapsed = 100h`, loop → cycles calculado sobre `MAX_OFFLINE_MS`, não sobre 100h.
6. **`remainingMs` ausente** (save do motor novo: só `startedAt`+`precomputedOutcome`) → gold creditado (regressão direta do bug 1.2).
7. **Split per-hero:** `perHeroGold` recebe `floor(totalReward / n)` por herói.
8. **Fonte do reward:** missão com `precomputedOutcome.reward = R` → crédito usa `R` (não `calcMissionReward`); missão sem `precomputedOutcome` → cai no fallback `calcMissionReward`. Garante consistência online↔offline.
9. **Boss semanal offline:** `m.isWeeklyBoss=true`, `templateId` de `WEEKLY_BOSS_POOL` (não em `MISSIONS`), não-loop, `elapsed ≥ durationMs` → template resolvido via `bossToMissionTemplate`, gold creditado, heróis a IDLE (cobre o caminho que `MISSIONS.find` sozinho não acharia).

### Unit — `storage.persistence.test.ts` (novo)
10. **Sem save:** `getItem`→`null` → `load()` retorna `null`.
11. **Corrompido:** `setItem(STORAGE_KEY, '{trunc')` → `load()` lança `CorruptSaveError` (não retorna `null`).
12. **Backup recupera:** save válido v8, depois corromper principal, manter `.bak` → `load()` retorna estado do backup.
13. **Backup escrito no save:** dois `save()` consecutivos → `.bak` contém o penúltimo JSON.
14. **Migração v9:** save v8 com `activeMissions:[{remainingMs:5000, templateId, heroIds, startedAt}]` → após `load()`, item sem `remainingMs`, com `startedAt`.
15. **validateShape rejeita:** `heroes` não-array → corrupção.

### Integração — `gameContext.offline.test.tsx` (reescrito)
16. Monta `Hero` **válido** (`hpMax/hpCurrent/defense/crit/agility`), missão loop com `precomputedOutcome.reward` setado, `lastSavedAt` 2h atrás. Persiste via `StorageService.save` (AsyncStorage real). `GameProvider` carrega → `offlineSummary.goldGained > 0` e o `gold` no estado reflete o crédito. Cobre o ciclo **save → offline → reload** ponta a ponta (objetivo 2 do roadmap).

### Validação de tipo e UI
17. `npx tsc --noEmit` → 0 erros (gate binário).
18. `npm test` (jest.unit) verde, ≤ 60 suites, branches ≥ 80%.
19. **Boot real** (§ checklist abaixo): abrir no emulador Android e iOS; navegar pelas 5 abas (ícones renderizam, sem crash de áudio); disparar um som; deixar uma missão em loop, fechar o app por > `durationMs`, reabrir e confirmar gold creditado e toast de offline.

---

## 6. Critérios de Aceitação

- [ ] `npx tsc --noEmit` → **0 erros** (era 17).
- [ ] `npm test` (jest.unit.config.js) → **verde**, **≤ 60 suites** (sem duplicatas de `.worktrees/`).
- [ ] `coverageThreshold.branches: 80` presente em **ambos** os configs e o run **passa** o gate.
- [ ] Teste de integração save→offline→reload credita gold com **save do motor novo** (sem `remainingMs`) → verde.
- [ ] `@expo/vector-icons` em `package.json` `dependencies`; `AppNavigator` compila.
- [ ] `src/services/sound.ts` importa **só** símbolos existentes de `expo-audio@1.1.1` (sem `Audio`).
- [ ] `grep -rn "remainingMs" src/utils/offlineProgress.ts` → **0 ocorrências de leitura** (campo só aparece, se aparecer, em migração).
- [ ] `grep -rn "textShadow: '" src/components` e `grep -rn "boxShadow: '" src/components` → **0**.
- [ ] `app.json`: `userInterfaceStyle == "dark"`; `splash.backgroundColor == "#15100B"`; `android.adaptiveIcon.backgroundColor == "#15100B"`.
- [ ] **Android emulador**: app dá boot, 5 abas navegáveis com ícones vetoriais, 1 som toca sem crash.
- [ ] **iOS emulador/sim**: idem.
- [ ] **Cenário offline real no emulador**: missão em loop → fecha app > durationMs → reabre → gold creditado + toast de resumo offline.
- [ ] Save corrompido (injetado) → app inicia novo estado **sem** apagar `.bak`, com toast; nenhum progresso some em silêncio.

---

## 7. Riscos e Mitigação

| Risco | Severidade | Mitigação |
|---|---|---|
| API do `expo-audio@1.1.1` divergir do esboço (nomes de `AudioMode`/métodos) | Média | Confirmar contra `node_modules/expo-audio/build/AudioModule.types.d.ts` e `ExpoAudio.d.ts` **antes** de codar; `sound.ts` é isolado e tem stub de teste (`jest.react-native-setup.stub.js` mapeado em ambos configs), então não quebra a suíte. |
| Unificação offline mudar saldo de gold de saves reais antigos (que tinham `remainingMs`) | Média | Migração v9 normaliza para `startedAt`; testes 1-7 cobrem loop/non-loop/cap; o crédito usa `m.precomputedOutcome?.reward` (a mesma fonte que o tick online em `tickHandler.ts:228-243`), com fallback `calcMissionReward` só quando o save não tem precompute — garante consistência online↔offline. |
| `coverageThreshold.branches:80` reprovar de cara (baseline desconhecido) | Média | Rodar `--coverage` **antes** de fixar o threshold; se o baseline for < 80%, escrever testes dos branches novos (offline/storage) primeiro e, se ainda assim faltar, escopar o threshold a `src/utils`+`src/context`+`src/services` em vez de `global` (documentar). Não baixar abaixo de 80 sem registrar no roadmap. |
| `position:'absolute'` em vez de `'fixed'` mudar layout do modal na web | Baixa | Web é alvo de dev, não de produção; validar visualmente no browser (Playwright) que o `ChestRevealModal` ainda centraliza. |
| Backup `.bak` dobrar I/O de save (lê antes de escrever a cada save) | Baixa | `save()` roda em intervalo de autosave (não por frame); custo de 1 `getItem`+1 `setItem` extra é desprezível em AsyncStorage. |
| Tokens `warning`/`accent` temporários conflitarem com a paleta "Reino" do SPEC 2 | Baixa | Marcados `// TODO SPEC 2`; SPEC 2 substitui `theme` inteiro de qualquer forma. |
| Reescrever `gameContext.offline.test.tsx` mascarar regressão se mal feito | Baixa | O teste novo é integração ponta-a-ponta com AsyncStorage real; o caso 6 (sem `remainingMs`) é a regressão-alvo explícita. |

---

## 8. Dependências e Sequenciamento

**Depende de:** nada — é a base. SPEC 1 é a raiz do grafo de dependências do roadmap (`SPEC 1 ──> SPEC 3/5/6`).

**Destrava:**
- **SPEC 2 (Design System)** pode correr **em paralelo** (worktree distinto), mas se beneficia de `tsc` verde como baseline. Os tokens `warning`/`accent`/`userInterfaceStyle:dark` aqui são o ponto de contato — SPEC 2 os absorve na paleta "Reino".
- **SPEC 3 (Redesign)**, **SPEC 5 (Onboarding)**, **SPEC 6 (Refatoração)** exigem este SPEC fechado (base estável + boot mobile + suíte limpa como rede de segurança para regressão).
- **SPEC 4 (Balance)** depende de `coverageThreshold` + suíte sem duplicatas para rodar como gate de CI.

**Ordem interna sugerida (commits pequenos):**
1. Suíte: ignore `.worktrees/` + reativar/limpar (destrava feedback rápido). 
2. `tsc` cat. A/B/E/F/G (estilos, tipos, tokens) — sem deps externas.
3. `tsc` cat. C: `expo install @expo/vector-icons` + reescrever `sound.ts`.
4. Bug offline (TDD: testes 1-7 → correção).
5. Persistência (TDD: testes 8-13 → backup/validateShape/v9).
6. Integração offline reescrita (teste 14) + `coverageThreshold` ligado.
7. `app.json` dark + boot mobile (checklist §6).

---

## Checklist de Boot Mobile (Android + iOS)

Estratégia: **EAS dev build** (preferido — `newArchEnabled:true` + libs nativas como reanimated/svg/vector-icons rodam melhor que em Expo Go) com fallback **Expo Go** para smoke rápido.

```
# pré-requisitos (já no projeto): expo 54, newArchEnabled true
1. npx expo install @expo/vector-icons          # resolve TS2307 + ícones nativos
2. npx tsc --noEmit                              # gate: 0 erros antes de buildar
3. npm test                                      # gate: verde + threshold
# Expo Go (smoke):
4. npx expo start                                # QR → Expo Go Android e iOS
# EAS dev build (validação real, recomendado):
5. npx eas build --profile development --platform android
6. npx eas build --profile development --platform ios
```

Validações no device/emulador (preencher na execução):
- [ ] Splash sem flash branco (background `#15100B`).
- [ ] 5 abas navegam; `Ionicons` renderizam (não quadrado/tofu).
- [ ] Tela de chest abre (modal centralizado, sem erro de `'fixed'`/`'84vh'`).
- [ ] 1 efeito sonoro toca (preload + play sem crash de `expo-audio`).
- [ ] Missão em loop → app em background > `durationMs` → reabrir → gold creditado + toast offline.
- [ ] Forçar save corrompido (dev menu / script) → app recupera sem apagar progresso em silêncio.
