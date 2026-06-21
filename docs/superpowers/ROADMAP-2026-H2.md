# Roadmap idle_rpg — H2 2026 (6 meses, 3 horizontes)

> Documento mestre. Define a estratégia, o sequenciamento, o *Design Language* e as métricas
> de sucesso. Cada SPEC referenciado tem seu próprio arquivo em `docs/superpowers/specs/` e,
> para H1/H2, um plano executável em `docs/superpowers/plans/`.
>
> **Decisões de produto (2026-06-20):**
> - **Plataforma-alvo:** Mobile nativo (iOS/Android via Expo). Web continua como alvo de dev/teste,
>   mas o que conta é rodar nas lojas. → estilos web-only viram **bloqueadores de boot**.
> - **Ambição:** Lançar publicamente. → onboarding, retenção e monetização ética entram no escopo.
> - **Foco H1:** Estabilizar a base **e** profissionalizar o design, em paralelo.
> - **Identidade visual:** Fantasia medieval clássica, **dark-first** (couro/pedra escura + ouro +
>   serif Cinzel). Modo pergaminho-claro como opção secundária.

---

## 1. Diagnóstico que motiva o roadmap

O projeto é **funcionalmente rico** (todas as features dos roadmaps anteriores + 46 gaps de
auditoria + determinismo #47 estão mergeados) e **bem arquitetado** (reducer puro + handlers,
combate determinístico por seed, ~426 testes unit). Mas o git log esconde problemas reais:

| # | Problema | Severidade | Onde |
|---|---|---|---|
| 1 | `tsc --noEmit` vermelho (17 erros): estilos web-only, `@expo/vector-icons` ausente do `package.json`, `Audio` inexistente em `expo-audio`, `hp` em `Hero` | 🔴 Bloqueador mobile | SPEC 1 |
| 2 | **Gold de missão offline não creditado** — `offlineProgress` lê `remainingMs`, que o motor novo (`startedAt`+`scheduledActions`) não grava | 🔴 Crítico (retenção idle) | SPEC 1 |
| 3 | Persistência frágil — `LOAD_STATE` não migra; save corrompido apaga progresso em silêncio; sem backup/checksum | 🟠 Alto | SPEC 1 |
| 4 | Suite inflada — `.worktrees/` não ignorado (37/95 suites são duplicatas); coverage stale e sem threshold | 🟡 Médio | SPEC 1 |
| 5 | Design genérico — fontes do sistema, ícones 100% emoji, 4 paletas concorrentes (3 vermelhos de HP), zero gradiente/textura/ilustração, splash branco contradiz tema dark, `village_map.png` não usado | 🟠 Alto (prioridade do dono) | SPEC 2, 3 |
| 6 | Balanço inerte — 5/6 sinergias e 4/6 personalidades com Δ≈0 ou negativo; equipamentos ~0.4pp | 🟠 Alto | SPEC 4 |
| 7 | `tickHandler.ts` (499 LOC, deus-handler) e `battleEngine.ts` (791 LOC) — maior superfície de regressão | 🟡 Médio (habilitador) | SPEC 6 |
| 8 | Sem onboarding/FTUE; estado inicial não revisto | 🟠 Alto (lançamento) | SPEC 5 |

**Princípio condutor:** não construir conteúdo novo sobre uma base quebrada. H1 estabiliza e
veste o jogo; H2 aplica o redesign e torna as mecânicas relevantes; H3 prepara o lançamento.

---

## 2. Horizontes e SPECs

### HORIZONTE 1 — CURTO PRAZO (Mês 1–2): *"Fundação Sólida"*

| SPEC | Título | Objetivo de 1 linha | Plano |
|---|---|---|---|
| **1** | Estabilização Técnica & Boot Mobile | `tsc` verde, bug de gold offline corrigido, persistência robusta, suite limpa, boot validado em iOS/Android | sim |
| **2** | Design System "Reino" | Tokens (tipografia/elevação/raridade), fontes Cinzel+Inter, iconografia vetorial, paleta unificada dark-first, componentes-base com moldura | sim |

### HORIZONTE 2 — MÉDIO PRAZO (Mês 3–4): *"Cara Nova + Jogo Justo"*

| SPEC | Título | Objetivo de 1 linha | Plano |
|---|---|---|---|
| **3** | Redesign de Telas | Aplicar o DS nas 11 telas; Vila vira mapa interativo; microinterações; estados vazios polidos | sim |
| **4** | Balance & Economia | Sinergias +5pp, personalidades +3–10pp, equipamentos relevantes; ritmo econômico medido; gate de estrela do boss; balanço como gate de CI | sim |
| **5** | Onboarding & FTUE | Tutorial dos primeiros minutos, estado inicial revisto, dicas contextuais | sim |
| **6** | Refatoração Habilitadora | Quebrar `tickHandler`/`battleEngine`; reduzir acoplamento; preparar para escala | sim |

### HORIZONTE 3 — LONGO PRAZO (Mês 5–6+): *"Pronto pra Lançar"*

| SPEC | Título | Objetivo de 1 linha | Plano |
|---|---|---|---|
| **7** | Conteúdo & End-game | Novas missões/classes, prestígio/ascensão, eventos sazonais | design only |
| **8** | Monetização Ética & Retenção | Push notifications, daily login, cosméticos/IAP de conveniência (sem pay-to-win) | design only |
| **9** | Store Readiness | EAS Build, assets de loja, áudio/SFX/música, analytics, privacidade | design only |

**Dependências:**

```
SPEC 1 (estabilizar) ──┐
                       ├──> SPEC 3 (redesign) ──> SPEC 7 (conteúdo)
SPEC 2 (design system)─┘                          SPEC 8 (monetização) ──> SPEC 9 (store)
SPEC 1 ──> SPEC 6 (refatoração) ──> SPEC 4 (balance)
SPEC 1 ──> SPEC 5 (onboarding)
```

SPEC 2 e SPEC 1 podem correr em paralelo (worktrees distintos). SPEC 3 exige SPEC 2 pronto.
SPEC 4 se beneficia de SPEC 6 (engine modular facilita instrumentar o balanço), mas não depende.

---

## 3. Design Language do "Reino" (fonte de verdade)

Esta seção fixa a linguagem visual. SPEC 2 implementa os tokens; SPEC 3 os aplica. Qualquer
valor concreto abaixo é o **alvo**; SPEC 2 pode refiná-lo com justificativa, mas não diverge sem
atualizar este documento.

### 3.1 Princípios
1. **Um token, nunca um hex inline.** Lint barra `#rrggbb` em `src/screens` e `src/components`.
2. **Toda superfície tem profundidade** — gradiente sutil + sombra/elevação, nunca cor chapada.
3. **A tipografia carrega a hierarquia.** Cinzel nos títulos = identidade medieval instantânea.
4. **Ouro é a cor de marca** — usado com parcimônia, sinaliza valor/premium.
5. **Movimento intencional** — microinterações reforçam a ação (Reanimated v4 + Lottie já no projeto).
6. **Dark-first, quente.** Sai o navy frio (`#0F0D23`), entra couro/pedra escura quente.

### 3.2 Paleta (dark-first) — alvo de tokens

```
// Superfícies (couro / pedra / madeira escura, quente)
bgDeep        #15100B   // moldura externa / quase-preto quente
bgBase        #1E1710   // fundo de tela
surface       #2A2018   // card / couro
surfaceRaised #362A1F   // card elevado / pergaminho escurecido

// Marca (ouro velho — menos neon que o #F59E0B atual)
gold          #C9A227
goldBright    #E8C45A   // realce / brilho
goldDark      #8A6D1B   // moldura

// Acento quente
ember         #B5471F   // brasa — ações destrutivas/críticas
blood         #7E2A1E

// Stats (UNIFICAR — hoje há 3 vermelhos de HP soltos)
statHp        #C0392B
statAtk       #C8772E
statMp        #3E6E8E
statDef       #6B7280

// Raridade (tokens de PRIMEIRA classe — hoje soltos em constants/equipment.ts)
rarityCommon    #9CA3AF   // ferro/prata
rarityRare      #3E7CB1   // azul
rarityEpic      #8E5BC4   // roxo
rarityLegendary #E8C45A   // dourado (+ glow)

// Texto (sobre superfície escura quente)
textPrimary   #F3E9D2   // marfim/pergaminho claro
textSecondary #C4B499   // bege
textMuted     #8A7B63   // sépia

// Bordas / molduras
border        #4A3826   // madeira
borderGold    #8A6D1B   // moldura dourada

// Feedback (musgo medieval, não neon)
success       #6B8E23
successBright #9ACD32
danger        = ember
warning       = goldBright
```

Modo **pergaminho-claro** (opcional, SPEC 2 entrega o switch): `bgBase #E8DCC0`,
`surface #F2E9CF`, `textPrimary #2A2018`, mantendo ouro/raridade/stats.

### 3.3 Tipografia
- **Cinzel** (serif lapidar) — `display` (900), `h1` (700), `h2` (600). Identidade.
- **Inter** — corpo, labels, números (tabular). Legibilidade em mobile.
- **Alegreya** (serif humanista) — *opcional*, só para *flavor text* (descrições de sabor).
- Carregadas via `expo-font`. Sem fonte → fallback do sistema (degrade gracioso).

Tokens semânticos (`fontFamily` + `fontSize` + `lineHeight` + `letterSpacing` + `weight` juntos):

```
display  Cinzel  900  32/40  +0.5
h1       Cinzel  700  24/30  +0.3
h2       Cinzel  600  18/24  +0.2
bodyLg   Inter   400  16/24   0
body     Inter   400  14/20   0
label    Inter   600  12/16  +0.4   (UPPERCASE opcional)
caption  Inter   500  11/14  +0.2
stat     Inter   700  — / —    0    (tabular-nums)
```
Elimina os pesos soltos `'800'`/`'900'` espalhados (ComingSoon, MissionResultModal, ScreenHeader).

### 3.4 Elevação / sombra (tokens novos — hoje inexistentes)
`e0` none · `e1` card · `e2` card elevado · `e3` modal · `e4` overlay.
Glow para raridade: `glowGold`, `glowEpic`, `glowLegendary`.
Banir o `boxShadow` inline duplicado (`HeroCard:250`, `VillageScreen:138`).

### 3.5 Forma & moldura
- `borderRadius`: medieval pede cantos menos arredondados → `sm 4 · md 8 · lg 12 · xl 16`.
- Componentes de identidade (SPEC 2):
  - `OrnateFrame` — moldura com cantos decorativos (SVG) + borda dourada.
  - `Banner` — faixa de título de tela (substitui `ScreenHeader` cru).
  - `Divider` — divisória ornamental.
  - `Seal` — selo/brasão circular (para classes, conquistas).
  - `Parchment` — superfície com textura sutil.

### 3.6 Iconografia
- **Fim do emoji.** Stats, ações e navegação usam vetor.
- Base: `@expo/vector-icons` (já importado por `AppNavigator`, falta instalar) →
  MaterialCommunityIcons tem `sword`, `shield`, `castle`, `anvil`, `bottle-tonic`, etc.
- SVGs custom (via `react-native-svg`, já instalado) para os 4 stats principais e brasões de classe.

### 3.7 Textura, gradiente, ilustração
- Instalar `expo-linear-gradient` → gradientes sutis em cards/botões/fundos.
- Overlay de textura (couro/pergaminho) com baixa opacidade nas superfícies grandes.
- Usar `village_map.png` de fato (Vila vira mapa — SPEC 3).
- Ampliar Lottie (hoje só confetti/chest_pulse/sparkle): level-up, forja, recrutamento.

### 3.8 Plataforma coerente
- `app.json`: `userInterfaceStyle: "dark"`, splash e adaptive-icon em `#15100B` (fim do flash branco).

---

## 4. Métricas de sucesso por horizonte

**H1 (Fundação):**
- `npx tsc --noEmit` → 0 erros. `npm test` → verde, sem duplicatas de worktree, coverage com threshold (branches ≥ 80%).
- Save→offline→reload credita gold de missão corretamente (teste de integração cobre).
- App **builda e dá boot** em emulador Android e iOS (EAS dev build ou Expo Go), sem crash de ícones/áudio.
- Design System publicado: `theme` expandido, fontes carregando, 0 hex inline em screens/components (lint verde).

**H2 (Cara Nova + Jogo Justo):**
- 11 telas redesenhadas com o DS; Vila interativa; validação no browser/emulador screenshot-a-screenshot.
- `balance_analysis.ts` mostra ≥5/6 sinergias com Δ≥+5pp e personalidades no alvo; roda como gate.
- Novo jogador chega à 1ª missão em < 60s com tutorial; estado inicial documentado.

**H3 (Lançamento):**
- Build de produção EAS assinado; assets de loja completos; áudio integrado.
- Push notifications e daily login ativos; analytics de retenção instrumentado (D1/D7).

---

## 5. Modo de execução

- Cada SPEC vira uma branch/worktree (`feat/<spec-slug>`) seguindo o padrão do projeto (`.worktrees/`).
- TDD onde há lógica crítica (offline, persistência, balance) — convenção do projeto.
- Validação de UI **no emulador/browser** antes de declarar tela pronta — convenção do projeto.
- Commits pequenos por unidade coerente; mensagem foca no *porquê*.
- H1/H2 têm planos executáveis (`docs/superpowers/plans/`); H3 ganha plano ao iniciar (depende de
  aprendizados de balance/retenção de H2).

---

*Gerado em 2026-06-20. Atualize a tabela de status conforme os SPECs forem entregues.*
