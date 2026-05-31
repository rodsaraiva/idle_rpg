# Determinismo do Battle Engine (#47) — Design

> **Origem:** follow-up #47 (`docs/followups-pos-execucao-2026-05-31.md`). A configuração da batalha e 1 sinergia usam `Math.random()` em vez do `rng` injetado → `computeBattleOutcome` não é reprodutível mesmo com `rng` fixo. Sintoma: `battleSim.test.ts` flaky (~40%).
> **Objetivo:** batalha **totalmente determinística sob um seed** — mesmo seed → resultado idêntico. Conserta o flaky e torna os balance sims reprodutíveis.
> **Estratégia escolhida:** PRNG **seedável** (mulberry32) threadado por todo o pipeline (setup + combate + sinergias). Stream único derivado do seed.

## Fontes de não-determinismo (mapa completo)

Pré-confirmado por grep. Todas no pipeline de batalha:

| Site | Responsabilidade | Fase |
|---|---|---|
| `battleEngine.ts:113` | shuffle de posições dos inimigos | setup (`createEnemies`) |
| `battleEngine.ts:123` | `attackType` aleatório quando não definido | setup |
| `battleEngine.ts:141,165` | `assignEnemySkills(diff, isBoss, Math.random)` | setup |
| `synergyEffects.ts:119` | ARTILHARIA: chance de 50% de splash | combate (`onAttackResolved`) |
| `synergyEffects.ts:132` | ARTILHARIA: escolha do alvo do splash | combate |

**Já determinístico** (usam `rng` injetado): loop de combate em `battleEngine` (selectTarget tie-break, hit/crit) e `gameMath.calcMissionReward`/drops.

**Fora de escopo** (aleatoriedade intencional, não afeta resultado de batalha): `math.ts:12-13` (gaussiana), `heroFactory.ts:10-11,30` (nome/sufixo/personalidade no recrutamento).

## Arquitetura da solução

### 1. PRNG seedável

Criar `makeRng(seed: number): () => number` em `src/utils/math.ts` usando **mulberry32** (PRNG pequeno e de boa qualidade, retorna `[0,1)` a partir de um seed uint32). Determinístico: mesmo seed → mesma sequência.

### 2. Resolução do rng em `computeBattleOutcome`

Estender `BattleOpts` com `seed?: number`. Precedência:

```
const rng = opts.rng ?? (opts.seed != null ? makeRng(opts.seed) : Math.random);
```

`opts.rng` explícito vence (compat com injeção direta em testes unitários de função); senão `seed` → `makeRng`; senão `Math.random` (**produção inalterada**).

### 3. Threading do rng único pelo setup

- `BattleEngine.createEnemies(template, rng: () => number = Math.random)` — substituir os 4 `Math.random` (shuffle, attackType, e os 2 `assignEnemySkills(..., rng)`; `assignEnemySkills` já aceita o param de rng).
- `BattleEngine.initializeBattle(heroes, template, opts)` — aceitar `opts.rng`, repassar a `createEnemies(template, rng)` e **armazenar em `state.rng`**.
- `computeBattleOutcome` passa o `rng` resolvido para `initializeBattle` e para o loop de combate (mesmo stream).

### 4. Sinergias determinísticas via `state.rng`

- Adicionar campo `rng: () => number` à interface `BattleState` (`battleEngine.ts`).
- `synergyEffects.ts` (ARTILHARIA, linhas 119/132): usar `state.rng()` em vez de `Math.random()`.
- Todos os construtores de `BattleState` (incl. helpers `makeState`/`createBaseState` dos testes) passam a definir `rng` (default `Math.random` onde não importa).

### 5. Balance sims reprodutíveis

`scripts/simulations/missions/battles.ts` (e variantes): aceitar `--seed=<n>`. Quando presente, passar `seed` para `computeBattleOutcome` → cada run com o mesmo seed é idêntico (debug/balance reprodutível). Sem `--seed`, mantém `Math.random` (comportamento atual de amostragem).

### 6. Reescrita dos testes

- **`battleSim.test.ts`**: passar `seed` (ou `rng: makeRng(seed)`) tornando o setup determinístico. Manter as asserções semânticas robustas (herói forte vence; herói fraco hp5/atk1 vs 2 orcs perde — verdadeiras sob qualquer seed) e injetar o rng de combate onde a sequência específica importa.
- **Novo teste de determinismo (guarda de regressão):** `computeBattleOutcome(t, heroes, { seed: 42 })` rodado **2×** → `expect(outcomeA).toEqual(outcomeB)` (deep-equal). Prova reprodutibilidade ponta-a-ponta — é o teste que pega qualquer `Math.random` remanescente no pipeline.
- **Auditar** outros testes que injetam `rng` (skillEffects, battleEngine, combatGaps): a maioria testa funções isoladas (não passam por `createEnemies`) → inalterados. Atualizar só os que constroem `BattleState` (adicionar `rng`) ou que dependiam do `Math.random` de setup.

## Produção: sem mudança de comportamento

Nenhum call site de produção (`missionHandler`, `tickHandler`, `battleRunner`) passa `seed` → default `Math.random`. Jogabilidade idêntica. O determinismo é **opt-in** (sims + testes). `BattleEngine.createEnemies` mantém default `Math.random` para o call site de visualização em `missionHandler.ts:103`.

## Critérios de aceitação

1. `computeBattleOutcome(..., { seed: S })` produz resultado **byte-idêntico** em execuções repetidas (deep-equal), para vários seeds e missões.
2. `battleSim.test.ts` deixa de ser flaky (roda 10× sem falha).
3. Suíte completa verde; `tsc` não piora (idealmente igual a 17).
4. `npm run simulate:m1 -- --seed=42` reprodutível (mesma saída em runs repetidos).
5. Produção sem mudança (call sites sem seed seguem em `Math.random`).

## Riscos

- **`BattleState.rng` em todos os construtores:** esquecer um helper de teste quebra a compilação/execução. Mitigar: grep por todos os locais que montam `BattleState` e cobrir.
- **`assignEnemySkills`/attackType determinístico pode mudar o cenário do teste:** com seed fixo, o inimigo pode ganhar skill/attackType específico. Os testes semânticos (forte vence / fraco perde) são robustos; o teste de determinismo não depende do valor, só da igualdade entre runs.
- **Qualidade do PRNG:** mulberry32 é suficiente para jogo/sim (não-cripto). Documentar como tal.

## Escopo

Um único arquivo de plano, executável por um implementador em TDD. Mudança coesa (rng), sem fases paralelas.
