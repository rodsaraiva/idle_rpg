# Condições de incursão — Design Spec

> Data: 2026-07-29 · Pedido do dono ("quero deixar as missões mais interessantes"), fora dos 9 SPECs
> do `ROADMAP-2026-H2.md`.
>
> Cada missão passa a carregar **condições** que mudam a luta e a recompensa, e que se redefinem a
> cada 5 execuções daquela missão, sorteadas de um pool. O jogador vê as condições no Quadro de
> Missões antes de escolher, e um loop longo atravessa vários blocos.
>
> **Estratégia:** derivar, não persistir. O save guarda um contador de execuções por missão; as
> condições saem de uma função pura de `(worldSeed, templateId, bloco)`. Online e offline chegam ao
> mesmo resultado por construção — a família de divergências que o loop expôs seis vezes não tem
> por onde nascer aqui.

---

## 1. O problema

O motor é rico: grid hexagonal com posicionamento, alcance e movimento; 8 habilidades de inimigo
graduadas por dificuldade (`src/constants/enemySkills.ts`); 5 personalidades; 6 sinergias; 12
missões com composição inimiga explícita e requisitos de entrada.

Mas **a missão é sempre a mesma missão**. `mission_3` tem os mesmos inimigos, nas mesmas posições,
com a mesma faixa de recompensa, hoje e daqui a mil ciclos. Toda a decisão acontece antes do ENVIAR
e nunca mais. O loop de missões (mergeado em `4effb97`) amplifica isso: o jogador aperta uma vez e
repete 25×.

---

## 2. Decisões

| # | Decisão | Por quê |
|---|---|---|
| 1 | Condições **derivadas**, nunca persistidas | Online e offline não podem divergir; derivar de seed elimina a classe inteira de bug |
| 2 | Redefinem a cada **5 execuções** da missão, não por relógio | Atrela variedade ao jogo, não ao tempo; não pune sessão espaçada |
| 3 | Um loop **atravessa** os blocos | Loop longo vira aposta calculada; sem isso o "sempre igual" volta |
| 4 | Alavancas: **campo e inimigos**, nunca stat de herói | Efeito real na luta sem interagir com enfermaria, treino e equipamentos |
| 5 | "Sem condição" é resultado legítimo do sorteio | O contraste faz as outras pesarem |
| 6 | Multiplicador incide **antes** do `computeFinalGold` | Condição é da missão; panteão/legado/evento continuam por cima, na ordem já documentada |
| 7 | Boss semanal **fora** do primeiro corte | Tem identidade própria e o adaptador ainda carrega débito |

---

## 3. Modelo

### 3.1 Estado persistido (migração v14 → v15)

```ts
worldSeed: number;                        // criado na migração, estável para sempre
missionRuns: Record<string, number>;      // templateId -> execuções concluídas
```

`worldSeed` nasce na migração (`src/services/storage.ts:6`, `CURRENT_VERSION` 14 → 15). Save
existente deriva de `hash(heroes[0].id)` — único por guilda e estável, já que o herói semeado nunca
troca de id; sem heróis, cai em `hash(lastSavedAt)`. Jogo novo sorteia em `initialGameState`. Duas
guildas diferentes veem rotações diferentes.

`RUNS_PER_BLOCK = 5`.

`missionRuns[templateId]` incrementa **no mesmo ponto que credita o ouro do ciclo** — é a definição
de "execução concluída", e garante que os dois caminhos contem igual.

### 3.2 Derivação

```ts
// src/utils/missionConditions.ts
export function blocoDe(runs: number): number;                       // floor(runs / RUNS_PER_BLOCK)
export function condicoesDe(
  worldSeed: number, templateId: string, bloco: number, difficulty: number
): MissionCondition[];
```

Função pura, sem `Math.random`, sem `Date.now`. Hash estável de `(worldSeed, templateId, bloco)`
alimenta o sorteio; `difficulty` filtra o pool por `minDifficulty`. Mesmas entradas, mesmas
condições, em qualquer caminho e a qualquer momento.

### 3.3 O pool

`src/constants/missionConditions.ts`. Zero a duas condições por bloco.

| Alavanca | Condição | Efeito | minDifficulty |
|---|---|---|---|
| Campo | Emboscada | Inimigos começam adjacentes ao time | 1 |
| Campo | Névoa densa | Alcance −1 (mínimo 1) | 2 |
| Campo | Lamaçal | Movimento −1 (mínimo 1) | 2 |
| Campo | Terreno alto | Alcance +1 para heróis RANGED | 1 |
| Inimigos | Bando | Duplica um inimigo da composição base | 2 |
| Inimigos | Elite | Um inimigo com +50% HP | 3 |
| Inimigos | Veterano | Um inimigo ganha skill do `ENEMY_SKILL_POOL` respeitando `minDifficulty` | 3 |

Onde a condição diz "um inimigo", o alvo sai do mesmo hash do bloco (`índice = hash % n`), não de
`Math.random` — duas guildas no mesmo bloco veem o mesmo inimigo marcado, e o offline concorda com
o online sem precisar guardar nada.

Cada condição declara `rewardMultiplier`. Total = produto, com teto (`MAX_CONDITION_MULTIPLIER`)
para duas condições fortes não explodirem a economia.

---

## 4. Aplicação

O combate é composto em **três lugares** hoje, e é aí que mora o risco:

| Caminho | Onde | Como monta |
|---|---|---|
| Envio | `src/context/missionHandler.ts:53` (`buildBattleMission`, privado) | `computeBattleOutcome(tpl, heróis, opts)` |
| Rearme do loop | `src/context/missionTickHandler.ts:242` | `computeBattleOutcome(tpl, heróis, opts)` |
| Offline | `src/utils/offlineProgress.ts` | **reaproveita** `m.precomputedOutcome` para todos os ciclos |

As condições entram por uma função só, aplicada ao template antes do combate:

```ts
export function aplicarCondicoes(
  tpl: MissionTemplate, condicoes: MissionCondition[]
): MissionTemplate;   // devolve cópia com enemies/posições ajustados
```

Os três caminhos chamam `aplicarCondicoes` com o mesmo resultado de `condicoesDe`. `buildBattleMission`
deixa de ser privado e passa a ser o ponto único dos dois caminhos online.

**O offline precisa mudar de forma:** hoje ele reusa um único `precomputedOutcome` para todos os
ciclos. Com condições girando, isso divergiria do online exatamente no eixo novo. O offline passa a
**recomputar na virada de bloco** — não a cada ciclo. Um loop de 25 ciclos cruzando 5 blocos custa 5
recomputações, não 25. Ciclos dentro do mesmo bloco seguem reusando o outcome, como hoje.

---

## 5. UI

- **Quadro de Missões** (`src/screens/MissionsScreen.tsx`): chips de condição por missão, com
  "vale por N incursões" (`RUNS_PER_BLOCK − runs % RUNS_PER_BLOCK`). Missão sem condição mostra o
  espaço vazio, não um chip "nenhuma".
- **Confirmação de envio**: repete os chips, para a escolha ser informada no momento do commit.
- **Resumo do loop** (`src/components/LoopSummaryModal.tsx`): lista por bloco — faixa de ciclos,
  condições, multiplicador — em vez de só o total.

Tokens do DS "Reino"; ícone de condição via `Icon` vetorial, não emoji.

---

## 6. Balanço

O multiplicador médio das condições muda o rendimento de ouro por missão, e **a compensação de
balanço do loop já estava pendente** (unificar a duração do ciclo aperta o começo em 56–66% e
afrouxa o fim). Tratar as duas juntas: medir com `balance:check` antes e depois, e escolher o teto e
os multiplicadores do pool a partir da medição, não do chute. Sem isso a feature nasce desbalanceada.

---

## 7. Testes

1. **Determinismo:** mesma `(worldSeed, templateId, bloco)` → mesmas condições, em execuções e
   processos distintos.
2. **Rotação:** 5 execuções viram o bloco; 25 execuções atravessam 5 blocos; contador incrementa só
   em ciclo concluído.
3. **Paridade online × offline:** mesmo estado inicial e mesmo intervalo produzem o mesmo ouro e o
   mesmo desfecho pelos dois caminhos — o teste que a família de bugs do loop ensinou a exigir.
4. **Efeito real:** cada condição do pool muda o combate de forma observável (não só o número).
5. **Gate de dificuldade:** condição com `minDifficulty` alto nunca aparece em missão de dificuldade
   menor.
6. **Recompensa:** multiplicador aplicado antes do `computeFinalGold`, com teto respeitado.
7. **Migração:** save v14 sem `worldSeed`/`missionRuns` migra para v15 com valores válidos e sem
   perder progresso.

---

## 8. Fora de escopo

- Condições que mexem em stat de herói (exaustão, moral) — interagem com enfermaria, regen e com a
  compensação de balanço pendente.
- Boss semanal.
- Condições puramente positivas como recompensa de progressão (Legado, evento) — pode vir depois,
  em cima da mesma derivação.
