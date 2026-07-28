# Loop de missões: modos, recolher e resumo acumulado — Design Spec

> Data: 2026-07-28 · Pedido do dono, fora dos 9 SPECs do `ROADMAP-2026-H2.md`.
> Três mudanças na experiência de loop: (1) escolher **quantos ciclos** — X vezes, X tempo ou
> indefinido; (2) **recolher** os heróis de um loop, com eles terminando o ciclo atual antes de
> voltar; (3) **parar de abrir o modal de resultado a cada ciclo** e mostrar um resumo acumulado
> só quando o loop termina.
>
> **Estratégia:** aditiva. O plano do loop e o acumulado moram na própria `ActiveMission`, que já é
> recriada a cada ciclo. Nenhuma regra de combate, economia ou recompensa muda. O ouro continua
> sendo creditado ciclo a ciclo.

---

## 1. Como o loop funciona hoje

`ActiveMission.looping?: boolean` (`src/types/index.ts:233`) é ligado por um checkbox no
`MissionHeroSelectionModal` (`:61`) e chega ao reducer via
`START_MISSION { looping }` (`src/context/gameReducer.ts:65` → `missionHandler.ts:135,166`).

A cada tick, `processMissions` (`src/context/missionTickHandler.ts:173`) faz, para uma missão
concluída com `looping && outcome.success`: recomputa o combate, credita o ouro do ciclo
(`computeFinalGold`) e **empurra uma `ActiveMission` nova, com uuid novo** (`:206-219`), mantendo os
heróis em `MISSION`. Os sobreviventes precisam bater `tpl.minHeroes` (`:179`); senão os heróis são
liberados (`:229-237`).

Cada ciclo produz um `MissionResult` que o `tickHandler` empilha em `recentMissionResults`
(`src/context/tickHandler.ts:161-162`, cap de 10), e o `MissionResultModal` abre com o **primeiro**
da lista (`MissionResultModal.tsx:17,25`), reproduzindo o combate ação por ação via `BattleRunner`.

**Os três problemas:**

1. Não existe modo: `looping` é booleano e o loop é sempre indefinido.
2. Não existe forma de parar. O loop só morre por baixas, derrota ou erro de cálculo.
3. Cada ciclo abre o modal com playback completo. Num loop de 10 ciclos são 10 modais.

---

## 2. Decisões

| # | Decisão | Por quê |
|---|---|---|
| 1 | Resumo agregado **sem playback**, com botão opcional "Ver último combate" | Reproduzir N combates não escala |
| 2 | No modo por tempo, o prazo **só impede um novo ciclo** começar | Mesma regra do recolher: herói nunca volta no meio da missão |
| 3 | Quantidades por **presets em chips** (3/5/10/25 e 15m/1h/4h/8h) | Um toque, sem teclado no celular |
| 4 | Ouro creditado **por ciclo**, não retido até o fim | Reter quebraria a promessa idle e o crédito offline; o resumo só reporta |
| 5 | Loops que terminam **offline** dobram no modal de "Progresso Offline" que já existe | Empilhar dois modais no boot é pior que perder o detalhe |

---

## 3. Modelo de dados

```ts
export type LoopPlan =
  | { mode: 'times'; remaining: number; total: number }  // total é fixo: alimenta "7 de 10"
  | { mode: 'until'; endsAt: number }                    // timestamp limite
  | { mode: 'endless' };

export interface LoopTally {
  cycles: number;                          // ciclos concluídos com sucesso
  gold: number;                            // já creditado, aqui só para reportar
  materials: Record<string, number>;
  casualties: { heroId: string; hpAfter: number }[];  // união por herói de quem caiu em QUALQUER ciclo
  lastResult?: MissionResult;              // alimenta "Ver último combate"
}

export interface ActiveMission {
  // ...campos atuais
  loop?: LoopPlan;         // ausente = missão avulsa, comportamento de hoje
  loopRecalled?: boolean;  // recolher pedido
  loopTally?: LoopTally;   // acumulado, copiado de ciclo em ciclo
}
```

`looping?: boolean` **sai** do tipo. A presença de `loop` passa a ser o sinal de "é loop".

O resumo pronto para a UI é um bloco novo no `GameState`:

```ts
export interface LoopSummary {
  missionId: string;       // id do último ciclo, chave de dispensa
  templateId: string;
  heroIds: string[];
  tally: LoopTally;
  plannedCycles?: number;  // cópia de plan.total no modo 'times' — permite "7 de 10"
  reason: 'completed' | 'recalled' | 'casualties' | 'failed' | 'error';
}

interface GameState {
  completedLoops?: LoopSummary[];  // o modal consome o primeiro
}
```

---

## 4. Ciclo de vida

Regras puras em `src/utils/missionLoop.ts` — `processMissions` já é o maior ponto de regressão do
projeto e a auditoria de 2026-06-27 reclamou do seu tamanho; a orquestração fica lá, a decisão vem daqui:

```ts
planAllowsAnotherCycle(plan: LoopPlan, now: number): boolean
advanceLoopPlan(plan: LoopPlan): LoopPlan          // 'times' decrementa
accumulateTally(prev: LoopTally | undefined, c: CompletedCycle): LoopTally
```

Em `processMissions`, para cada missão concluída **com `loop`**:

```
tally = accumulateTally(mission.loopTally, ciclo)

continua = outcome.success
        && !mission.loopRecalled
        && planAllowsAnotherCycle(advanceLoopPlan(plan), now)
        && sobreviventes >= tpl.minHeroes

se continua  → empurra próximo ciclo com { loop: advanceLoopPlan(plan), loopTally: tally }
senão        → libera heróis para IDLE + empurra LoopSummary(tally, motivo)
```

Motivos: plano esgotado → `completed`; `loopRecalled` → `recalled`; sobreviventes insuficientes →
`casualties`; `outcome.success === false` → `failed`; exceção no cálculo de combate → `error`.
Derrota encerra o loop, como já acontece hoje.

Missão **sem** `loop` segue exatamente o caminho atual.

---

## 5. Silenciar o modal por ciclo

`MissionResult` ganha `fromLoop?: boolean`, marcado nos resultados de ciclo de loop. Em
`tickHandler.ts:161-162`, só os resultados **sem** essa marca entram em `recentMissionResults`.

Tudo o mais continua consumindo a lista inteira de `newResults`: `completedMissionCount`,
`completedMissionIds`, conquistas, quests diárias e `trackMissionCompletions` (analytics). A mudança
é de apresentação, não de contabilidade.

---

## 6. Recolher

Ação nova: `RECALL_MISSION_LOOP { missionId }`, que marca `loopRecalled: true` na missão. Não
interrompe nada em andamento — o ciclo atual termina e o loop não reinicia.

Recolher uma missão **sem** `loop` é no-op (a missão avulsa já vai terminar).

---

## 7. UI

**`MissionHeroSelectionModal`** — o checkbox de loop vira seletor de modo:

```
Modo do loop
( ) Uma vez
(•) Repetir    [3] [5] [10] [25]
( ) Por tempo  [15m] [1h] [4h] [8h]
( ) Indefinido
```

"Uma vez" é o default e produz `loop: undefined`. Os chips só ficam habilitados no modo
correspondente. O `onConfirm` passa a levar `loop?: LoopPlan` no lugar de `looping?: boolean`.

**`MissionActiveItem`** — mostra o estado do loop (`×7 restantes`, `até 14:30`, `∞`) e ganha o botão
**Recolher**. Depois de acionado, o botão some e o item mostra "voltando ao fim do ciclo".

**`LoopSummaryModal`** (novo) — consome `completedLoops[0]`:

```
┌─ Patrulha concluída ×7 ──────────┐
│ 7 de 10 ciclos · parou por baixas│
│ Ouro       ▸ 1.240               │
│ Materiais  ▸ couro ×3, ferro ×1  │
│ Baixas     ▸ Ursa (35% HP)       │
│   [ Ver último combate ]         │
│   [ Fechar ]                     │
└──────────────────────────────────┘
```

"Fechar" despacha `DISMISS_LOOP_SUMMARY { missionId }`. A linha "N de M ciclos" só aparece no modo
`times` (usa `plannedCycles`); nos outros, "N ciclos". O texto do motivo é fixo por `reason`. A
porcentagem de HP das baixas sai de `hpAfter / hero.hpMax`, buscando o herói em `state.heroes` pelo
id — a `LoopTally` guarda só o valor absoluto.

**Baixas acumulam por herói, não pela foto do último ciclo** (decisão de 2026-07-28, revisada durante a
execução): um herói que caiu no ciclo 2 tem que aparecer no resumo mesmo que o ciclo 3 termine ileso.
`accumulateTally` funde a lista por `heroId`, mantendo o `hpAfter` mais recente de cada um. Sobrescrever
fazia um loop de 10 ciclos reportar "nenhuma baixa" — e é justamente esse número que o jogador usa para
decidir se repete.

"Ver último combate" precisa de um ajuste no `MissionResultModal`, que hoje lê
`state.recentMissionResults[0]` direto do contexto (`:17,25`) — e resultados de loop, por decisão da
seção 5, nunca entram nessa lista. O modal ganha uma prop opcional `result?: MissionResult`, que
quando presente tem precedência sobre a leitura do estado; quem dispensa é o chamador. Sem a prop, o
comportamento atual não muda.

Montagem: **na raiz**, junto do `OfflineSummaryGate` — o `MissionResultModal` vive na
`MissionsScreen` (`:67`), mas um loop pode terminar com o jogador em qualquer tela, e foi exatamente
esse erro que fez o resumo offline nunca aparecer (corrigido em `a3c7ba3`).

---

## 8. Migração de save (v13 → v14)

Saves em voo têm `looping: true`. A migração 14 converte, em cada `activeMissions[]`:

```ts
if (m.looping) { m.loop = { mode: 'endless' }; }
delete m.looping;
```

`CURRENT_VERSION` vai de 13 para 14 (`src/services/storage.ts:6`). Loop indefinido é a leitura
honesta do que aquele save estava fazendo.

---

## 9. Offline

`calculateOfflineProgress` (`src/utils/offlineProgress.ts:189`) hoje trata `m.looping` calculando
`cycles = floor(elapsed / durationMs)`, creditando tudo e re-armando a missão.

Passa a respeitar o plano:

- `times`: `cycles = min(cyclesPossíveis, plan.remaining)`
- `until`: `cycles = min(cyclesPossíveis, ciclos que cabem até endsAt)`
- `endless`: como hoje
- `loopRecalled`: no máximo 1 ciclo

Se o plano se esgota offline, a missão **não** é re-armada: os heróis voltam a `IDLE`, como já
acontece com missão avulsa (`:200-204`). O ouro e os materiais entram no resumo de progresso offline
que já existe; **nenhum `LoopSummary` é emitido para loops encerrados offline** (decisão 5).

---

## 10. Testes

Puros (`missionLoop.test.ts`): `planAllowsAnotherCycle` nos 3 modos e na borda (`endsAt` no passado
→ barra); `advanceLoopPlan` decrementa só `remaining` e preserva `total`, e não mexe em
`until`/`endless`; `accumulateTally` soma ouro, funde materiais e substitui `lastResult`.

A contagem fecha assim: um plano `{ times, remaining: 3, total: 3 }` roda o 1º ciclo e avança para
`remaining: 2`, que ainda permite; o 3º ciclo avança para `remaining: 0`, que barra. Três ciclos
executados, como pedido — vale um teste explícito de ponta a ponta para travar esse off-by-one.

Integração em `processMissions`: loop de 3 ciclos para no 3º com `reason: 'completed'`;
`loopRecalled` para ao fim do ciclo corrente; baixas insuficientes param com `reason: 'casualties'`;
o `loopTally` sobrevive à troca de uuid entre ciclos.

Apresentação: resultado com `fromLoop` **não** entra em `recentMissionResults`, mas **conta** em
`completedMissionCount`.

Reducer: `RECALL_MISSION_LOOP` marca a missão certa e é no-op em missão sem loop;
`DISMISS_LOOP_SUMMARY` remove o resumo certo.

Migração: save v13 com `looping: true` vira `loop: { mode: 'endless' }` sem `looping`.

Offline: loop `times: 2` com 10 ciclos de tempo decorrido credita 2 ciclos e libera os heróis.

---

## 11. Fora de escopo

- **Abortar missão no meio** — pedido explicitamente descartado por ora; recolher sempre respeita o
  ciclo em andamento.
- Loop de **boss semanal** (`isWeeklyBoss` nunca entra em loop hoje).
- Persistir histórico de loops encerrados além do resumo pendente.
- Notificação push ao fim do loop (depende do débito device-bound do SPEC 8).
