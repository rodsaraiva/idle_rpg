# Balance & Economia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar sinergias, personalidades e equipamentos mecanicamente mensuráveis (medição A/B por efeito, não por troca de classe), instrumentar o ritmo econômico (gold/hora, custos, tempo até forja/fusão/boss), implementar o gate de estrela do boss semanal e transformar `balance_analysis.ts` num gate de CI com exit-code, removendo os scripts de simulação legados divergentes.

**Architecture:** O harness de simulação (`scripts/simulations/balance_analysis.ts`) ganha um hook de teste `forceSynergies` que atravessa `runMissionSimulation` → `BattleEngine.initializeBattle` → `createInitialState`, permitindo medir a MESMA composição com handlers de sinergia ligados vs NOOP. Os sweeps de personalidade e equipamento passam a medir contra um baseline neutro (sem personalidade / sem itens) num estágio com headroom (baseline 40–75%). Um novo `sweepEconomy()` puramente determinístico importa `GameMath.calcMissionReward`/`getRecruitCost` reais (proibido reimplementar). Um bloco `assertThresholds` + flag `--ci` faz o script sair com código ≠0 quando limiares são violados. O gate de estrela vai em `handleStartWeeklyBoss` (bloqueia o início, não desperdiça tentativa). Toques no `battleEngine.ts` são cirúrgicos: apenas o `??` de `forceSynergies` em `initializeBattle`. O fix do Bastião já está no engine (verificado), então não há segundo toque.

**Tech Stack:** TypeScript, ts-node (`tsconfig.sim.json`), Jest (`jest.unit.config.js`), Expo/React Native. Sem novas dependências.

**Spec:** [`docs/superpowers/specs/2026-06-20-balance-economia-design.md`](../specs/2026-06-20-balance-economia-design.md)

## Global Constraints
- Idioma de todo conteúdo (docs, comentários, mensagens de commit, log do relatório): pt-BR. Identificadores de código em inglês.
- `npx tsc --noEmit` → 0 erros antes de cada commit.
- `npm test` (`jest --config jest.unit.config.js`) verde antes de cada commit.
- Alvo mobile (iOS/Android via Expo). Nenhuma mudança aqui toca UI; validação visual fica para SPEC 3.
- Sem gold passivo: gold só de missão completada. Invariante coberta por teste (`sweepEconomy` valida gold-fora-de-missão = 0).
- DEF/CRIT/AGI não-treináveis: só crescem por equipamento/passiva/fusão. Nenhum ajuste pode torná-los treináveis.
- "Integração > mock": os sweeps de balanço rodam o engine e a math REAIS; proibido reimplementar fórmulas ou fabricar números.
- DRY / YAGNI: sem novas classes/missões/sinergias/personalidades; só rebalanceia o existente. Sem abstração prematura.
- Os toques no `battleEngine.ts` são mínimos e preservam o caminho de produção (`forceSynergies === undefined` → comportamento atual idêntico).

---

## Estado do código vs. spec (ler antes de começar)

O spec foi escrito em 2026-06-20; parte dele já foi implementada desde então. **Confirmado por leitura do código em 2026-06-21:**

| Item do spec | Estado real | Consequência no plano |
|---|---|---|
| §3.1.1 Bastião "inerte por bug" | **JÁ corrigido.** `battleEngine.ts:473-503` consome `flags['bastion_armed']` → cura AoE + limpa flag. | Vira Task de **verificação** (não reimplementar). Não há 2º toque no engine. |
| §5.1 testes unit de `synergyEffects`/`personalityEffects` | **JÁ existem** em `src/__tests__/utils/synergyEffects.test.ts` (incl. teste AoE do Bastião) e `personalityEffects.test.ts`. 68 testes verdes. | Não recriar. Plano só adiciona o que falta. |
| §3.6 gate "uma-vez-por-semana" | **JÁ existe** (`handleStartWeeklyBoss` checa `bossDefeated`; `weeklyBoss.test.ts` cobre). | Falta só o gate de **estrela** (`heroes.some(stars>0)`). |
| Trackers `itemsForged`/`fusionsCompleted`/`weeklyBossKills` | **JÁ incrementam** (`equipmentHandler.ts:56`, `pantheonHandler.ts:126`, `tickHandler.ts:463`). | Fora de escopo. |
| §3.1 `forceSynergies` (hook A/B) | **NÃO existe.** `initializeBattle` só auto-detecta via `getActiveSynergies`. | Task 1. |
| §3.5 `sweepEconomy` | **NÃO existe.** Nenhum sweep mede gold/hora. | Tasks 6-7. |
| §3.7 gate de CI (`--ci`, exit-code) | **NÃO existe.** | Task 8. |
| §3.8 scripts legados | **Existem** (`scripts/simulate_full.js`, `simulate_grid.js`, `simulate_training_missions.js`), referenciados só pelo próprio spec. | Task 10. |

Caminhos reais relevantes:
- `markWeeklyBossDefeated` (`weeklyHandler.ts:71`) é chamado em `tickHandler.ts:462` (pós-combate). O gate de produto correto é no **início** (`handleStartWeeklyBoss`, `missionHandler.ts:159`), logo após o gate de `bossDefeated` (`:166`).
- Estado inicial: `gold: 20` (`gameReducer.ts:34`).
- `runMissionSimulation` já aceita `seed?` (`simulationRunner.ts:14`); usa `makeRng(seed+i)` por iteração.
- `Hero.stars?` existe (`types/index.ts:47`).

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/utils/battleEngine.ts` | Modify | `initializeBattle` aceita `opts.forceSynergies?: SynergyId[]`, sobrepondo `getActiveSynergies` (hook de teste, §3.1). |
| `scripts/utils/simulationRunner.ts` | Modify | `SimulationParams` ganha `forceSynergies?`; repassa a `initializeBattle`. |
| `src/__tests__/utils/battleEngineSynergyOverride.test.ts` | Create | Testa que `forceSynergies:[]` desliga sinergias auto-detectadas e que `forceSynergies:['X']` força a sinergia X. |
| `scripts/simulations/balance_analysis.ts` | Modify | `STAGES` (headroom + midgame); `sweepSynergies` A/B por efeito (NOOP vs ativo); `sweepPersonalities` vs sem-personalidade; `sweepEquipment` usa `generateEquipment` real seedado; novo `sweepEconomy`; `THRESHOLDS` + `assertThresholds` + flag `--ci`. Remove `makeEquipment`/`applyEquipmentToHero` hardcoded. |
| `src/context/equipmentHandler.ts` | Modify | Extrai `rollEquipmentStats(template, tier, rng)` para roll determinístico injetável; `generateEquipment` ganha param `rng?`. |
| `src/__tests__/context/equipmentHandler.roll.test.ts` | Create | Roll tier-multiplicativo determinístico (`generateEquipment(3,'weapon',rng)` rola atk em [6,24]; tier 1 em [2,8]). |
| `src/context/missionHandler.ts` | Modify | Gate de estrela em `handleStartWeeklyBoss` (`:166`): exige ≥1 herói com estrela. |
| `src/__tests__/context/weeklyBoss.test.ts` | Modify | Testa o gate de estrela (bloqueia sem estrela; permite com estrela). |
| `src/utils/synergyEffects.ts` | Modify (condicional) | Ajuste de potência por sinergia só se Δ<+5pp após medição correta (Task 4, tabela). |
| `src/utils/personalityEffects.ts` | Modify (condicional) | Ajuste de potência por personalidade só se Δ<+3pp (Task 5, tabela). |
| `src/constants/equipment.ts` | Modify (condicional) | `statRange.max` por template só se a curva de tier for fraca (Task 5). |
| `src/constants/missions.ts` | Modify (condicional) | Ajuste de `ref`/`scale`/`rewardMax` só se `sweepEconomy` mostrar curva não-monotônica (Task 7). |
| `package.json` | Modify | Novo script `balance:check`. |
| `scripts/simulate_full.js` | **Remove** | Math divergente, não referenciado. |
| `scripts/simulate_grid.js` | **Remove** | idem. |
| `scripts/simulate_training_missions.js` | **Remove** | idem. |

---

## Task 1: Hook de teste `forceSynergies` no `battleEngine.ts`

**Files:**
- Modify: `src/utils/battleEngine.ts` (assinatura de `initializeBattle` em `:180-184`; corpo em `:190-193`)
- Create: `src/__tests__/utils/battleEngineSynergyOverride.test.ts`

**Interfaces:**
- Produces: `BattleEngine.initializeBattle(heroes, template, opts)` onde `opts` ganha `forceSynergies?: SynergyId[]`. Quando `undefined`, comportamento idêntico ao atual (`getActiveSynergies`). Quando `[]`, NOOP handlers. Quando `['X', ...]`, exatamente essas sinergias.
- `SynergyId` é exportado de `src/utils/battleEngine.ts:19-25`.

Steps:

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/__tests__/utils/battleEngineSynergyOverride.test.ts`:

```ts
import { BattleEngine, SynergyId } from '../../utils/battleEngine';

const fakeTemplate: any = {
  id: 'test', name: 'Test', minHeroes: 2, rewardMin: 1, rewardMax: 2,
  enemies: [{ hp: 1, atk: 1, mp: 0, count: 1 }],
};

// Dupla TANK+ARCHER ativa MURALHA_E_FLECHA por auto-detecção.
const heroes: any = [
  { id: 't1', classId: 'TANK', name: 'T', hpMax: 50, hpCurrent: 50, atk: 5, mp: 0, defense: 10, crit: 0, agility: 5, range: 1, movement: 2 },
  { id: 'a1', classId: 'ARCHER', name: 'A', hpMax: 30, hpCurrent: 30, atk: 8, mp: 0, defense: 2, crit: 0, agility: 8, range: 3, movement: 2 },
];

describe('initializeBattle — forceSynergies (hook de teste)', () => {
  test('sem forceSynergies, auto-detecta MURALHA_E_FLECHA para TANK+ARCHER', () => {
    const state = BattleEngine.initializeBattle(heroes, fakeTemplate, { rng: () => 0.5 });
    expect(state.activeSynergies).toEqual(['MURALHA_E_FLECHA']);
  });

  test('forceSynergies:[] desliga sinergias mesmo com par sinérgico', () => {
    const state = BattleEngine.initializeBattle(heroes, fakeTemplate, { rng: () => 0.5, forceSynergies: [] });
    expect(state.activeSynergies).toEqual([]);
    // NOOP: onBattleStart não aplica buffs de Muralha e Flecha
    expect(state.buffs).toEqual({});
  });

  test('forceSynergies sobrepõe a auto-detecção com a lista dada', () => {
    const forced: SynergyId[] = ['ARTILHARIA'];
    const state = BattleEngine.initializeBattle(heroes, fakeTemplate, { rng: () => 0.5, forceSynergies: forced });
    expect(state.activeSynergies).toEqual(['ARTILHARIA']);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/battleEngineSynergyOverride.test.ts`
Expected: FAIL — o caso `forceSynergies:[]` retorna `['MURALHA_E_FLECHA']` (override ignorado), pois `initializeBattle` ainda não lê `forceSynergies`.

- [ ] **Step 3: Implementar o override em `initializeBattle`**

Em `src/utils/battleEngine.ts`, localizar a assinatura (`:180-184`):

```ts
  initializeBattle(
    heroes: Hero[],
    template: MissionTemplate,
    opts: { heroPositions?: Record<string, number>; rng?: () => number } = {}
  ): BattleState {
```

Substituir por:

```ts
  initializeBattle(
    heroes: Hero[],
    template: MissionTemplate,
    opts: { heroPositions?: Record<string, number>; rng?: () => number; forceSynergies?: SynergyId[] } = {}
  ): BattleState {
```

Localizar o bloco de detecção (`:190-193`):

```ts
    const classIds = heroes.map(h => h.classId).filter(Boolean) as ClassId[];
    const activeSynergyDefs = getActiveSynergies(classIds);
    const activeSynergies = activeSynergyDefs.map(s => s.id);
    const handlers = createSynergyHandlers(activeSynergies);
```

Substituir por:

```ts
    const classIds = heroes.map(h => h.classId).filter(Boolean) as ClassId[];
    const activeSynergies = opts.forceSynergies ?? getActiveSynergies(classIds).map(s => s.id);
    const handlers = createSynergyHandlers(activeSynergies);
```

(O `??` preserva o caminho de produção: quando `forceSynergies` é `undefined`, usa a auto-detecção exatamente como antes.)

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/battleEngineSynergyOverride.test.ts`
Expected: PASS (3 testes).

Run (regressão de sinergias e batalha): `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/synergyEffects.test.ts`
Expected: PASS (sem regressão).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 6: Commit**

```bash
git add src/utils/battleEngine.ts src/__tests__/utils/battleEngineSynergyOverride.test.ts
git commit -m "feat(battle): hook de teste forceSynergies em initializeBattle (mede sinergia por efeito, A/B)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Repassar `forceSynergies` no `simulationRunner.ts`

**Files:**
- Modify: `scripts/utils/simulationRunner.ts` (`SimulationParams` em `:9-15`; chamada a `initializeBattle` em `:59`)

**Interfaces:**
- Consumes: `BattleEngine.initializeBattle(..., { forceSynergies })` da Task 1.
- Produces: `SimulationParams` ganha `forceSynergies?: SynergyId[]` (importado de `../../src/utils/battleEngine`). `runMissionSimulation({ heroes, missionId, iterations, seed, forceSynergies })`.

Steps:

- [ ] **Step 1: Importar `SynergyId` e estender `SimulationParams`**

Em `scripts/utils/simulationRunner.ts`, localizar o import existente (`:1`):

```ts
import { BattleEngine, BattleState } from '../../src/utils/battleEngine';
```

Substituir por:

```ts
import { BattleEngine, BattleState, SynergyId } from '../../src/utils/battleEngine';
```

Localizar `SimulationParams` (`:9-15`):

```ts
export interface SimulationParams {
  heroes: Hero[];
  missionId: string;
  iterations: number;
  /** Quando presente, cada iteração usa makeRng(seed + iterIdx) — reprodutível. */
  seed?: number;
}
```

Substituir por:

```ts
export interface SimulationParams {
  heroes: Hero[];
  missionId: string;
  iterations: number;
  /** Quando presente, cada iteração usa makeRng(seed + iterIdx) — reprodutível. */
  seed?: number;
  /** Hook de teste: força as sinergias ativas (sobrepõe auto-detecção). [] = nenhuma. */
  forceSynergies?: SynergyId[];
}
```

- [ ] **Step 2: Repassar para `initializeBattle`**

Em `scripts/utils/simulationRunner.ts`, localizar a desestruturação (`:30`):

```ts
  const { heroes, missionId, iterations, seed } = params;
```

Substituir por:

```ts
  const { heroes, missionId, iterations, seed, forceSynergies } = params;
```

Localizar a chamada a `initializeBattle` (`:59`):

```ts
    const state = BattleEngine.initializeBattle(activeHeroes, mission as MissionTemplate, { rng: iterRng });
```

Substituir por:

```ts
    const state = BattleEngine.initializeBattle(activeHeroes, mission as MissionTemplate, { rng: iterRng, forceSynergies });
```

- [ ] **Step 3: Type-check do harness**

Run: `npx tsc --noEmit --project tsconfig.sim.json`
Expected: 0 erros.

- [ ] **Step 4: Smoke do runner (regressão)**

Run: `npm run simulate:m1`
Expected: finaliza com exit 0, imprimindo log de batalha (vitória/derrota) — confirma que adicionar o param opcional não quebrou o caminho de produção (não usa `forceSynergies`).

- [ ] **Step 5: Commit**

```bash
git add scripts/utils/simulationRunner.ts
git commit -m "feat(sim): runMissionSimulation aceita forceSynergies e repassa ao engine

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Estágios de medição (`STAGES`) com headroom no harness

**Files:**
- Modify: `scripts/simulations/balance_analysis.ts` (constantes de estágio em `:30-32`)

**Interfaces:**
- Produces: constantes `STAGES = { HEADROOM: { ms, label }, MIDGAME: { ms, label } }`, `SYNERGY_STAGE_MISSION`, `PERSONALITY_STAGE_MISSION`, `EQUIP_STAGE_MISSION` (todas exportadas ou no escopo de módulo). `STAGE_MS`/`STAGE_LABEL` atuais mapeiam para `STAGES.MIDGAME`.

Headroom tem dois botões: tempo de treino (`ms`) e dureza da missão. O valor `mission_4` abaixo é **chute inicial** — a calibração (Task 4 Step 6) imprime o baseline e gira `ms`/missão até a janela 40–75%.

Steps:

- [ ] **Step 1: Adicionar as constantes de estágio**

Em `scripts/simulations/balance_analysis.ts`, localizar (`:30-32`):

```ts
// Progression stage — all tests use the same stage for fair comparison
const STAGE_MS = 3 * 24 * 60 * 60 * 1000; // Day 3
const STAGE_LABEL = 'Dia 3';
```

Substituir por:

```ts
// Estágios de progressão. HEADROOM = herói pouco treinado (baseline observável,
// não saturado em 100%); MIDGAME = onde o jogador real passa o tempo (Dia 3).
const STAGES = {
  HEADROOM: { ms: 30 * 60 * 1000, label: '30 min' },
  MIDGAME: { ms: 3 * 24 * 60 * 60 * 1000, label: 'Dia 3' },
} as const;

// Compat: tier-list de classe e composições seguem medindo em MIDGAME.
const STAGE_MS = STAGES.MIDGAME.ms;
const STAGE_LABEL = STAGES.MIDGAME.label;

// Missão usada por cada sweep de headroom. Chute inicial — calibrar (Task 4 Step 6)
// até o baseline (par sem sinergia / herói sem personalidade / herói sem item) cair em 40–75%.
const SYNERGY_STAGE_MISSION = 'mission_4';
const PERSONALITY_STAGE_MISSION = 'mission_4';
const EQUIP_STAGE_MISSION = 'mission_4';
```

- [ ] **Step 2: Type-check do harness**

Run: `npx tsc --noEmit --project tsconfig.sim.json`
Expected: 0 erros (`STAGE_MS`/`STAGE_LABEL` continuam definidos; os novos identificadores ainda não são usados — serão consumidos nas Tasks 4-6; o TS não erra por const não-usada).

- [ ] **Step 3: Commit**

```bash
git add scripts/simulations/balance_analysis.ts
git commit -m "feat(balance): estágios HEADROOM/MIDGAME e missões de headroom por sweep

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `sweepSynergies` A/B por efeito (NOOP vs ativo)

**Files:**
- Modify: `scripts/simulations/balance_analysis.ts` (interface `SynergyTest` em `:278-285`; função `sweepSynergies` em `:287-328`; uso de `STAGE_MS`/`mission` dentro)
- Modify (condicional): `src/utils/synergyEffects.ts` (só se Δ<+5pp após medição correta)

**Interfaces:**
- Consumes: `forceSynergies` (Task 1/2), `SYNERGY_STAGE_MISSION`, `STAGES` (Task 3), `SYNERGIES` (`src/constants/synergies.ts:11`).
- Produces: `sweepSynergies(): SynergyTest[]` com `SynergyTest = { name, pair, withWin, withoutWin, delta }`. Mede a MESMA dupla com `forceSynergies:[syn.id]` (ativo) vs `forceSynergies:[]` (NOOP). Seed fixo para reprodutibilidade.

Steps:

- [ ] **Step 1: Reescrever a interface `SynergyTest` e a função `sweepSynergies`**

Em `scripts/simulations/balance_analysis.ts`, localizar a interface (`:278-285`):

```ts
interface SynergyTest {
  name: string;
  withSynergy: ClassId[];
  withoutSynergy: ClassId[];
  withWin: number;
  withoutWin: number;
  delta: number;
}
```

Substituir por:

```ts
interface SynergyTest {
  name: string;
  pair: ClassId[];       // a dupla canônica da sinergia
  withWin: number;       // mesma dupla, handler ATIVO
  withoutWin: number;    // mesma dupla, handler DESLIGADO (NOOP)
  delta: number;
}

const SYNERGY_SEED = 12345;
```

Localizar a função inteira `sweepSynergies` (`:287-328`) e substituí-la por:

```ts
function sweepSynergies(): SynergyTest[] {
  console.log('\n[5/6] Synergy validation (A/B por efeito)...');
  const results: SynergyTest[] = [];
  const mission = SYNERGY_STAGE_MISSION;

  for (const synergy of SYNERGIES) {
    const pair: ClassId[] = [synergy.classes[0], synergy.classes[1]];
    const heroes = pair.map((c, i) => {
      const h = generateTrainedHero(c, { ms: STAGES.HEADROOM.ms, focus: getFocusForClass(c) });
      h.id = `syn_${i}`;
      return h;
    });

    const withR = runMissionSimulation({
      heroes, missionId: mission, iterations: ITERATIONS,
      seed: SYNERGY_SEED, forceSynergies: [synergy.id],
    });
    const withoutR = runMissionSimulation({
      heroes, missionId: mission, iterations: ITERATIONS,
      seed: SYNERGY_SEED, forceSynergies: [],
    });

    const withWin = parsePercent(withR.winRate);
    const withoutWin = parsePercent(withoutR.winRate);

    results.push({ name: synergy.name, pair, withWin, withoutWin, delta: withWin - withoutWin });
    process.stdout.write('.');
  }
  console.log(' done');
  return results;
}
```

(Observação: o "5/5" do log antigo vira "5/6" porque o `sweepEconomy` da Task 6 será o 6º. Os logs dos outros sweeps — `sweepClassVsMission:115` "[1/5]", `sweepPersonalities` "[2/5]", `sweepEquipment` "[3/5]", `sweepCompositions:221` "[4/5]" — são reescritos para "/6" nas Tasks 5 e 6 conforme cada função é tocada; onde não forem tocados, o "/5" remanescente é cosmético e não afeta nada.)

- [ ] **Step 2: Atualizar `generateReport` para a nova forma de `SynergyTest`**

Em `scripts/simulations/balance_analysis.ts`, na seção `// 6. Synergies` de `generateReport` (`:526-540`), localizar o loop que lê `s.withWin`/`s.withoutWin`/`s.delta`:

```ts
  for (const s of synergies) {
    const functional = s.delta >= 5 ? '✅' : s.delta >= 2 ? '⚠️' : '❌';
    p(`| ${s.name} | ${s.withWin.toFixed(0)}% | ${s.withoutWin.toFixed(0)}% | ${s.delta >= 0 ? '+' : ''}${s.delta.toFixed(1)}pp | ${functional} |`);
  }
```

Substituir por (acrescenta a coluna do par e o aviso de headroom):

```ts
  p('> Metodologia A/B: MESMA dupla com o efeito da sinergia LIGADO vs DESLIGADO (NOOP),');
  p(`> em estágio com headroom (${STAGES.HEADROOM.label}, missão ${SYNERGY_STAGE_MISSION}).`);
  p('');
  for (const s of synergies) {
    const functional = s.delta >= 5 ? '✅' : s.delta >= 2 ? '⚠️' : '❌';
    p(`| ${s.name} (${s.pair.join('+')}) | ${s.withWin.toFixed(0)}% | ${s.withoutWin.toFixed(0)}% | ${s.delta >= 0 ? '+' : ''}${s.delta.toFixed(1)}pp | ${functional} |`);
  }
```

Atualizar o cabeçalho da tabela logo acima (`:530`), de:

```ts
  p('| Sinergia | Com Sinergia | Sem Sinergia | Δ Win Rate | Funcional? |');
```

para:

```ts
  p('| Sinergia (par) | Efeito Ligado | Efeito Desligado | Δ Win Rate | Funcional? |');
```

- [ ] **Step 3: Type-check do harness**

Run: `npx tsc --noEmit --project tsconfig.sim.json`
Expected: 0 erros (não há mais referência a `withSynergy`/`withoutSynergy`; `getActiveSynergies` ainda é usado no `sweepCompositions:241`).

- [ ] **Step 4: Smoke do sweep de sinergia (run reduzido)**

Run: `npx ts-node --project tsconfig.sim.json -e "import { runMissionSimulation } from './scripts/utils/simulationRunner'; import { generateTrainedHero } from './scripts/utils/trainedHeroGenerator'; const h=['WARRIOR','HEALER'].map((c,i)=>{const x=generateTrainedHero(c as any,{ms:30*60*1000,focus:'ATK'}); x.id='s'+i; return x;}); const on=runMissionSimulation({heroes:h,missionId:'mission_4',iterations:300,seed:1,forceSynergies:['LINHA_DE_FRENTE']}); const off=runMissionSimulation({heroes:h,missionId:'mission_4',iterations:300,seed:1,forceSynergies:[]}); console.log('ON',on.winRate,'OFF',off.winRate);"`
Expected: imprime `ON xx.x% OFF yy.y%` com ambos numéricos. Anotar os valores — se `OFF` estiver fora de 40–75%, a missão de headroom precisa de calibração (Step 6).

- [ ] **Step 5: Rodar o report completo de sinergia**

Run: `npx ts-node --project tsconfig.sim.json scripts/simulations/balance_analysis.ts`
Expected: gera `scripts/simulations/BALANCE_REPORT.md`; a seção "6. Validação de Sinergias" mostra `withoutWin` por sinergia. Inspecionar: o baseline (`Efeito Desligado`) de cada dupla deve estar em ~40–75%.

- [ ] **Step 6: Calibrar o estágio se o baseline saturar (CONDICIONAL)**

Se algum `Efeito Desligado` ≥ ~85% (saturado) ou ≤ ~20% (piso), ajustar em `balance_analysis.ts`:
- Primeiro reduzir treino: `STAGES.HEADROOM.ms` (ex.: `15 * 60 * 1000`).
- Se ainda saturar, endurecer a missão: `SYNERGY_STAGE_MISSION = 'mission_5'` ou `'mission_boss_1'`.
Repetir Step 5 até a maioria das duplas cair na janela 40–75%. Documentar o valor final num comentário ao lado da constante.

- [ ] **Step 7: Ajuste de potência por sinergia (CONDICIONAL — só se Δ<+5pp com baseline na janela)**

Se, com baseline em 40–75%, alguma sinergia ainda tiver Δ<+5pp, girar UM parâmetro em `src/utils/synergyEffects.ts` (uma sinergia por commit):

| Sinergia | Parâmetro atual | Alavanca | Local |
|---|---|---|---|
| Linha de Frente | `value: 1.30` (atkMul), `state.rounds + 1` | `1.40` e/ou `state.rounds + 2` | `synergyEffects.ts:29-30` |
| Caos Arcano | `value: 0.5` (defDebuffMul), `state.rounds + 1` | `0.4` ou `state.rounds + 2` | `synergyEffects.ts:97-98` |
| Emboscada | `if (state.rounds > 2) return false` | `> 3` (estende ao round 3) | `synergyEffects.ts:107` |
| Artilharia | `if (state.rng() >= 0.5) return` / `dmg * 0.5` | `>= 0.4` ou `dmg * 0.6` | `synergyEffects.ts:119,133` |
| Muralha e Flecha | `critFlat 20`/`taunt 60` | já +5.7pp histórico — manter | `synergyEffects.ts:46,52` |
| Bastião | cura AoE (já funcional) | manter; só medir | `synergyEffects.ts:77-85` + `battleEngine.ts:473-503` |

Cada ajuste: editar UM número → rodar Step 5 → confirmar que aquela sinergia atinge ≥+5pp E que a tier-list de classe (seção 1 do report) não abre gap >30pp → commit. Os testes unit de `synergyEffects.test.ts` que cravam `value: 1.30`/`0.5` precisam ser atualizados junto se o número mudar (ex.: `synergyEffects.test.ts:67` espera `1.30`).

Run após cada ajuste: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/synergyEffects.test.ts`
Expected: PASS (com os valores esperados atualizados).

- [ ] **Step 8: Commit**

```bash
git add scripts/simulations/balance_analysis.ts
git commit -m "feat(balance): sweepSynergies A/B por efeito (NOOP vs ativo, headroom, seed fixo)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(Se a Task 4 Step 7 alterar `synergyEffects.ts`, commitar em commit(s) separado(s) por sinergia: `git add src/utils/synergyEffects.ts src/__tests__/utils/synergyEffects.test.ts` com mensagem `fix(synergy): <nome> sobe para +Npp`.)

---

## Task 5: `sweepEquipment` com roll real + `sweepPersonalities` vs sem-personalidade

**Files:**
- Modify: `src/context/equipmentHandler.ts` (`generateEquipment` em `:9-23`)
- Create: `src/__tests__/context/equipmentHandler.roll.test.ts`
- Modify: `scripts/simulations/balance_analysis.ts` (`sweepPersonalities` em `:144-170`; `sweepEquipment` em `:183-214`; remover `makeEquipment`/`applyEquipmentToHero` em `:65-87`)
- Modify (condicional): `src/constants/equipment.ts` (`statRange.max`)

**Interfaces:**
- Consumes: `STAGES`, `PERSONALITY_STAGE_MISSION`, `EQUIP_STAGE_MISSION` (Task 3); `forceSynergies` não usado aqui (heróis solo).
- Produces:
  - `generateEquipment(tier, equipmentType?, rng?)` — `rng` default `Math.random`; quando injetado, roll determinístico.
  - `sweepPersonalities(): PersonalityResult[]` com `deltaVsNone` por classe×personalidade.
  - `sweepEquipment(): EquipmentResult[]` usando `generateEquipment` real seedado.

Steps:

- [ ] **Step 1: Escrever o teste falhando do roll determinístico**

Criar `src/__tests__/context/equipmentHandler.roll.test.ts`:

```ts
import { generateEquipment } from '../../context/equipmentHandler';

describe('generateEquipment — roll tier-multiplicativo determinístico', () => {
  // rng fixo em 0 → rola sempre o mínimo do range; rng→0.999 → rola o máximo.
  test('tier 1 weapon (atk 2-8): rng=0 dá atk=2; rng→1 dá atk=8', () => {
    const min = generateEquipment(1, 'weapon', () => 0);
    const max = generateEquipment(1, 'weapon', () => 0.999999);
    expect(min.statBonus.atk).toBe(2);
    expect(max.statBonus.atk).toBe(8);
  });

  test('tier 3 weapon (atk 2-8 ×3 = 6-24): rng=0 dá 6; rng→1 dá 24', () => {
    const min = generateEquipment(3, 'weapon', () => 0);
    const max = generateEquipment(3, 'weapon', () => 0.999999);
    expect(min.statBonus.atk).toBe(6);
    expect(max.statBonus.atk).toBe(24);
  });

  test('tier 3 armor (defense 3-10 ×3 = 9-30): rng=0 dá def=9; rng→1 dá def=30', () => {
    const min = generateEquipment(3, 'armor', () => 0);
    const max = generateEquipment(3, 'armor', () => 0.999999);
    expect(min.statBonus.defense).toBe(9);
    expect(max.statBonus.defense).toBe(30);
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/equipmentHandler.roll.test.ts`
Expected: FAIL — `generateEquipment` só aceita 2 args (`(tier, equipmentType?)`); o 3º arg é ignorado e o roll usa `Math.random`, então os valores não batem com os esperados deterministicamente.

- [ ] **Step 3: Tornar `generateEquipment` aceitar `rng` injetável**

Em `src/context/equipmentHandler.ts`, localizar (`:9-23`):

```ts
function generateEquipment(tier: number, equipmentType?: 'weapon' | 'armor' | 'accessory'): Equipment {
  const templates = equipmentType
    ? EQUIPMENT_TEMPLATES.filter(t => t.type === equipmentType)
    : EQUIPMENT_TEMPLATES;
  const template = templates[Math.floor(Math.random() * templates.length)];
  const name = template.names[Math.floor(Math.random() * template.names.length)];
  const tierDef = EQUIPMENT_TIERS.find(t => t.tier === tier)!;
  const statBonus: Record<string, number> = {};
  for (const sr of template.statRange) {
    const tierMin = sr.min * tier;
    const tierMax = sr.max * tier;
    statBonus[sr.stat] = tierMin + Math.floor(Math.random() * (tierMax - tierMin + 1));
  }
  return { id: uuidv4(), name: `${name} ${tierDef.label}`, type: template.type, statBonus, tier };
}
```

Substituir por (`export` para o harness importar; `rng` injetável):

```ts
export function generateEquipment(
  tier: number,
  equipmentType?: 'weapon' | 'armor' | 'accessory',
  rng: () => number = Math.random,
): Equipment {
  const templates = equipmentType
    ? EQUIPMENT_TEMPLATES.filter(t => t.type === equipmentType)
    : EQUIPMENT_TEMPLATES;
  const template = templates[Math.floor(rng() * templates.length)];
  const name = template.names[Math.floor(rng() * template.names.length)];
  const tierDef = EQUIPMENT_TIERS.find(t => t.tier === tier)!;
  const statBonus: Record<string, number> = {};
  for (const sr of template.statRange) {
    const tierMin = sr.min * tier;
    const tierMax = sr.max * tier;
    statBonus[sr.stat] = tierMin + Math.floor(rng() * (tierMax - tierMin + 1));
  }
  return { id: uuidv4(), name: `${name} ${tierDef.label}`, type: template.type, statBonus, tier };
}
```

- [ ] **Step 4: Rodar para confirmar que passa**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/equipmentHandler.roll.test.ts`
Expected: PASS (3 testes).

Run (regressão de equipamento/forja): `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/equipmentHandler.test.ts src/__tests__/context/equipmentHandler.forge.test.ts`
Expected: PASS (o default `Math.random` preserva o comportamento de produção).

- [ ] **Step 5: Commit do roll injetável**

```bash
git add src/context/equipmentHandler.ts src/__tests__/context/equipmentHandler.roll.test.ts
git commit -m "feat(equip): generateEquipment com rng injetável e export (roll determinístico testável)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Reescrever `sweepEquipment` para usar `generateEquipment` real seedado**

Em `scripts/simulations/balance_analysis.ts`, remover as funções hardcoded `applyEquipmentToHero` (`:65-77`) e `makeEquipment` (`:79-87`) inteiras.

Adicionar perto do topo dos imports (`:24`):

```ts
import { generateEquipment } from '../../src/context/equipmentHandler';
import { makeRng } from '../../src/utils/math';
```

Adicionar um helper de aplicação de equipamento (acima de `sweepEquipment`):

```ts
function applyEquipmentToHero(hero: Hero, items: Equipment[]): Hero {
  const clone = { ...hero };
  for (const item of items) {
    if (item.statBonus.hp) clone.hpMax += item.statBonus.hp;
    if (item.statBonus.atk) clone.atk += item.statBonus.atk;
    if (item.statBonus.mp) clone.mp += item.statBonus.mp;
    if (item.statBonus.defense) clone.defense += item.statBonus.defense;
    if (item.statBonus.crit) clone.crit += item.statBonus.crit;
    if (item.statBonus.agility) clone.agility += item.statBonus.agility;
  }
  clone.hpCurrent = clone.hpMax;
  return clone;
}
```

Localizar a função `sweepEquipment` (`:183-214`) e substituí-la por:

```ts
function sweepEquipment(): EquipmentResult[] {
  console.log('\n[3/6] Equipment impact sweep (roll real, headroom)...');
  const results: EquipmentResult[] = [];
  const mission = EQUIP_STAGE_MISSION;
  const eqRng = makeRng(777); // determinístico p/ reprodutibilidade do roll

  const conditions: { label: string; items: Equipment[] }[] = [
    { label: 'Sem itens', items: [] },
    { label: '1x Comum', items: [generateEquipment(1, 'weapon', eqRng)] },
    { label: '1x Raro', items: [generateEquipment(2, 'weapon', eqRng)] },
    { label: '1x Épico', items: [generateEquipment(3, 'weapon', eqRng)] },
    { label: 'Conjunto Épico', items: [generateEquipment(3, 'weapon', eqRng), generateEquipment(3, 'armor', eqRng)] },
  ];

  for (const classId of CLASSES) {
    for (const cond of conditions) {
      const baseHero = generateTrainedHero(classId, { ms: STAGES.HEADROOM.ms, focus: getFocusForClass(classId) });
      const equipped = applyEquipmentToHero(baseHero, cond.items);
      equipped.id = `eq_${classId}_${cond.label}`;
      const r = runMissionSimulation({ heroes: [equipped], missionId: mission, iterations: ITERATIONS, seed: 777 });
      results.push({
        classId,
        condition: cond.label,
        winPct: parsePercent(r.winRate),
        avgRounds: r.avgRoundsWin === '-' ? 0 : parseFloat(r.avgRoundsWin),
      });
    }
    process.stdout.write('.');
  }
  console.log(' done');
  return results;
}
```

- [ ] **Step 7: Atualizar o delta de equipamento em `generateReport`**

Em `scripts/simulations/balance_analysis.ts`, a seção `// 4. Equipment impact` lê a condição `'ATK+DEF Épico'` (`:474-475`). Como o rótulo mudou para `'Conjunto Épico'`, localizar:

```ts
    const full = equipment.find(e => e.classId === cls && e.condition === 'ATK+DEF Épico');
```

Substituir por:

```ts
    const full = equipment.find(e => e.classId === cls && e.condition === 'Conjunto Épico');
```

- [ ] **Step 8: Reescrever `sweepPersonalities` para medir vs sem-personalidade**

Em `scripts/simulations/balance_analysis.ts`, localizar a interface `PersonalityResult` (`:136-142`) e adicionar o campo `deltaVsNone`:

```ts
interface PersonalityResult {
  classId: ClassId;
  personality: PersonalityId;
  mission: string;
  winPct: number;
  deltaVsNone: number;
  avgHpLost: number;
}
```

Localizar a função `sweepPersonalities` (`:144-170`) e substituí-la por:

```ts
function sweepPersonalities(): PersonalityResult[] {
  console.log('\n[2/6] Personality × Class sweep (vs sem-personalidade, headroom)...');
  const results: PersonalityResult[] = [];
  const mission = PERSONALITY_STAGE_MISSION;

  for (const classId of CLASSES) {
    // Baseline: MESMA classe/seed SEM personalidade.
    const baseHero = generateTrainedHero(classId, { ms: STAGES.HEADROOM.ms, focus: getFocusForClass(classId) });
    baseHero.personality = undefined;
    baseHero.id = `p_${classId}_none`;
    const baseWin = parsePercent(
      runMissionSimulation({ heroes: [baseHero], missionId: mission, iterations: ITERATIONS, seed: 555 }).winRate
    );

    for (const p of PERSONALITY_LIST) {
      const hero = generateTrainedHero(classId, {
        ms: STAGES.HEADROOM.ms,
        focus: getFocusForClass(classId),
        personality: p.id,
      });
      hero.id = `p_${classId}_${p.id}`;
      const r = runMissionSimulation({ heroes: [hero], missionId: mission, iterations: ITERATIONS, seed: 555 });
      const winPct = parsePercent(r.winRate);
      results.push({
        classId,
        personality: p.id,
        mission,
        winPct,
        deltaVsNone: winPct - baseWin,
        avgHpLost: r.avgHpLostWin === '-' ? 0 : parseFloat(r.avgHpLostWin),
      });
    }
    process.stdout.write('.');
  }
  console.log(' done');
  return results;
}
```

- [ ] **Step 9: Mostrar `deltaVsNone` na seção 3 de `generateReport`**

Em `scripts/simulations/balance_analysis.ts`, a seção `// 3. Personality` constrói a tabela de melhor/pior personalidade (`:432-450`). Acrescentar, logo após o loop existente que imprime as linhas por classe (após `:447`, antes do `p('')` que fecha a seção), um sub-bloco de delta vs sem-personalidade:

```ts
  p('');
  p('**Δ vs sem-personalidade (cada personalidade, por classe natural):**');
  p('');
  p('| Classe | Personalidade | Win % | Δ vs nenhuma |');
  p('|--------|---------------|-------|--------------|');
  for (const r of personality) {
    const clsName = configProvider.getClassDef(r.classId).displayName;
    const pName = PERSONALITIES[r.personality].displayName;
    p(`| ${clsName} | ${pName} | ${r.winPct.toFixed(0)}% | ${r.deltaVsNone >= 0 ? '+' : ''}${r.deltaVsNone.toFixed(1)}pp |`);
  }
```

- [ ] **Step 10: Type-check do harness**

Run: `npx tsc --noEmit --project tsconfig.sim.json`
Expected: 0 erros (sem referências remanescentes a `makeEquipment`; `Equipment` ainda é importado de `../../src/types`).

- [ ] **Step 11: Rodar o report completo**

Run: `npx ts-node --project tsconfig.sim.json scripts/simulations/balance_analysis.ts`
Expected: gera o report; seção 3 mostra `Δ vs nenhuma` por classe×personalidade; seção 4 mostra `Sem itens → Conjunto Épico` com roll real. Inspecionar: baseline (`Sem itens` / personalidade `none` implícita) deve estar em 40–75%.

- [ ] **Step 12: Calibrar/ajustar potência (CONDICIONAL)**

- Se `Sem itens` saturar, ajustar `EQUIP_STAGE_MISSION`/`STAGES.HEADROOM.ms` (mesma lógica da Task 4 Step 6).
- Se, com headroom, `Sem itens → Conjunto Épico` < +8pp médio: subir `statRange.max` por template em `src/constants/equipment.ts:14-16` (ex.: weapon `max: 8` → `10`), **mantendo** o multiplicador de tier de `equipmentHandler.ts`. NÃO tocar em `crit`/`agility`/`defense` de forma que os torne treináveis — eles continuam só-equip. Atualizar os valores esperados em `equipmentHandler.roll.test.ts` se o range mudar.
- Se `deltaVsNone` < +3pp para a personalidade natural de alguma classe: girar UM parâmetro em `src/utils/personalityEffects.ts`:

| Personalidade | Atual | Alavanca | Local |
|---|---|---|---|
| AGGRESSIVE | `targetHpPct < 0.3`, `value: 1.15` | `< 0.4` ou `1.20` | `personalityEffects.ts:32,34` |
| CAUTIOUS | `value: 10` (critFlat) | `15` | `personalityEffects.ts:45` |
| VENGEFUL | `value: 1.25` (atkMul) | manter (já forte) | `personalityEffects.ts:56` |
| OPPORTUNIST | `rng() < 0.25` | `< 0.35` | `personalityEffects.ts:64` |
| PROTECTOR | `value: 0.20` (shield) | `0.25` | `personalityEffects.ts:91` |

Cada ajuste (uma personalidade por commit): editar → rodar Step 11 → confirmar Δ alvo e nenhuma personalidade negativa em nenhuma classe → atualizar `personalityEffects.test.ts` se o número mudar → commit.

- [ ] **Step 13: Commit**

```bash
git add scripts/simulations/balance_analysis.ts
git commit -m "feat(balance): sweepEquipment com roll real seedado e sweepPersonalities vs sem-personalidade (headroom)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(Ajustes condicionais de `equipment.ts`/`personalityEffects.ts` em commits separados, conforme Step 12.)

---

## Task 6: `sweepEconomy` — ritmo econômico determinístico

**Files:**
- Modify: `scripts/simulations/balance_analysis.ts` (nova interface `EconomyRow`, nova função `sweepEconomy`, registro no `main`, seção no report)

**Interfaces:**
- Consumes: `GameMath.calcMissionReward`/`getRecruitCost` (`src/utils/gameMath.ts:23,34`), `MISSIONS` (`:18`), `STAGES`, `generateTrainedHero`, `makeRng`. PROIBIDO reimplementar a math.
- Produces:
  - `EconomyRow = { missionId, missionName, stageLabel, goldPerRun, runsPerHour, goldPerHour }`.
  - `EconomyDerived = { recruitCumulative: number; runsToFirstForge: number; runsToFirstFusion: number; bossStatGate: string }`.
  - `sweepEconomy(): { rows: EconomyRow[]; derived: EconomyDerived }`.

Steps:

- [ ] **Step 1: Adicionar imports e interfaces de economia**

Em `scripts/simulations/balance_analysis.ts`, adicionar ao bloco de imports (`:21`):

```ts
import { GameMath } from '../../src/utils/gameMath';
```

(`makeRng` já foi importado na Task 5 Step 6, então não precisa re-adicionar — as tasks são sequenciais e a Task 5 sempre precede esta.)

Adicionar as interfaces perto das outras interfaces de sweep (ex.: após `SynergyTest`):

```ts
interface EconomyRow {
  missionId: string;
  missionName: string;
  stageLabel: string;
  goldPerRun: number;   // média de calcMissionReward (rng seedado, N amostras)
  runsPerHour: number;  // 3_600_000 / durationMs
  goldPerHour: number;
}

interface EconomyDerived {
  recruitCumulative: number;   // Σ getRecruitCost(i), i=0..4 (heróis 1→5)
  runsToFirstForge: number;    // ceil(custo Comum 50 / goldPerRun de M1 HEADROOM)
  runsToFirstFusion: number;   // 3 recrutamentos em gold-equivalente / goldPerRun de M1
  bossStatGate: string;        // requisitos de stat do mission_boss_1
}
```

- [ ] **Step 2: Escrever `sweepEconomy`**

Adicionar a função (após `sweepSynergies`):

```ts
const ECONOMY_SAMPLES = 2000;

function sweepEconomy(): { rows: EconomyRow[]; derived: EconomyDerived } {
  console.log('\n[6/6] Economy pacing sweep...');
  const rows: EconomyRow[] = [];

  // gold/hora por missão usando um time representativo treinado em HEADROOM.
  for (const mission of MISSIONS) {
    const teamSize = Math.max(1, mission.minHeroes);
    const team = Array.from({ length: teamSize }, (_, i) => {
      const cls = (CLASSES[i % CLASSES.length]);
      const h = generateTrainedHero(cls, { ms: STAGES.HEADROOM.ms, focus: getFocusForClass(cls) });
      h.id = `econ_${mission.id}_${i}`;
      return h;
    });

    const rng = makeRng(900 + MISSIONS.indexOf(mission));
    let totalReward = 0;
    for (let s = 0; s < ECONOMY_SAMPLES; s++) {
      totalReward += GameMath.calcMissionReward(mission, team, {
        rng,
        ref: mission.ref,
        exponent: mission.exponent,
        synergyK: mission.synergyK,
        scale: mission.scale,
      });
    }
    const goldPerRun = totalReward / ECONOMY_SAMPLES;
    const runsPerHour = 3_600_000 / mission.durationMs;
    rows.push({
      missionId: mission.id,
      missionName: mission.name,
      stageLabel: STAGES.HEADROOM.label,
      goldPerRun: Math.round(goldPerRun * 10) / 10,
      runsPerHour: Math.round(runsPerHour * 10) / 10,
      goldPerHour: Math.round(goldPerRun * runsPerHour),
    });
    process.stdout.write('.');
  }

  // Custo cumulativo de recrutamento (heróis 1→5): Σ getRecruitCost(i), i=0..4.
  let recruitCumulative = 0;
  for (let i = 0; i < 5; i++) recruitCumulative += GameMath.getRecruitCost(i);

  // Tempo até 1ª forja: custo Comum (50) ÷ goldPerRun da M1.
  const m1 = rows.find(r => r.missionId === 'mission_1')!;
  const forgeCostCommon = 50;
  const runsToFirstForge = Math.ceil(forgeCostCommon / Math.max(0.01, m1.goldPerRun));

  // 1ª fusão: 3 heróis idle. Custo gold-equivalente = recrutar do 1º ao 3º herói.
  const fusionRecruitGold = GameMath.getRecruitCost(0) + GameMath.getRecruitCost(1) + GameMath.getRecruitCost(2);
  const runsToFirstFusion = Math.ceil(fusionRecruitGold / Math.max(0.01, m1.goldPerRun));

  const bossTpl = MISSIONS.find(m => m.id === 'mission_boss_1')!;
  const bossStatGate = (bossTpl.requirements ?? []).map(r => r.label).join('; ');

  console.log(' done');
  return {
    rows,
    derived: { recruitCumulative, runsToFirstForge, runsToFirstFusion, bossStatGate },
  };
}
```

- [ ] **Step 3: Registrar `sweepEconomy` no `main` e passar ao report**

Em `scripts/simulations/balance_analysis.ts`, localizar em `main` (`:609-616`):

```ts
  const classMission = sweepClassVsMission();
  const personality = sweepPersonalities();
  const equipment = sweepEquipment();
  const compositions = sweepCompositions();
  const synergies = sweepSynergies();

  console.log('\n\nGenerating report...');
  const report = generateReport(classMission, personality, equipment, compositions, synergies);
```

Substituir por:

```ts
  const classMission = sweepClassVsMission();
  const personality = sweepPersonalities();
  const equipment = sweepEquipment();
  const compositions = sweepCompositions();
  const synergies = sweepSynergies();
  const economy = sweepEconomy();

  console.log('\n\nGenerating report...');
  const report = generateReport(classMission, personality, equipment, compositions, synergies, economy);
```

Localizar a assinatura de `generateReport` (`:334-340`) e adicionar o parâmetro `economy`:

```ts
function generateReport(
  classMission: ClassMissionResult[],
  personality: PersonalityResult[],
  equipment: EquipmentResult[],
  compositions: CompositionResult[],
  synergies: SynergyTest[],
  economy: { rows: EconomyRow[]; derived: EconomyDerived },
): string {
```

- [ ] **Step 4: Adicionar a seção de economia ao report**

Em `generateReport`, antes da seção `// 7. Key takeaways` (`:544`), inserir:

```ts
  // 6.5 Economy
  p('## 6. Ritmo Econômico');
  p('');
  p('Gold/hora por missão (math de produção `GameMath.calcMissionReward`, rng seedado).');
  p('');
  p('| Missão | Estágio | Gold/run | Runs/hora | Gold/hora |');
  p('|--------|---------|----------|-----------|-----------|');
  for (const r of economy.rows) {
    p(`| ${r.missionName} (${r.missionId}) | ${r.stageLabel} | ${r.goldPerRun} | ${r.runsPerHour} | ${r.goldPerHour} |`);
  }
  p('');
  // Monotonicidade gold/hora entre missões.
  let monotonic = true;
  for (let i = 1; i < economy.rows.length; i++) {
    if (economy.rows[i].goldPerHour < economy.rows[i - 1].goldPerHour) monotonic = false;
  }
  p(`- Curva gold/hora monotônica crescente: ${monotonic ? '✅ sim' : '❌ NÃO — revisar ref/scale/rewardMax'}`);
  p(`- Custo cumulativo de recrutamento (heróis 1→5): **${economy.derived.recruitCumulative} gold**`);
  p(`- Runs de M1 até 1ª forja (Comum, 50 gold): **${economy.derived.runsToFirstForge}**`);
  p(`- Runs de M1 até 1ª fusão (3 heróis idle, gold-equiv): **${economy.derived.runsToFirstFusion}**`);
  p(`- Gate de stat do 1º boss (não parede de gold): ${economy.derived.bossStatGate}`);
  p('');
  p('---');
  p('');
```

(Renumerar mentalmente: a seção de "Validação de Sinergias" já é "6"; renomear a de economia para "## 6.5 Ritmo Econômico" OU manter o título "## 7" e empurrar Takeaways para 8 não é necessário — usar título sem número rígido. Para evitar colisão, usar `p('## Ritmo Econômico');` sem número.)

Correção: trocar a primeira linha do bloco inserido de `p('## 6. Ritmo Econômico');` para:

```ts
  p('## Ritmo Econômico');
```

- [ ] **Step 5: Type-check do harness**

Run: `npx tsc --noEmit --project tsconfig.sim.json`
Expected: 0 erros (todos os campos de `mission` lidos — `ref`/`exponent`/`synergyK`/`scale` — existem em `MissionTemplate`, `:20-23`).

- [ ] **Step 6: Rodar o report completo**

Run: `npx ts-node --project tsconfig.sim.json scripts/simulations/balance_analysis.ts`
Expected: report contém a seção "Ritmo Econômico" com gold/hora por missão, custo de recrutamento (130 gold para 1→5 com a curva atual `10·1.5^n`), runs até forja/fusão e o gate de stat do boss.

- [ ] **Step 7: Commit**

```bash
git add scripts/simulations/balance_analysis.ts
git commit -m "feat(balance): sweepEconomy mede gold/hora, custos e tempo até forja/fusão/boss (math real)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Ajuste fino de economia se a curva não for monotônica (CONDICIONAL)

**Files:**
- Modify (condicional): `src/constants/missions.ts` (`ref`/`scale`/`rewardMax` por missão)

**Interfaces:**
- Consumes: output de `sweepEconomy` (Task 6).
- Produces: missões com curva gold/hora monotônica crescente entre `mission_1` → `mission_2` → ... → `mission_boss_1`.

Steps:

- [ ] **Step 1: Ler a seção "Ritmo Econômico" do último report**

Inspecionar `scripts/simulations/BALANCE_REPORT.md` gerado na Task 6. Se a linha "Curva gold/hora monotônica" mostrar `✅`, **pular esta task inteira** (nada a ajustar). Se mostrar `❌`, identificar entre quais missões o gold/hora cai.

- [ ] **Step 2: Ajustar um parâmetro da missão problemática**

Para a missão onde o gold/hora regrediu, aumentar `rewardMax` ou `scale`, ou diminuir `ref` (que sobe o `normalized`), em `src/constants/missions.ts`. Editar UM valor por iteração. Ex.: se M3 (`:78-95`) tiver gold/hora abaixo de M2, subir `rewardMax: 100` → `130` OU `scale: 1.08` → `1.15`.

Não inventar números fora da faixa de pacing (§3.5 do spec): Gold/hora de M1 no estágio inicial deve ficar em 30–120.

- [ ] **Step 3: Re-rodar o sweep e verificar monotonicidade**

Run: `npx ts-node --project tsconfig.sim.json scripts/simulations/balance_analysis.ts`
Expected: "Curva gold/hora monotônica crescente: ✅ sim".

- [ ] **Step 4: Garantir que a math de batalha não regrediu**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__`
Expected: PASS (mudar `rewardMax`/`scale`/`ref` afeta só recompensa; nenhum teste de combate quebra). Se algum teste fixar um reward específico de missão, atualizá-lo.

- [ ] **Step 5: Commit (só se houve ajuste)**

```bash
git add src/constants/missions.ts
git commit -m "balance(economy): ajusta <missão> para curva gold/hora monotônica

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Gate de CI — `THRESHOLDS`, `assertThresholds` e flag `--ci`

**Files:**
- Modify: `scripts/simulations/balance_analysis.ts` (objeto `THRESHOLDS`, função `assertThresholds`, leitura de `--ci` em `main`)
- Modify: `package.json` (script `balance:check`)

**Interfaces:**
- Consumes: resultados dos 6 sweeps.
- Produces:
  - `THRESHOLDS = { synergyMinDelta: 5, synergyMinPassing: 5, personalityMinDelta: 3, equipmentMinDelta: 8, classGapMax: 30 }`.
  - `assertThresholds(data): string[]` — lista de violações (vazia = tudo ok).
  - `main()` lê `process.argv.includes('--ci')`; com `--ci`, usa `CI_ITERATIONS` reduzido, roda os sweeps, chama `assertThresholds`, e em caso de violação faz `console.error` + `process.exit(1)`. Sem `--ci`, comportamento atual (gera report, exit 0).

Steps:

- [ ] **Step 1: Adicionar `THRESHOLDS` e `assertThresholds`**

Em `scripts/simulations/balance_analysis.ts`, perto do topo (após `const ITERATIONS`, `:26`):

```ts
const CI_ITERATIONS = 600; // suficiente p/ thresholds de pp; report completo usa ITERATIONS
const THRESHOLDS = {
  synergyMinDelta: 5,      // pp por sinergia
  synergyMinPassing: 5,    // ≥5/6 sinergias devem passar
  personalityMinDelta: 3,  // pp na classe natural
  equipmentMinDelta: 8,    // pp médio sem→épico
  classGapMax: 30,         // pp entre melhor e pior classe
};
```

Adicionar a função (antes de `main`, `:601`):

```ts
function assertThresholds(
  synergies: SynergyTest[],
  personality: PersonalityResult[],
  equipment: EquipmentResult[],
  classMission: ClassMissionResult[],
  compositions: CompositionResult[],
  economy: { rows: EconomyRow[]; derived: EconomyDerived },
): string[] {
  const errors: string[] = [];

  // Sinergias: ≥ synergyMinPassing com Δ ≥ synergyMinDelta.
  const passingSyn = synergies.filter(s => s.delta >= THRESHOLDS.synergyMinDelta).length;
  if (passingSyn < THRESHOLDS.synergyMinPassing) {
    errors.push(`Sinergias: ${passingSyn}/${synergies.length} com Δ≥${THRESHOLDS.synergyMinDelta}pp (exige ≥${THRESHOLDS.synergyMinPassing}).`);
  }

  // Personalidades: cada uma das 5 deve ter Δ≥personalityMinDelta em ≥1 classe, e nenhuma negativa.
  const personalityIds = [...new Set(personality.map(p => p.personality))];
  for (const pid of personalityIds) {
    const rows = personality.filter(p => p.personality === pid);
    const best = Math.max(...rows.map(r => r.deltaVsNone));
    const worst = Math.min(...rows.map(r => r.deltaVsNone));
    if (best < THRESHOLDS.personalityMinDelta) {
      errors.push(`Personalidade ${pid}: melhor Δ=${best.toFixed(1)}pp < ${THRESHOLDS.personalityMinDelta}pp em todas as classes.`);
    }
    if (worst < 0) {
      errors.push(`Personalidade ${pid}: Δ negativo (${worst.toFixed(1)}pp) em alguma classe.`);
    }
  }

  // Equipamento: média Sem itens → Conjunto Épico ≥ equipmentMinDelta.
  const eqDeltas = CLASSES.map(cls => {
    const no = equipment.find(e => e.classId === cls && e.condition === 'Sem itens');
    const full = equipment.find(e => e.classId === cls && e.condition === 'Conjunto Épico');
    return (full?.winPct ?? 0) - (no?.winPct ?? 0);
  });
  const avgEqDelta = eqDeltas.reduce((s, d) => s + d, 0) / eqDeltas.length;
  if (avgEqDelta < THRESHOLDS.equipmentMinDelta) {
    errors.push(`Equipamento: Δ médio sem→épico = ${avgEqDelta.toFixed(1)}pp < ${THRESHOLDS.equipmentMinDelta}pp.`);
  }

  // Gap de classe ≤ classGapMax (agregado de classMission + composições).
  const scores: Record<string, { total: number; count: number }> = {};
  for (const r of classMission) {
    scores[r.classId] = scores[r.classId] ?? { total: 0, count: 0 };
    scores[r.classId].total += r.winPct; scores[r.classId].count++;
  }
  for (const r of compositions) {
    for (const c of r.classes) {
      scores[c] = scores[c] ?? { total: 0, count: 0 };
      scores[c].total += r.winPct; scores[c].count++;
    }
  }
  const avgs = Object.values(scores).map(s => s.total / s.count);
  if (avgs.length > 0) {
    const gap = Math.max(...avgs) - Math.min(...avgs);
    if (gap > THRESHOLDS.classGapMax) {
      errors.push(`Gap de classe = ${gap.toFixed(1)}pp > ${THRESHOLDS.classGapMax}pp.`);
    }
  }

  // Economia: curva gold/hora monotônica crescente entre missões.
  for (let i = 1; i < economy.rows.length; i++) {
    if (economy.rows[i].goldPerHour < economy.rows[i - 1].goldPerHour) {
      errors.push(`Economia: gold/hora não-monotônico em ${economy.rows[i].missionId} (${economy.rows[i].goldPerHour} < ${economy.rows[i - 1].goldPerHour}).`);
      break;
    }
  }

  return errors;
}
```

- [ ] **Step 2: Ligar o modo `--ci` no `main`**

Em `scripts/simulations/balance_analysis.ts`, localizar `function main()` (`:601`). Logo no início, adicionar a leitura da flag e usar `CI_ITERATIONS` quando presente. Substituir o corpo de `main` por:

```ts
function main() {
  const ci = process.argv.includes('--ci');
  const iterations = ci ? CI_ITERATIONS : ITERATIONS;
  ITERATIONS_RUNTIME = iterations; // ver Step 3

  const startTime = Date.now();
  console.log('======================================================');
  console.log(`  BALANCE ANALYSIS — ${ci ? 'CI gate' : 'Comprehensive Sweep'}`);
  console.log(`  Iterations per scenario: ${iterations}`);
  console.log(`  Progression stage: ${STAGE_LABEL}`);
  console.log('======================================================');

  const classMission = sweepClassVsMission();
  const personality = sweepPersonalities();
  const equipment = sweepEquipment();
  const compositions = sweepCompositions();
  const synergies = sweepSynergies();
  const economy = sweepEconomy();

  if (ci) {
    const errors = assertThresholds(synergies, personality, equipment, classMission, compositions, economy);
    if (errors.length > 0) {
      console.error('\n❌ BALANCE GATE FAILED:');
      for (const e of errors) console.error(`  - ${e}`);
      process.exit(1);
    }
    console.log('\n✅ BALANCE GATE PASSED');
    return;
  }

  console.log('\n\nGenerating report...');
  const report = generateReport(classMission, personality, equipment, compositions, synergies, economy);
  fs.writeFileSync(OUTPUT_FILE, report);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n======================================================`);
  console.log(`  Done in ${duration}s`);
  console.log(`  Report: ${OUTPUT_FILE}`);
  console.log(`======================================================\n`);
}
```

- [ ] **Step 3: Tornar `ITERATIONS` configurável em runtime (para `--ci`)**

`ITERATIONS` é `const` usado dentro de cada sweep. Para o `--ci` reduzir as iterações sem reescrever todos os sweeps, trocar a constante por uma variável mutável. Em `scripts/simulations/balance_analysis.ts`, localizar (`:26`):

```ts
const ITERATIONS = 2000; // Fast but still statistically meaningful
```

Substituir por:

```ts
const ITERATIONS = 2000; // run completo (modo report)
let ITERATIONS_RUNTIME = ITERATIONS; // sobrescrito por --ci (CI_ITERATIONS)
```

Em cada sweep que usa `iterations: ITERATIONS`, trocar para `iterations: ITERATIONS_RUNTIME`. São os call-sites em: `sweepClassVsMission` (`:123`), `sweepPersonalities` (Task 5, dois sites: baseline e loop), `sweepEquipment` (Task 5), `sweepCompositions` (`:242`), `sweepSynergies` (Task 4, dois sites), `sweepEconomy` usa `ECONOMY_SAMPLES` (não trocar). Substituição global no arquivo: `iterations: ITERATIONS` → `iterations: ITERATIONS_RUNTIME` (não casa `ECONOMY_SAMPLES`).

- [ ] **Step 4: Adicionar o script `balance:check`**

Em `package.json`, na seção `scripts` (`:5-19`), após a linha `"simulate:sandbox": ...` (`:18`), adicionar:

```json
    "balance:check": "npx ts-node --project tsconfig.sim.json scripts/simulations/balance_analysis.ts --ci"
```

(Lembrar de adicionar a vírgula na linha anterior.)

- [ ] **Step 5: Type-check do harness**

Run: `npx tsc --noEmit --project tsconfig.sim.json`
Expected: 0 erros.

- [ ] **Step 6: Rodar o gate em modo CI (caminho feliz)**

Run: `npm run balance:check`
Expected: termina com `✅ BALANCE GATE PASSED` e exit 0. Verificar o exit code: `echo $?` → `0`.

(Se falhar com violações reais, é sinal de que as Tasks 4/5/7 ainda não atingiram os alvos — voltar aos ajustes condicionais. O gate só deve passar quando o balanço estiver no alvo.)

- [ ] **Step 7: Provar que o gate morde (run com threshold forçado)**

Temporariamente, em `balance_analysis.ts`, mudar `synergyMinDelta: 5` para `synergyMinDelta: 99` e rodar `npm run balance:check`.
Expected: imprime `❌ BALANCE GATE FAILED` listando a violação de sinergia, e `echo $?` → `1`. Reverter o valor para `5` em seguida (não commitar o valor `99`).

- [ ] **Step 8: Commit**

```bash
git add scripts/simulations/balance_analysis.ts package.json
git commit -m "feat(balance): gate de CI com THRESHOLDS, assertThresholds e flag --ci (balance:check)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Gate de estrela do boss semanal

**Files:**
- Modify: `src/context/missionHandler.ts` (`handleStartWeeklyBoss`, gate logo após `:166`)
- Modify: `src/__tests__/context/weeklyBoss.test.ts` (novos testes do gate de estrela)

**Interfaces:**
- Consumes: `Hero.stars` (`types/index.ts:47`), `state.weeklyState.bossDefeated`.
- Produces: `handleStartWeeklyBoss` retorna o estado inalterado quando `state.heroes.every(h => (h.stars ?? 0) === 0)` (nenhum herói com estrela). O gate vai no **início** (não em `markWeeklyBossDefeated`), para não desperdiçar a tentativa do jogador.

**Decisão (§3.6 do spec):** implementar (não cortar). Dá razão para fundir (fecha o loop recrutar→treinar→fundir→boss) sem violar regras do dono. O gate `bossDefeated` (uma-vez-por-semana) já existe; este é o gate de **estrela**.

Steps:

- [ ] **Step 1: Escrever os testes falhando**

Em `src/__tests__/context/weeklyBoss.test.ts`, adicionar um novo describe ao final (após `:326`). O helper `makeHero`/`makeState` já existem no arquivo (`:10-56`); reusá-los.

```ts
// ── F4-6: gate de estrela ─────────────────────────────────────────────────────

describe('handleStartWeeklyBoss — gate de estrela', () => {
  test('sem nenhum herói estrelado, retorna estado inalterado', () => {
    const state = makeState(5); // makeHero não seta stars → todos com stars undefined
    const boss = getWeeklyBoss(state.weeklyState!.seed);
    const heroIds = state.heroes.slice(0, boss.minHeroes).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());
    expect(next).toBe(state);
    expect(next.activeMissions ?? []).toHaveLength(0);
  });

  test('com ≥1 herói estrelado, o boss inicia normalmente', () => {
    const base = makeState(5);
    const boss = getWeeklyBoss(base.weeklyState!.seed);
    // Marca o primeiro herói com 1 estrela.
    const heroes = base.heroes.map((h, i) => (i === 0 ? { ...h, stars: 1 } : h));
    const state = { ...base, heroes };
    const heroIds = state.heroes.slice(0, boss.minHeroes).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());
    expect(next.activeMissions).toHaveLength(1);
    expect(next.activeMissions![0].isWeeklyBoss).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar para confirmar que o 1º teste falha**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/weeklyBoss.test.ts`
Expected: FAIL no caso "sem nenhum herói estrelado" — hoje o boss inicia sem checar estrela, então `next.activeMissions` tem 1 missão (não estado inalterado). O 2º teste já passa.

- [ ] **Step 3: Implementar o gate de estrela**

Em `src/context/missionHandler.ts`, localizar o início de `handleStartWeeklyBoss` (`:165-169`):

```ts
  // Gate: boss já derrotado esta semana
  if (state.weeklyState?.bossDefeated) return state;

  const seed = state.weeklyState?.seed ?? getWeeklySeed();
  const boss = getWeeklyBoss(seed);
```

Substituir por:

```ts
  // Gate: boss já derrotado esta semana
  if (state.weeklyState?.bossDefeated) return state;

  // Gate de estrela: o boss semanal exige ≥1 herói com estrela (fecha o loop
  // recrutar→treinar→fundir→boss). Não desperdiça a tentativa — bloqueia o início.
  const hasStarred = state.heroes.some(h => (h.stars ?? 0) > 0);
  if (!hasStarred) return state;

  const seed = state.weeklyState?.seed ?? getWeeklySeed();
  const boss = getWeeklyBoss(seed);
```

- [ ] **Step 4: Rodar para confirmar que passa**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/weeklyBoss.test.ts`
Expected: PASS (todos os testes, incluindo os dois novos).

**Atenção a regressão:** os testes existentes em `weeklyBoss.test.ts` (`:60-136`) usam `makeState` cujos heróis NÃO têm estrela. Esses testes esperam que o boss inicie. Após o gate, eles precisam de ≥1 herói estrelado. Se algum deles falhar (ex.: "cria ActiveMission com isWeeklyBoss=true"), atualizar `makeState` (`:36-56`) para marcar o primeiro herói com `stars: 1`:

Localizar em `makeState` (`:37-39`):

```ts
  const heroes = Array.from({ length: heroCount }, (_, i) =>
    makeHero({ id: `h${i + 1}`, name: `Hero ${i + 1}` })
  );
```

Substituir por:

```ts
  const heroes = Array.from({ length: heroCount }, (_, i) =>
    makeHero({ id: `h${i + 1}`, name: `Hero ${i + 1}`, stars: i === 0 ? 1 : 0 })
  );
```

Isso mantém os testes de build/conclusão passando, e o novo teste "sem herói estrelado" cria seu próprio estado sem estrela (sobrescrevendo). Se essa mudança em `makeState` for feita, o teste "com ≥1 herói estrelado" do Step 1 fica redundante com o default — manter mesmo assim para documentar a intenção, mas garantir que o teste "sem estrela" construa heróis com `stars: 0` explicitamente:

Ajustar o 1º teste do Step 1 para forçar ausência de estrela:

```ts
  test('sem nenhum herói estrelado, retorna estado inalterado', () => {
    const base = makeState(5);
    const state = { ...base, heroes: base.heroes.map(h => ({ ...h, stars: 0 })) };
    const boss = getWeeklyBoss(state.weeklyState!.seed);
    const heroIds = state.heroes.slice(0, boss.minHeroes).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());
    expect(next).toBe(state);
    expect(next.activeMissions ?? []).toHaveLength(0);
  });
```

Re-rodar Run do Step 4 → PASS.

- [ ] **Step 5: Type-check e suíte completa**

Run: `npx tsc --noEmit`
Expected: 0 erros.

Run: `npm test`
Expected: verde (nenhuma regressão em weeklyBoss/weeklyHandler/missionHandler).

- [ ] **Step 6: Commit**

```bash
git add src/context/missionHandler.ts src/__tests__/context/weeklyBoss.test.ts
git commit -m "feat(weekly): gate de estrela no boss semanal (exige ≥1 herói estrelado para iniciar)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Remover scripts de simulação legados

**Files:**
- Remove: `scripts/simulate_full.js`, `scripts/simulate_grid.js`, `scripts/simulate_training_missions.js`

**Interfaces:**
- Nenhum consumidor: confirmado por grep que só o spec os referencia (não há `.github/workflows/`, `package.json` não os cita).

Steps:

- [ ] **Step 1: Confirmar que não há referências fora do git history e do spec**

Run: `grep -rl "simulate_full\|simulate_grid\|simulate_training" --include="*.json" --include="*.ts" --include="*.js" --include="*.md" . 2>/dev/null | grep -v node_modules | grep -v "/.git/" | grep -v ".worktrees"`
Expected: apenas `scripts/simulate_full.js`, `scripts/simulate_grid.js`, `scripts/simulate_training_missions.js` (auto-referência) e `docs/superpowers/specs/2026-06-20-balance-economia-design.md`. Nenhum `package.json` ou workflow.

- [ ] **Step 2: Remover os três arquivos**

Run:
```bash
git rm scripts/simulate_full.js scripts/simulate_grid.js scripts/simulate_training_missions.js
```

- [ ] **Step 3: Confirmar que a suíte e o harness oficial seguem verdes**

Run: `npm test`
Expected: verde (os `.js` não eram importados por nada).

Run: `npm run simulate:m1`
Expected: exit 0 (o caminho oficial `scripts/simulations/*.ts` é independente).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(sim): remove scripts legados (math divergente da produção, não referenciados)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificação final

- [ ] **Step 1: Suíte unit completa**

Run: `npm test`
Expected: verde, incluindo os novos `battleEngineSynergyOverride.test.ts`, `equipmentHandler.roll.test.ts` e os testes de gate de estrela em `weeklyBoss.test.ts`.

- [ ] **Step 2: Type-check da app e do harness**

Run: `npx tsc --noEmit`
Expected: 0 erros.

Run: `npx tsc --noEmit --project tsconfig.sim.json`
Expected: 0 erros.

- [ ] **Step 3: Gate de CI passa em run completo**

Run: `npm run balance:check`
Expected: `✅ BALANCE GATE PASSED`, exit 0 (`echo $?` → 0).

- [ ] **Step 4: Report completo gerado e coerente**

Run: `npx ts-node --project tsconfig.sim.json scripts/simulations/balance_analysis.ts`
Expected: `scripts/simulations/BALANCE_REPORT.md` atualizado com: ≥5/6 sinergias ✅ (Δ≥+5pp medido A/B), seção 3 com `Δ vs nenhuma` por personalidade, seção 4 com `Sem itens → Conjunto Épico` (roll real), seção "Ritmo Econômico" com curva monotônica.

- [ ] **Step 5: Revisão de invariantes (regras do dono)**

Run: `git diff main --stat` e revisar o diff de `src/`:
- Nenhuma mudança torna DEF/CRIT/AGI treináveis (só `statRange` de equipamento, se alterado).
- Nenhum gold creditado fora de missão completada (Task 6 só lê a math, não credita; `sweepEconomy` valida monotonicidade, não credita).
Expected: revisão manual confirma ambas as invariantes.

- [ ] **Step 6: Commit de encerramento e push**

```bash
git add -A
git commit -m "chore(balance): fecha SPEC 4 — medição A/B, economia instrumentada, gate de CI, gate de estrela

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push
```

(Branch: criar `feat/balance-economia` antes de começar, conforme `using-git-worktrees`. Não commitar na `main` diretamente.)

---

## Validação manual (emulador/browser) — pós-merge, dependência de SPEC 3

Balanço é numérico, mas a percepção é o produto. A validação visual fina (forjar Épico muda stat na ficha; personalidade muda resultado; boss bloqueado sem estrela mostra mensagem) depende do polish de UI que é **SPEC 3**. Aqui entregamos a regra + teste. Quando SPEC 3 estiver disponível, abrir o app (Playwright/emulador) e confirmar:
- Forjar Épico e equipar muda stat visível na ficha do herói (Épico rola 6–24 ATK / 9–30 DEF).
- Tentar iniciar o boss semanal sem herói estrelado é bloqueado (regra desta SPEC; mensagem é SPEC 3).

Não bloqueia o merge desta SPEC (sem mudança de UI aqui).

---

## Resumo das decisões de design

| Decisão | Justificativa |
|---|---|
| `forceSynergies` via `??` em `initializeBattle` | Hook de teste mínimo; `undefined` preserva produção idêntica. Mede sinergia por efeito, não por troca de classe. |
| Bastião NÃO é reimplementado | O fix do spec já está no engine (`:473-503`) e testado. Plano só verifica (Task 4 Step 7 menciona "manter"). |
| Testes unit de hooks NÃO são recriados | Já existem em `src/__tests__/utils/`. Plano adiciona só override, roll e gate de estrela. |
| Gate de estrela em `handleStartWeeklyBoss` (não em `markWeeklyBossDefeated`) | Bloquear no início não desperdiça a tentativa do jogador; é a decisão de produto correta. |
| `sweepEconomy` importa `GameMath` real | Proibido reimplementar (pecado dos `.js` legados). Garante que o número simulado = número de produção. |
| `--ci` usa `CI_ITERATIONS=600` | Suficiente p/ thresholds de pp; report completo (2000) fica no modo sem flag. |
| Ajustes de potência são CONDICIONAIS | YAGNI: só mexer em `synergyEffects`/`personalityEffects`/`equipment`/`missions` se a medição correta provar Δ abaixo do alvo. |
| `ITERATIONS` vira `let ITERATIONS_RUNTIME` | Permite `--ci` reduzir iterações sem reescrever cada sweep. |
