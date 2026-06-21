# Monetização Ética & Retenção — Design Spec

**Data**: 2026-06-20
**Status**: Direção (design-only) — aguardando revisão
**Referência**: SPEC 8 do `docs/superpowers/ROADMAP-2026-H2.md` (Horizonte 3 — "Pronto pra Lançar")
**Escopo**: Definir a **direção** de push notifications, daily login/streak, monetização ética (cosméticos + IAP de conveniência) e o modelo de retenção D1/D7/D30. Não cobre implementação nem plano de tasks (isso vira plano em H3, junto de SPEC 9 — Store Readiness).

> **Marcação**: este é um spec de **direção**. As seções 3–4 trazem recomendações com trade-offs explícitos e a seção 9 lista as perguntas abertas que precisam de decisão do dono antes do plano executável. Tudo abaixo é fundamentado no código real lido (citado por arquivo:LOC), não em suposição.

---

## 1. Contexto e Problema

### 1.1 O que existe hoje (medido no código)

O jogo já tem os **loops de engajamento** prontos, mas **zero superfície de retenção fora do app** e **zero monetização**.

**Loops de retenção já implementados:**

- **Daily quests** — `src/constants/dailyQuests.ts:10-19` define um pool de 8 quests; `pickDailyQuests` (`:25-43`) escolhe 3 com trackers únicos via seed diário (`getDailySeed`, `:45-48`, formato `YYYYMMDD`). Recompensas: 25–80 de gold por quest + `DAILY_BONUS_REWARD = 100` por completar as 3 (`:22`). O handler (`src/context/dailyQuestHandler.ts`) faz refresh por seed (`refreshDailyQuests:4-18`), acumula progresso (`updateDailyProgress:20-28`) e credita gold no claim (`claimDailyQuest:30-55`, linha `:52` faz `gold: state.gold + def.reward + bonusGold`).
- **Weekly cycle** — `GameState.weeklyState` (`src/types/index.ts:97-103`): quests semanais + boss semanal (`bossDefeated`). Handler em `src/context/weeklyHandler.ts`.
- **Milestones / toasts** — `src/services/milestones.ts:1-33`: 8 eventos de marco (skill desbloqueada, 1ª fusão, fusão com estrelas, quest/boss semanal, 1º tier forjado, drop de material raro) emitidos como `FeedbackEvent.TOAST` com `type: 'milestone'`, duração 4000ms. **Esses marcos só aparecem com o app aberto** — não há hook para notificar offline.
- **Loja (gameplay)** — `src/constants/shop.ts:15-19`: 3 baús de herói (`chest_bronze/silver/gold`), todos comprados **com gold** (`handleBuyChest`, `src/context/heroHandler.ts:26-37`, custo = `getRecruitCost(heroesRecruited) * costMultiplier`). **Não há moeda premium, IAP, nem cosméticos** — a "loja" atual é 100% sink de gold de gameplay.

**Economia (regra de produto confirmada no código):**

- Gold entra por **missão completada** (`src/context/missionHandler.ts:273`, `applyGoldBonus(reward, state)`), **daily/weekly claim** (`dailyQuestHandler.ts:52`, `weeklyHandler.ts:62`) e **achievements** (`achievementHandler.ts:27`). O tracker `goldEarned` é alimentado no tick (`tickHandler.ts:483`). **Não existe gold passivo** — confirmado: nenhum caminho credita gold sem uma ação/missão concluída. Isso valida a regra de produto da memória do dono e **restringe** o design de daily login (ver §3.2).
- Inventário já modela `inventory?: Equipment[]` (`:73`) e `materials?: Record<string, number>` (`:104`) — **há onde colar recompensas não-gold** (materiais, chaves) sem inventar estrutura nova.

### 1.2 A dor concreta

1. **O idle não "chama de volta".** O motor offline credita progresso de missão em loop (mecanismo offline confirmado pela memória do dono), mas o jogador **não sabe** quando uma missão/boss terminou ou quando o daily resetou. Sem push, o ciclo idle→retorno depende de o jogador lembrar sozinho. `expo-notifications` **não está no `package.json`** (deps verificadas: só `expo-audio`, `expo-font` via expo, `lottie`, `reanimated`, `svg`, `async-storage`) — toda a camada de push é **greenfield**.
2. **Daily login não existe** — só daily *quests* (que exigem jogar). Falta o gancho de "abriu o app = ganhou algo", que é o degrau D1 mais barato. E ele tem que respeitar "sem gold passivo": login não pode simplesmente cuspir gold.
3. **Monetização zero** e o objetivo é **lançar publicamente**. Sem um modelo ético definido (cosméticos + conveniência), o risco é cair em pay-to-win (que viola a regra do dono) ou em ads agressivos que matam retenção.
4. **Sem modelo de retenção articulado.** O roadmap (métricas H3, ROADMAP §4) pede "push + daily login ativos; analytics D1/D7", mas não diz *quais loops* sustentam cada janela. Este spec preenche isso.

---

## 2. Objetivos e Não-Objetivos

### 2.1 Objetivos

1. **Push opt-in, útil, sem spam** — definir os 3–4 gatilhos que valem uma notificação (missão/boss pronto, daily reset, heróis ociosos), com teto de frequência e quiet hours.
2. **Daily login + streak que NÃO violam "sem gold passivo"** — recompensar com materiais, chaves de baú e cosméticos; tratar qualquer gold de login como **exceção controlada e justificada** (ver §3.2) ou eliminá-lo.
3. **Monetização ética catalogada** — lista explícita do que é **aceitável** (cosmético, conveniência limitada) vs. o que **cruza a linha** (pay-to-win), ancorada no DS "Reino" (SPEC 2) para os cosméticos.
4. **Modelo D1/D7/D30** — mapear cada janela de retenção ao loop que a sustenta, com o KPI-alvo e o gatilho de notificação correspondente.
5. **Tudo respeitando a regra do dono**: stats secundários (DEF/CRIT/AGI) não-treináveis e não-vendáveis; sem gold passivo; sem vantagem de combate comprável.

### 2.2 Não-Objetivos (YAGNI)

- **Implementação** — nenhum código nesta entrega. Sem `pushHandler.ts`, sem telas, sem chamadas a `expo-notifications`.
- **Plano de tasks** — fica para o plano de H3 (`docs/superpowers/plans/`), que depende de aprendizados de balance (SPEC 4) e store (SPEC 9).
- **Backend de servidor / contas** — manter offline-first com `AsyncStorage`. Sem login social, sem sync de nuvem, sem catálogo remoto de IAP nesta direção (anotado como pergunta aberta).
- **Loot boxes pagas / gacha premium** — explicitamente fora; conflita com "ético, sem pay-to-win".
- **Battle pass / assinatura** — fora da primeira direção (anotado como pergunta aberta para pós-lançamento).
- **Ads** — decisão pendente (§9); a direção **recomenda começar sem ads** e não desenha unidades de anúncio.

---

## 3. Design Detalhado (direção)

### 3.1 Push notifications (opt-in, sem spam)

**Stack alvo:** `expo-notifications` (a adicionar no `package.json`) + agendamento **local** (não precisa de servidor de push para os gatilhos abaixo, todos derivados do estado local). Push remoto só seria necessário para eventos sazonais empurrados pelo dono (out of scope aqui).

**Modelo de gatilhos — apenas 4, todos derivados de campos que já existem no `GameState`:**

| # | Gatilho | Fonte no estado | Quando agendar | Cap |
|---|---|---|---|---|
| N1 | **Missão pronta** | `activeMissions[]` — fim derivado de `startedAt` + `scheduledActions[].atMsFromStart` (`types:154,160`), ou `finishAt?` quando gravado (`types:155`) / `forgingQueue[].finishAt` (`types:74`) | no `START_MISSION`/`FORGE_EQUIPMENT`, agenda 1 notif para o instante de término | 1 por missão/forja |
| N2 | **Boss semanal pronto / disponível** | `weeklyState` (`types:97-103`); boss libera no reset semanal | no reset semanal, se boss não derrotado | 1/semana |
| N3 | **Daily reset** | `getDailySeed()` mudou (`dailyQuests.ts:45`) | agenda diária para a virada local de dia | 1/dia, respeitando quiet hours |
| N4 | **Heróis ociosos** | herói sem `task`/missão há > X horas (varre `heroes[]`/`activeMissions`) | agenda relativa quando todos os heróis ficam sem ação | máx. 1 a cada 24–48h |

**Regras anti-spam (não-negociáveis):**

- **Opt-in real.** Primeira permissão pedida **depois** do FTUE (SPEC 5), não no boot. Recusar = jogo 100% funcional.
- **Quiet hours** padrão 22h–9h (local). N3/N4 nunca disparam dentro da janela; reagendam para o fim dela.
- **Teto global**: no máx. **2 notificações/dia** somando todos os gatilhos (valor default; confirmar em §9.7). N1 (a mais valiosa) tem prioridade; N4 é a primeira a ser suprimida se o teto for atingido.
- **Cancelamento**: ao abrir o app, cancelar notificações já "consumidas" (ex.: jogador já viu a missão pronta) para não notificar redundante.
- **Categorias toggláveis** nas Configurações: o jogador liga/desliga cada classe (N1–N4) individualmente.

**Forma (alinhada ao DS "Reino", ROADMAP §3):** texto curto, voz de fantasia medieval, sem emoji nos títulos (o roadmap decreta "fim do emoji" na UI; manter coerência). Ex.: título "Vossa missão terminou", corpo "Os heróis retornaram com o butim. Tocai para recolher." Ícone de notificação = brasão dourado sobre `#15100B` (cor de marca, ROADMAP §3.8).

**Dado de estado novo (direção, não esquema final):** um bloco `notifications?: { optedIn: boolean; categories: Record<'mission'|'boss'|'daily'|'idle', boolean>; quietHours: [number, number]; scheduledIds: Record<string,string> }` em `GameState`, persistido junto do save. `scheduledIds` mapeia gatilho→id retornado por `scheduleNotificationAsync` para permitir cancelamento idempotente.

### 3.2 Daily login & streak (respeitando "sem gold passivo")

**A restrição dura:** o código confirma que **gold só entra por missão/daily-claim/achievement** (§1.1). Um "login reward = +N gold" **seria** gold passivo (o jogador ganha gold sem completar nada) e **viola a regra do dono**. Logo:

**Recomendação primária (sem exceção): recompensas NÃO-gold.** O daily login dá itens que já têm slot no estado:

| Dia da streak | Recompensa | Slot no estado |
|---|---|---|
| 1 | Material comum (×N) | `materials` (`types:104`) |
| 2 | Material comum (×2N) | `materials` |
| 3 | **Chave de baú** (1 abertura grátis de `chest_bronze`) | nova: `keys?: Record<string,number>` |
| 4 | Material raro | `materials` |
| 5 | Chave de baú prata | `keys` |
| 6 | Cosmético rotativo (moldura/brasão) | inventário cosmético (§3.3) |
| 7 | **Chave de baú ouro** + cosmético | `keys` + cosmético |

A streak reseta se o jogador pular um dia (com **1 "graça"/mês** opcional — pergunta aberta). O "dia" usa o mesmo `getDailySeed()` que já governa o daily quest, garantindo consistência de fuso e uma única fonte de verdade para "que dia é".

**Por que chaves e não gold:** a chave dá acesso a um baú de herói (conteúdo de gameplay) **sem injetar gold na economia** — o sink de gold do baú (`handleBuyChest`) é *contornado* pela chave, mas isso é uma recompensa **de conteúdo**, não moeda fungível que desestabiliza o balanço (SPEC 4). Materiais alimentam a forja sem mexer no fluxo de gold. Cosméticos são puramente estéticos.

**Exceção controlada (se o dono aprovar):** um **micro-bônus de gold só no dia 7** (ex.: equivalente a ~1 missão), enquadrado como "recompensa de marco semanal", não como renda passiva diária. Trade-off: simplifica a percepção de recompensa para jogadores que ainda não engajaram com forja/baús, mas **abre um precedente** de gold-sem-missão. **Recomendação: NÃO incluir** na v1; manter a regra limpa. Decisão fica em §9.

**Trade-off de design da streak:** streaks longas premiam quem já está retido e punem quem volta depois de um lapso (frustração no churn-and-return). Mitigação: streak **curta de 7 dias que cicla** (não escala infinitamente) + a "graça" mensal. Evita o anti-padrão de "perdi 200 dias de streak, desisto".

### 3.3 Monetização ética

Dois pilares, ambos sem tocar em poder de combate.

**Pilar A — Cosméticos (a espinha dorsal ética).** Usa o DS "Reino" (SPEC 2) como matéria-prima visual: o roadmap já planeja `OrnateFrame`, `Seal` (brasão), `Banner`, `Parchment` e tokens de raridade (ROADMAP §3.5). Catálogo de cosméticos:

- **Molduras de herói** (`OrnateFrame` variantes) — bordas decorativas no `HeroCard`.
- **Brasões / selos** (`Seal`) — emblema do jogador/guilda, exibido no perfil e na Vila.
- **Skins de herói** — paletas/temas alternativos por classe (não alteram stats).
- **Temas de UI** — além do dark-first e do pergaminho-claro já planejados (ROADMAP §3.2), temas pagos extras (ex.: "Forja Vulcânica", "Cripta Gélida"), só trocam tokens de cor/textura.

Cosméticos são **puramente visuais**, persistidos em algo como `cosmetics?: { owned: string[]; equipped: Record<slot,string> }`. Vendidos por **moeda premium** (comprada via IAP) e/ou desbloqueados por streak/conquista (§3.2). **Nunca** dão stat.

**Pilar B — IAP de conveniência (a linha tênue).** Catalogar com rigor o que **acelera** sem **vencer por você**:

| Item | Aceitável? | Justificativa |
|---|---|---|
| **+1 slot de missão** permanente | ✅ Aceitável | Aumenta throughput de *tempo*, não de poder; quem não paga chega ao mesmo lugar mais devagar. Limite rígido (ex.: máx. +2) para não virar P2W de farm. |
| **Dobrar velocidade de forja** (reduz `forgingQueue[].finishAt`) | ✅ Aceitável (com teto) | Conveniência de tempo. O item forjado é o mesmo; só sai antes. Não dá item melhor. |
| **Remover quiet hours / segundo slot de daily** | ⚠️ Cinza | Conveniência, mas mexe em ritmo; avaliar se distorce a economia de daily-gold. Default: **não** na v1. |
| **Pacote de moeda premium** (para cosméticos) | ✅ Aceitável | Premium só compra estética. |
| **Comprar gold direto** | ❌ Cruza a linha | É gold passivo pago = vantagem de gameplay + viola a regra do dono. **Proibido.** |
| **Comprar stats/equip/heróis raros** | ❌ Cruza a linha | Pay-to-win explícito. **Proibido.** |
| **Loot box paga / gacha de herói** | ❌ Cruza a linha | Aleatoriedade paga por poder. **Proibido.** |
| **XP/level boost** | ❌ Cruza a linha | Compra progressão de poder. **Proibido.** |

**Regra-mestra (o teste de uma frase):** *"Um jogador que nunca paga pode alcançar qualquer estado de poder do jogo só com tempo?"* Se a resposta for **não** por causa de um item, o item **cruza a linha**. Conveniência comprime tempo; nunca destrava poder inacessível.

**Implicação para a loja atual:** a `ShopScreen` (`src/screens/ShopScreen.tsx`) e `SHOP_ITEMS` (`shop.ts`) permanecem 100% gameplay (gold). A monetização entra como uma **superfície separada** (aba "Cosméticos" / "Loja Real") para não confundir o jogador sobre o que é pago vs. ganho com gold — separação ética e de UX.

### 3.4 Modelo de retenção D1/D7/D30

Cada janela mapeada ao loop que a sustenta, ao gatilho de push e ao KPI-alvo (alvos são *direção*, a calibrar com analytics de SPEC 9):

| Janela | Loop que sustenta | Gatilho de volta | KPI-alvo (direção) |
|---|---|---|---|
| **D1** | FTUE completo (SPEC 5) → 1ª missão → daily login dia 1 → opt-in de push | N1 (missão pronta), N3 (daily reset) | D1 ≥ 35% |
| **D7** | Streak de login (7 dias), daily quests, 1ª forja, 1ª fusão, weekly boss | N2 (boss), N3, N4 (ociosos) | D7 ≥ 15% |
| **D30** | Weekly cycle recorrente, coleção de cosméticos, end-game/prestígio (SPEC 7) | N2, eventos sazonais | D30 ≥ 6% |

**Leitura:** D1 é barato e mecânico (push + login dia 1). D7 depende de o jogador *entrar* nos loops de profundidade (forja/fusão/boss) — daí a streak de 7 dias casar com a primeira semana. D30 exige **conteúdo recorrente** (SPEC 7) e **colecionismo** (cosméticos) — por isso monetização ética e retenção de longo prazo são o mesmo problema: o cosmético é tanto receita quanto âncora de D30.

**Contrato de eventos de analytics (definido aqui; emissão real em SPEC 9).** Nomes e payload mínimo que SPEC 9 deve emitir para medir as janelas acima:

| Evento | Quando | Payload mínimo |
|---|---|---|
| `session_start` | abertura do app | `{ daySeed, optedInPush }` |
| `login_reward_claimed` | claim de login | `{ streakDay, rewardType }` (`rewardType ∈ material/key/cosmetic`, **nunca `gold`**) |
| `push_opt_in` | permissão concedida | `{ source: 'ftue' \| 'settings' }` |
| `push_opened` | toque numa notificação | `{ trigger: 'mission' \| 'boss' \| 'daily' \| 'idle' }` |
| `cosmetic_equipped` | equipar cosmético | `{ cosmeticId, slot }` |

D1/D7/D30 são derivados de `session_start` por `installId` no analytics (SPEC 9), não um evento próprio. Este spec **fixa o contrato**; SPEC 9 **instrumenta**.

---

## 4. Mudanças por Arquivo (direção — quando o plano de H3 for escrito)

> Lista de *intenção arquitetural*, não de implementação. Caminhos exatos; "criar" = greenfield.

| Arquivo | Mudança |
|---|---|
| `package.json` | **Adicionar** `expo-notifications`. (Confirmado ausente.) Eventual `expo-in-app-purchases`/RevenueCat fica para SPEC 9. |
| `src/types/index.ts` | **Estender `GameState`** (após `:104`) com `notifications?`, `loginStreak?: { lastDaySeed: number; streak: number; claimedToday: boolean }`, `keys?: Record<string, number>`, `cosmetics?: { owned: string[]; equipped: Record<string, string> }`. **Estender `GameAction`** (após `:128`) com `CLAIM_LOGIN_REWARD`, `SET_NOTIFICATION_PREFS`, `EQUIP_COSMETIC`, `OPEN_KEY_CHEST`. |
| `src/constants/loginRewards.ts` | **Criar** — pool de 7 dias de recompensas não-gold (espelhando o estilo de `dailyQuests.ts:10-19`). |
| `src/constants/cosmetics.ts` | **Criar** — catálogo de molduras/brasões/skins/temas, com `rarity` (tokens de SPEC 2) e preço em premium. Sem campo de stat. |
| `src/context/loginStreakHandler.ts` | **Criar** — `refreshLoginStreak`/`claimLoginReward`, espelhando a forma pura de `dailyQuestHandler.ts` (seed-gated, sem efeito colateral). |
| `src/context/notificationHandler.ts` | **Criar** — reducer de prefs (puro); o agendamento real fica num serviço (abaixo) para manter o reducer livre de I/O. |
| `src/services/notifications.ts` | **Criar** — wrapper de `expo-notifications` (schedule/cancel/permissions, quiet hours, cap). Serviço com I/O, fora do reducer. |
| `src/services/milestones.ts` | **Ajustar** — hoje só emite toasts in-app (`:1-33`); avaliar emitir push N1/N2 quando o app está em background (sem quebrar o caso foreground atual). |
| `src/screens/ShopScreen.tsx` / nova aba | **Não tocar a loja de gold**; criar superfície separada de cosméticos/premium. |
| `src/screens/SettingsScreen.tsx` | Toggles de categorias de notificação (N1–N4) + quiet hours. |

---

## 5. Estratégia de Teste (direção)

Como é design-only, aqui ficam os **casos que o plano de H3 deverá cobrir** (TDD onde crítico; "integração > mock" — AsyncStorage real, conforme convenção):

**Unit (lógica pura, sem mock de DB):**
- `loginStreakHandler`: (a) primeiro login do dia incrementa streak; (b) segundo login no mesmo `daySeed` é no-op (`claimedToday`); (c) pular um dia reseta para 1 (ou consome graça, se habilitada); (d) recompensa creditada é **não-gold** — asserção explícita de que `state.gold` **não muda** no claim de login (guarda da regra "sem gold passivo").
- `notificationHandler`: prefs default = **não-inscrito** (`optedIn: false`, todas as categorias `false`); só vira `true` após o opt-in explícito pós-FTUE; toggles persistem; cap reduz N4 antes de N1.
- `cosmetics`: equipar cosmético **não altera nenhum stat** do herói (asserção sobre `atk/hp/def/...`).
- Catálogo de IAP: teste-guarda que percorre o catálogo e **falha** se algum item de conveniência conceder gold/stat/equip (trava automatizada contra P2W).

**Integração (AsyncStorage in-memory real):**
- Save com `loginStreak`/`notifications`/`cosmetics` → reload → estado preservado (cobre a migração de `LOAD_STATE`, que o SPEC 1 já precisa endurecer — ROADMAP problema #3).
- Streak através de virada de dia: simular `getDailySeed` em dois dias consecutivos e confirmar incremento.

**Validação de UI (emulador, convenção do projeto):**
- Pedido de permissão de push aparece **após** FTUE, nunca no boot.
- Notificação local de teste (N1) dispara e, ao tocar, abre a missão pronta.
- Aba de cosméticos com tokens do DS "Reino" (0 hex inline — lint do SPEC 2), molduras renderizando no `HeroCard`.
- Quiet hours respeitada (N3 agendado fora da janela).

---

## 6. Critérios de Aceitação (para o plano de H3, mensuráveis)

- `npx tsc --noEmit` → **0 erros** após estender `GameState`/`GameAction`.
- `npm test` verde, incluindo o **teste-guarda anti-P2W** (catálogo) e o teste **`gold` inalterado no claim de login**.
- **0 caminhos novos** que creditam gold. Os únicos slots permitidos hoje são missão (`missionHandler.ts:273`), daily-claim (`dailyQuestHandler.ts:52`), weekly-claim (`weeklyHandler.ts:62`) e achievement (`achievementHandler.ts:27`); grep automatizado sobre `state.gold +` nos handlers **novos** deste spec = **0 ocorrências**.
- Push **não-inscrito por padrão** (`optedIn: false`, categorias `false`); a inscrição só ocorre via opt-in explícito pós-FTUE. Recusar/ignorar a permissão mantém o jogo 100% funcional (sem crash, sem bloqueio).
- Teto de **≤ 2 notificações/dia** verificável em teste de agendamento.
- Cosméticos: **0** campos de stat no `cosmetics.ts` (asserção de tipo + teste).
- IAP de conveniência: **nenhum** item da tabela §3.3 marcado ❌ presente no catálogo.
- Contrato de eventos de retenção (D1/D7/D30) **definido neste spec** (nomes + payload na §3.4); a instrumentação/emissão real é critério de **SPEC 9**, não deste plano.

---

## 7. Riscos e Mitigação

| Risco | Sev. | Mitigação |
|---|---|---|
| **Push vira spam → desinstalação** | Alto | Teto ≤2/dia, quiet hours, opt-in pós-FTUE, categorias toggláveis. N4 (ociosos) é o primeiro a cortar. |
| **Chave/material de login distorce o balanço (SPEC 4)** | Médio | Recompensas de login entram como *input* na simulação de balance; calibrar quantidades com `balance_analysis.ts` (gate de CI do SPEC 4) antes de fixar. |
| **Pressão futura por "só um item de gold pago"** → erosão da regra anti-P2W | Médio | Teste-guarda automatizado (§5) que **quebra o build** se gold/stat virar comprável. A regra fica codificada, não só documentada. |
| **Migração de save quebra com campos novos** | Alto | Depende do `LOAD_STATE` robusto do SPEC 1 (ROADMAP #3); todos os campos novos são `?:` opcionais e default-seguros. |
| **Streak punitiva aumenta churn de retornantes** | Médio | Streak de 7 dias que cicla + 1 graça/mês; não escalar streak infinitamente. |
| **Loja de gold vs. loja real confunde o jogador** | Médio | Superfícies **separadas** (§3.3); premium nunca aparece misturado com itens de gold. |
| **Política de loja (Apple/Google) sobre IAP/streak** | Médio | Pergunta aberta §9; SPEC 9 (Store Readiness) valida compliance antes do submit. |

---

## 8. Dependências e Sequenciamento

**Depende de:**
- **SPEC 1** (Estabilização) — `LOAD_STATE` robusto/migração de save (ROADMAP #3) é pré-requisito para adicionar campos a `GameState` sem apagar progresso.
- **SPEC 2** (Design System "Reino") — fornece `OrnateFrame`/`Seal`/`Banner`/tokens de raridade que **são** os cosméticos; sem o DS, não há catálogo cosmético coerente.
- **SPEC 5** (Onboarding/FTUE) — define o momento pós-tutorial onde o opt-in de push é pedido.

**Beneficia-se de:**
- **SPEC 4** (Balance) — calibra as quantidades de material/chave do login para não distorcer a economia; o gate de balance valida.
- **SPEC 7** (Conteúdo/End-game) — fornece a profundidade recorrente que sustenta D30; cosméticos ancoram colecionismo.

**Destrava:**
- **SPEC 9** (Store Readiness) — analytics de retenção (D1/D7/D30), compliance de IAP e a configuração de push remoto/eventos sazonais. Este spec define **o que** medir e vender; SPEC 9 define **como** publicar.

Sequência sugerida em H3: SPEC 7 (conteúdo) e SPEC 8 (este) em paralelo após SPEC 3, convergindo em SPEC 9.

---

## 9. Perguntas Abertas (decisão do dono antes do plano executável)

1. **Ads: sim ou não?** Recomendação da direção: **começar sem ads** (preserva retenção e a estética premium do DS). Se sim, qual formato (rewarded-only?) e nunca interstitial forçado?
2. **Gold no dia 7 da streak?** Recomendação: **não** (manter "sem gold passivo" limpo). Decisão do dono sobre a exceção controlada (§3.2).
3. **Plataforma de pagamento**: IAP nativo (StoreKit/Play Billing) direto vs. RevenueCat (abstrai as duas lojas)? Afeta `package.json` e SPEC 9.
4. **Preço**: faixa da moeda premium e dos pacotes; preço de "+1 slot de missão" e "forja 2×". (Sem `tier` de preço definido — exige pesquisa de mercado, fora deste spec.)
5. **Moeda premium**: moeda única abstrata ("Gemas"/"Selos Reais") ou compra direta de cada cosmético? Recomendação: moeda única (mais flexível para bundles).
6. **Graça de streak**: oferecer 1 "perdão" por mês? Quantos?
7. **Teto exato de notificações** e janela de quiet hours default (proposto 22h–9h) — confirmar.
8. **Eventos sazonais** (push remoto) entram em SPEC 8 ou só SPEC 9? Direção: só SPEC 9 (exige servidor).
9. **Backend/contas**: manter 100% offline-first, ou introduzir conta para sync de cosméticos comprados (proteção da compra entre dispositivos)? Lojas costumam exigir "restore purchases" — avaliar em SPEC 9.

---

*Gerado em 2026-06-20. Direção, não implementação. Atualizar conforme decisões de §9 forem tomadas.*
