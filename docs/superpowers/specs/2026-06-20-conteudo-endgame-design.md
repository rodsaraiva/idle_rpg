# Conteúdo & End-game — Design Spec

> Data: 2026-06-20 · Referência: **SPEC 7** do `docs/superpowers/ROADMAP-2026-H2.md` (Horizonte 3 — "Pronto pra Lançar").
> **Natureza deste documento: DIREÇÃO (design-only).** Não há plano executável agora — o detalhamento
> depende de aprendizados de balance (SPEC 4) e retenção (SPEC 8). Cada seção marca o que é **decidido**
> e o que é **direção a detalhar em plano futuro**, com perguntas abertas ao dono no fim.

---

## 1. Contexto e Problema

O jogo tem hoje um **end-game raso**: a curva de conteúdo termina cedo e o loop de longo prazo se
apoia em sistemas que não escalam.

**Conteúdo de progressão atual (`src/constants/missions.ts:41-160`):** exatamente **6 missões**
em escada de dificuldade 1→5, sendo a última (`mission_boss_1`, "Covil do Dragão", LOC 138-159) o
teto. A escada é curta e os gates de desbloqueio são poucos: só 3 das 6 missões têm `requirements`
(`mission_4` exige `ATK médio >= 10`, LOC 113; `mission_5` exige `HP >= 25` + Curandeiro, LOC 132-135;
`mission_boss_1` exige `HP médio >= 20`, `ATK médio >= 12` e Tanque, LOC 154-158). Não há nenhuma
zona acima de difficulty 5 no fluxo principal — o jogador que vence o Dragão fica sem destino novo.

**Boss semanal (`src/constants/weeklyBosses.ts:22-78`):** existe um pool de **5 bosses** rotativos
(Hydra/Golem/Dragão Sombrio/Lich/Titã, difficulty 6→8) selecionados deterministicamente por
`getWeeklyBoss(seed)` via `seed % WEEKLY_BOSS_POOL.length` (LOC 80-83). É o **único** conteúdo
de difficulty >5, mas é rotativo e semanal — não é uma escada permanente que o jogador escala.

**Roster de classes (`src/constants/classes.ts:17-71`):** **6 classes**
(WARRIOR/TANK/ROGUE/ARCHER/MAGE/HEALER). Cobertura de papéis: tank (TANK), frontline-DPS
(WARRIOR/ROGUE), ranged-DPS (ARCHER/MAGE), suporte/cura (HEALER, com `ability: 'HEALER_BUFF'`,
LOC 67). Só ROGUE e HEALER têm `ability` (LOC 41, 67) — as outras 4 são puramente estatísticas.
**Lacuna de papel:** não há suporte ofensivo (buff de dano/debuff de inimigo) nem controle — o
único "ability" de suporte é defensivo (buff). Isso limita variedade de composição no end-game.

**Loop de longo prazo atual = Panteão/Fusão (`src/context/pantheonHandler.ts`).** A fusão
(`createFusedHero`, LOC 32-98) consome 3 heróis IDLE e gera 1 herói de estrela superior
(`stars = maxStars + 1`, LOC 60), com `starMul = 1 + stars*0.05` (LOC 61) sobre stats e
herdando 10% do treino somado (`fusionBonus`, LOC 53-57). O Panteão concede bônus globais por
contagem de estrelas (`calculatePantheonBonuses`, LOC 12-27): `+3% gold` com ≥1 estrela, `+5% gold`
com ≥3 estrelas, `+3% atk` se algum herói tem 3★, `+5% hp` com ≥5 estrelas. **Esse é o "prestígio"
de fato existente** — mas é local (não reseta a conta) e teto baixo (bônus chapados, sem escala
infinita). Qualquer sistema de ascensão **não pode duplicar** essa mecânica.

**Sazonalidade atual (`src/types/index.ts:96-103`, `src/context/weeklyHandler.ts`):** o jogo tem
um `weeklyState` com `seed` derivado da data (`getWeeklySeed`, LOC 6), quests semanais e flag
`bossDefeated`. `refreshWeeklyState` (LOC 5) troca o conteúdo quando o seed muda. Há também
`dailyQuests` (`src/types/index.ts:87-92`). **Não há eventos temáticos/sazonais** (ex.: festival,
invasão) — só o ciclo fixo diário/semanal de quests. Conteúdo rotativo = sempre o mesmo formato.

**Restrições de economia que TODO end-game respeita (memória do dono, fundamentado no código):**
1. **Sem gold passivo.** Gold só entra por missão completada (`missionHandler.ts`),
   weekly/daily quests claimados (`weeklyHandler.ts:62`, `dailyQuestHandler.ts:52`) e conquistas.
   O estado inicial dá `gold: 20` (`gameReducer.ts:34`). Missão em loop é o mecanismo offline.
2. **DEF/CRIT/AGI não são treináveis.** `trainSpeed` (`classes.ts:8`) só cobre hp/atk/mp;
   `permanentBonuses` (`types/index.ts:85`) só tem `{atk, hp}`; `__tests__/utils/heroUtils.test.ts:110`
   testa que DEF/CRIT/AGI recebem **apenas equipamento**, nunca bônus permanente/panteão. Ascensão e
   conteúdo novo **não podem** abrir treino desses stats.

**A dor concreta:** um jogador engajado esgota as 6 missões e o Dragão em poucas horas. Depois disso
o único loop "infinito" é farmar fusões para empurrar bônus de Panteão de teto baixo + repetir o
boss semanal. Para **lançar publicamente** (objetivo do roadmap, LOC 10) falta uma **espinha de
progressão de longo prazo** que dê motivo para voltar nas semanas 2, 4, 8.

---

## 2. Objetivos e Não-Objetivos

### Objetivos (mensuráveis, alvos de direção)
- **O1 — Estender a escada de conteúdo** de 6 para um conjunto que sustente difficulty 6→10 no
  **fluxo principal** (hoje difficulty >5 só existe no boss semanal), com gates de desbloqueio que
  reaproveitam o motor de `requirements` existente.
- **O2 — Avaliar 1–2 classes novas** que preencham as lacunas de papel identificadas (suporte
  ofensivo / controle), sem desbalancear o que SPEC 4 vai ter acabado de calibrar.
- **O3 — Definir um sistema de ASCENSÃO** de meta-progressão infinita que **complemente** (não
  duplique) o Panteão/Fusão, respeitando "sem gold passivo" e "DEF/CRIT/AGI não treináveis".
- **O4 — Definir o formato de EVENTOS SAZONAIS** rotativos que reutilize a infra de seed
  semanal/diária já existente, sem inventar persistência nova frágil.
- **O5 — Sequenciar** tudo isso atrás de SPEC 3 (redesign) e dos números de SPEC 4 (balance), para
  não construir conteúdo sobre balanço inerte (princípio condutor do roadmap, LOC 34).

### Não-Objetivos (YAGNI — explicitamente fora)
- **NÃO** entregar plano de tasks nem código agora (escopo OUT declarado na tarefa).
- **NÃO** abrir treino de DEF/CRIT/AGI nem qualquer fonte de gold passivo — barreira de produto fixa.
- **NÃO** redesenhar o sistema de Fusão/Panteão; ascensão é **camada acima**, não substituição.
- **NÃO** PvP, multiplayer, guildas, leaderboards online — fora do escopo de um idle single-player.
- **NÃO** mais de 2 classes novas neste horizonte — cada classe nova multiplica a matriz de
  balance que SPEC 4 precisa manter no alvo.
- **NÃO** sistema de mapa procedural / dungeons geradas — conteúdo curado é mais barato de balancear.
- **NÃO** monetização aqui — é SPEC 8.

---

## 3. Design Detalhado

> Tudo abaixo é **direção**. Onde aparece tipo/assinatura concreta, é uma **proposta de forma** que
> respeita as interfaces atuais — não um contrato final. "A detalhar em plano futuro" marca o que
> depende de números de SPEC 4.

### 3.1 (a) Novas missões / zonas — escada estendida

**Decisão de forma:** reusar 100% a `MissionTemplate` (`missions.ts:11-39`). Ela já suporta tudo que
precisamos: `enemies` com composição explícita, `requirements` (3 tipos), `difficulty`, e os
parâmetros de curva de recompensa (`ref`/`exponent`/`synergyK`/`scale`). **Nenhum campo novo é
necessário** para estender a escada — só novos registros no array.

**Proposta: agrupar missões em ZONAS** com desbloqueio encadeado. Hoje o desbloqueio é implícito
(requirements de stat). A direção é tornar a progressão **legível como mapa** (casa com a Vila-mapa
do SPEC 3): cada zona reúne 2–3 missões e desbloqueia ao completar a anterior. Para isso, um campo
opcional de gate por progressão:

```ts
// proposta — adição não-destrutiva a MissionRequirement
export interface MissionRequirement {
  type: 'min_stat' | 'class_needed' | 'min_avg_stat' | 'mission_cleared'; // +1 tipo
  stat?: 'hp' | 'atk' | 'mp';
  value?: number;
  classId?: ClassId;
  missionId?: string;   // novo: gate "complete X antes"
  label: string;
}
```

`mission_cleared` checa `state.completedMissionIds` (já existe, `types/index.ts:84`). Zero migração:
é só mais um `case` no validador de requirements. **Trade-off:** gate por missão deixa a escada
linear/curada (previsível de balancear) vs. desbloqueio por stat (emergente, mas pode pular zonas).
Recomendação: **híbrido** — gate de stat (poder mínimo) E `mission_cleared` (ordem narrativa).

**Escada-alvo (difficulty 6→10), a detalhar com números de SPEC 4:**

| Zona | Missões (proposta) | difficulty | Papel no loop |
|---|---|---|---|
| Atual | mission_1..5 + boss_1 | 1→5 | onboarding → mid-game (existe) |
| Z2 "Costa Quebrada" | 2–3 missões | 6→7 | primeiro conteúdo pós-Dragão |
| Z3 "Picos Gelados" | 2–3 missões | 7→8 | exige composição (2+ classes-chave) |
| Z4 "Abismo" | 2 missões + boss zona | 9→10 | teto que pede heróis ascendidos (3.3) |

Os `enemies` das zonas novas reaproveitam estatísticas dos bosses semanais como referência de escala
(ex.: o "Golem Ancestral" tem `hp:300, defense:30`, `weeklyBosses.ts:39` — bom molde para um boss de
zona de difficulty 8). **Curva de recompensa** (`ref`/`exponent`) calibrada por SPEC 4; este spec só
fixa a **estrutura**.

### 3.2 (b) Novas classes — avaliar lacunas de papel

**Diagnóstico (de `classes.ts`):** a matriz cobre tank/melee-DPS/ranged-DPS/cura. **Faltam:**
- **Suporte ofensivo / "Bardo / Comandante"** — `ability` que **buffa o ATK do time** (espelho
  ofensivo do `HEALER_BUFF` defensivo, LOC 67). Preenche a lacuna "buff de dano" inexistente.
- **Controle / "Invocador / Necromante"** — usa MP para somar corpos/debuffar inimigo. Mais arriscado:
  o motor de batalha precisa suportar invocação (verificar `battleEngine.ts` antes — pode ser caro).

**Proposta concreta (1 classe segura + 1 stretch):**

```ts
// SAFE — só estende a forma existente de ClassDef/ability
COMMANDER: {
  id: 'COMMANDER', displayName: 'Comandante',
  baseStatDelta: { hp: 2, atk: 2, defense: 6, crit: 5, agility: 0, mp: 6 },
  trainSpeed: { hp: 0.8, atk: 0.8, mp: 1.3 },
  ability: 'COMMANDER_RALLY',   // novo enum: buff de ATK do time (n turnos)
  attackType: 'MELEE', range: 1,
},
```

**Recomendação:** entregar **só o Comandante** neste horizonte. É a menor mudança (novo valor de
`ability`, espelhando o caminho já trilhado por `HEALER_BUFF`/`ROGUE_BONUS`) e o maior ganho de
variedade de composição. O Invocador fica como **direção futura** (depende de avaliar custo no
`battleEngine`). **Trade-off:** toda classe nova entra na matriz de balance — adicionar 1 já obriga
SPEC 4 a re-rodar `balance_analysis.ts` com 7 classes. Adicionar 2 dobra esse custo.

**Restrição respeitada:** a nova classe ganha DEF/CRIT/AGI **só** via `baseStatDelta` (base de classe,
permitido) — não cria fonte de treino desses stats. ✅

### 3.3 (c) Sistema de PRESTÍGIO / Ascensão — sem duplicar Panteão

Esta é a decisão mais delicada. **O Panteão/Fusão já é um prestígio local** (3.1 do contexto):
sobe estrela do herói, dá bônus global de teto baixo, **não reseta a conta**. Para não duplicar,
ascensão precisa ocupar um **eixo diferente**:

| Eixo | Panteão/Fusão (existe) | Ascensão (proposto) |
|---|---|---|
| Escopo | por-herói (estrelas) | conta inteira (reset) |
| Custo | 3 heróis IDLE | resetar progresso de conta |
| Bônus | chapado, teto baixo | escala com "pontos de ascensão", sem teto |
| Trigger | manual, a qualquer hora | só após limpar a zona-teto (3.1) |

**Recomendação — "Legado" (ascensão de conta):**
- **Gate:** só destrava após completar a zona-teto (Z4/Abismo). Garante que ascender é decisão de
  fim-de-conteúdo, não atalho precoce.
- **Reset:** zera gold, heróis e progresso de missão; **preserva** Panteão (estrelas/fusões),
  conquistas e `permanentBonuses`. Ascensão e Panteão coexistem porque atuam em camadas distintas.
- **Moeda nova: "Selos de Legado"** — ganhos no reset, proporcionais ao progresso da run (ex.:
  função do total de gold ganho e da zona mais alta). **NÃO é gold** e **NÃO é passiva** — é
  cunhada uma vez, no ato do reset. Não viola "sem gold passivo".
- **Bônus de Legado:** uma árvore pequena de upgrades permanentes comprados com Selos. Para
  **respeitar "DEF/CRIT/AGI não treináveis"**, os bônus de Legado mexem em **economia e ritmo**,
  não em DEF/CRIT/AGI de herói:
  - velocidade de missão (−% `durationMs` efetivo),
  - +% de recompensa de missão (multiplicador de gold de missão — não gold passivo),
  - +% de velocidade de treino de hp/atk/mp (stats já treináveis),
  - slots extras de herói ativo.

**Forma de estado (proposta, aditiva — espelha `pantheonFusions`/`permanentBonuses`):**

```ts
// adição a GameState (types/index.ts, depois de pantheonBonuses ~LOC 95)
legacy?: {
  seals: number;              // moeda de ascensão (cunhada no reset)
  ascensions: number;         // contagem de resets
  upgrades: Record<string, number>; // id do upgrade -> nível comprado
};
```

A aplicação dos bônus de Legado entra no **mesmo helper central** que já soma
equip+permanentBonuses+pantheonBonuses (`missionHandler.ts:90`, `heroUtils.ts`) — ponto único, sem
espalhar lógica. **Trade-off central:** resetar a conta num idle mobile é polarizante. Mitigação:
ascensão **opcional** e gateada no fim do conteúdo (quem não quer resetar nunca é forçado).

> **Direção, a detalhar em plano futuro:** a fórmula exata de Selos, a árvore de upgrades e os
> coeficientes dependem do ritmo econômico que SPEC 4 vai medir. Não fixar números aqui.

### 3.4 (d) Eventos sazonais / conteúdo rotativo

**Reusar a infra de seed, não inventar persistência.** `weeklyState`/`dailyQuests`
(`types/index.ts:87-103`) já provam o padrão: conteúdo derivado de um seed temporal,
trocado por `refreshWeeklyState` quando o seed muda (`weeklyHandler.ts:5-19`). Eventos sazonais
seguem o mesmo molde, num nível acima do semanal.

**Proposta — "Eventos" (janela datada, ex.: 7–14 dias):**
- Um pool de eventos temáticos curados (ex.: "Invasão Goblin" = missões com `enemies` de difficulty
  elevada e drop bônus de `starstone`; "Festival da Forja" = custo de forja reduzido por janela).
- Selecionado por **um seed de data mensal/de janela** (mesma técnica de `getWeeklySeed`, só outro
  divisor), aplicando modificadores temporários — **sem** moeda nova nem persistência paralela:
  o evento **modula conteúdo existente** (multiplicador de drop, missões extra temporárias).
- Estado: um `activeEvent?: { id; startsAt; endsAt; seed }` derivado do relógio; o refresh segue o
  padrão idempotente de `refreshWeeklyState` (se o seed/janela não mudou, no-op).

**Trade-off:** evento "real" com calendário fixo (Natal/Halloween) exige datas hardcoded e
manutenção contínua; evento "rotativo por seed" é zero-manutenção mas menos temático. **Recomendação:**
começar com **rotativo por seed** (barato, sempre tem algo no ar) e reservar 2–3 slots de calendário
fixo para datas-âncora. **Restrição:** nenhum evento concede gold passivo — só multiplica recompensa
de atividade (missão/quest) ou desconto de custo. ✅

---

## 4. Mudanças por Arquivo

> **Direção** — arquivos que um plano futuro tocaria. Nenhuma mudança é feita por este spec.

| Arquivo | Mudança proposta | Notas |
|---|---|---|
| `src/constants/missions.ts` | Adicionar zonas Z2–Z4 ao array `MISSIONS` (após LOC 159); +1 tipo `mission_cleared` em `MissionRequirement` (LOC 3-9) | Aditivo; reusa `MissionTemplate` inteiro |
| `src/constants/classes.ts` | Adicionar `COMMANDER` a `CLASS_DEFS` (após LOC 70); novo valor de `ability` na união (LOC 12) | 7ª classe; obriga re-rodar balance |
| `src/constants/zones.ts` | **Novo** — agrupamento de missões em zonas + ordem de desbloqueio | Só metadados de UI/navegação |
| `src/constants/events.ts` | **Novo** — pool de eventos sazonais + seletor por seed (espelha `weeklyBosses.ts:80-83`) | Curado, sem persistência nova |
| `src/types/index.ts` | Adicionar `legacy?` (após LOC 95) e `activeEvent?` (após LOC 103) ao `GameState` | Opcionais → `LOAD_STATE` antigo continua válido |
| `src/context/legacyHandler.ts` | **Novo** — `handleAscend(state)`: cunha Selos, reseta conta preservando Panteão/conquistas, aplica upgrades. Espelha estrutura de `pantheonHandler.ts` | Reset é a parte sensível |
| `src/context/eventHandler.ts` | **Novo** — `refreshActiveEvent(state)` idempotente; espelha `weeklyHandler.ts:5-19` | Modula conteúdo, não persiste paralelo |
| `src/context/gameReducer.ts` | Novos actions `ASCEND`, refresh de evento no boot (perto do refresh semanal); estado inicial inalterado (`gold: 20`, LOC 34) | Roteamento puro |
| `src/utils/heroUtils.ts` | Aplicar bônus de Legado de ritmo/economia no helper central (perto de LOC 80-81) | Ponto único; **não** tocar DEF/CRIT/AGI |
| `src/constants/abilities`/battle | Implementar `COMMANDER_RALLY` no motor (espelhar `HEALER_BUFF`) | **Verificar custo em `battleEngine.ts` antes** |

---

## 5. Estratégia de Teste

> TDD onde há lógica crítica (regra do projeto). Integração > mock; AsyncStorage real/in-memory.

**Unit (casos concretos):**
- `mission_cleared` requirement: missão Z2 **bloqueada** se `completedMissionIds` não contém o
  pré-requisito; **liberada** quando contém. (espelha testes de `requirements` atuais)
- `handleAscend`: após reset, `gold === 20`, `heroes` zerado, **`pantheonFusions` e `unlockedAchievements`
  preservados**, `legacy.seals` > 0 e proporcional ao progresso da run, `legacy.ascensions` +1.
- **Invariante anti-regressão (crítico):** teste garante que NENHUM bônus de Legado escreve em
  DEF/CRIT/AGI — espelhar `__tests__/utils/heroUtils.test.ts:110` ("DEF/CRIT/AGI recebem apenas equipamento").
- **Invariante "sem gold passivo":** simular N ticks sem missão/quest ativa com Legado/evento
  comprados → `state.gold` **inalterado**. (rede de segurança da regra de produto)
- `refreshActiveEvent`: idempotente (mesmo seed → no-op, igual `refreshWeeklyState`); troca de
  janela aplica o evento correto do pool.
- `COMMANDER_RALLY`: com seed fixo (combate é determinístico por seed, SPEC battle-determinism),
  Δwinrate de uma composição com Comandante > sem, em missão-alvo.

**Integração:**
- Save → ascensão → reload (AsyncStorage real): Selos e upgrades persistem; conta resetada persiste.
- Save de versão **pré-Legado** (sem `legacy`/`activeEvent`) carrega sem crash (campos opcionais).

**Validação de UI (emulador/browser, regra do projeto):**
- Tela de Ascensão: confirmação de reset clara (ação destrutiva), preview de Selos a ganhar.
- Banner de evento ativo na Vila-mapa (SPEC 3) — screenshot a screenshot.
- Mapa de zonas mostra zonas bloqueadas/desbloqueadas corretamente.

**Gate de balance (regra de SPEC 4):** `balance_analysis.ts` re-roda com 7 classes e zonas novas;
winrate por zona dentro da banda-alvo antes de declarar conteúdo pronto.

## 6. Critérios de Aceitação

Binários e mensuráveis (de um plano futuro derivado deste spec):
- `npx tsc --noEmit` → **0 erros**.
- `npm test` (jest.unit.config.js) → **verde**, incluindo os 6 casos unit + 2 de integração acima.
- **Invariante "sem gold passivo"**: teste dedicado passa (gold inalterado sem atividade). **Bloqueante.**
- **Invariante DEF/CRIT/AGI**: teste dedicado passa (nenhum bônus de Legado/evento toca esses stats). **Bloqueante.**
- Escada principal cobre **difficulty 6→10** (hoje termina em 5); ≥3 zonas novas registradas.
- Save pré-Legado carrega sem perda de progresso (teste de migração/compat).
- `balance_analysis.ts` reporta winrate de cada zona nova dentro da banda-alvo definida por SPEC 4.
- Com 7 classes, ≥5/6 sinergias mantêm Δ≥+5pp (não regredir a meta de SPEC 4).
- Reset de ascensão **preserva** Panteão + conquistas (verificado em teste e na UI).

## 7. Riscos e Mitigação

| Risco | Sev | Mitigação |
|---|---|---|
| **Ascensão duplica/conflita com Panteão** (dois "prestígios") | 🔴 | Eixos disjuntos (conta vs. herói); reset **preserva** Panteão; gate no fim do conteúdo. Decisão de design, não de implementação. |
| **Reset polariza jogadores** de idle mobile | 🟠 | Ascensão 100% opcional e gateada; quem não quer nunca é forçado. Validar UX no emulador antes. |
| **Classe nova quebra o balance recém-calibrado** (SPEC 4) | 🟠 | Entregar só 1 classe (Comandante); re-rodar `balance_analysis.ts` como gate; Invocador fica para depois. |
| **Bônus de Legado vira gold passivo disfarçado** | 🔴 | Bônus só **multiplica recompensa de atividade** ou **desconta custo** — nunca credita gold sem missão/quest. Teste-invariante bloqueante. |
| **Conteúdo construído sobre balanço inerte** (princípio do roadmap) | 🟠 | Sequenciar atrás de SPEC 4; números só depois de medidos. |
| **`COMMANDER_RALLY`/invocação caro no `battleEngine` (791 LOC)** | 🟡 | Espelhar `HEALER_BUFF` (caminho já existente); auditar engine antes; preferir buff a invocação. |
| **Save antigo quebra com campos novos** | 🟡 | `legacy`/`activeEvent` **opcionais**; testes de compat de save pré-Legado. |

## 8. Dependências e Sequenciamento

**Depende de (entra depois):**
- **SPEC 1** (estabilização/persistência robusta) — ascensão escreve estado novo; precisa de
  `LOAD_STATE` que migra e de save com checksum (problema 3 do roadmap).
- **SPEC 4** (balance/economia) — **bloqueante para os números**. Zonas, classe nova e Selos só
  são calibrados sobre o ritmo econômico que SPEC 4 mede. Sem isso, conteúdo sobre balanço inerte.
- **SPEC 3** (redesign) — zonas/eventos/ascensão precisam de UI (Vila-mapa, banner de evento, tela
  de ascensão). Diagrama do roadmap: `SPEC 3 → SPEC 7`.

**Habilita / destrava:**
- **SPEC 8** (monetização/retenção) — eventos sazonais e ascensão são os ganchos naturais de
  daily-login e push ("evento novo no ar", "pronto pra ascender"). Este spec dá o conteúdo que
  SPEC 8 monetiza eticamente.
- **SPEC 9** (store readiness) — escada longa + eventos rotativos = argumento de retenção D7/D30
  para a página de loja.

**Sequência interna recomendada** (quando virar plano): (1) zonas Z2–Z4 + `mission_cleared`
[menor risco, reusa tudo] → (2) Comandante + re-balance → (3) eventos sazonais [reusa seed] →
(4) Ascensão/Legado [maior risco, por último, depois que a escada-teto existe para gatear].

---

## Perguntas abertas ao dono

1. **Ascensão com reset de conta** é desejável num idle mobile single-player, ou prefere
   meta-progressão **sem reset** (ex.: árvore de Legado paga com uma moeda de fim-de-conteúdo, sem
   zerar nada)? O reset é o ponto mais polarizante deste spec.
2. **Quantas classes novas** quer assumir? Recomendo **1 (Comandante)**; 2 dobra o custo de balance.
   Topa adiar o Invocador?
3. **Eventos:** começar só com **rotativo por seed** (zero manutenção) ou já reservar **datas-âncora**
   fixas (Natal/Halloween) — que exigem manutenção contínua?
4. **Teto de conteúdo:** difficulty 10 é o alvo certo, ou quer escada ainda mais longa (12+) sabendo
   que cada zona nova é mais trabalho de balance?
5. **Bônus de Legado:** confirma que o leque permitido é **só ritmo/economia + treino de hp/atk/mp**
   (nunca DEF/CRIT/AGI, nunca gold passivo)? Quer também desbloqueios cosméticos por ascensão (entra
   melhor em SPEC 8)?
6. **Comandante (`COMMANDER_RALLY`)** preenche a lacuna de suporte ofensivo de forma satisfatória, ou
   prefere priorizar **controle/debuff** (Invocador/Necromante) mesmo sendo mais caro no motor?
