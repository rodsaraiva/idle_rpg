# Onboarding & FTUE (First-Time User Experience) — Design Spec

> Data: 2026-06-20 · Referência: **SPEC 5** do `docs/superpowers/ROADMAP-2026-H2.md` (Horizonte 2).
> Define o **tutorial dos primeiros minutos** (recrutar → treinar → 1ª missão → coletar recompensa) com
> coach marks / spotlight contextual, **revisa o estado inicial** (sem violar "sem gold passivo"), cria um
> **sistema de flags de first-time persistido** no save, estende o serviço de **milestones** existente para
> **dicas contextuais pós-tutorial** (1ª forja, 1ª fusão), e **instrumenta** a métrica de sucesso
> *tempo-até-1ª-missão < 60s* (gancho para o SPEC 9 analytics).
>
> **Estratégia:** camada **aditiva e desacoplada** — um `OnboardingProvider` sobre o `GameProvider` existente,
> coach marks por **overlay** (não reescreve telas), e flags num **bloco isolado** do `GameState`
> (`onboarding`) com migração v9. Nenhuma regra de jogo muda; nenhuma tela é redesenhada (isso é SPEC 3).
> O estado inicial revisto é a **única** mudança de balanço, e é mínima e justificada.

---

## 1. Contexto e Problema

### 1.1 O primeiro minuto hoje (diagnóstico, fundamentado no código lido)

Estado inicial real, em `src/context/gameReducer.ts:33-41`:

```ts
export const initialGameState: GameState = {
  gold: 20,
  heroes: [],
  heroesRecruited: 0,
  // ...
  activeMissions: [],
};
```

Ou seja: **20 de ouro, zero heróis, zero tutorial**. O app abre no `AppNavigator`
(`src/navigation/AppNavigator.tsx`) na tab **"Vila"** (`VillageScreen`, primeira `Tab.Screen`). A
`VillageScreen.tsx` (166 LOC) é uma **lista de 8 cards** (`VillageScreen.tsx:53-102`: Treinamento,
Enfermaria, Ferreiro, Missões Diárias, Conquistas, Panteão, Desafio Semanal, Guilda) — e **nenhum** desses
8 cards leva a recrutar o primeiro herói nem a iniciar a primeira missão. A Vila nem mostra "Loja" nem
"Missões" (essas são tabs inferiores, não cards da Vila).

O jogador novo, portanto, vê uma vila cheia de prédios **todos inúteis sem heróis** (Treinamento com lista
vazia, Enfermaria vazia, Ferreiro sem ouro para forjar, Panteão sem heróis para fundir) e precisa
**descobrir sozinho** que:

1. Recrutar acontece em **dois lugares diferentes e inconsistentes**:
   - **Loja** (tab inferior, `ShopScreen.tsx`): compra **baús** (`useShop.ts:30-43` → `BUY_CHEST` →
     `CONFIRM_CHEST_REVEAL`), com modal de revelação (`ChestRevealModal`). O baú mais barato é
     `chest_bronze` (`costMultiplier: 1`, `src/constants/shop.ts:16`), custando
     `getRecruitCost(heroesRecruited) * 1`.
   - **Guilda** (card da Vila → `GuildScreen.tsx:60`): botão `RecruitButton` → `recruitHero()`
     (`GameContext.tsx:109-111` → `RECRUIT_HERO` → `handleRecruitHero`, `heroHandler.ts:9-24`), **sem** modal,
     herói instantâneo.
   - Ambos usam a mesma fórmula `getRecruitCost(heroesRecruited)` (`utils/gameMath.ts:24-26`):
     `floor(RECRUIT_BASE_COST * RECRUIT_COST_MULTIPLIER^n)` = `floor(10 * 1.5^n)`. Logo o **1º herói custa
     10**, o 2º custa 15, o 3º custa 22.
2. O herói recrutado começa com `INITIAL_HERO_STATS` (`constants/game.ts:95-102`): `hp:15, atk:6, mp:2,
   defense:5, crit:5, agility:10`.
3. Missões ficam na tab **"Missões"** (`MissionsScreen.tsx`). A de entrada, `mission_1` "Primeira Patrulha"
   (`constants/missions.ts:43-56`): `minHeroes: 1`, `durationMs: 10_000` (10s), `rewardMin/Max: 1/10`,
   `difficulty: 1`. É a única acessível com 1 herói — `mission_2` já pede `minHeroes: 2`, e o botão de envio
   é desabilitado por `availableCount < mission.minHeroes` (`MissionsScreen.tsx:77`).

### 1.2 A dor concreta

- **Custo de descoberta alto.** Não há nenhum sinal apontando o caminho `recrutar → treinar → missão`. As
  duas portas de recrutamento (Loja/Guilda) divergem em UX, e a tela inicial (Vila) não expõe nenhuma das
  duas como primeiro passo.
- **Estado inicial quase travado.** Com 20 de ouro o jogador recruta **1** herói (custo 10, sobra 10) mas
  **não consegue o 2º** (custo 15). Fica preso em `mission_1` (única `minHeroes:1`) até completar missões e
  acumular ouro — e como **não há gold passivo** (regra do dono: ouro só vem de missão completada;
  `MISSION_BASE_GOLD`/`GOLD_PER_ATK` em `constants/game.ts:61-65`), o loop de progressão depende inteiramente
  de o jogador **descobrir e iniciar** `mission_1`. Se ele não descobre, o jogo não anda.
- **Zero retenção de primeira sessão.** Sem coach mark, sem celebração da 1ª recompensa, sem instrumentação,
  não há como medir nem melhorar o funil. O ROADMAP §1 (problema #8) e §4 (H2) cravam a meta:
  *"Novo jogador chega à 1ª missão em < 60s com tutorial; estado inicial documentado."*

### 1.3 O que já existe e vamos reusar (não reinventar)

- **`GameState.onboarding`?** Não existe ainda — campo novo (§3.2). O `GameState`
  (`src/types/index.ts`) já carrega vários blocos opcionais (`dailyQuests`, `pantheonBonuses`,
  `weeklyState`, `materials`), então **adicionar um bloco `onboarding?` é idiomático**.
- **Persistência versionada.** `src/services/storage.ts` já tem `CURRENT_VERSION = 8` e um pipeline de
  `migrations` (`storage.ts:16-106`). Adicionamos a **migração v9** no mesmo padrão.
- **Serviço de milestones.** `src/services/milestones.ts` (34 LOC) já emite toasts de marco via
  `FeedbackEvent.TOAST` com `type: 'milestone', duration: 4000` (`milestones.ts:3-5`), e expõe
  `emitFirstFusion()` (`milestones.ts:11-13`) e `emitFirstTierForged(tierName)` (`milestones.ts:27-29`).
  As **dicas contextuais pós-tutorial** penduram nesses ganchos.
- **Bus de feedback.** `src/services/feedback.ts` expõe `FeedbackEvent.TOAST`/`FEEDBACK_EVENTS.TOAST` e
  `emit`/`on` (`feedback.ts:85-97`) — o canal por onde o overlay e os toasts conversam sem acoplar telas.
- **`createHero(classId)`** (`utils/heroFactory.ts`, usado em `heroHandler.ts:3,15`) — usado para semear o
  herói inicial determinístico (§3.4).

---

## 2. Objetivos e Não-Objetivos

### 2.1 Objetivos (mensuráveis)

1. **Tutorial guiado de 4 passos** (recrutar → treinar → iniciar missão → coletar), com spotlight contextual,
   que conduz o jogador da Vila à 1ª missão. **Pulável** a qualquer momento (botão "Pular tutorial").
2. **Tempo-até-1ª-missão < 60s** para o caminho feliz do tutorial, **medido** por instrumentação própria
   (evento `ftue_first_mission_started` com `elapsedMs`; §3.7).
3. **Estado inicial revisto** que permita formar uma equipe mínima viável **sem** trivializar e **sem** ferir
   "sem gold passivo": entregar o jogador já com **1 herói semeado** + ouro suficiente para **+1 recruta**.
4. **Flags de first-time persistidas** num bloco `GameState.onboarding`, com **reset** (debug/QA) e **skip**
   (jogador), migráveis (v9), retrocompatíveis (saves v8 não quebram).
5. **Dicas contextuais pós-tutorial** (1ª visita à Forja, 1ª fusão no Panteão) reusando
   `services/milestones.ts`, disparadas **uma única vez** cada.
6. `npx tsc --noEmit` 0 erros e `npm test` (jest.unit.config.js) verde, com testes novos cobrindo
   máquina de estados do tutorial, flags/persistência e o cálculo de `elapsedMs`.

### 2.2 Não-Objetivos (YAGNI — explicitamente fora)

- **Redesign visual das telas / tokens do DS.** Coach marks usam tokens do `theme` já existente; a estética
  final é SPEC 3 (o overlay é construído para **herdar** os tokens, não para definir layout novo).
- **Monetização / push / daily-login** — SPEC 8.
- **Backend de analytics.** Aqui só definimos a **interface** `track(event, props)` e os **call sites**;
  o sink real (PostHog/Amplitude/EAS) é SPEC 9. O default é um logger no-op em produção e `console` em dev.
- **Tutorial de sistemas avançados** (forja em profundidade, fusão, semanal, equipamentos). Pós-tutorial só
  ganha **dica de 1 toast**, não fluxo guiado.
- **Unificar Loja vs Guilda** como portas de recrutamento. O tutorial **escolhe uma** (Guilda, §3.5) e ignora
  a outra; a unificação de UX é decisão de SPEC 3.
- **A/B testing do onboarding.** Fora de escopo; a instrumentação só precisa medir o funil único.

---

## 3. Design Detalhado

### 3.1 Visão de arquitetura

Camada nova **acima** do jogo, sem tocar no reducer puro nem nas telas:

```
<GameProvider>                         (existente — estado do jogo)
  <OnboardingProvider>                 (NOVO — máquina de estados do FTUE + analytics)
    <AppNavigator/>                    (existente)
    <OnboardingOverlay/>               (NOVO — spotlight + balão, renderizado por cima de tudo)
  </OnboardingProvider>
</GameProvider>
```

- **Fonte de verdade das flags:** `GameState.onboarding` (persistido pelo storage existente).
- **Driver do passo atual:** `OnboardingProvider` deriva o passo ativo de `(state.onboarding, state.heroes,
  state.activeMissions, state.completedMissionCount)` — ou seja, **observa o jogo de verdade**, não um mock.
  Isso é o "integração > mock" da convenção: o passo "treinou?" lê `hero.trainingCount`, não um sinal
  sintético.
- **Atuação:** o overlay **não executa** ações por conta própria; ele **aponta** (spotlight) e o jogador toca.
  O avanço de passo é **reativo** ao estado do jogo mudando (ex.: ao surgir uma `activeMission`, o passo
  "iniciar missão" é dado como cumprido). Isso evita divergência entre "tutorial acha que fez" e "o jogo fez".

### 3.2 Modelo de dados — bloco `onboarding` no `GameState`

Em `src/types/index.ts`, adicionar ao `GameState`:

```ts
/** Estado do onboarding / FTUE (first-time experience). Bloco isolado e opcional. */
export interface OnboardingState {
  /** Versão do fluxo de tutorial; permite reexibir se o tutorial mudar muito. */
  version: number;
  /** Passo guiado atual; 'done' = concluído, 'skipped' = pulado pelo jogador. */
  step: OnboardingStep;
  /** Epoch ms do começo do tutorial (primeiro boot). Base do elapsedMs até a 1ª missão. */
  startedAt: number;
  /** Flags one-shot de dicas contextuais já mostradas (chave -> true). */
  hintsSeen: Record<string, boolean>;
}

export type OnboardingStep =
  | 'intro'        // balão de boas-vindas na Vila
  | 'recruit'      // aponta a Guilda / botão recrutar
  | 'train'        // aponta Treinamento, pede treinar 1 ponto
  | 'mission'      // aponta Missões, pede iniciar mission_1
  | 'collect'      // aponta a missão ativa / aguarda recompensa
  | 'done'
  | 'skipped';

export interface GameState {
  // ...campos existentes...
  onboarding?: OnboardingState;
}
```

**Chaves de `hintsSeen`** (one-shot, pós-tutorial): `'forge'` (1ª vez no Ferreiro), `'fusion'` (1ª fusão),
`'infirmary'` (1º herói ferido), `'second_recruit'` (gargalo de ouro do 2º recruta). Cada uma vira `true`
ao disparar, e o gate `if (!state.onboarding?.hintsSeen.forge)` garante o "uma vez só".

`onboarding` é **opcional** no tipo: saves antigos sem o campo continuam válidos até a migração rodar.

### 3.3 Estado inicial revisto

`initialGameState` (`gameReducer.ts:33-41`) passa a:

```ts
export const initialGameState: GameState = {
  gold: 25,                 // era 20 — cobre o 2º recruta (10 + 15) após a missão render ouro
  heroes: [createHero('WARRIOR')], // era [] — semeia 1 herói determinístico (sem RNG no 1º boot)
  heroesRecruited: 1,       // era 0 — mantém a fórmula de custo coerente (próximo custa floor(10*1.5)=15)
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

**Justificativa de balanço (e por que não trivializa):**

- **1 herói semeado** remove o paradoxo "vila cheia de prédios inúteis" e dá um alvo imediato para o passo
  "treinar". Classe **fixa `WARRIOR`** (determinística) para o tutorial ser reproduzível e o herói ser viável
  em `mission_1` (`atk:6` já passa, pois `mission_1` não tem `requirements`). Não usamos a classe aleatória de
  `handleRecruitHero` (`heroHandler.ts:13-14`) para o herói **semeado** — só para os recrutados depois.
- **`heroesRecruited: 1`** mantém a fórmula `getRecruitCost` honesta: o herói grátis "conta" como o 1º, então
  o próximo recruta custa `floor(10 * 1.5^1) = 15` — preço cheio, sem desconto disfarçado.
- **gold 25 (não mais):** o jogador **não** consegue o 2º herói de cara (25 < 15 só permite 1 recruta e sobra
  10). Ele precisa **completar `mission_1`** (ganha 1–10 de ouro) e repetir/treinar para juntar os 15. Isso
  **preserva** o loop "ouro só de missão" — o estado inicial dá um empurrão de **um** recruta extra, não uma
  economia de graça. Mata o soft-lock de "preso com 1 herói para sempre" sem dar nada passivamente.
- **Não viola "stats secundários não treináveis":** nada aqui treina DEF/CRIT/AGI; o passo "treinar" usa a
  tela de Treinamento existente, que já só permite hp/atk/mp (`trainingCount: {hp,atk,mp}` em
  `storage.ts:48-52`). O tutorial **não introduz** novo caminho de stat.

`createHero` precisa ser importado em `gameReducer.ts` (hoje só `heroFactory` é usado em `heroHandler.ts`).

### 3.4 Máquina de estados do tutorial (passos e gatilhos)

A transição de passo é **derivada do estado do jogo** dentro do `OnboardingProvider` (efeito que observa
`state`). Tabela de passos:

| Passo      | O que o overlay mostra | Alvo do spotlight | Gatilho de avanço (lido do `GameState`) |
|------------|------------------------|-------------------|------------------------------------------|
| `intro`    | Balão "Bem-vindo à sua guilda. Vamos formar sua primeira equipe." + botão "Começar" / "Pular" | centro da Vila | toque em "Começar" → `setStep('recruit')` |
| `recruit`  | "Você já tem 1 herói. Recrute mais um na **Guilda**." | card "Guilda" da Vila → depois o `RecruitButton` (`GuildScreen.tsx:60`) | `state.heroes.length >= 2` |
| `train`    | "Fortaleça seu herói: treine **+1 de ATK** no Treinamento." | tab/card "Treinamento" → botão de treino de ATK | qualquer `hero.trainingCount.atk >= 1` (lido do estado) |
| `mission`  | "Hora da ação. Envie sua equipe na **Primeira Patrulha**." | tab "Missões" → `MissionListItem` de `mission_1` (`MissionsScreen.tsx:73-78`) | `state.activeMissions?.some(m => m.templateId === 'mission_1')` — **dispara `track('ftue_first_mission_started')`** |
| `collect`  | "Sua equipe está em campo (~10s). Aguarde a recompensa." | `MissionActiveItem` em andamento (`MissionsScreen.tsx:55-61`) | `(+state.completedMissionCount ?? 0) >= 1` ou aparição de `recentMissionResults` |
| `done`     | Toast "Sua guilda começou. Boa sorte!" | — | persistente |

Notas de robustez:

- **Idempotência:** se o jogador já satisfez o gatilho de um passo (ex.: recrutou antes de o overlay pedir),
  o provider **pula** para o próximo passo cujo gatilho ainda não foi cumprido. O passo nunca regride.
- **`recruit` cobre as duas portas:** o gatilho é `heroes.length >= 2`, então recrutar pela **Loja** também
  satisfaz; o spotlight só **sugere** a Guilda (porta mais simples, sem modal de baú).
- **Sem timers no provider:** o passo `collect` não usa `setTimeout`; ele reage ao tick do jogo que conclui
  `mission_1` (motor existente em `tickHandler`/`missionHandler`). Sem relógio paralelo = sem dessincronização.

### 3.5 Componentes novos

**`OnboardingProvider` — `src/onboarding/OnboardingProvider.tsx`**
- Lê `state`/`dispatch` via `useGame()`. Deriva o passo (efeito sobre `state`). Expõe via contexto:
  `{ step, isActive, target, advance(), skip(), reset() }`.
- `target` é um id semântico (`'recruit-button' | 'train-atk' | 'mission-1' | 'active-mission'`) que o overlay
  resolve para coordenadas via **registry** (abaixo).
- `skip()` e `done` despacham uma ação nova `SET_ONBOARDING` (§3.6) para persistir a flag.

**`OnboardingOverlay` — `src/onboarding/OnboardingOverlay.tsx`**
- `Modal`/`View` absoluto, `pointerEvents="box-none"`, por cima do `AppNavigator`. Quando `isActive`:
  - **Spotlight:** escurece a tela (overlay `rgba(0,0,0,0.6)`) com um **recorte** sobre o `target` medido.
  - **Balão (coach mark):** card com o texto do passo + botões "Pular" (sempre) e "Entendi"/"Começar".
  - **Sem `target` medido** (passo numa tela não montada, ex.: pedir Treinamento estando na Vila): o balão vira
    um **ponteiro de navegação** ("Toque em *Treinamento*") sem recorte, e o overlay deixa o toque passar
    (`box-none`) para o jogador navegar.
- **Herda tokens** do `theme` (cores/spacing/borderRadius já existentes). Nenhum hex inline (respeita a regra
  do DS para não criar dívida para SPEC 3).

**Registry de alvos — `src/onboarding/targetRegistry.ts`**
- API mínima: `registerTarget(id, ref)` / `measureTarget(id): Promise<Layout | null>`.
- Telas/botões-alvo chamam `registerTarget('recruit-button', ref)` num `onLayout`/`ref`. São **3-4 call sites
  cirúrgicos** (RecruitButton na Guilda, botão de treino ATK no Treinamento, `MissionListItem` de `mission_1`,
  `MissionActiveItem`). Nada além disso muda nas telas.
- Se um alvo não está registrado (tela não montada), `measureTarget` retorna `null` → overlay cai no modo
  "ponteiro de navegação".

**Serviço de analytics (interface) — `src/services/analytics.ts`**
```ts
export type AnalyticsEvent =
  | 'ftue_started'
  | 'ftue_step_completed'   // props: { step }
  | 'ftue_first_mission_started' // props: { elapsedMs }
  | 'ftue_completed'        // props: { elapsedMs }
  | 'ftue_skipped';         // props: { step }

export interface Analytics { track(event: AnalyticsEvent, props?: Record<string, unknown>): void; }

// Default: no-op em prod, console em dev. SPEC 9 troca a impl pelo sink real.
export const analytics: Analytics = {
  track(event, props) { if (__DEV__) console.log('[analytics]', event, props ?? {}); },
};
```

### 3.6 Ação e handler do reducer

Bloco isolado, no padrão dos handlers existentes:

- **Tipo de ação** (`src/types/index.ts`, no union `GameAction`): `{ type: 'SET_ONBOARDING'; patch:
  Partial<OnboardingState> }`.
- **Handler** `src/context/onboardingHandler.ts`:
  ```ts
  export function handleSetOnboarding(state: GameState, patch: Partial<OnboardingState>): GameState {
    const base = state.onboarding ?? { version: 1, step: 'intro', startedAt: Date.now(), hintsSeen: {} };
    return { ...state, onboarding: { ...base, ...patch, hintsSeen: { ...base.hintsSeen, ...(patch.hintsSeen ?? {}) } } };
  }
  ```
- **Wire-up** em `gameReducer.ts` (junto dos outros `case`, ~linha 70): `case 'SET_ONBOARDING': return
  handleSetOnboarding(state, action.patch);`
- **Conveniências no `GameContext`** (espelhando `recruitHero`/`setHeroTask`): `advanceOnboarding(step)`,
  `skipOnboarding()`, `markHintSeen(key)`, `resetOnboarding()` — todas despacham `SET_ONBOARDING`.

### 3.7 Instrumentação da métrica (< 60s até 1ª missão)

- `startedAt` é gravado no `intro` (já no `initialGameState`, §3.3).
- **Call-sites dos 5 eventos** (todos no `OnboardingProvider`, derivados da transição de passo): `ftue_started`
  ao montar com `step === 'intro'`; `ftue_step_completed` `{ step }` a cada avanço de passo; `ftue_skipped`
  `{ step }` em `skip()`; `ftue_first_mission_started` e `ftue_completed` abaixo. Sem evento órfão.
- No avanço para `mission` cumprido (1ª `activeMission` de `mission_1`), o provider chama
  `analytics.track('ftue_first_mission_started', { elapsedMs: Date.now() - state.onboarding.startedAt })`.
- `ftue_completed` no passo `collect→done`, com seu **próprio** `elapsedMs = Date.now() - startedAt` (sempre
  ≥ o de `ftue_first_mission_started`, pois inclui os ~10s da missão). Ambos derivam do mesmo `startedAt`; não
  há acumulação manual.
- **Critério de produto:** mediana de `elapsedMs` de `ftue_first_mission_started` **< 60000**. Em dev/teste,
  o valor sai no `console` (sink no-op), e o teste unitário valida o **cálculo** do `elapsedMs` (não a rede).

### 3.8 Migração de persistência (v9)

`src/services/storage.ts`: `CURRENT_VERSION = 9` e nova entrada em `migrations`:

```ts
9: (data) => {
  // v9: bloco de onboarding. Saves antigos = jogador veterano → tutorial concluído (não re-tutorializa).
  if (data.onboarding === undefined) {
    data.onboarding = { version: 1, step: 'done', startedAt: data.lastSavedAt ?? Date.now(), hintsSeen: {} };
  }
  return data;
},
```

**Decisão:** quem já tem save (v8) **não** vê o tutorial — `step:'done'`. O tutorial é só para boot **sem
save** (caminho `initialGameState`). Isso evita interromper jogadores existentes e respeita o pipeline de
migração já validado (`storage.ts:93-106`).

### 3.9 Dicas contextuais pós-tutorial (reuso de milestones)

Estendem `src/services/milestones.ts` (mesmo `emitMilestone` → toast 4s, `milestones.ts:3-5`), **gated** por
`hintsSeen`:

| Gatilho | Onde pendura | Toast |
|---|---|---|
| 1ª visita ao Ferreiro | `BlacksmithScreen` mount (gate `!hintsSeen.forge`) | "🔨 Forje equipamentos com o ouro das missões para fortalecer a guilda." |
| 1ª fusão | toast já existe via `emitFirstFusion()` (`pantheonHandler.ts:112`, reducer puro — não despacha). O `OnboardingProvider` observa o estado pós-fusão e, no gate `!hintsSeen.fusion`, despacha `markHintSeen('fusion')` para persistir o one-shot (o toast em si fica como está) | (toast mantém) + `markHintSeen('fusion')` |
| 1º herói ferido | `OnboardingProvider` observa `state.heroes.some(h => h.currentTask === HeroTask.INFIRMARY)` (gate `!hintsSeen.infirmary`) — reativo ao estado, não a mount de tela (herói fica ferido no tick, sem o jogador abrir a Enfermaria) | "🩺 Heróis feridos se recuperam na Enfermaria." |
| Gargalo do 2º recruta | `GuildScreen` ao tocar recrutar com `gold < getRecruitCost(heroesRecruited)` (gate `!hintsSeen.second_recruit`) | "Complete missões para juntar ouro e recrutar mais heróis." |

Cada dica chama `markHintSeen(key)` (despacha `SET_ONBOARDING`), garantindo o one-shot persistido. Reusar o
serviço de milestones evita criar um 2º canal de toast.

---

## 4. Mudanças por Arquivo

| Arquivo | Ação | O que muda |
|---|---|---|
| `src/types/index.ts` | **mod** | Adiciona `OnboardingState`, `OnboardingStep`; `onboarding?: OnboardingState` no `GameState`; `{ type: 'SET_ONBOARDING'; patch }` no `GameAction`. |
| `src/context/gameReducer.ts` | **mod** | Import `createHero`; revisa `initialGameState` (linhas 33-41: gold 20→25, `heroes:[createHero('WARRIOR')]`, `heroesRecruited:0→1`, bloco `onboarding`); `case 'SET_ONBOARDING'` (~linha 70). |
| `src/context/onboardingHandler.ts` | **novo** | `handleSetOnboarding(state, patch)` — merge profundo de `hintsSeen`. |
| `src/services/storage.ts` | **mod** | `CURRENT_VERSION 8→9`; entrada `migrations[9]` (§3.8). |
| `src/services/analytics.ts` | **novo** | Interface `Analytics` + `analytics` no-op/console (§3.5). |
| `src/services/milestones.ts` | **mod** | `emitForgeHint()`, `emitInfirmaryHint()`, `emitSecondRecruitHint()` (§3.9), no padrão de `emitFirstTierForged` (`milestones.ts:27-29`). |
| `src/onboarding/OnboardingProvider.tsx` | **novo** | Máquina de estados; deriva passo de `state`; contexto `useOnboarding()`; observa `heroes.*INFIRMARY` para a dica `infirmary` (gate `!hintsSeen.infirmary` → `emitInfirmaryHint()` + `markHintSeen('infirmary')`). |
| `src/onboarding/OnboardingOverlay.tsx` | **novo** | Spotlight + coach mark; herda `theme`; `pointerEvents="box-none"`. |
| `src/onboarding/targetRegistry.ts` | **novo** | `registerTarget`/`measureTarget`. |
| `src/context/GameContext.tsx` | **mod** | Conveniências `advanceOnboarding`/`skipOnboarding`/`markHintSeen`/`resetOnboarding` (junto de `recruitHero`, linhas 109-119); expor no value (linhas 140-151). |
| `App.tsx` (raiz) | **mod** | Envolve `AppNavigator` com `<OnboardingProvider>` e renderiza `<OnboardingOverlay/>` (§3.1). |
| `src/screens/GuildScreen.tsx` | **mod** | `registerTarget('recruit-button', ref)` no `RecruitButton` (`GuildScreen.tsx:58-62`); ao tocar recrutar com `gold < getRecruitCost(heroesRecruited)`, `if (!hintsSeen.second_recruit) { emitSecondRecruitHint(); markHintSeen('second_recruit'); }`. |
| `src/screens/TrainingScreen.tsx` | **mod** | `registerTarget('train-atk', ref)` no botão de treino de ATK. |
| `src/screens/MissionsScreen.tsx` | **mod** | `registerTarget('mission-1', ref)` no `MissionListItem` de `mission_1` (`MissionsScreen.tsx:72-79`); `registerTarget('active-mission', ref)` no `MissionActiveItem` (`MissionsScreen.tsx:55-61`). |
| `src/screens/BlacksmithScreen.tsx` | **mod** | Mount: `if (!hintsSeen.forge) emitForgeHint(); markHintSeen('forge')`. |
| `src/__tests__/onboarding/onboardingHandler.test.ts` | **novo** | Testes do handler/migração/máquina (§5). |

---

## 5. Estratégia de Teste

**TDD nos pontos críticos** (handler, migração, derivação de passo, elapsedMs). "Integração > mock":
AsyncStorage real/in-memory para persistência, reducer real para a máquina de estados.

### 5.1 Unit — `handleSetOnboarding` (TDD primeiro)
- Patch parcial preserva campos não-tocados.
- `hintsSeen` faz **merge** (não substitui): `{forge:true}` + patch `{fusion:true}` → ambos `true`.
- `SET_ONBOARDING` num estado **sem** `onboarding` cria o bloco com defaults.

### 5.2 Unit — estado inicial revisto
- `initialGameState.heroes.length === 1` e classe `WARRIOR`; `heroesRecruited === 1`; `gold === 25`.
- `getRecruitCost(initialGameState.heroesRecruited) === 15` (confirma preço cheio do 2º recruta).
- **Anti-trivialização:** com `heroesRecruited === 1`, o próximo recruta custa `getRecruitCost(1) === 15` e o
  seguinte `getRecruitCost(2) === 22`. Com 25 de ouro o jogador faz **exatamente 1** recruta (sobra 10, abaixo
  dos 22 do 3º herói) — não consegue 2 de imediato. Teste explícito (binário):
  `gold(25) >= getRecruitCost(1) && gold(25) < getRecruitCost(1) + getRecruitCost(2)` → `25 >= 15 && 25 < 37`.

### 5.3 Unit/Integração — migração v9 (AsyncStorage in-memory, sem mock de lógica)
- Save v8 (sem `onboarding`) → `load()` → `onboarding.step === 'done'` (veterano não re-tutorializa).
- Save v9 com `onboarding` → round-trip preserva `step`/`hintsSeen`.
- Boot sem save → `initialGameState.onboarding.step === 'intro'`.

### 5.4 Unit — derivação de passo (reducer real + estados sintéticos do jogo real)
- `intro`+"Começar" → `recruit`.
- `recruit` com `heroes.length` 1→2 → avança para `train`.
- `train` com `trainingCount.atk` 0→1 → `mission`.
- `mission` ao surgir `activeMission` de `mission_1` → `collect` **e** `track('ftue_first_mission_started')`
  é chamado com `elapsedMs` = `now - startedAt` (spy no `analytics.track`).
- `collect` ao `completedMissionCount` 0→1 → `done`.
- **Idempotência:** estado que já satisfaz `recruit`+`train` pula direto para `mission`.

### 5.5 Unit — dicas pós-tutorial one-shot
- `emitForgeHint` dispara toast **uma vez**; 2ª chamada com `hintsSeen.forge===true` não emite.

### 5.6 Validação de UI (emulador/browser — Expo web :8081 + Playwright)
- Boot limpo (storage vazio) → Vila com balão `intro` → seguir spotlight → recrutar (Guilda) → treinar ATK →
  iniciar `mission_1` → ver recompensa → `done`. Screenshot por passo.
- **Pular tutorial** em cada passo → overlay some, `step:'skipped'` persiste (reload não retraz).
- **Cronômetro manual:** do boot ao `ftue_first_mission_started` < 60s seguindo os spotlights.
- Reload após `done`/`skipped` → tutorial **não** reaparece.

---

## 6. Critérios de Aceitação (binários e mensuráveis)

1. `npx tsc --noEmit` → **0 erros**.
2. `npm test` (jest.unit.config.js) → **verde**, incluindo os testes novos de §5.1–5.5.
3. `initialGameState`: `heroes.length === 1` (WARRIOR), `heroesRecruited === 1`, `gold === 25`,
   `onboarding.step === 'intro'` — **e** `getRecruitCost(1) === 15` (sem desconto disfarçado).
4. **Anti-gold-passivo:** nenhum `state.gold +=` (ou equivalente) introduzido fora do crédito de missão; o
   único delta econômico é o valor **estático** de `initialGameState` (`gold: 25`, +1 herói semeado),
   aplicado **uma vez** no boot sem save — não há ganho recorrente nem por tick. `OnboardingProvider`/overlay
   **não despacham** ação que altere `gold` (verificável por grep: nenhum `gold` no diff de `src/onboarding/`).
5. Boot sem save mostra o tutorial; save v8 migrado tem `onboarding.step === 'done'` e **não** mostra.
6. Tutorial **pulável** em qualquer passo; `skipped`/`done` persistem e **não** reaparecem após reload.
7. `analytics.track('ftue_first_mission_started', {elapsedMs})` é chamado exatamente **1×** ao iniciar
   `mission_1`; `elapsedMs` calculado de `startedAt`.
8. No caminho feliz validado em emulador/browser, **tempo-até-1ª-missão < 60s** (cronometrado).
9. 0 hex inline no overlay/coach mark (só tokens do `theme`) — não cria dívida para SPEC 3.
10. As 4 dicas pós-tutorial disparam **uma única vez** cada (flag `hintsSeen` persistida).

---

## 7. Riscos e Mitigação

| Risco | Sev. | Mitigação |
|---|---|---|
| Spotlight desalinha em telas diferentes (alvo numa tab não montada) | Médio | Modo "ponteiro de navegação" quando `measureTarget` retorna `null` (§3.5); `box-none` deixa o toque passar para navegar. |
| Tutorial e jogo dessincronizam (overlay acha que fez, jogo não fez) | Alto | Passo **derivado do `GameState` real** (heroes/activeMissions/completedMissionCount), nunca de sinal sintético; sem timers paralelos. |
| Migração v9 quebra save de veterano | Alto | v9 só **adiciona** `onboarding` (step `done`); round-trip testado com AsyncStorage real (§5.3); pipeline de migração já validado. |
| Estado inicial trivializa a economia | Médio | gold 25 dá só **1** recruta extra (não 2); 2º herói exige `mission_1` completa; teste §5.2 trava o invariante. |
| Overlay colide com `MissionResultModal`/`ChestRevealModal` | Médio | `OnboardingOverlay` no topo da árvore com `z-index`/ordem controlada; passo `collect` cede o foco ao `MissionResultModal` (não recorta enquanto o modal de resultado está aberto). |
| Coach mark vira dívida visual para SPEC 3 | Baixo | Overlay só usa tokens do `theme`; SPEC 3 reestiliza trocando tokens, sem mexer na lógica. |
| Classe fixa `WARRIOR` some se `CLASS_DEFS` renomear chaves | Baixo | Teste §5.2 referencia a chave; `createHero` valida a classe; renome quebra teste cedo. |

---

## 8. Dependências e Sequenciamento

- **Depende de SPEC 1** (estabilização): o ROADMAP §2 cita `SPEC 1 ──> SPEC 5`. Em particular, o **bug de
  gold de missão offline** (ROADMAP problema #2) e a **persistência robusta** precisam estar de pé — o passo
  `collect` confia que `mission_1` credita ouro de verdade, e a migração v9 assume o pipeline de `storage.ts`
  saudável.
- **Convive com SPEC 2/3 (DS/redesign):** o overlay é construído sobre `theme` (tokens). Quando SPEC 2 trocar
  os tokens e SPEC 3 reestilizar as telas, o onboarding herda o visual **sem** mudança de lógica. Os
  `registerTarget` ficam nos componentes mesmo que o estilo mude.
- **Habilita SPEC 9 (Store Readiness / analytics):** `src/services/analytics.ts` define a **interface** e os
  **call sites** (`ftue_*`); SPEC 9 pluga o sink real e liga a métrica D1/D7 (ROADMAP §4 H3) reusando o mesmo
  `track`.
- **Não bloqueia SPEC 4 (balance):** a única mudança de balanço aqui (estado inicial) é local e documentada;
  se SPEC 4 retunar a economia inicial, ajusta `initialGameState` no mesmo lugar, com o invariante do teste
  §5.2 como guarda.

---

*Gerado em 2026-06-20. Fundamentado em leitura de `gameReducer.ts`, `heroHandler.ts`, `constants/game.ts`,
`constants/missions.ts`, `constants/shop.ts`, `storage.ts`, `milestones.ts`, `feedback.ts`, `useShop.ts`,
`GameContext.tsx`, `AppNavigator.tsx`, `VillageScreen.tsx`, `ShopScreen.tsx`, `MissionsScreen.tsx`,
`GuildScreen.tsx` e `gameMath.ts`.*
