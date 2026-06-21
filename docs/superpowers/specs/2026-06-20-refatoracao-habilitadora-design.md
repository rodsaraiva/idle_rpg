# Refatoração Habilitadora — Design Spec

> **Data:** 2026-06-20 · **Referência:** SPEC 6 do `docs/superpowers/ROADMAP-2026-H2.md` (Horizonte 2 — "Cara Nova + Jogo Justo").
> **Princípio condutor:** não construir conteúdo novo sobre uma base quebrada. Este SPEC é **comportamento-preservante**: nenhuma regra de jogo, balanço ou número de saída muda. Quebra os dois maiores deus-módulos (`tickHandler.ts`, `battleEngine.ts`) em unidades coesas guardadas pelos testes de caracterização existentes, e remove duas ineficiências reais do loop. Habilita SPEC 4 (instrumentar balanço com engine modular).
> **Estratégia escolhida (resumo):** mover código por **extração mecânica** (cortar-colar com assinatura preservada), uma unidade por commit, com a suíte unit verde **idêntica** antes/depois de cada passo. Onde a caracterização não cobre uma fronteira que vou cortar, **adicionar o teste ANTES** de mover. API pública (`computeBattleOutcome`, `handleTick`, `BattleEngine.*`) inalterada.

---

## 1. Contexto e Problema

O motor é bem arquitetado (reducer puro + handlers, combate determinístico por seed após #47) mas concentra a lógica de duas áreas críticas em dois arquivos que viraram a maior superfície de regressão do projeto (linha 31 do roadmap: *"`tickHandler.ts` (499 LOC) e `battleEngine.ts` (791 LOC) — maior superfície de regressão"*). Tudo abaixo foi confirmado lendo o código real.

### 1.1 `tickHandler.ts` — 499 LOC, deus-handler

Confirmado: `wc -l src/context/tickHandler.ts` = **499**. O arquivo importa de **16 módulos distintos**: 12 de domínio/tipos/constantes (`types`, `constants/game`, `services/configProvider`, `constants/missions`, `utils/battleSim`, `utils/heroUtils`, `utils/battleEngine`, `constants/synergies`, `uuid`, `constants/weeklyBosses`, `constants/skills`, `services/milestones`) **+ 4 handlers** (`achievementHandler`, `equipmentHandler`, `dailyQuestHandler`, `weeklyHandler`). Estrutura atual:

| Função | LOC (arquivo) | Responsabilidade |
|---|---|---|
| `bossToMissionTemplate` | 35–47 | adaptador `WeeklyBossTemplate → MissionTemplate` (DUPLICADO — ver 1.1.1) |
| `processTraining` | 50–100 | avança treino HP/ATK/MP, conta pontos, infla `timePerPoint` |
| `processRegeneration` | 103–133 | regen passiva + enfermaria (buff de Healer) |
| `processMissions` | 136–387 | **~252 LOC** — núcleo: aplica `scheduledActions`, resolve `finishAt`, recomputa outcome, credita gold, aplica baixas, reinicia loop, sinaliza boss semanal |
| `handleTick` | 389–499 | orquestra as 4 fases + cascata de daily/weekly + achievements |

A dor concreta de `processMissions` (linhas 136–387): é uma função única de ~252 LOC com **seis preocupações entrelaçadas** num só escopo — (a) resolver template (incl. fallback de boss semanal, 151–155), (b) reproduzir o ledger de `scheduledActions` no `enemiesState`/`heroPositions`/HP dos heróis (161–219), (c) decidir `finishAt` (206–225), (d) recomputar/ler `precomputedOutcome` no fim (227–244), (e) creditar gold + aplicar baixas + drops (255–276), (f) decidir o relançamento do loop com `computeBattleOutcome` + novo `scheduledActions` + `try/catch` de fallback (279–360) e (g) montar `MissionResult[]` (362–376). Qualquer mudança em uma toca o escopo das outras seis.

#### 1.1.1 Duplicação confirmada

`bossToMissionTemplate` (tickHandler.ts:35–47) é **byte-a-byte equivalente** a `bossTemplateToMissionTemplate` (missionHandler.ts:145–157): mesmos 9 campos copiados (`id, name, minHeroes, durationMs, rewardMin, rewardMax, statWeights, difficulty, enemies`). Dois nomes, uma função.

#### 1.1.2 Cascata de daily/weekly — 6 reconstruções de state por tick

`handleTick` (linhas 474–495) reconstrói `stateAfterTick` por spread em **6 chamadas sequenciais** quando há progresso:

```
updateDailyProgress(state, 'missionsCompleted', n)   // 477
updateDailyProgress(state, 'pointsTrained', n)        // 480
updateDailyProgress(state, 'goldEarned', n)           // 483
updateWeeklyProgress(state, 'missionsCompleted', n)   // 488
updateWeeklyProgress(state, 'pointsTrained', n)       // 491
updateWeeklyProgress(state, 'goldEarned', n)          // 494
```

Cada `updateDailyProgress`/`updateWeeklyProgress` (ver `weeklyHandler.ts:22–32`) faz `{ ...state, weeklyState: { ...state.weeklyState, progress } }` — ou seja, até **6 spreads de GameState + 6 spreads de weeklyState/dailyState aninhados por tick** com os mesmos 3 trackers (`missionsCompleted`, `pointsTrained`, `goldEarned`). É puramente mecânico e seguro de bater num único pass.

### 1.2 `battleEngine.ts` — 791 LOC, um objeto-monólito

Confirmado: `wc -l src/utils/battleEngine.ts` = **791**. É um único objeto literal `BattleEngine` com 8 métodos + ~80 LOC de tipos no topo (`Buff`, `BattleEnemy`, `SynergyHandlers`, `BattleState`). Métodos e suas preocupações:

| Método | LOC | Preocupação coesa |
|---|---|---|
| `createEnemies` | 109–173 | **spawn/grid**: embaralha posições no `ENEMY_ROWS`, instancia inimigos, atribui skills |
| `initializeBattle` | 180–216 | **setup**: monta `BattleState`, fia sinergias/handlers, posições |
| `cleanExpiredBuffs` | 222–229 | **buffs**: GC de buffs por round |
| `findMovePath` | 234–269 | **grid/movimento**: BFS hexagonal até o alvo |
| `selectTarget` | 275–362 | **mira**: score por distância+classe+personalidade+`modifyScore`, tiebreak RNG |
| `calculateAttack` | 367–442 | **resolução de dano**: evasão, penalidade de distância, buffs atk/crit/def, hit/crit/dmg |
| `executeClassAbility` | 448–510 | **turno**: cura do Healer (+ AoE Bastião) |
| `processHeroTurn` | 515–671 | **turno do herói**: skill pre-attack → movimento → ataque → on-hit/kill/extra |
| `processEnemyTurn` | 676–790 | **turno do inimigo**: movimento → pre-attack skill → ataque → mitigação tank/escudo |

A ordem de turno/iniciativa **não está aqui** — vive em `battleSim.ts:63–83` (montagem da lista `combatants` + sort por `agility + rng()*2` na linha 72), dentro do laço de rounds (`while` em 56). `battleSim.ts` (137 LOC) é o orquestrador de rounds que consome o `BattleEngine` e expõe a API pública `computeBattleOutcome`.

A dor: as quatro famílias de lógica (grid hex, mira+score, resolução de dano, turnos) estão num só arquivo de 791 LOC sem fronteira de import. SPEC 4 precisa **instrumentar** mira e resolução de dano isoladamente (ex.: medir Δ de winrate por sinergia variando só o `modifyScore` ou o `calcDamage`), e hoje isso obriga a importar o objeto inteiro e mexer no monólito.

### 1.3 Otimização do loop — `getUnlockedSkills` 2× por herói por tick

Confirmado em `handleTick` (tickHandler.ts:397–411): para detectar skills recém-desbloqueadas e emitir `emitSkillUnlocked`, o tick chama `getUnlockedSkills(hero)` **uma vez antes** (398–401, monta `prevSkills`) e **uma vez depois** do treino (404, dentro do `for`). São **2 chamadas por herói por tick**. Mas o conjunto de skills desbloqueadas só pode mudar quando o treino sobe um `trainingCount` — `processTraining` já devolve `totalPointsTrained` e atualiza `hero.trainingCount`. A chamada "antes" recomputa o set anterior do zero todo tick, mesmo quando nenhum herói treinou (heróis em missão/idle: `processTraining` retorna o herói intacto, linhas 95–97). Com N heróis e tick a cada `TICK_INTERVAL_MS`, é 2N invocações de `getUnlockedSkills` por tick — quase todas redundantes.

### 1.4 Estado da caracterização (a rede de segurança)

Os testes que guardam estas áreas, no diretório unit (`src/__tests__/`, fora de `.worktrees/`):

| Suite | LOC | Cobre |
|---|---|---|
| `context/tickHandler.test.ts` | 91 | treino, regen, `goldPercent` do panteão sobre reward |
| `context/tickHandler.advanced.test.ts` | 379 | caminhos avançados do tick |
| `context/weeklyBoss.test.ts` | 326 | fluxo de boss semanal no tick |
| `utils/battleEngine.test.ts` | 165 | `selectTarget`, `calculateAttack` (hit/miss), `findMovePath`, `executeClassAbility` |
| `utils/battleEngine.advanced.test.ts` | 945 | personalidades, pathfinding, AoE, skills |
| `utils/battleSim.test.ts` + `.edgecases.test.ts` | 67+19 | `computeBattleOutcome` golden + edge |

Total relevante ≈ **1992 LOC de teste**. É rede densa, mas tem **lacunas nas fronteiras que vou cortar**: não há teste que fixe diretamente (a) a **igualdade** entre os dois adaptadores de boss; (b) a saída de `processMissions` como unidade isolada (só é exercida via `handleTick`); (c) a **idempotência da cascata daily/weekly** (que os 6 trackers somam o mesmo total quando agregados). Estas lacunas são fechadas em §5 antes de mover qualquer código.

---

## 2. Objetivos e Não-Objetivos

### Objetivos (mensuráveis)
1. **`processMissions` extraído** de `tickHandler.ts` para `src/context/missionTickHandler.ts`, com assinatura idêntica à atual (mesmo tipo de retorno). `tickHandler.ts` cai de 499 para **≤ 260 LOC**.
2. **Cascata daily/weekly agregada**: as 6 chamadas (tickHandler.ts:474–495) viram **1 agregador** que aplica os 3 trackers a daily e weekly num único pass, produzindo `GameState` byte-equivalente ao atual.
3. **`battleEngine.ts` modularizado** em ≥ 4 unidades coesas por arquivo (grid, mira, dano, turnos), `battleEngine.ts` reduzido a um **barril/fachada** que reexporta `BattleEngine` com a **mesma forma pública**. `computeBattleOutcome` e todos os call sites (`tickHandler`, `missionHandler`) compilam sem alteração.
4. **`getUnlockedSkills` chamado ≤ 1×/herói/tick** quando `trainingCount` não muda; recomputa o set só para heróis cujo `trainingCount` mudou no tick.
5. **Suíte unit verde e idêntica** (mesmo nº de testes passando, 0 novos falhando) antes e depois — `npx tsc --noEmit` 0 erros, `npm test` (jest.unit) verde.
6. **Determinismo preservado**: dado o mesmo `seed`, `computeBattleOutcome` produz `actions`/`reward`/`casualties` **idênticos** antes e depois (teste de regressão por snapshot de seed fixo).

### Não-Objetivos (YAGNI)
- **Nada de mudança de regra/balanço/número** — isso é SPEC 4. Se um teste de caracterização mudar de valor esperado, **é bug da refatoração**, não ajuste.
- **Não** transformar `BattleEngine` (objeto literal) em classes nem injetar DI/container — o objeto-fachada basta.
- **Não** mexer em `offlineProgress.ts`, persistência, `LOAD_STATE` (SPEC 1) nem na semântica de `remainingMs`.
- **Não** unificar os dois fluxos de `handleStartMission`/`handleStartWeeklyBoss` (eles divergem no cálculo de equipamento: missionHandler usa `getEffectiveStats` em 91–94, weeklyBoss soma `statBonus` à mão em 195–214) — fora de escopo.
- **Não** adicionar memoização/`reselect` global, cache de `getEffectiveStats`, nem otimizar `createEnemies` shuffle. Só a ineficiência de §1.3.
- **Não** criar abstrações novas de domínio ("BattlePipeline", "TickContext" genérico) sem necessidade. Extração mecânica, não redesenho.

---

## 3. Design Detalhado

A refatoração é **estrutural, não semântica**. Cada unidade abaixo é "cortar daqui, colar ali, ajustar imports". Princípio: **uma unidade movida = um commit = suíte verde**.

### 3.1 Extração de `processMissions` → `missionTickHandler.ts`

Novo arquivo `src/context/missionTickHandler.ts`. Move-se `processMissions` (tickHandler.ts:136–387) **integral e sem alteração de corpo**, exportando-a:

```ts
// src/context/missionTickHandler.ts
import { GameState, Hero, ActiveMission, MissionResult, MissionOutcome, ClassId } from '../types';
import { MISSIONS, MissionTemplate } from '../constants/missions';
import { WEEKLY_BOSS_POOL } from '../constants/weeklyBosses';
import { computeBattleOutcome } from '../utils/battleSim';
import { BattleEngine } from '../utils/battleEngine';
import { getEffectiveStats, applyGoldBonus } from '../utils/heroUtils';
import { getActiveSynergies } from '../constants/synergies';
import { bossToMissionTemplate } from './bossTemplate'; // ver 3.2
import {
  MISSION_FINISH_DELAY_MS, MISSION_START_DELAY_MS, MISSION_ACTION_INTERVAL_MS,
  HEALER_BUFF_PER_HERO, HEALER_BUFF_CAP, ROGUE_RNG_BONUS_PER_HERO, ROGUE_RNG_BONUS_CAP,
} from '../constants/game';
import { v4 as uuidv4 } from 'uuid';

export interface ProcessMissionsResult {
  newHeroes: Hero[];
  activeMissions: ActiveMission[];
  goldGained: number;
  newResults: MissionResult[];
  materialDrops: Record<string, number>;
  weeklyBossDefeated: boolean;
  weeklyBossTemplateId: string | undefined;
}

export function processMissions(state: GameState, heroes: Hero[], now: number): ProcessMissionsResult {
  /* corpo idêntico a tickHandler.ts:145–386 */
}
```

`tickHandler.ts` passa a `import { processMissions } from './missionTickHandler'` e a chamá-la inalterada na fase 3 (atual linha 417–425). O tipo de retorno inline atual (tickHandler.ts:136–144) vira `ProcessMissionsResult` nomeado — facilita SPEC 4 tipar mocks/instrumentação.

**Por que esta fronteira:** `processMissions` já recebe `(state, heroes, now)` e devolve um objeto puro consumido por `handleTick` (não muta `tickHandler` por fora). É um corte limpo de função pura. Os símbolos `computeBattleOutcome`, `BattleEngine`, `getEffectiveStats`, `applyGoldBonus`, `getActiveSynergies`, `uuidv4`, `MISSIONS`/`MissionTemplate`, e as constantes de missão/healer/rogue (`MISSION_FINISH_DELAY_MS`, `MISSION_START_DELAY_MS`, `MISSION_ACTION_INTERVAL_MS`, `HEALER_BUFF_PER_HERO`, `HEALER_BUFF_CAP`, `ROGUE_RNG_BONUS_PER_HERO`, `ROGUE_RNG_BONUS_CAP`) migram junto. Com isso `tickHandler` **deixa de importar 5 módulos inteiros** (`utils/battleSim`, `utils/battleEngine`, `utils/heroUtils`, `constants/synergies`, `uuid`), encolhe os imports de `constants/game` e `constants/missions`, e passa a depender de `./missionTickHandler` + `./bossTemplate`. **Atenção:** `WEEKLY_BOSS_POOL` (de `constants/weeklyBosses`) **continua importado** por `handleTick` (linha 464, ao conceder o equipamento garantido do boss), então esse import permanece — embora `missionTickHandler` também o importe para o fallback de template.

### 3.2 Deduplicar o adaptador de boss → `bossTemplate.ts`

Novo `src/context/bossTemplate.ts` exporta uma única `bossToMissionTemplate(boss: WeeklyBossTemplate): MissionTemplate` (corpo idêntico ao atual). `missionTickHandler.ts` e `missionHandler.ts` passam a importá-la; remove-se a cópia local de cada um (tickHandler.ts:35–47 e missionHandler.ts:145–157). Antes do corte, teste de caracterização fixa que ambas produzem a mesma saída (§5.1) — depois do corte, basta-se a função única.

### 3.3 Agregador da cascata daily/weekly → `progressTrackers.ts`

Novo `src/context/progressTrackers.ts`:

```ts
// src/context/progressTrackers.ts
import { GameState } from '../types';
import { updateDailyProgress } from './dailyQuestHandler';
import { updateWeeklyProgress } from './weeklyHandler';

export interface TickProgressDelta {
  missionsCompleted: number;
  pointsTrained: number;
  goldEarned: number;
}

/**
 * Aplica os 3 trackers de tick a daily e weekly num único pass.
 * Equivalente às 6 chamadas sequenciais de handleTick (preserva ordem:
 * daily antes de weekly, e missionsCompleted→pointsTrained→goldEarned),
 * pois updateDailyProgress/updateWeeklyProgress ignoram amount<=0.
 */
export function applyTickProgress(state: GameState, delta: TickProgressDelta): GameState {
  let s = updateDailyProgress(state, 'missionsCompleted', delta.missionsCompleted);
  s = updateDailyProgress(s, 'pointsTrained', delta.pointsTrained);
  s = updateDailyProgress(s, 'goldEarned', delta.goldEarned);
  s = updateWeeklyProgress(s, 'missionsCompleted', delta.missionsCompleted);
  s = updateWeeklyProgress(s, 'pointsTrained', delta.pointsTrained);
  s = updateWeeklyProgress(s, 'goldEarned', delta.goldEarned);
  return s;
}
```

**Comportamento preservado, não alterado.** Os guards `amount <= 0` (weeklyHandler.ts:23) e o equivalente em `dailyQuestHandler` já fazem `update*` virar no-op quando o delta é 0 — então remover os `if (n > 0)` externos de `handleTick` (476/479/482/487/490/493) e passar os 3 deltas diretos para `applyTickProgress` produz **o mesmo `GameState`**. A "batelada" pedida no escopo (c) é exatamente isto: substituir 6 chamadas + 6 ifs espalhados por 1 chamada que faz os 6 updates em sequência, num só lugar. Não se funde os spreads internos de `update*` (manter as funções de domínio intactas evita risco); ganha-se legibilidade e um único ponto de evolução. `handleTick` fase 4+5 (linhas 474–495) colapsa para:

```ts
stateAfterTick = applyTickProgress(stateAfterTick, {
  missionsCompleted: missionsCompletedCount,
  pointsTrained: totalPointsTrained,
  goldEarned: goldGained,
});
```

### 3.4 Otimização `getUnlockedSkills`

`processTraining` (tickHandler.ts:50–100) já sabe quais heróis treinaram: só os `case TRAIN_*` alteram `trainingCount` e contribuem para `totalPointsTrained`; o `default` retorna o herói **por referência** (linha 96). Logo, `heroAfter === heroBefore` (mesma referência) ⟺ não treinou. Refino de `handleTick` (397–411):

```ts
// só recomputa skills dos heróis cuja referência mudou (= treinaram neste tick)
const { heroes: heroesAfterTraining, totalPointsTrained } =
  processTraining(currentState.heroes, tickMs, inflation);

if (totalPointsTrained > 0) {
  const before = new Map(currentState.heroes.map(h => [h.id, h]));
  for (const hero of heroesAfterTraining) {
    const prevHero = before.get(hero.id);
    if (prevHero === hero) continue;          // não treinou → skills não mudam
    const prevSkills = getUnlockedSkills(prevHero!).map(s => s.id);
    for (const skill of getUnlockedSkills(hero)) {
      if (!prevSkills.includes(skill.id)) emitSkillUnlocked(hero.name, skill.icon, skill.name);
    }
  }
}
```

**Garantia de equivalência:** `getUnlockedSkills` é função pura do estado do herói (treino) — se `prevHero === hero` (mesma referência, nenhum stat mudou), o set desbloqueado é idêntico, então pular a comparação não pode perder um unlock. E unlocks só ocorrem quando algum `trainingCount` sobe, o que implica `totalPointsTrained > 0`. Resultado: quando **nenhum** herói treina (caso dominante — heróis em missão/idle), **0 chamadas** a `getUnlockedSkills` (antes: 2N). Quando K de N heróis treinam, **2K chamadas** (antes: 2N). Mesmos eventos `emitSkillUnlocked` emitidos.

> Esta otimização depende de `processTraining` retornar o herói **por referência** no `default`. Isso já é verdade (linha 96 `return hero;`) e fica **fixado por teste** (§5.4) para que ninguém quebre a invariante por descuido (ex.: trocar para `return { ...hero }`).

### 3.5 Modularização de `battleEngine.ts`

`battleEngine.ts` vira um **barril (fachada)**. As 4 famílias migram para arquivos sob `src/utils/battle/`, e o objeto `BattleEngine` é remontado no barril a partir das funções movidas — **mantendo a forma pública `BattleEngine.metodo(...)`** (consumida por `battleSim.ts:44,58,78,81` — `initializeBattle`/`cleanExpiredBuffs`/`processHeroTurn`/`processEnemyTurn`; `missionHandler.ts:103,235` — `createEnemies`; `missionTickHandler` linha que hoje é `tickHandler.ts:322` — `createEnemies`; e a suíte). Tipos (`Buff`, `BattleEnemy`, `SynergyHandlers`, `BattleState`, `SynergyId`, `BuffType`) migram para `src/utils/battle/types.ts` e são reexportados pelo barril (a suíte importa `{ BattleEngine, BattleEnemy, BattleState }` de `../utils/battleEngine`).

Decomposição proposta (cada arquivo = uma preocupação coesa, funções **livres** que recebem o que precisam por parâmetro):

| Arquivo novo | Origem (battleEngine.ts) | Exports |
|---|---|---|
| `src/utils/battle/types.ts` | 19–101 | `SynergyId`, `BuffType`, `Buff`, `BattleEnemy`, `SynergyHandlers`, `BattleState` |
| `src/utils/battle/grid.ts` | `createEnemies` (109–173), `findMovePath` (234–269) | `createEnemies`, `findMovePath` (usam `GameMath.getHex*`, `ENEMY_ROWS`, `GRID_*`) |
| `src/utils/battle/targeting.ts` | `selectTarget` (275–362) | `selectTarget` (score por dist/classe/personalidade + `modifyScore` + tiebreak rng) |
| `src/utils/battle/resolution.ts` | `calculateAttack` (367–442), `cleanExpiredBuffs` (222–229) | `calculateAttack`, `cleanExpiredBuffs` (evasão, penalidade dist, buffs, crit/dmg) |
| `src/utils/battle/turns.ts` | `executeClassAbility` (448–510), `processHeroTurn` (515–671), `processEnemyTurn` (676–790) | `executeClassAbility`, `processHeroTurn`, `processEnemyTurn` |
| `src/utils/battle/setup.ts` | `initializeBattle` (180–216) | `initializeBattle` |
| `src/utils/battleEngine.ts` (barril) | — | `export const BattleEngine = { createEnemies, initializeBattle, cleanExpiredBuffs, findMovePath, selectTarget, calculateAttack, executeClassAbility, processHeroTurn, processEnemyTurn }` + reexport de tipos |

**Cuidado com `this`:** hoje os métodos chamam-se via `this.` (ex.: `processHeroTurn` usa `this.selectTarget`, `this.findMovePath`, `this.calculateAttack`; `initializeBattle` usa `this.createEnemies`; `processEnemyTurn` usa `this.selectTarget`). Ao virar funções livres, cada `this.X(...)` vira chamada direta `X(...)` importada do módulo irmão. Como o barril remonta `BattleEngine` a partir das mesmas funções, call sites externos (`BattleEngine.processHeroTurn`) não mudam. **A iniciativa/ordem de turno fica onde está** (`battleSim.ts:63–83`, sort na linha 72) — não é responsabilidade do engine e o escopo só pede "ordem de turno/iniciativa" como *unidade coesa a identificar*; ela já é coesa e isolada no `battleSim`. Documenta-se isso (não há código a mover; o snapshot golden §5.5 fixa indiretamente que a ordem de turno permanece idêntica por seed).

**Grafo de dependência interno** (sem ciclos): `turns.ts` → `targeting.ts`, `resolution.ts`, `grid.ts` (findMovePath), `GameMath` (em `executeClassAbility`) + efeitos de skill/personalidade já externos (`skillEffects`, `personalityEffects`, `enemySkillEffects`). `setup.ts` → `grid.ts` (createEnemies), `constants/synergies` (`getActiveSynergies`), `synergyEffects` (`createSynergyHandlers`). `grid.ts` → `GameMath`, `constants/enemySkills` (`assignEnemySkills`). `resolution.ts`/`targeting.ts` → `GameMath`, `constants`, efeitos externos. `types.ts` é folha. O barril importa de todos e exporta o objeto. Nenhum dos novos módulos importa `turns.ts` (raiz do grafo), o que garante aciclicidade.

### 3.6 Fluxo de dados pós-refatoração (inalterado na semântica)

```
gameReducer.TICK → handleTick(state, now)
  ├─ refreshDailyQuests → refreshWeeklyState
  ├─ processTraining → (otim. §3.4) emitSkillUnlocked p/ heróis que treinaram
  ├─ processRegeneration
  ├─ processMissions  [missionTickHandler.ts]   ← era inline em tickHandler
  │     └─ computeBattleOutcome [battleSim → battle/* modular]   ← era battleEngine monólito
  ├─ merge materialDrops / weekly boss reward
  ├─ applyTickProgress(delta)  [progressTrackers.ts]   ← era 6 chamadas + 6 ifs
  └─ checkAchievements
```

Nenhuma seta nova; só fronteiras de módulo onde antes havia uma função gigante.

---

## 4. Mudanças por Arquivo

| Arquivo | Ação | O que muda |
|---|---|---|
| `src/context/bossTemplate.ts` | **criar** | Exporta `bossToMissionTemplate` única (corpo = tickHandler.ts:35–47). |
| `src/context/missionTickHandler.ts` | **criar** | Recebe `processMissions` movida de tickHandler.ts:136–387 + `ProcessMissionsResult` (tipo nomeado do retorno inline 136–144). Importa `bossToMissionTemplate` de `./bossTemplate`. |
| `src/context/progressTrackers.ts` | **criar** | `applyTickProgress(state, delta)` + `TickProgressDelta` (§3.3). |
| `src/context/tickHandler.ts` | **editar** | Remove `processMissions` (136–387), `bossToMissionTemplate` (35–47) e ~9 imports que migraram. Importa `processMissions`, `applyTickProgress`. Fase 3 chama `processMissions` importada. Fases 4–5 (474–495) colapsam para 1 `applyTickProgress`. Otimização §3.4 nas linhas 397–411. Alvo: **≤ 260 LOC** (de 499). Mantém `processTraining` e `processRegeneration` (são pequenas e específicas do tick). |
| `src/context/missionHandler.ts` | **editar** | Remove `bossTemplateToMissionTemplate` (145–157); importa `bossToMissionTemplate` de `./bossTemplate`; troca o uso em `handleStartWeeklyBoss` (linha 192). Nenhuma outra mudança. |
| `src/utils/battle/types.ts` | **criar** | Tipos de battleEngine.ts:19–101. |
| `src/utils/battle/grid.ts` | **criar** | `createEnemies`, `findMovePath`. |
| `src/utils/battle/targeting.ts` | **criar** | `selectTarget`. |
| `src/utils/battle/resolution.ts` | **criar** | `calculateAttack`, `cleanExpiredBuffs`. |
| `src/utils/battle/turns.ts` | **criar** | `executeClassAbility`, `processHeroTurn`, `processEnemyTurn` (`this.` → import direto). |
| `src/utils/battle/setup.ts` | **criar** | `initializeBattle`. |
| `src/utils/battleEngine.ts` | **editar (vira barril)** | Esvazia o corpo; reexporta tipos de `./battle/types` e remonta `export const BattleEngine = { ... }` a partir das funções de `./battle/*`. Forma pública idêntica. |
| `src/utils/battleSim.ts` | **inalterado** | `computeBattleOutcome` continua importando `{ BattleEngine, BattleEnemy, BattleState }` de `./battleEngine` (barril) — compila sem tocar. |
| `src/__tests__/context/bossTemplate.test.ts` | **criar** | Caracterização da igualdade do adaptador (§5.1). |
| `src/__tests__/context/progressTrackers.test.ts` | **criar** | Idempotência da cascata (§5.3). |
| `src/__tests__/context/missionTickHandler.test.ts` | **criar** | Caracteriza `processMissions` isolada (§5.2). |
| `src/__tests__/utils/battleEngine.golden.test.ts` | **criar** | Snapshot determinístico por seed (§5.5) — rede contra regressão da modularização. |

Nenhum arquivo é deletado; `battleEngine.ts` e `tickHandler.ts` permanecem como pontos de import estáveis.

---

## 5. Estratégia de Teste

Regra-mestra: **a suíte unit é a especificação do comportamento**. Toda extração é validada por `npm test` (jest.unit.config.js, `--runInBand`) verde **idêntico** antes/depois. Onde corto uma fronteira sem cobertura direta, escrevo o teste de caracterização **antes** de mover (TDD reverso: o teste descreve o que já existe, depois mexo no código sem ele mudar de cor). Sem mock de DB; combate usa `seed` fixo (determinismo #47 já disponível).

### 5.1 Igualdade dos adaptadores de boss (ANTES de 3.2)
`bossTemplate.test.ts`: para cada boss de `WEEKLY_BOSS_POOL`, `bossToMissionTemplate(boss)` deve produzir objeto com os 9 campos esperados; e um teste que afirma que a saída casa a forma usada por `computeBattleOutcome`/`createEnemies`. Verde com a função atual; segue verde após dedupe.

### 5.2 `processMissions` isolada (ANTES de 3.1)
`missionTickHandler.test.ts` monta um `GameState` com 1 missão ativa contendo `scheduledActions` + `precomputedOutcome` + `finishAt` no passado e chama `processMissions(state, heroes, now)` direto. Casos concretos:
- **golden path**: missão não-loop que atinge `finishAt` → `goldGained === applyGoldBonus(reward)`, herói volta a `IDLE`, `newResults.length === 1`.
- **loop com sobreviventes ≥ minHeroes** → `activeMissions` contém missão nova com `startedAt === now`, novo `scheduledActions`, `precomputedOutcome` presente; heróis **não** voltam a IDLE.
- **loop sem sobreviventes suficientes** → heróis liberados a IDLE, sem missão nova.
- **boss semanal vitorioso** → `weeklyBossDefeated === true`, `weeklyBossTemplateId` correto.
- **baixas aplicadas** → `newHeroes[i].hpCurrent === outcome.casualties[i].hpAfter`.
- **drops acumulados** → `materialDrops` soma os drops do outcome.

Estes casos hoje só são exercidos **indiretamente** via `tickHandler.advanced.test.ts`; ao isolá-los, o corte 3.1 fica protegido por asserts diretos.

### 5.3 Idempotência/equivalência da cascata (ANTES de 3.3)
`progressTrackers.test.ts`: dado um `state` com `weeklyState`/`dailyState`, `applyTickProgress(state, {m, p, g})` produz **exatamente** o mesmo `GameState` que aplicar as 6 chamadas manuais na ordem atual. Inclui caso com algum delta `=0` (garante que o guard `amount<=0` mantém no-op). Comparação por `expect(out).toEqual(expectedManual)`.

### 5.4 Invariante de referência do `processTraining` (ANTES de 3.4)
Teste em `tickHandler.test.ts` (estender o existente): herói em `IDLE`/`MISSION` passado a `processTraining` retorna a **mesma referência** (`expect(out.heroes[0]).toBe(input[0])`); herói em `TRAIN_*` com tempo suficiente retorna referência **nova** e `totalPointsTrained > 0`. Fixa a invariante de que a otimização §3.4 depende.

### 5.5 Determinismo de combate (rede da modularização 3.5)
`battleEngine.golden.test.ts`: roda `computeBattleOutcome(template, heroes, { seed: 12345 })` para 2–3 cenários (1 sem sinergia, 1 com sinergia ativa, 1 com personalidade não-neutra) e faz `toMatchSnapshot()` de `{ success, reward, rounds, casualties, actions.length, primeiras 10 actions }`. Gera-se o snapshot **na branch base (pré-refatoração)**; após mover os módulos, o snapshot tem de bater **byte-a-byte**. É o gate central: se a modularização introduzir qualquer divergência (ex.: `this` perdido, ordem de import alterando algo), o snapshot falha.

### 5.6 Regressão de suíte completa
`npx tsc --noEmit` (0 erros) + `./node_modules/.bin/jest --config jest.unit.config.js --runInBand` rodados **antes** (baseline: anotar nº de suites/testes passando) e **depois de cada commit de extração**. Critério: mesmo nº de testes passando, 0 novos vermelhos. Diff de contagem de testes só pode crescer (os novos de caracterização), nunca encolher.

### 5.7 Validação de UI
Refatoração pura não altera UI; ainda assim, **smoke no browser** (Expo web) após a fase de battleEngine: iniciar 1 missão, ver a animação de batalha rodar e o resultado/gold creditar — confirma que o barril não quebrou os call sites de `BattleEngine.createEnemies`/`processHeroTurn` em runtime (não só no tsc). Screenshot do MissionResultModal com gold > 0.

---

## 6. Critérios de Aceitação

Binários e mensuráveis:

1. `npx tsc --noEmit` → **0 erros**.
2. `jest.unit.config.js` → **verde**; nº de testes passando ≥ baseline (só cresce pelos testes de caracterização novos).
3. `wc -l src/context/tickHandler.ts` → **≤ 260** (de 499).
4. `src/context/missionTickHandler.ts`, `src/context/progressTrackers.ts`, `src/context/bossTemplate.ts` existem e exportam, respectivamente, `processMissions`/`ProcessMissionsResult`, `applyTickProgress`/`TickProgressDelta`, `bossToMissionTemplate`.
5. **0 ocorrências** de definição de adaptador de boss fora de `bossTemplate.ts`: `grep -rnE "minHeroes: boss\.minHeroes" src/context` retorna **só** `bossTemplate.ts`.
6. `battleEngine.ts` é fachada: `wc -l src/utils/battleEngine.ts` cai para **≤ 60 LOC** (só reexports/montagem); existem ≥ 5 arquivos em `src/utils/battle/`.
7. Call sites de produção **inalterados**: `grep -rn "BattleEngine\.createEnemies(" src --include=*.ts | grep -v __tests__ | grep -v .worktrees` retorna exatamente **3** linhas (hoje `tickHandler.ts:322`→`missionTickHandler.ts`, `missionHandler.ts:103`, `missionHandler.ts:235`); `initializeBattle`/`cleanExpiredBuffs`/`processHeroTurn`/`processEnemyTurn` permanecem **1 cada** em `battleSim.ts`. (O comentário-docstring `missionHandler.ts:143` não conta — não é call site.)
8. Snapshot de `battleEngine.golden.test.ts` (gerado na base) passa **sem `--ci -u`** após a refatoração (igualdade byte-a-byte do outcome por seed).
9. **`getUnlockedSkills` não é chamado quando ninguém treina**: teste com todos os heróis em `MISSION`/`IDLE` espia `getUnlockedSkills` (ex.: `jest.spyOn`) e afirma `toHaveBeenCalledTimes(0)` num tick; com 1 herói treinando até desbloqueio, afirma o `emitSkillUnlocked` correspondente disparou.
10. `git diff` de cada commit toca **uma** unidade (não há commit que mova battleEngine e tickHandler juntos).

---

## 7. Riscos e Mitigação

| Risco | Severidade | Mitigação |
|---|---|---|
| **`this.` perdido ao virar funções livres** em `turns.ts`/`setup.ts` (battleEngine usa `this.selectTarget` etc.) → `undefined is not a function` em runtime, invisível ao tsc se mal-tipado | 🔴 Alto | Snapshot determinístico (§5.5) roda o pipeline real; smoke no browser (§5.7) exercita os call sites. Converter `this.X` → import direto método a método, rodando a suíte a cada conversão. |
| **Ciclo de import** entre `battle/*` (turns↔targeting↔resolution) | 🟠 Médio | Grafo desenhado acyclic (§3.5): `turns` depende dos outros, ninguém depende de `turns`. `types.ts` é folha. `madge`/tsc acusam ciclo se surgir. |
| **Mudança silenciosa de saída** numa extração (ex.: ordem de spread, default de param) | 🟠 Médio | Snapshot por seed (§5.5) + suíte idêntica (§5.6) como gate por commit. Extração é cortar-colar, não reescrever. |
| **Otimização §3.4 perde um `emitSkillUnlocked`** (ex.: herói treina mas `processTraining` não troca referência) | 🟠 Médio | Invariante de referência fixada por teste (§5.4) **antes** da otimização; teste de unlock real (critério 9) confirma o evento dispara. Se `processTraining` mudar para sempre clonar, o teste §5.4 quebra e bloqueia. |
| **Guard `amount<=0` divergir entre daily e weekly** ao agregar a cascata | 🟡 Baixo | `weeklyHandler.ts:23` confirma `amount<=0 → no-op`; teste §5.3 cobre delta=0. Se `dailyQuestHandler` não tiver o guard, `applyTickProgress` o mantém via os deltas (que já são ≥0 por construção do tick). |
| **Escopo creep para SPEC 4** (tentação de "já que estou aqui, ajusto o score") | 🟠 Médio | Não-objetivo explícito §2; qualquer Δ de valor num teste de caracterização é tratado como **bug**, revertido, não aceito. |
| **Baseline de testes mal medida** (worktree poluindo a contagem) | 🟡 Baixo | Rodar baseline só com `jest.unit.config.js` após SPEC 1 ter ignorado `.worktrees/` (dependência declarada §8). |

---

## 8. Dependências e Sequenciamento

**Depende de:**
- **SPEC 1 (Estabilização Técnica & Boot Mobile)** — obrigatório. SPEC 1 deixa `tsc` em 0 erros e a suíte limpa (`.worktrees/` ignorado, ≤ 60 suites, threshold de coverage). Sem isso a "baseline verde idêntica" que guarda esta refatoração não existe — refatorar sobre suíte vermelha/inflada é cego. O roadmap fixa `SPEC 1 ──> SPEC 6` (linha 71).

**Destrava / habilita:**
- **SPEC 4 (Balance & Economia)** — o roadmap diz "SPEC 4 se beneficia de SPEC 6 (engine modular facilita instrumentar o balanço), mas não depende" (linha 76). Com `battle/targeting.ts` e `battle/resolution.ts` isolados, o `balance_analysis.ts` de SPEC 4 pode instrumentar mira e dano sem importar o monólito; `ProcessMissionsResult` tipado facilita harness de simulação em massa. Não é gate de SPEC 4, é acelerador.

**Sequenciamento interno (ordem dos commits, cada um com suíte verde):**
1. `bossTemplate.ts` + teste §5.1 → dedupe em `missionHandler` e `tickHandler`.
2. Teste §5.4 (invariante de referência) → otimização §3.4 em `handleTick`.
3. `progressTrackers.ts` + teste §5.3 → colapsar cascata em `handleTick`.
4. Teste §5.2 (`processMissions` isolada) → extrair `missionTickHandler.ts`.
5. Snapshot golden §5.5 na base → modularizar `battleEngine.ts` em `battle/*` (um módulo por commit: types → grid → resolution → targeting → setup → turns → barril), suíte + snapshot verdes a cada passo.
6. Smoke no browser (§5.7) → fechar.

Cada fase é independente e reversível (branch `feat/refatoracao-habilitadora`, worktree em `.worktrees/`, conforme convenção do projeto).

---

*Gerado em 2026-06-20. Refatoração comportamento-preservante guardada por testes de caracterização; nenhuma regra de jogo, balanço ou número de saída é alterado (isso é SPEC 4).*
