# Refatoração Habilitadora Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quebrar os dois deus-módulos (`tickHandler.ts` 499 LOC, `battleEngine.ts` 791 LOC) em unidades coesas guardadas por testes de caracterização, deduplicar o adaptador de boss, agregar a cascata daily/weekly e remover a redundância de `getUnlockedSkills` — **sem mudar nenhuma regra, balanço ou número de saída**.

**Architecture:** Refatoração **comportamento-preservante** por extração mecânica (cortar-colar com assinatura preservada), uma unidade por commit, com a suíte unit verde **idêntica** antes/depois. `processMissions` sai de `tickHandler.ts` para `missionTickHandler.ts`; o adaptador `WeeklyBossTemplate → MissionTemplate` (hoje duplicado) vira `bossTemplate.ts`; as 6 chamadas de progresso viram um agregador `progressTrackers.ts`; o objeto `BattleEngine` é decomposto em `src/utils/battle/{types,grid,targeting,resolution,turns,setup}.ts` e `battleEngine.ts` vira um barril que remonta o objeto com a **mesma forma pública**. Onde a caracterização não cobre uma fronteira, o teste é escrito **antes** de mover.

**Tech Stack:** TypeScript, React Native (Expo), Jest (`ts-jest`, `jest.unit.config.js`), PRNG seedável `makeRng` (mulberry32, já no projeto). Sem novas dependências.

## Global Constraints

- Idioma de todo o conteúdo (comentários, docstrings, mensagens de commit, descrições de teste): **pt-BR**. Identificadores de código permanecem como já estão no projeto.
- `npx tsc --noEmit` → **0 erros** antes de cada commit.
- `./node_modules/.bin/jest --config jest.unit.config.js --runInBand` → **verde** antes de cada commit; nº de testes passando **≥ baseline**, nunca encolhe.
- **Baseline limpa** (ignorando `.worktrees/`): **59 suites, 425 testes passando**. Comando de baseline:
  `./node_modules/.bin/jest --config jest.unit.config.js --runInBand --testPathIgnorePatterns '/node_modules/' '/dist/' '/.worktrees/' 'gameContext.offline.test.tsx'`
  (a config padrão hoje **não** ignora `.worktrees/` e contém 1 suite quebrada vinda de worktree — por isso a baseline desta refatoração usa o ignore explícito acima; depende de SPEC 1 ter limpado isso, ver §Dependências).
- **Nenhuma mudança de regra/balanço/número.** Se um teste de caracterização mudar de valor esperado, **é bug da refatoração** — reverter, não ajustar valor.
- **Determinismo preservado:** dado o mesmo `seed`, `computeBattleOutcome` produz `success`/`reward`/`rounds`/`casualties`/`actions` idênticos antes e depois.
- Sem gold passivo (gold só de missão completada). DEF/CRIT/AGI não-treináveis (só equip/passiva/fusão). Este plano **não toca** nessas regras (refatoração estrutural).
- Alvo de produção: mobile (iOS/Android via Expo). Web é só dev/teste.
- Sem over-engineering: extração mecânica, não redesenho. Não criar abstrações novas (`BattlePipeline`, `TickContext`), não virar classes/DI, não memoizar.
- `BattleEngine`, `tickHandler.ts` e `battleEngine.ts` permanecem como pontos de import estáveis — nenhum arquivo é deletado.

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/context/bossTemplate.ts` | Create | `bossToMissionTemplate` única (`WeeklyBossTemplate → MissionTemplate`) |
| `src/__tests__/context/bossTemplate.test.ts` | Create | Caracterização da igualdade do adaptador sobre `WEEKLY_BOSS_POOL` |
| `src/context/progressTrackers.ts` | Create | `applyTickProgress(state, delta)` + tipo `TickProgressDelta` |
| `src/__tests__/context/progressTrackers.test.ts` | Create | Equivalência da cascata agregada vs. 6 chamadas manuais |
| `src/context/missionTickHandler.ts` | Create | `processMissions` movida + tipo nomeado `ProcessMissionsResult` |
| `src/__tests__/context/missionTickHandler.test.ts` | Create | Caracteriza `processMissions` isolada (golden/loop/baixas/boss/drops) |
| `src/utils/battle/types.ts` | Create | `SynergyId`, `BuffType`, `Buff`, `BattleEnemy`, `SynergyHandlers`, `BattleState` |
| `src/utils/battle/grid.ts` | Create | `createEnemies`, `findMovePath` |
| `src/utils/battle/targeting.ts` | Create | `selectTarget` |
| `src/utils/battle/resolution.ts` | Create | `calculateAttack`, `cleanExpiredBuffs` |
| `src/utils/battle/turns.ts` | Create | `executeClassAbility`, `processHeroTurn`, `processEnemyTurn` (`this.` → import direto) |
| `src/utils/battle/setup.ts` | Create | `initializeBattle` |
| `src/__tests__/utils/battleEngine.golden.test.ts` | Create | Snapshot determinístico por seed (rede da modularização) |
| `src/utils/battleEngine.ts` | Modify | Vira barril: reexporta tipos de `./battle/types` e remonta `BattleEngine` a partir de `./battle/*` |
| `src/context/tickHandler.ts` | Modify | Remove `processMissions`, `bossToMissionTemplate`, imports migrados; importa `processMissions`/`applyTickProgress`; otimiza `getUnlockedSkills`. Alvo ≤ 260 LOC |
| `src/context/missionHandler.ts` | Modify | Remove `bossTemplateToMissionTemplate`; importa `bossToMissionTemplate` de `./bossTemplate` |
| `src/__tests__/context/tickHandler.test.ts` | Modify | Adiciona invariante de referência do `processTraining` + teste de `getUnlockedSkills` não-chamado |

**Ordem de execução (cada fase = suíte verde, 1 unidade por commit):** Task 1 (boss dedupe) → Task 2 (invariante ref) → Task 3 (otim. getUnlockedSkills) → Task 4 (cascata) → Task 5 (extrair processMissions) → Tasks 6–12 (modularizar battleEngine: snapshot → types → grid → resolution → targeting → setup → turns+barril) → Task 13 (smoke + fechamento).

---

## Task 1: Deduplicar o adaptador de boss → `bossTemplate.ts`

**Files:**
- Create: `src/context/bossTemplate.ts`
- Create: `src/__tests__/context/bossTemplate.test.ts`
- Modify: `src/context/missionHandler.ts` (remove `bossTemplateToMissionTemplate` linhas 141-157; usa import na linha 192)
- Modify: `src/context/tickHandler.ts` (remove `bossToMissionTemplate` linhas 35-47; usa import nas linhas 154 e 366)

**Interfaces:**
- Consumes: `WeeklyBossTemplate` (de `../constants/weeklyBosses`), `MissionTemplate` (de `../constants/missions`).
- Produces: `export function bossToMissionTemplate(boss: WeeklyBossTemplate): MissionTemplate`.

- [ ] **Step 1: Escrever o teste de caracterização (falhando)**

Criar `src/__tests__/context/bossTemplate.test.ts`:

```ts
import { bossToMissionTemplate } from '../../context/bossTemplate';
import { WEEKLY_BOSS_POOL } from '../../constants/weeklyBosses';

describe('bossToMissionTemplate', () => {
  test('copia os 9 campos de cada boss do pool para MissionTemplate', () => {
    for (const boss of WEEKLY_BOSS_POOL) {
      const tpl = bossToMissionTemplate(boss);
      expect(tpl.id).toBe(boss.id);
      expect(tpl.name).toBe(boss.bossName);
      expect(tpl.minHeroes).toBe(boss.minHeroes);
      expect(tpl.durationMs).toBe(boss.durationMs);
      expect(tpl.rewardMin).toBe(boss.rewardMin);
      expect(tpl.rewardMax).toBe(boss.rewardMax);
      expect(tpl.statWeights).toBe(boss.statWeights);
      expect(tpl.difficulty).toBe(boss.difficulty);
      expect(tpl.enemies).toBe(boss.enemies);
    }
  });

  test('saída casa a forma consumida por createEnemies (tem enemies array)', () => {
    const tpl = bossToMissionTemplate(WEEKLY_BOSS_POOL[0]);
    expect(Array.isArray(tpl.enemies)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/bossTemplate.test.ts`
Expected: FAIL com `Cannot find module '../../context/bossTemplate'`.

- [ ] **Step 3: Criar `src/context/bossTemplate.ts`**

```ts
import { WeeklyBossTemplate } from '../constants/weeklyBosses';
import { MissionTemplate } from '../constants/missions';

/**
 * Converte um WeeklyBossTemplate para MissionTemplate (formato esperado por
 * computeBattleOutcome e BattleEngine.createEnemies). Único adaptador — antes
 * duplicado em tickHandler.ts e missionHandler.ts.
 */
export function bossToMissionTemplate(boss: WeeklyBossTemplate): MissionTemplate {
  return {
    id: boss.id,
    name: boss.bossName,
    minHeroes: boss.minHeroes,
    durationMs: boss.durationMs,
    rewardMin: boss.rewardMin,
    rewardMax: boss.rewardMax,
    statWeights: boss.statWeights,
    difficulty: boss.difficulty,
    enemies: boss.enemies,
  };
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/bossTemplate.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Substituir a cópia em `missionHandler.ts`**

Em `src/context/missionHandler.ts`, **remover** o bloco completo de `bossTemplateToMissionTemplate` (linhas 141-157, incluindo a docstring `/** Converte um WeeklyBossTemplate ... */`).

Adicionar o import logo após a linha 7 (`import { BattleEngine } from '../utils/battleEngine';`):

```ts
import { bossToMissionTemplate } from './bossTemplate';
```

Na linha 192, trocar:

```ts
  const tpl = bossTemplateToMissionTemplate(boss);
```

por:

```ts
  const tpl = bossToMissionTemplate(boss);
```

- [ ] **Step 6: Substituir a cópia em `tickHandler.ts`**

Em `src/context/tickHandler.ts`, **remover** a função `bossToMissionTemplate` (linhas 35-47).

Adicionar o import logo após a linha 33 (`import { emitSkillUnlocked, emitRareMaterialDrop } from '../services/milestones';`):

```ts
import { bossToMissionTemplate } from './bossTemplate';
```

(As duas chamadas existentes `bossToMissionTemplate(bossFromPool)` nas linhas 154 e 366 passam a resolver pelo import. Não alterar o corpo delas.)

- [ ] **Step 7: Type-check e suíte completa**

Run: `npx tsc --noEmit`
Expected: 0 erros.

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand --testPathIgnorePatterns '/node_modules/' '/dist/' '/.worktrees/' 'gameContext.offline.test.tsx'`
Expected: PASS — **60 suites, 427 testes** (425 baseline + 2 novos do bossTemplate). 0 vermelhos.

- [ ] **Step 8: Confirmar dedupe via grep**

Run: `grep -rnE "minHeroes: boss\.minHeroes" src/context`
Expected: **só** `src/context/bossTemplate.ts`.

- [ ] **Step 9: Commit**

```bash
git add src/context/bossTemplate.ts src/__tests__/context/bossTemplate.test.ts src/context/missionHandler.ts src/context/tickHandler.ts
git commit -m "refactor(boss): deduplicar adaptador WeeklyBossTemplate→MissionTemplate em bossTemplate.ts"
```

---

## Task 2: Fixar a invariante de referência do `processTraining`

**Files:**
- Modify: `src/__tests__/context/tickHandler.test.ts` (adicionar describe ao final)

**Interfaces:**
- Consumes: nada novo. `processTraining` **não é exportada** hoje — este teste a exercita indiretamente pela invariante observável: heróis que não treinam mantêm a mesma referência através do tick.
- Produces: garantia testada de que herói em `IDLE`/`MISSION` atravessa `processTraining` **por referência** (`===`), e herói treinando recebe **nova referência**. A Task 3 depende disto.

> **Nota sobre escopo do teste:** `processTraining` é função privada de `tickHandler.ts`. Em vez de exportá-la só para testar (acoplamento desnecessário), a invariante é fixada de forma **observável** via `handleTick`: comparamos as referências dos heróis antes/depois do tick. Heróis em `IDLE` sem HP a regenerar e sem missão não são tocados por nenhuma fase (`processTraining` retorna por referência no `default`; `processRegeneration` só clona se `hpCurrent < hpMax`; `processMissions` só toca heróis em missão). Assim, `next.heroes[i] === state.heroes[i]` ⟺ o herói não treinou nem regenerou — exatamente a invariante de que a Task 3 precisa.

- [ ] **Step 1: Inspecionar o topo do arquivo de teste para reaproveitar helpers**

Run: `head -40 src/__tests__/context/tickHandler.test.ts`
Expected: ver os imports e factories já usados (ex.: `handleTick`, criação de herói, `initialGameState`/equivalente). Reaproveitar o que existir; se houver um factory de herói, usá-lo. O bloco abaixo assume os imports já presentes no arquivo — se algum nome divergir, ajustar para o factory real do arquivo.

- [ ] **Step 2: Escrever o teste da invariante (falhando se a invariante quebrar)**

Adicionar ao final de `src/__tests__/context/tickHandler.test.ts`:

```ts
import { HeroTask } from '../../types';
import { handleTick } from '../../context/tickHandler';

describe('invariante de referência do tick (base para otimização getUnlockedSkills)', () => {
  function makeIdleHeroAtFullHp(id: string) {
    return {
      id,
      name: `Hero ${id}`,
      hpMax: 30,
      hpCurrent: 30, // cheio: processRegeneration não toca (clona só se hpCurrent < hpMax)
      atk: 10,
      mp: 5,
      defense: 5,
      crit: 10,
      agility: 5,
      currentTask: HeroTask.IDLE,
      trainingCount: { hp: 0, atk: 0, mp: 0 },
      trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
      equippedItems: [],
    } as any;
  }

  test('herói IDLE em HP cheio atravessa o tick pela MESMA referência (não treinou nem regenerou)', () => {
    const hero = makeIdleHeroAtFullHp('h1');
    const state = {
      gold: 0,
      heroes: [hero],
      heroesRecruited: 1,
      lastSavedAt: 0,
      inventory: [],
      activeMissions: [],
    } as any;

    const next = handleTick(state, Date.now());
    expect(next.heroes[0]).toBe(hero); // referência idêntica
  });

  test('herói em TRAIN_ATK com progresso suficiente recebe NOVA referência e ganha atk', () => {
    const hero = makeIdleHeroAtFullHp('h2');
    hero.currentTask = HeroTask.TRAIN_ATK;
    // progresso já acumulado alto força >=1 ponto neste tick
    hero.trainingProgressMs = { hp: 0, atk: 10_000_000, mp: 0 };
    const state = {
      gold: 0,
      heroes: [hero],
      heroesRecruited: 1,
      lastSavedAt: 0,
      inventory: [],
      activeMissions: [],
    } as any;

    const next = handleTick(state, Date.now());
    expect(next.heroes[0]).not.toBe(hero); // referência nova
    expect(next.heroes[0].atk).toBeGreaterThan(hero.atk);
  });
});
```

- [ ] **Step 3: Rodar o teste — deve PASSAR já hoje (caracteriza o comportamento atual)**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/tickHandler.test.ts`
Expected: PASS. (Se falhar no 1º caso, é porque algum helper/factory divergiu — ajustar o objeto de estado para casar o shape real de `GameState` usado no arquivo, sem mudar a intenção do teste.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/context/tickHandler.test.ts
git commit -m "test(tick): fixar invariante de referência do processTraining (base da otim. getUnlockedSkills)"
```

---

## Task 3: Otimizar `getUnlockedSkills` (≤ 1×/herói/tick)

**Files:**
- Modify: `src/context/tickHandler.ts` (linhas 397-411, dentro de `handleTick`)
- Modify: `src/__tests__/context/tickHandler.test.ts` (adicionar teste de spy)

**Interfaces:**
- Consumes: invariante da Task 2 (`processTraining` retorna por referência quando o herói não treina); `getUnlockedSkills(hero)` (de `../constants/skills`); `emitSkillUnlocked` (de `../services/milestones`).
- Produces: `handleTick` que chama `getUnlockedSkills` **0 vezes** quando ninguém treina e **2K vezes** quando K heróis treinam (antes: sempre 2N). Mesmos eventos `emitSkillUnlocked`.

- [ ] **Step 1: Escrever o teste de spy (falhando)**

Adicionar ao final de `src/__tests__/context/tickHandler.test.ts`:

```ts
import * as skills from '../../constants/skills';

describe('otimização getUnlockedSkills no tick', () => {
  afterEach(() => jest.restoreAllMocks());

  test('NÃO chama getUnlockedSkills quando nenhum herói treina', () => {
    const spy = jest.spyOn(skills, 'getUnlockedSkills');
    const hero = {
      id: 'h1', name: 'Idle', hpMax: 30, hpCurrent: 30, atk: 10, mp: 5,
      defense: 5, crit: 10, agility: 5, currentTask: HeroTask.IDLE,
      trainingCount: { hp: 0, atk: 0, mp: 0 },
      trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, equippedItems: [],
    } as any;
    const state = {
      gold: 0, heroes: [hero], heroesRecruited: 1, lastSavedAt: 0,
      inventory: [], activeMissions: [],
    } as any;

    handleTick(state, Date.now());
    expect(spy).toHaveBeenCalledTimes(0);
  });

  test('chama getUnlockedSkills só para o herói que treinou (2 chamadas: antes+depois)', () => {
    const spy = jest.spyOn(skills, 'getUnlockedSkills');
    const trainer = {
      id: 'h1', name: 'Trainer', hpMax: 30, hpCurrent: 30, atk: 10, mp: 5,
      defense: 5, crit: 10, agility: 5, currentTask: HeroTask.TRAIN_ATK,
      trainingCount: { hp: 0, atk: 0, mp: 0 },
      trainingProgressMs: { hp: 0, atk: 10_000_000, mp: 0 }, equippedItems: [],
    } as any;
    const idler = {
      id: 'h2', name: 'Idle', hpMax: 30, hpCurrent: 30, atk: 10, mp: 5,
      defense: 5, crit: 10, agility: 5, currentTask: HeroTask.IDLE,
      trainingCount: { hp: 0, atk: 0, mp: 0 },
      trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, equippedItems: [],
    } as any;
    const state = {
      gold: 0, heroes: [trainer, idler], heroesRecruited: 2, lastSavedAt: 0,
      inventory: [], activeMissions: [],
    } as any;

    handleTick(state, Date.now());
    // só o trainer é reavaliado: getUnlockedSkills(prevHero) + getUnlockedSkills(hero) = 2
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/tickHandler.test.ts -t "otimização getUnlockedSkills"`
Expected: FAIL — código atual chama `getUnlockedSkills` 2N vezes (1 no caso IDLE-only; 4 no caso de 2 heróis). Os asserts de `0` e `2` falham.

- [ ] **Step 3: Reescrever o bloco de skills em `handleTick`**

Em `src/context/tickHandler.ts`, substituir o bloco das linhas 397-411:

```ts
  // 1. Process Training
  const prevSkills: Record<string, string[]> = {};
  for (const hero of currentState.heroes) {
    prevSkills[hero.id] = getUnlockedSkills(hero).map(s => s.id);
  }
  const { heroes: heroesAfterTraining, totalPointsTrained } = processTraining(currentState.heroes, tickMs, inflation);
  for (const hero of heroesAfterTraining) {
    const newSkills = getUnlockedSkills(hero);
    const prev = prevSkills[hero.id] ?? [];
    for (const skill of newSkills) {
      if (!prev.includes(skill.id)) {
        emitSkillUnlocked(hero.name, skill.icon, skill.name);
      }
    }
  }
```

por:

```ts
  // 1. Process Training
  const { heroes: heroesAfterTraining, totalPointsTrained } = processTraining(currentState.heroes, tickMs, inflation);
  // Skills só mudam quando algum trainingCount sobe → totalPointsTrained > 0.
  // processTraining retorna o herói pela MESMA referência quando não treina
  // (case default), então só reavalia quem mudou de referência.
  if (totalPointsTrained > 0) {
    const before = new Map(currentState.heroes.map(h => [h.id, h]));
    for (const hero of heroesAfterTraining) {
      const prevHero = before.get(hero.id);
      if (prevHero === hero) continue; // não treinou → skills idênticas
      const prevSkills = getUnlockedSkills(prevHero!).map(s => s.id);
      for (const skill of getUnlockedSkills(hero)) {
        if (!prevSkills.includes(skill.id)) {
          emitSkillUnlocked(hero.name, skill.icon, skill.name);
        }
      }
    }
  }
```

- [ ] **Step 4: Rodar o teste de spy para confirmar que passa**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/tickHandler.test.ts`
Expected: PASS (todos, incluindo invariante da Task 2 e os 2 novos de spy).

- [ ] **Step 5: Type-check e suíte completa**

Run: `npx tsc --noEmit`
Expected: 0 erros.

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand --testPathIgnorePatterns '/node_modules/' '/dist/' '/.worktrees/' 'gameContext.offline.test.tsx'`
Expected: PASS — 60 suites, **431 testes** (427 da Task 1 + 2 da Task 2 + 2 da Task 3). 0 vermelhos. Nenhum teste de unlock de skill já existente muda de cor.

- [ ] **Step 6: Commit**

```bash
git add src/context/tickHandler.ts src/__tests__/context/tickHandler.test.ts
git commit -m "perf(tick): só recomputar getUnlockedSkills para heróis que treinaram no tick"
```

---

## Task 4: Agregar a cascata daily/weekly → `progressTrackers.ts`

**Files:**
- Create: `src/context/progressTrackers.ts`
- Create: `src/__tests__/context/progressTrackers.test.ts`
- Modify: `src/context/tickHandler.ts` (colapsar linhas 474-495 em 1 chamada)

**Interfaces:**
- Consumes: `updateDailyProgress` (de `./dailyQuestHandler`), `updateWeeklyProgress` (de `./weeklyHandler`), `GameState` (de `../types`). Ambos `update*` já são no-op quando `amount <= 0` (`dailyQuestHandler.ts:21`, `weeklyHandler.ts:23`).
- Produces: `export interface TickProgressDelta { missionsCompleted: number; pointsTrained: number; goldEarned: number }` e `export function applyTickProgress(state: GameState, delta: TickProgressDelta): GameState`.

- [ ] **Step 1: Escrever o teste de equivalência (falhando)**

Criar `src/__tests__/context/progressTrackers.test.ts`:

```ts
import { applyTickProgress } from '../../context/progressTrackers';
import { updateDailyProgress } from '../../context/dailyQuestHandler';
import { updateWeeklyProgress } from '../../context/weeklyHandler';

function makeState(): any {
  return {
    gold: 0,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: 0,
    inventory: [],
    dailyQuests: { seed: 1, quests: [], progress: {}, allClaimed: false },
    weeklyState: { seed: 1, quests: [], progress: {}, allClaimed: false, bossDefeated: false },
  };
}

function manualCascade(state: any, m: number, p: number, g: number): any {
  let s = updateDailyProgress(state, 'missionsCompleted', m);
  s = updateDailyProgress(s, 'pointsTrained', p);
  s = updateDailyProgress(s, 'goldEarned', g);
  s = updateWeeklyProgress(s, 'missionsCompleted', m);
  s = updateWeeklyProgress(s, 'pointsTrained', p);
  s = updateWeeklyProgress(s, 'goldEarned', g);
  return s;
}

describe('applyTickProgress', () => {
  test('produz o mesmo GameState que as 6 chamadas manuais (todos os deltas > 0)', () => {
    const state = makeState();
    const out = applyTickProgress(state, { missionsCompleted: 2, pointsTrained: 7, goldEarned: 100 });
    const expected = manualCascade(makeState(), 2, 7, 100);
    expect(out).toEqual(expected);
  });

  test('delta=0 em um tracker mantém no-op (guard amount<=0)', () => {
    const state = makeState();
    const out = applyTickProgress(state, { missionsCompleted: 0, pointsTrained: 5, goldEarned: 0 });
    const expected = manualCascade(makeState(), 0, 5, 0);
    expect(out).toEqual(expected);
    expect(out.dailyQuests.progress.missionsCompleted).toBeUndefined();
    expect(out.dailyQuests.progress.pointsTrained).toBe(5);
    expect(out.weeklyState.progress.goldEarned).toBeUndefined();
  });

  test('todos os deltas 0 retorna estado equivalente ao inicial', () => {
    const state = makeState();
    const out = applyTickProgress(state, { missionsCompleted: 0, pointsTrained: 0, goldEarned: 0 });
    expect(out).toEqual(makeState());
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/progressTrackers.test.ts`
Expected: FAIL com `Cannot find module '../../context/progressTrackers'`.

- [ ] **Step 3: Criar `src/context/progressTrackers.ts`**

```ts
import { GameState } from '../types';
import { updateDailyProgress } from './dailyQuestHandler';
import { updateWeeklyProgress } from './weeklyHandler';

export interface TickProgressDelta {
  missionsCompleted: number;
  pointsTrained: number;
  goldEarned: number;
}

/**
 * Aplica os 3 trackers de tick a daily e weekly num único pass. Equivalente às
 * 6 chamadas sequenciais que ficavam em handleTick: preserva a ordem (daily
 * antes de weekly; missionsCompleted→pointsTrained→goldEarned). updateDaily/
 * updateWeeklyProgress já são no-op para amount<=0, então passar deltas zerados
 * direto produz o mesmo GameState que os antigos `if (n > 0)` externos.
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

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/progressTrackers.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Colapsar a cascata em `handleTick`**

Em `src/context/tickHandler.ts`, adicionar o import logo após o import de Task 1 (`import { bossToMissionTemplate } from './bossTemplate';`):

```ts
import { applyTickProgress } from './progressTrackers';
```

Substituir o bloco das linhas 474-495:

```ts
  // 4. Update daily quest progress trackers
  const missionsCompletedCount = newResults.length;
  if (missionsCompletedCount > 0) {
    stateAfterTick = updateDailyProgress(stateAfterTick, 'missionsCompleted', missionsCompletedCount);
  }
  if (totalPointsTrained > 0) {
    stateAfterTick = updateDailyProgress(stateAfterTick, 'pointsTrained', totalPointsTrained);
  }
  if (goldGained > 0) {
    stateAfterTick = updateDailyProgress(stateAfterTick, 'goldEarned', goldGained);
  }

  // 5. Update weekly quest progress trackers
  if (missionsCompletedCount > 0) {
    stateAfterTick = updateWeeklyProgress(stateAfterTick, 'missionsCompleted', missionsCompletedCount);
  }
  if (totalPointsTrained > 0) {
    stateAfterTick = updateWeeklyProgress(stateAfterTick, 'pointsTrained', totalPointsTrained);
  }
  if (goldGained > 0) {
    stateAfterTick = updateWeeklyProgress(stateAfterTick, 'goldEarned', goldGained);
  }
```

por:

```ts
  // 4+5. Progresso de daily e weekly num único pass (no-op para deltas zerados)
  const missionsCompletedCount = newResults.length;
  stateAfterTick = applyTickProgress(stateAfterTick, {
    missionsCompleted: missionsCompletedCount,
    pointsTrained: totalPointsTrained,
    goldEarned: goldGained,
  });
```

- [ ] **Step 6: Remover o import `updateDailyProgress` órfão se não for mais usado**

`updateDailyProgress` ainda é importado em `tickHandler.ts:28` (`import { refreshDailyQuests, updateDailyProgress } from './dailyQuestHandler';`). Após o Step 5 ele não é mais usado diretamente em `tickHandler.ts`.

Run: `grep -n "updateDailyProgress" src/context/tickHandler.ts`
Expected: só a linha do import. Se for o caso, editar a linha 28 para:

```ts
import { refreshDailyQuests } from './dailyQuestHandler';
```

`updateWeeklyProgress` **permanece** importado (linha 29) — ainda é usado em `tickHandler.ts:463` (`weeklyBossKills`). Não remover.

Run: `npx tsc --noEmit`
Expected: 0 erros (confirma que nenhum import ficou pendurado/quebrado).

- [ ] **Step 7: Suíte completa**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand --testPathIgnorePatterns '/node_modules/' '/dist/' '/.worktrees/' 'gameContext.offline.test.tsx'`
Expected: PASS — 61 suites, **434 testes** (431 da Task 3 + 3 da Task 4). 0 vermelhos. Os testes de daily/weekly via tick existentes seguem verdes (comportamento idêntico).

- [ ] **Step 8: Commit**

```bash
git add src/context/progressTrackers.ts src/__tests__/context/progressTrackers.test.ts src/context/tickHandler.ts
git commit -m "refactor(tick): agregar cascata daily/weekly em applyTickProgress (6 chamadas → 1)"
```

---

## Task 5: Extrair `processMissions` → `missionTickHandler.ts`

**Files:**
- Create: `src/context/missionTickHandler.ts`
- Create: `src/__tests__/context/missionTickHandler.test.ts`
- Modify: `src/context/tickHandler.ts` (remove `processMissions` 135-387 + imports migrados; importa `processMissions`)

**Interfaces:**
- Consumes: `bossToMissionTemplate` (Task 1, de `./bossTemplate`); `computeBattleOutcome` (de `../utils/battleSim`); `BattleEngine` (de `../utils/battleEngine`); `getEffectiveStats`, `applyGoldBonus` (de `../utils/heroUtils`); `getActiveSynergies` (de `../constants/synergies`); `MISSIONS`, `MissionTemplate` (de `../constants/missions`); `WEEKLY_BOSS_POOL` (de `../constants/weeklyBosses`); `uuidv4`; constantes de missão/healer/rogue (de `../constants/game`).
- Produces: `export interface ProcessMissionsResult { newHeroes: Hero[]; activeMissions: ActiveMission[]; goldGained: number; newResults: MissionResult[]; materialDrops: Record<string, number>; weeklyBossDefeated: boolean; weeklyBossTemplateId: string | undefined }` e `export function processMissions(state: GameState, heroes: Hero[], now: number): ProcessMissionsResult`.

- [ ] **Step 1: Escrever os testes de caracterização (falhando)**

Criar `src/__tests__/context/missionTickHandler.test.ts`. Os casos exercitam `processMissions` isolada com `precomputedOutcome` fixo (sem RNG — determinístico por construção):

```ts
import { processMissions } from '../../context/missionTickHandler';
import { applyGoldBonus } from '../../utils/heroUtils';
import { HeroTask } from '../../types';
import { MISSIONS } from '../../constants/missions';

function makeHero(id: string, over: any = {}): any {
  return {
    id, name: `Hero ${id}`, hpMax: 50, hpCurrent: 50, atk: 12, mp: 5,
    defense: 5, crit: 10, agility: 5, currentTask: HeroTask.MISSION,
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, equippedItems: [],
    ...over,
  };
}

function outcome(over: any = {}): any {
  return {
    success: true, reward: 100, casualties: [], enemyCasualties: 1,
    rounds: 3, log: [], actions: [], materialDrops: {}, ...over,
  };
}

function makeState(over: any = {}): any {
  return {
    gold: 0, heroes: [], heroesRecruited: 0, lastSavedAt: 0,
    inventory: [], activeMissions: [], perHeroGold: {}, ...over,
  };
}

const M1 = MISSIONS.find(m => m.id === 'mission_1')!;

describe('processMissions (caracterização da unidade isolada)', () => {
  test('golden path: missão não-loop atinge finishAt → gold creditado, herói volta a IDLE', () => {
    const now = 1_000_000;
    const hero = makeHero('h1');
    const state = makeState({
      heroes: [hero],
      activeMissions: [{
        id: 'mA', templateId: M1.id, heroIds: ['h1'],
        startedAt: now - 100_000, finishAt: now - 1000,
        looping: false, scheduledActions: [], enemiesState: [],
        precomputedOutcome: outcome({ reward: 100 }),
      }],
    });

    const r = processMissions(state, [hero], now);
    expect(r.goldGained).toBe(applyGoldBonus(100, state));
    expect(r.newResults.length).toBe(1);
    expect(r.newHeroes[0].currentTask).toBe(HeroTask.IDLE);
    expect(r.activeMissions.length).toBe(0);
  });

  test('loop com sobreviventes ≥ minHeroes → nova missão com startedAt=now, heróis seguem em missão', () => {
    const now = 2_000_000;
    const heroes = Array.from({ length: Math.max(1, M1.minHeroes) }, (_, i) => makeHero(`h${i}`));
    const heroIds = heroes.map(h => h.id);
    const state = makeState({
      heroes,
      activeMissions: [{
        id: 'mLoop', templateId: M1.id, heroIds,
        startedAt: now - 100_000, finishAt: now - 1000,
        looping: true, scheduledActions: [], enemiesState: [], heroPositions: {},
        precomputedOutcome: outcome({ reward: 80, success: true }),
      }],
    });

    const r = processMissions(state, heroes, now);
    expect(r.activeMissions.length).toBe(1);
    const next = r.activeMissions[0];
    expect(next.startedAt).toBe(now);
    expect(next.looping).toBe(true);
    expect(next.precomputedOutcome).toBeDefined();
    expect(Array.isArray(next.scheduledActions)).toBe(true);
    // heróis NÃO voltam a IDLE no loop
    expect(r.newHeroes.every(h => h.currentTask === HeroTask.MISSION)).toBe(true);
  });

  test('loop sem sobreviventes suficientes → heróis liberados a IDLE, sem missão nova', () => {
    const now = 3_000_000;
    // todos mortos (hpCurrent 0) → 0 sobreviventes < minHeroes
    const dead = makeHero('d1', { hpCurrent: 0 });
    const state = makeState({
      heroes: [dead],
      activeMissions: [{
        id: 'mDead', templateId: M1.id, heroIds: ['d1'],
        startedAt: now - 100_000, finishAt: now - 1000,
        looping: true, scheduledActions: [], enemiesState: [],
        precomputedOutcome: outcome({
          reward: 50, success: true,
          casualties: [{ heroId: 'd1', hpLost: 50, hpAfter: 0 }],
        }),
      }],
    });

    const r = processMissions(state, [dead], now);
    expect(r.activeMissions.length).toBe(0);
    expect(r.newHeroes[0].currentTask).toBe(HeroTask.IDLE);
  });

  test('boss semanal vitorioso → weeklyBossDefeated=true e templateId correto', () => {
    const now = 4_000_000;
    const hero = makeHero('hb');
    const state = makeState({
      heroes: [hero],
      activeMissions: [{
        id: 'mBoss', templateId: 'weekly_boss_x', heroIds: ['hb'],
        isWeeklyBoss: true,
        startedAt: now - 100_000, finishAt: now - 1000,
        looping: false, scheduledActions: [], enemiesState: [],
        precomputedOutcome: outcome({ reward: 200, success: true }),
      }],
    });

    const r = processMissions(state, [hero], now);
    expect(r.weeklyBossDefeated).toBe(true);
    expect(r.weeklyBossTemplateId).toBe('weekly_boss_x');
  });

  test('baixas aplicadas: hpCurrent do herói vira casualties.hpAfter', () => {
    const now = 5_000_000;
    const hero = makeHero('h1', { hpCurrent: 50 });
    const state = makeState({
      heroes: [hero],
      activeMissions: [{
        id: 'mCas', templateId: M1.id, heroIds: ['h1'],
        startedAt: now - 100_000, finishAt: now - 1000,
        looping: false, scheduledActions: [], enemiesState: [],
        precomputedOutcome: outcome({
          reward: 100, success: true,
          casualties: [{ heroId: 'h1', hpLost: 20, hpAfter: 30 }],
        }),
      }],
    });

    const r = processMissions(state, [hero], now);
    expect(r.newHeroes[0].hpCurrent).toBe(30);
  });

  test('drops acumulados em materialDrops', () => {
    const now = 6_000_000;
    const hero = makeHero('h1');
    const state = makeState({
      heroes: [hero],
      activeMissions: [{
        id: 'mDrop', templateId: M1.id, heroIds: ['h1'],
        startedAt: now - 100_000, finishAt: now - 1000,
        looping: false, scheduledActions: [], enemiesState: [],
        precomputedOutcome: outcome({ reward: 100, materialDrops: { iron: 2, leather: 1 } }),
      }],
    });

    const r = processMissions(state, [hero], now);
    expect(r.materialDrops).toEqual({ iron: 2, leather: 1 });
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/missionTickHandler.test.ts`
Expected: FAIL com `Cannot find module '../../context/missionTickHandler'`.

- [ ] **Step 3: Criar `src/context/missionTickHandler.ts` (corpo movido sem alteração)**

Criar o arquivo colando o corpo **idêntico** de `processMissions` (hoje `tickHandler.ts:135-387`), com os imports que o corpo precisa e o tipo de retorno nomeado:

```ts
import { GameState, HeroTask, Hero, ActiveMission, MissionOutcome, MissionResult, ClassId } from '../types';
import {
  MISSION_FINISH_DELAY_MS,
  MISSION_START_DELAY_MS,
  MISSION_ACTION_INTERVAL_MS,
  HEALER_BUFF_PER_HERO,
  HEALER_BUFF_CAP,
  ROGUE_RNG_BONUS_PER_HERO,
  ROGUE_RNG_BONUS_CAP,
} from '../constants/game';
import { MISSIONS, MissionTemplate } from '../constants/missions';
import { WEEKLY_BOSS_POOL } from '../constants/weeklyBosses';
import { computeBattleOutcome } from '../utils/battleSim';
import { BattleEngine } from '../utils/battleEngine';
import { getEffectiveStats, applyGoldBonus } from '../utils/heroUtils';
import { getActiveSynergies } from '../constants/synergies';
import { bossToMissionTemplate } from './bossTemplate';
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

/** Processa o progresso das missões ativas. */
export function processMissions(state: GameState, heroes: Hero[], now: number): ProcessMissionsResult {
  const active = (state.activeMissions || []).map((m) => ({ ...m }));
  const completed: { mission: ActiveMission; reward: number; outcome: MissionOutcome }[] = [];
  let currentHeroes = [...heroes];

  for (let mi = 0; mi < active.length; mi++) {
    const m = active[mi];
    let tpl: MissionTemplate | undefined = MISSIONS.find((t) => t.id === m.templateId);
    if (!tpl && m.isWeeklyBoss) {
      const bossFromPool = WEEKLY_BOSS_POOL.find(b => b.id === m.templateId);
      if (bossFromPool) tpl = bossToMissionTemplate(bossFromPool);
    }
    if (!tpl) continue;

    const startedAt = m.startedAt ?? 0;
    const elapsed = Math.max(0, now - startedAt);

    if (m.scheduledActions && Array.isArray(m.scheduledActions)) {
      let ai = 0;
      let prevWasMiss = false;
      while (ai < m.scheduledActions.length) {
        const sched = m.scheduledActions[ai];
        if (sched.applied) {
          ai++;
          continue;
        }

        if ((sched.atMsFromStart ?? 0) <= elapsed || prevWasMiss) {
          const act = sched.action;

          if (act.actorType === 'enemy' && act.actionType === 'hit' && act.targetId) {
            const idx = currentHeroes.findIndex((hh) => hh.id === act.targetId);
            if (idx >= 0) {
              currentHeroes[idx] = {
                ...currentHeroes[idx],
                hpCurrent: Math.max(0, currentHeroes[idx].hpCurrent - (act.amount ?? 0))
              };
            }
          }

          if (act.actorType === 'hero' && act.actionType === 'hit' && act.targetId && m.enemiesState) {
            const eidx = m.enemiesState.findIndex((ee) => ee.id === act.targetId);
            if (eidx >= 0) {
              const newHp = Math.max(0, (m.enemiesState[eidx].hp ?? 0) - (act.amount ?? 0));
              m.enemiesState[eidx] = { ...m.enemiesState[eidx], hp: newHp, alive: newHp > 0 };
            }
          }

          if (act.actionType === 'move' && act.toPosition !== undefined) {
            if (act.actorType === 'enemy' && m.enemiesState) {
              const eidx = m.enemiesState.findIndex((ee) => ee.id === act.actorId);
              if (eidx >= 0) {
                m.enemiesState[eidx] = { ...m.enemiesState[eidx], position: act.toPosition };
              }
            } else if (act.actorType === 'hero' && m.heroPositions) {
              m.heroPositions[act.actorId] = act.toPosition;
            }
          }

          sched.applied = true;
          prevWasMiss = act.actionType === 'miss';

          if (act.actionType === 'defeat') {
            const aliveEnemiesNow = (m.enemiesState || []).filter((e: any) => (e.hp ?? 0) > 0);
            const aliveHeroesNow = currentHeroes.filter((h) => m.heroIds.includes(h.id) && h.hpCurrent > 0);
            if (aliveEnemiesNow.length === 0 || aliveHeroesNow.length === 0) {
              if (!m.finishAt) m.finishAt = now + MISSION_FINISH_DELAY_MS;
            }
            prevWasMiss = false;
          }
          ai++;
        } else {
          break;
        }
      }
    }

    const aliveEnemies = (m.enemiesState || []).filter((e: any) => (e.hp ?? 0) > 0);
    const aliveHeroes = currentHeroes.filter((h) => m.heroIds.includes(h.id) && h.hpCurrent > 0);
    if ((aliveEnemies.length === 0 || aliveHeroes.length === 0) && !m.finishAt) {
      m.finishAt = now + MISSION_FINISH_DELAY_MS;
    }

    if (m.finishAt && now >= m.finishAt) {
      let outcome: MissionOutcome;
      if (m.precomputedOutcome) {
        outcome = m.precomputedOutcome;
      } else {
        const heroesForOutcome = state.heroes.filter((h) => m.heroIds.includes(h.id));
        const battleOutcome = computeBattleOutcome(tpl, heroesForOutcome, {
          healerBuffMultiplier: m.healerBuffMultiplier,
          rogueRngBonus: m.rogueRngBonus,
          ref: tpl.ref,
          exponent: tpl.exponent,
          synergyK: tpl.synergyK,
          scale: tpl.scale,
        });
        outcome = battleOutcome;
      }
      completed.push({ mission: m, reward: outcome.reward, outcome });
    }
    active[mi] = m;
  }

  const remainingMissions = active.filter((m) => !completed.find((c) => c.mission.id === m.id));
  const perHeroGold = { ...(state.perHeroGold ?? {}) };
  let goldGained = 0;
  const materialDrops: Record<string, number> = {};
  let weeklyBossCompletedThisTick = false;
  let weeklyBossTemplateId: string | undefined;

  completed.forEach((c) => {
    const n = c.mission.heroIds.length || 1;
    const per = Math.floor(c.reward / n);

    // Apply casualties to hero HP regardless of looping
    c.mission.heroIds.forEach((hid: string) => {
      const idx = currentHeroes.findIndex((hh) => hh.id === hid);
      if (idx >= 0) {
        const caus = c.outcome.casualties.find((x: any) => x.heroId === hid);
        if (caus) {
          currentHeroes[idx] = { ...currentHeroes[idx], hpCurrent: caus.hpAfter };
        }
      }
      perHeroGold[hid] = (perHeroGold[hid] || 0) + per;
    });

    // Accumulate material drops from this mission outcome
    if (c.outcome.materialDrops) {
      for (const [mat, qty] of Object.entries(c.outcome.materialDrops)) {
        materialDrops[mat] = (materialDrops[mat] ?? 0) + qty;
      }
    }

    // Check if looping mission should restart
    if (c.mission.looping && c.outcome.success) {
      goldGained += applyGoldBonus(c.reward, state);
      const tpl = MISSIONS.find(t => t.id === c.mission.templateId);
      if (tpl) {
        // Get the surviving heroes for the next cycle
        const heroesForNext = currentHeroes.filter(h => c.mission.heroIds.includes(h.id) && h.hpCurrent > 0);
        if (heroesForNext.length >= tpl.minHeroes) {
          // Apply all stat bonuses via central helper
          const heroesWithEquipment = heroesForNext.map(h => {
            const eff = getEffectiveStats(h, state);
            return { ...h, hpMax: eff.hpMax, hpCurrent: eff.hpCurrent, atk: eff.atk, mp: eff.mp, defense: eff.defense, crit: eff.crit, agility: eff.agility };
          });

          const countHealers = heroesForNext.filter(h => h.classId === 'HEALER').length;
          const countRogues = heroesForNext.filter(h => h.classId === 'ROGUE').length;
          const healerBuffMultiplier = 1 + Math.min(HEALER_BUFF_CAP, countHealers * HEALER_BUFF_PER_HERO);
          const rogueRngBonus = Math.min(ROGUE_RNG_BONUS_CAP, countRogues * ROGUE_RNG_BONUS_PER_HERO);

          const teamClassIds = heroesForNext.map(h => h.classId).filter(Boolean) as ClassId[];
          const activeSynergyNames = getActiveSynergies(teamClassIds).map(s => s.name);

          try {
            const newOutcome = computeBattleOutcome(tpl, heroesWithEquipment, {
              healerBuffMultiplier,
              rogueRngBonus,
              heroPositions: c.mission.heroPositions,
            });
            const newScheduled = (newOutcome.actions || []).map((a, i) => ({
              atMsFromStart: MISSION_START_DELAY_MS + i * MISSION_ACTION_INTERVAL_MS,
              action: a,
              applied: false,
            }));
            remainingMissions.push({
              id: uuidv4(),
              templateId: c.mission.templateId,
              heroIds: c.mission.heroIds,
              heroPositions: c.mission.heroPositions,
              startedAt: now,
              looping: true,
              healerBuffMultiplier,
              rogueRngBonus,
              activeSynergies: activeSynergyNames.length > 0 ? activeSynergyNames : undefined,
              scheduledActions: newScheduled,
              enemiesState: BattleEngine.createEnemies(tpl),
              precomputedOutcome: newOutcome,
            });
          } catch {
            // If battle computation fails, stop looping and release heroes
            c.mission.heroIds.forEach((hid: string) => {
              const idx = currentHeroes.findIndex((hh) => hh.id === hid);
              if (idx >= 0) {
                currentHeroes[idx] = { ...currentHeroes[idx], currentTask: HeroTask.IDLE };
              }
            });
          }
        } else {
          // Not enough surviving heroes to continue — release them
          c.mission.heroIds.forEach((hid: string) => {
            const idx = currentHeroes.findIndex((hh) => hh.id === hid);
            if (idx >= 0) {
              currentHeroes[idx] = { ...currentHeroes[idx], currentTask: HeroTask.IDLE };
            }
          });
        }
      }
    } else {
      // Boss semanal vitorioso: sinalizar para aplicar bossDefeated fora do loop
      if (c.mission.isWeeklyBoss && c.outcome.success) {
        weeklyBossCompletedThisTick = true;
        weeklyBossTemplateId = c.mission.templateId;
      }

      // Normal completion: release heroes to IDLE
      goldGained += applyGoldBonus(c.reward, state);
      c.mission.heroIds.forEach((hid: string) => {
        const idx = currentHeroes.findIndex((hh) => hh.id === hid);
        if (idx >= 0) {
          currentHeroes[idx] = { ...currentHeroes[idx], currentTask: HeroTask.IDLE };
        }
      });
    }
  });

  const newResults: MissionResult[] = completed.map(c => {
    let tpl: MissionTemplate | undefined = MISSIONS.find(m => m.id === c.mission.templateId);
    if (!tpl && c.mission.isWeeklyBoss) {
      const bossFromPool = WEEKLY_BOSS_POOL.find(b => b.id === c.mission.templateId);
      if (bossFromPool) tpl = bossToMissionTemplate(bossFromPool);
    }
    const totalEnemies = tpl?.enemies?.reduce((sum, e) => sum + (e.count ?? 1), 0) ?? 0;
    return {
      ...c.outcome,
      missionId: c.mission.id,
      templateId: c.mission.templateId,
      totalEnemies,
      activeSynergies: c.mission.activeSynergies,
    };
  });

  return {
    newHeroes: currentHeroes,
    activeMissions: remainingMissions,
    goldGained,
    newResults,
    materialDrops,
    weeklyBossDefeated: weeklyBossCompletedThisTick,
    weeklyBossTemplateId,
  };
}
```

> **Atenção:** o corpo acima é **byte-a-byte** o de `tickHandler.ts:145-386`. A única diferença é `export function processMissions(...): ProcessMissionsResult` em vez do tipo de retorno inline. Não reescrever nenhuma linha do corpo.

- [ ] **Step 4: Rodar o teste de caracterização para confirmar que passa**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/missionTickHandler.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Remover `processMissions` e os imports migrados de `tickHandler.ts`; importar a versão movida**

Em `src/context/tickHandler.ts`:

1. **Remover** a função `processMissions` inteira (linhas 135-387, do comentário `/** Processa o progresso das missões ativas */` até o `}` de fechamento).

2. **Adicionar** o import logo após `import { applyTickProgress } from './progressTrackers';` (Task 4):

```ts
import { processMissions } from './missionTickHandler';
```

3. **Remover os imports que migraram e não são mais usados por `tickHandler.ts`.** Após remover `processMissions`, ficam órfãos (confirmar com grep no Step 6):
   - `computeBattleOutcome` (linha 21)
   - `getEffectiveStats, applyGoldBonus` (linha 22)
   - `getActiveSynergies` (linha 24)
   - `uuidv4` (linha 25)
   - `MISSIONS` (linha 20) e `MissionTemplate` (linha 31)
   - `ActiveMission, MissionOutcome, ClassId, MissionResult` da linha 1 — após a extração, o corpo de `handleTick` não referencia nenhum desses tipos (usa só a **propriedade** `recentMissionResults`, não o tipo `MissionResult`). Mantém apenas `GameState, HeroTask, Hero` na linha 1. Confirmar com o Step 6.
   - Constantes da linha 9-17 que só `processMissions` usava: `MISSION_FINISH_DELAY_MS`, `MISSION_START_DELAY_MS`, `MISSION_ACTION_INTERVAL_MS`, `HEALER_BUFF_PER_HERO`, `HEALER_BUFF_CAP`, `ROGUE_RNG_BONUS_PER_HERO`, `ROGUE_RNG_BONUS_CAP`.

   **`BattleEngine` (linha 23):** após a extração, `tickHandler.ts` não chama mais `BattleEngine` diretamente — remover esse import também.
   **`WEEKLY_BOSS_POOL` (linha 30):** **permanece** — `handleTick:464` ainda o usa para o equipamento garantido do boss. Não remover.
   **`getUnlockedSkills` (linha 32):** **permanece** — usado na otimização da Task 3.

   Use o Step 6 (tsc) como autoridade final sobre o que remover: o type-check acusa import não usado **somente** se `noUnusedLocals` estiver ligado; independentemente disso, remova manualmente os que o grep do Step 6 mostrar como não referenciados no corpo.

- [ ] **Step 6: Limpar imports órfãos guiado por grep + tsc**

Para cada símbolo candidato a remoção, confirmar que não há mais uso no corpo de `tickHandler.ts`:

```bash
for s in computeBattleOutcome getEffectiveStats applyGoldBonus getActiveSynergies uuidv4 MISSIONS MissionTemplate BattleEngine ActiveMission MissionOutcome MissionResult ClassId MISSION_FINISH_DELAY_MS MISSION_START_DELAY_MS MISSION_ACTION_INTERVAL_MS HEALER_BUFF_PER_HERO HEALER_BUFF_CAP ROGUE_RNG_BONUS_PER_HERO ROGUE_RNG_BONUS_CAP; do
  echo -n "$s: "; grep -c "\b$s\b" src/context/tickHandler.ts;
done
```

Expected: cada símbolo aparece **1** vez (só na linha de import) → seguro remover do import. Se algum aparecer **≥2**, ele ainda é usado no corpo — **manter** no import.

Editar as linhas de import de `tickHandler.ts` removendo os símbolos confirmados como órfãos (`1`). Depois:

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 7: Confirmar o tamanho de `tickHandler.ts`**

Run: `wc -l src/context/tickHandler.ts`
Expected: **≤ 260** (de 499). Se exceder, verificar que `processMissions` foi removida por completo.

- [ ] **Step 8: Suíte completa**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand --testPathIgnorePatterns '/node_modules/' '/dist/' '/.worktrees/' 'gameContext.offline.test.tsx'`
Expected: PASS — 62 suites, **440 testes** (434 da Task 4 + 6 da Task 5). 0 vermelhos. `tickHandler.advanced.test.ts` e `weeklyBoss.test.ts` (que exercitam o tick completo) seguem verdes — prova de que a extração preservou o comportamento.

- [ ] **Step 9: Commit**

```bash
git add src/context/missionTickHandler.ts src/__tests__/context/missionTickHandler.test.ts src/context/tickHandler.ts
git commit -m "refactor(tick): extrair processMissions para missionTickHandler.ts (assinatura preservada)"
```

---

## Task 6: Snapshot golden de combate (rede da modularização)

**Files:**
- Create: `src/__tests__/utils/battleEngine.golden.test.ts`

**Interfaces:**
- Consumes: `computeBattleOutcome` (de `../../utils/battleSim`), `MISSIONS` (de `../../constants/missions`). Usa `seed` fixo (PRNG `makeRng` é acionado por `opts.seed` em `battleSim.ts:41`).
- Produces: snapshot determinístico de `{ success, reward, rounds, casualties, actionsLength, first10Actions }` para cenários fixos. **Este snapshot é gerado AGORA, antes de mexer no `battleEngine.ts`** — ele é a especificação byte-a-byte que as Tasks 7-12 não podem violar.

> **Ordem crítica:** esta task vem **antes** de qualquer mudança em `battleEngine.ts`. O snapshot é gravado contra o código monolítico atual; a modularização tem de reproduzi-lo exatamente.

- [ ] **Step 1: Escrever o teste de snapshot**

Criar `src/__tests__/utils/battleEngine.golden.test.ts`:

```ts
import { computeBattleOutcome } from '../../utils/battleSim';
import { MISSIONS } from '../../constants/missions';

function makeHero(id: string, classId: string, over: any = {}): any {
  return {
    id, name: `${classId}-${id}`, hpMax: 40, hpCurrent: 40, atk: 12, mp: 6,
    defense: 5, crit: 10, agility: 8, currentTask: 'IDLE',
    classId, range: 1, movement: 2, ...over,
  };
}

function digest(o: any) {
  return {
    success: o.success,
    reward: o.reward,
    rounds: o.rounds,
    enemyCasualties: o.enemyCasualties,
    casualties: o.casualties,
    actionsLength: o.actions.length,
    first10Actions: o.actions.slice(0, 10).map((a: any) => ({
      round: a.round, actorType: a.actorType, actorId: a.actorId,
      actionType: a.actionType, targetId: a.targetId, amount: a.amount, isCrit: a.isCrit,
    })),
  };
}

const M1 = MISSIONS.find(m => m.id === 'mission_1')!;

describe('battleEngine golden (determinismo por seed — gate da modularização)', () => {
  test('cenário sem sinergia (1 WARRIOR) — seed 12345', () => {
    const heroes = [makeHero('h1', 'WARRIOR')];
    const o = computeBattleOutcome(M1, heroes, { seed: 12345, heroPositions: { h1: 45 } });
    expect(digest(o)).toMatchSnapshot();
  });

  test('cenário com sinergia ativa (TANK+ARCHER) — seed 777', () => {
    const heroes = [makeHero('t1', 'TANK'), makeHero('a1', 'ARCHER', { range: 3 })];
    const o = computeBattleOutcome(M1, heroes, { seed: 777, heroPositions: { t1: 45, a1: 49 } });
    expect(digest(o)).toMatchSnapshot();
  });

  test('cenário com personalidade não-neutra (AGGRESSIVE) — seed 9001', () => {
    const heroes = [makeHero('h1', 'ROGUE', { personality: 'AGGRESSIVE' })];
    const o = computeBattleOutcome(M1, heroes, { seed: 9001, heroPositions: { h1: 45 } });
    expect(digest(o)).toMatchSnapshot();
  });
});
```

> Se `TANK+ARCHER` não ativar uma sinergia real em `getActiveSynergies`, o teste continua válido como rede determinística (apenas não exercita o caminho de sinergia). Para garantir cobertura de sinergia, conferir os pares válidos antes:
> Run: `grep -nE "classId|require|LINHA_DE_FRENTE|MURALHA" src/constants/synergies.ts | head -30`
> e ajustar os `classId` dos heróis do 2º cenário para um par que `getActiveSynergies` reconheça. **Não** alterar seeds depois de gerar o snapshot.

- [ ] **Step 2: Gerar o snapshot (1ª execução grava o `.snap`)**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/battleEngine.golden.test.ts`
Expected: PASS — `3 written` snapshots. Confere que existe `src/__tests__/utils/__snapshots__/battleEngine.golden.test.ts.snap`.

- [ ] **Step 3: Re-rodar para confirmar estabilidade (determinismo entre runs)**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/battleEngine.golden.test.ts`
Expected: PASS — `3 passed`, `0 written`. Se algum snapshot mudar entre runs, o determinismo por seed está quebrado (bug pré-existente) — **parar e investigar** (não prosseguir com a modularização sobre base não-determinística).

- [ ] **Step 4: Commit (snapshot é a base de regressão)**

```bash
git add src/__tests__/utils/battleEngine.golden.test.ts src/__tests__/utils/__snapshots__/battleEngine.golden.test.ts.snap
git commit -m "test(battle): snapshot golden por seed como gate da modularização do battleEngine"
```

---

## Task 7: Extrair tipos → `src/utils/battle/types.ts`

**Files:**
- Create: `src/utils/battle/types.ts`
- Modify: `src/utils/battleEngine.ts` (remover as definições de tipo; reimportar e reexportar de `./battle/types`)

**Interfaces:**
- Consumes: `Hero`, `MissionAction` (de `../../types`).
- Produces: `export type SynergyId`, `export type BuffType`, `export interface Buff`, `export interface BattleEnemy`, `export interface SynergyHandlers`, `export interface BattleState` (formas idênticas às de `battleEngine.ts:19-101`).

> Esta é a 1ª de 6 tasks de modularização. Princípio: **mover declaração, manter forma**, reexportar do barril para não quebrar `battleSim.ts` (`import { BattleEngine, BattleEnemy, BattleState } from './battleEngine'`) nem a suíte (`import { BattleEngine, BattleState } from '../../utils/battleEngine'`).

- [ ] **Step 1: Criar `src/utils/battle/types.ts`**

Mover as declarações de `battleEngine.ts:19-101` (de `export type SynergyId` até o fim de `export interface BattleState`):

```ts
import { Hero, MissionAction } from '../../types';

export type SynergyId =
  | 'LINHA_DE_FRENTE'
  | 'MURALHA_E_FLECHA'
  | 'BASTIAO'
  | 'CAOS_ARCANO'
  | 'EMBOSCADA'
  | 'ARTILHARIA';

export type BuffType =
  | 'atkMul'
  | 'critFlat'
  | 'rangeFlat'
  | 'defDebuffMul'
  | 'taunt'
  | 'dot'
  | 'shield'
  | 'defMul'
  | 'revive';

export interface Buff {
  source: string;
  type: BuffType;
  value: number;
  expiresAfterRound: number;
}

export interface BattleEnemy {
  id: string;
  hp: number;
  maxHp: number;
  atk: number;
  mp: number;
  defense: number;
  crit: number;
  agility: number;
  alive: boolean;
  attackType: 'MELEE' | 'RANGED';
  position?: number;
  range: number;
  movement: number;
  skills?: import('../../constants/enemySkills').EnemySkillDef[];
  skillCooldowns?: Record<string, number>;
  skillOnceUsed?: Record<string, boolean>;
}

export interface SynergyHandlers {
  onBattleStart: (state: BattleState) => void;
  onHealApplied: (state: BattleState, healer: Hero, target: Hero, amount: number) => void;
  onHeroDamaged: (state: BattleState, hero: Hero, hpAfter: number) => void;
  onAttackResolved: (
    state: BattleState,
    attacker: Hero | BattleEnemy,
    target: Hero | BattleEnemy,
    dmg: number,
    distance: number
  ) => void;
  shouldIgnoreDefense: (state: BattleState, attacker: Hero | BattleEnemy) => boolean;
  modifyTargetScore: (
    state: BattleState,
    enemy: BattleEnemy,
    candidate: Hero,
    baseScore: number
  ) => number;
}

export interface BattleState {
  heroes: Hero[];
  enemies: BattleEnemy[];
  heroPositions: Record<string, number>;
  enemyPositions: Record<string, number>;
  lastAttacker: Record<string, string>;
  threats: Record<string, string>;
  log: string[];
  actions: MissionAction[];
  rounds: number;
  activeSynergies: SynergyId[];
  buffs: Record<string, Buff[]>;
  flags: Record<string, boolean | number>;
  handlers: SynergyHandlers;
  skillCooldowns: Record<string, number>;
  skillOnceUsed: Record<string, boolean>;
  rng: () => number;
}
```

> Nota: caminho relativo sobe **dois** níveis (`../../types`, `../../constants/enemySkills`) porque o arquivo está em `src/utils/battle/`.

- [ ] **Step 2: Em `battleEngine.ts`, remover as declarações de tipo e reexportar de `./battle/types`**

No topo de `src/utils/battleEngine.ts`, **remover** as linhas 19-101 (as 6 declarações de tipo) e **substituir** por um reexport. Logo após os imports existentes (após a linha 17), adicionar:

```ts
export type {
  SynergyId,
  BuffType,
  Buff,
  BattleEnemy,
  SynergyHandlers,
  BattleState,
} from './battle/types';
import type { BattleState, BattleEnemy } from './battle/types';
```

(O `import type` traz `BattleState`/`BattleEnemy` para uso nas assinaturas dos métodos do objeto `BattleEngine`, que continuam no arquivo nesta task.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros. (`battleSim.ts` importa `{ BattleEngine, BattleEnemy, BattleState }` do barril — o reexport mantém isso válido.)

- [ ] **Step 4: Suíte de battle + snapshot golden**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/battleEngine.test.ts src/__tests__/utils/battleEngine.advanced.test.ts src/__tests__/utils/battleSim.test.ts src/__tests__/utils/battleEngine.golden.test.ts`
Expected: PASS, `0 written` no golden (snapshot inalterado).

- [ ] **Step 5: Commit**

```bash
git add src/utils/battle/types.ts src/utils/battleEngine.ts
git commit -m "refactor(battle): extrair tipos do battleEngine para battle/types.ts"
```

---

## Task 8: Extrair grid → `src/utils/battle/grid.ts`

**Files:**
- Create: `src/utils/battle/grid.ts`
- Modify: `src/utils/battleEngine.ts` (remover `createEnemies`/`findMovePath`; importar de `./battle/grid`; remontar no objeto)

**Interfaces:**
- Consumes: `BattleEnemy` (de `./types`); `MissionTemplate` (de `../../constants/missions`); `GameMath` (de `../gameMath`); `assignEnemySkills` (de `../../constants/enemySkills`); `ENEMY_ROWS`, `GRID_COLUMNS`, `GRID_ROWS` (de `../../constants/game`).
- Produces: `export function createEnemies(template: MissionTemplate, rng?: () => number): BattleEnemy[]` e `export function findMovePath(currentPos: number, targetPos: number, movement: number, occupiedPositions: Set<number>): number`.

- [ ] **Step 1: Criar `src/utils/battle/grid.ts`**

Mover o corpo de `createEnemies` (battleEngine.ts:109-173) e `findMovePath` (234-269), trocando `this.createEnemies` por nada (não há auto-referência em `createEnemies`; `findMovePath` também não usa `this`). Corpo idêntico:

```ts
import { MissionTemplate } from '../../constants/missions';
import { ENEMY_ROWS, GRID_COLUMNS, GRID_ROWS } from '../../constants/game';
import { GameMath } from '../gameMath';
import { assignEnemySkills } from '../../constants/enemySkills';
import { BattleEnemy } from './types';

/**
 * Cria os inimigos para a batalha baseado no template da missão.
 * @param rng PRNG a usar — default Math.random para retrocompatibilidade
 *            (call sites de produção como missionHandler não passam rng).
 */
export function createEnemies(template: MissionTemplate, rng: () => number = Math.random): BattleEnemy[] {
  const enemies: BattleEnemy[] = [];
  const enemyPositions = [...ENEMY_ROWS].flatMap(r =>
    Array.from({ length: GRID_COLUMNS }, (_, c) => r * GRID_COLUMNS + c)
  );
  for (let i = enemyPositions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [enemyPositions[i], enemyPositions[j]] = [enemyPositions[j], enemyPositions[i]];
  }

  let posIdx = 0;

  if (template.enemies && template.enemies.length > 0) {
    template.enemies.forEach((edef, gi) => {
      const cnt = edef.count ?? 1;
      for (let i = 0; i < cnt; i++) {
        const attackType = edef.attackType ?? (rng() < 0.5 ? 'MELEE' : 'RANGED');
        enemies.push({
          id: `enemy_${gi}_${i}`,
          hp: edef.hp,
          maxHp: edef.hp,
          atk: edef.atk,
          mp: edef.mp,
          defense: edef.defense ?? 2,
          crit: edef.crit ?? 5,
          agility: edef.agility ?? 5,
          alive: true,
          attackType,
          position: enemyPositions[posIdx++] ?? 0,
          range: edef.range ?? (attackType === 'RANGED' ? 3 : 1),
          movement: edef.movement ?? 2,
        });
        const difficulty = template.difficulty ?? 1;
        const isBoss = (edef.hp ?? 0) >= 100;
        const assigned = assignEnemySkills(difficulty, isBoss, rng);
        if (assigned.length > 0) enemies[enemies.length - 1].skills = assigned;
      }
    });
  } else {
    const enemyCount = template.minHeroes;
    for (let i = 0; i < enemyCount; i++) {
      enemies.push({
        id: `orc_${i}`,
        hp: 5,
        maxHp: 5,
        atk: 2,
        mp: 1,
        defense: 1,
        crit: 2,
        agility: 2,
        alive: true,
        attackType: i % 2 === 0 ? 'MELEE' : 'RANGED',
        position: enemyPositions[posIdx++] ?? 0,
        range: i % 2 === 0 ? 1 : 3,
        movement: 2,
      });
      const difficulty = template.difficulty ?? 1;
      const isBoss = false;
      const assigned = assignEnemySkills(difficulty, isBoss, rng);
      if (assigned.length > 0) enemies[enemies.length - 1].skills = assigned;
    }
  }
  return enemies;
}

/**
 * Encontra a melhor posição para se mover em direção ao alvo (BFS hexagonal).
 */
export function findMovePath(
  currentPos: number,
  targetPos: number,
  movement: number,
  occupiedPositions: Set<number>
): number {
  if (movement <= 0) return currentPos;

  let bestPos = currentPos;
  let minDistance = GameMath.getHexDistance(currentPos, targetPos);

  const queue: { pos: number; dist: number }[] = [{ pos: currentPos, dist: 0 }];
  const visited = new Set<number>([currentPos]);

  while (queue.length > 0) {
    const { pos, dist } = queue.shift()!;

    if (dist < movement) {
      const neighbors = GameMath.getHexNeighbors(pos, GRID_ROWS, GRID_COLUMNS);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && !occupiedPositions.has(neighbor)) {
          visited.add(neighbor);
          const dToTarget = GameMath.getHexDistance(neighbor, targetPos);
          if (dToTarget < minDistance) {
            minDistance = dToTarget;
            bestPos = neighbor;
          }
          queue.push({ pos: neighbor, dist: dist + 1 });
        }
      }
    }
  }

  return bestPos;
}
```

- [ ] **Step 2: Remover `createEnemies`/`findMovePath` de `battleEngine.ts` e remontar**

Em `src/utils/battleEngine.ts`:

1. **Remover** os métodos `createEnemies` (109-173) e `findMovePath` (234-269) do objeto `BattleEngine`.

2. **Adicionar** o import logo após o reexport da Task 7:

```ts
import { createEnemies, findMovePath } from './battle/grid';
```

3. Dentro de `initializeBattle` (que ainda está no objeto nesta task), trocar `this.createEnemies(template, rng)` (linha 186) por `createEnemies(template, rng)`.

4. Dentro de `processHeroTurn`/`processEnemyTurn` (ainda no objeto), trocar `this.findMovePath(...)` (linhas 558 e 705) por `findMovePath(...)`.

5. No literal final do objeto, garantir que `createEnemies` e `findMovePath` apareçam como propriedades. Como os métodos foram removidos, adicionar shorthand no objeto — **mas** o objeto ainda é um literal com métodos; a forma mais simples é declarar as propriedades apontando para as funções importadas. No fim da Task 12 o objeto vira um literal puro de referências; nesta task intermediária, adicionar ao objeto:

```ts
  createEnemies,
  findMovePath,
```

como propriedades (shorthand) entre os demais métodos. Confirma que `BattleEngine.createEnemies` e `BattleEngine.findMovePath` continuam existindo na forma pública.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 4: Suíte de battle + golden**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/battleEngine.test.ts src/__tests__/utils/battleEngine.advanced.test.ts src/__tests__/utils/battleSim.test.ts src/__tests__/utils/battleEngine.golden.test.ts`
Expected: PASS, `0 written` no golden.

- [ ] **Step 5: Commit**

```bash
git add src/utils/battle/grid.ts src/utils/battleEngine.ts
git commit -m "refactor(battle): extrair createEnemies/findMovePath para battle/grid.ts"
```

---

## Task 9: Extrair resolução de dano → `src/utils/battle/resolution.ts`

**Files:**
- Create: `src/utils/battle/resolution.ts`
- Modify: `src/utils/battleEngine.ts` (remover `calculateAttack`/`cleanExpiredBuffs`; importar; remontar)

**Interfaces:**
- Consumes: `BattleState` (de `./types`); `GameMath` (de `../gameMath`); `HIT_CHANCE_DISTANCE_PENALTY` (de `../../constants/game`); `MissionAction`, `MissionActorType` (de `../../types`).
- Produces: `export function calculateAttack(...)` (mesma assinatura de battleEngine.ts:367-376) e `export function cleanExpiredBuffs(state: BattleState): void`.

- [ ] **Step 1: Criar `src/utils/battle/resolution.ts`**

Mover `calculateAttack` (367-442) e `cleanExpiredBuffs` (222-229). Nenhuma das duas usa `this`. Corpo idêntico:

```ts
import { MissionAction, MissionActorType } from '../../types';
import { HIT_CHANCE_DISTANCE_PENALTY } from '../../constants/game';
import { GameMath } from '../gameMath';
import { BattleState } from './types';

/**
 * Remove buffs cujo expiresAfterRound é < round atual. Persistentes (-1) ficam.
 */
export function cleanExpiredBuffs(state: BattleState): void {
  for (const actorId of Object.keys(state.buffs)) {
    state.buffs[actorId] = state.buffs[actorId].filter(
      b => b.expiresAfterRound === -1 || b.expiresAfterRound >= state.rounds
    );
    if (state.buffs[actorId].length === 0) delete state.buffs[actorId];
  }
}

/**
 * Calcula o resultado de um ataque (evasão, penalidade de distância, buffs,
 * crit/dano).
 */
export function calculateAttack(
  attacker: { id: string; name?: string; atk: number; crit?: number; classId?: string; attackType?: 'MELEE' | 'RANGED'; personality?: string },
  target: { id: string; name?: string; hp?: number; hpCurrent?: number; defense?: number; agility?: number },
  baseHitChance: number,
  actorType: MissionActorType,
  round: number,
  rng: () => number,
  distance: number = 1,
  state?: BattleState
): { action: MissionAction; dmg: number } | null {
  const evasion = (target.agility ?? 0) / ((target.agility ?? 0) + 50);
  let distancePenalty = Math.max(0, distance - 1) * HIT_CHANCE_DISTANCE_PENALTY;
  if (attacker.personality === 'CAUTIOUS') {
    distancePenalty *= 0.6;
  }
  const effectiveHitChance = Math.max(0.05, baseHitChance - evasion - distancePenalty);

  if (rng() > effectiveHitChance) {
    return {
      action: {
        round,
        actorType,
        actorId: attacker.id,
        actorName: attacker.name ?? attacker.id,
        actionType: 'miss',
        targetId: target.id,
        text: `${attacker.name ?? attacker.id} errou o ataque em ${target.name ?? target.id}`,
      },
      dmg: 0,
    };
  }

  let atkMul = 1;
  let critFlat = 0;
  if (state) {
    const attackerBuffs = state.buffs[attacker.id] ?? [];
    for (const b of attackerBuffs) {
      if (b.type === 'atkMul') atkMul *= b.value;
      else if (b.type === 'critFlat') critFlat += b.value;
    }
  }

  let defMul = 1;
  if (state) {
    const targetBuffs = state.buffs[target.id] ?? [];
    for (const b of targetBuffs) {
      if (b.type === 'defDebuffMul') defMul *= b.value;
      else if (b.type === 'defMul') defMul *= b.value;
    }
  }

  const ignoreDef = state ? state.handlers.shouldIgnoreDefense(state, attacker as any) : false;
  const effectiveDef = ignoreDef ? 0 : Math.floor((target.defense ?? 0) * defMul);

  const critChance = GameMath.calcCritChance(attacker.classId, (attacker.crit ?? 0) + critFlat);
  const isCrit = rng() < critChance;
  const effectiveAtk = Math.floor(attacker.atk * atkMul);
  const dmg = GameMath.calcDamage(effectiveAtk, effectiveDef, isCrit);

  return {
    action: {
      round,
      actorType,
      actorId: attacker.id,
      actorName: attacker.name ?? attacker.id,
      actionType: 'hit',
      targetId: target.id,
      amount: dmg,
      isCrit,
      text: `${attacker.name ?? attacker.id} causou ${dmg} de dano em ${target.name ?? target.id}${isCrit ? ' (CRÍTICO!)' : ''}`,
    },
    dmg,
  };
}
```

- [ ] **Step 2: Remover de `battleEngine.ts` e remontar**

Em `src/utils/battleEngine.ts`:

1. **Remover** `cleanExpiredBuffs` (222-229) e `calculateAttack` (367-442) do objeto.

2. **Adicionar** o import após o de `./battle/grid`:

```ts
import { calculateAttack, cleanExpiredBuffs } from './battle/resolution';
```

3. Em `processHeroTurn`/`processEnemyTurn` (ainda no objeto), trocar `this.calculateAttack(...)` (linhas 599, 626, 741) por `calculateAttack(...)`.

4. No literal do objeto, adicionar `calculateAttack,` e `cleanExpiredBuffs,` como propriedades shorthand (mantendo `BattleEngine.cleanExpiredBuffs`, consumido por `battleSim.ts:58`).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 4: Suíte de battle + golden**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/battleEngine.test.ts src/__tests__/utils/battleEngine.advanced.test.ts src/__tests__/utils/battleSim.test.ts src/__tests__/utils/battleEngine.golden.test.ts`
Expected: PASS, `0 written` no golden.

- [ ] **Step 5: Commit**

```bash
git add src/utils/battle/resolution.ts src/utils/battleEngine.ts
git commit -m "refactor(battle): extrair calculateAttack/cleanExpiredBuffs para battle/resolution.ts"
```

---

## Task 10: Extrair mira → `src/utils/battle/targeting.ts`

**Files:**
- Create: `src/utils/battle/targeting.ts`
- Modify: `src/utils/battleEngine.ts` (remover `selectTarget`; importar; remontar)

**Interfaces:**
- Consumes: `GameMath` (de `../gameMath`).
- Produces: `export function selectTarget<T extends ...>(...)` (assinatura genérica idêntica a battleEngine.ts:275-286).

- [ ] **Step 1: Criar `src/utils/battle/targeting.ts`**

Mover `selectTarget` (275-362). Não usa `this`. Corpo idêntico:

```ts
import { GameMath } from '../gameMath';

/**
 * Lógica de seleção de alvo: score por distância, classe, personalidade e
 * modifyScore externo, com tiebreak via rng.
 */
export function selectTarget<T extends { id: string; hp?: number; hpCurrent?: number; position?: number; classId?: string; range?: number }>(
  attacker: { id: string; attackType?: 'MELEE' | 'RANGED'; personality?: string; classId?: string; range?: number },
  attackerPos: number,
  candidates: T[],
  rng: () => number,
  context: {
    lastAttackerId?: string;
    alliesInDanger?: string[];
    threats?: Record<string, string>;
    modifyScore?: (candidate: T, baseScore: number) => number;
  } = {}
): T | undefined {
  if (!candidates || candidates.length === 0) return undefined;

  const hpOf = (c: T) => (typeof c.hp === 'number' ? c.hp : c.hpCurrent ?? 0);
  const maxHpOf = (c: any) => (typeof c.maxHp === 'number' ? c.maxHp : 100);

  const scores = candidates.map(target => {
    let score = 100;
    const dist = GameMath.getHexDistance(attackerPos, target.position ?? 0);
    const targetHpPct = hpOf(target) / maxHpOf(target);

    score -= dist * 10;

    if (attacker.classId === 'TANK' || attacker.classId === 'WARRIOR') {
      if (dist <= 1) score += 20;
    } else if (attacker.classId === 'ROGUE' || attacker.classId === 'ARCHER' || attacker.classId === 'MAGE') {
      if (target.classId !== 'TANK') score += 15;
      if (targetHpPct < 0.5) score += 10;
    }

    switch (attacker.personality) {
      case 'AGGRESSIVE':
        if (targetHpPct < 0.3) score += 40;
        break;
      case 'PROTECTOR':
        if (context.threats && target.id in context.threats) {
          const targetOfEnemy = context.threats[target.id];
          if (context.alliesInDanger?.includes(targetOfEnemy)) {
            score += 100;
          }
        }
        break;
      case 'CAUTIOUS':
        const range = attacker.range ?? 1;
        if (dist <= range) score += 30;
        break;
      case 'VENGEFUL':
        if (target.id === context.lastAttackerId) {
          score += 200;
        }
        break;
      case 'OPPORTUNIST':
        if (target.classId !== 'TANK') score += 20;
        if (targetHpPct < 0.4) score += 30;
        break;
    }

    if (context.modifyScore) {
      score = context.modifyScore(target, score);
    }

    return { target, score };
  });

  scores.sort((a, b) => b.score - a.score);

  const topCandidates = scores.slice(0, 2);
  if (topCandidates.length > 1 && rng() < 0.2) {
    return topCandidates[1].target;
  }

  return topCandidates[0]?.target;
}
```

- [ ] **Step 2: Remover de `battleEngine.ts` e remontar**

Em `src/utils/battleEngine.ts`:

1. **Remover** `selectTarget` (275-362) do objeto.

2. **Adicionar** o import após o de `./battle/resolution`:

```ts
import { selectTarget } from './battle/targeting';
```

3. Em `processHeroTurn`/`processEnemyTurn`, trocar `this.selectTarget(...)` (linhas 528, 540, 580, 692, 727) por `selectTarget(...)`.

4. No literal do objeto, adicionar `selectTarget,` como propriedade shorthand (mantendo `BattleEngine.selectTarget`, consumido pela suíte `battleEngine.test.ts`).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 4: Suíte de battle + golden**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/battleEngine.test.ts src/__tests__/utils/battleEngine.advanced.test.ts src/__tests__/utils/battleSim.test.ts src/__tests__/utils/battleEngine.golden.test.ts`
Expected: PASS, `0 written` no golden.

- [ ] **Step 5: Commit**

```bash
git add src/utils/battle/targeting.ts src/utils/battleEngine.ts
git commit -m "refactor(battle): extrair selectTarget para battle/targeting.ts"
```

---

## Task 11: Extrair setup → `src/utils/battle/setup.ts`

**Files:**
- Create: `src/utils/battle/setup.ts`
- Modify: `src/utils/battleEngine.ts` (remover `initializeBattle`; importar; remontar)

**Interfaces:**
- Consumes: `createEnemies` (de `./grid`, Task 8); `BattleState`, `BattleEnemy`, `SynergyId` (de `./types`); `Hero`, `ClassId` (de `../../types`); `MissionTemplate` (de `../../constants/missions`); `getActiveSynergies` (de `../../constants/synergies`); `createSynergyHandlers` (de `../synergyEffects`).
- Produces: `export function initializeBattle(heroes: Hero[], template: MissionTemplate, opts?: { heroPositions?: Record<string, number>; rng?: () => number }): BattleState`.

- [ ] **Step 1: Criar `src/utils/battle/setup.ts`**

Mover `initializeBattle` (180-216), trocando `this.createEnemies(template, rng)` por `createEnemies(template, rng)` importado de `./grid`:

```ts
import { Hero, ClassId } from '../../types';
import { MissionTemplate } from '../../constants/missions';
import { getActiveSynergies } from '../../constants/synergies';
import { createSynergyHandlers } from '../synergyEffects';
import { createEnemies } from './grid';
import { BattleState } from './types';

/**
 * Constrói um BattleState fresco com handlers de sinergia ligados e posições
 * inicializadas.
 * @param opts.rng PRNG a usar — default Math.random para retrocompatibilidade.
 */
export function initializeBattle(
  heroes: Hero[],
  template: MissionTemplate,
  opts: { heroPositions?: Record<string, number>; rng?: () => number } = {}
): BattleState {
  const rng = opts.rng ?? Math.random;
  const enemies = createEnemies(template, rng);
  const enemyPositions: Record<string, number> = {};
  enemies.forEach(e => { if (e.position !== undefined) enemyPositions[e.id] = e.position; });

  const classIds = heroes.map(h => h.classId).filter(Boolean) as ClassId[];
  const activeSynergyDefs = getActiveSynergies(classIds);
  const activeSynergies = activeSynergyDefs.map(s => s.id);
  const handlers = createSynergyHandlers(activeSynergies);

  const state: BattleState = {
    heroes,
    enemies,
    heroPositions: { ...(opts.heroPositions || {}) },
    enemyPositions,
    lastAttacker: {},
    threats: {},
    log: [],
    actions: [],
    rounds: 0,
    activeSynergies,
    buffs: {},
    flags: {},
    handlers,
    skillCooldowns: {},
    skillOnceUsed: {},
    rng,
  };

  handlers.onBattleStart(state);
  return state;
}
```

> Nota: `createSynergyHandlers` aceita `SynergyId[]` (`activeSynergies` é `SynergyId[]` via `activeSynergyDefs.map(s => s.id)`). Se o tsc reclamar do tipo de `activeSynergies`, anotar `const activeSynergies: SynergyId[] = activeSynergyDefs.map(s => s.id);` e importar `SynergyId` de `./types`. Aplicar só se necessário (o código original não anotava).

- [ ] **Step 2: Remover de `battleEngine.ts` e remontar**

Em `src/utils/battleEngine.ts`:

1. **Remover** `initializeBattle` (180-216) do objeto.

2. **Adicionar** o import após o de `./battle/targeting`:

```ts
import { initializeBattle } from './battle/setup';
```

3. No literal do objeto, adicionar `initializeBattle,` como propriedade shorthand (mantendo `BattleEngine.initializeBattle`, consumido por `battleSim.ts:44`).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 4: Suíte de battle + golden**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/battleEngine.test.ts src/__tests__/utils/battleEngine.advanced.test.ts src/__tests__/utils/battleSim.test.ts src/__tests__/utils/battleEngine.golden.test.ts`
Expected: PASS, `0 written` no golden.

- [ ] **Step 5: Commit**

```bash
git add src/utils/battle/setup.ts src/utils/battleEngine.ts
git commit -m "refactor(battle): extrair initializeBattle para battle/setup.ts"
```

---

## Task 12: Extrair turnos → `src/utils/battle/turns.ts` e fechar o barril

**Files:**
- Create: `src/utils/battle/turns.ts`
- Modify: `src/utils/battleEngine.ts` (vira barril puro: só imports + reexport de tipos + `export const BattleEngine = { ... }`)

**Interfaces:**
- Consumes: `selectTarget` (de `./targeting`); `calculateAttack` (de `./resolution`); `findMovePath` (de `./grid`); `BattleState`, `BattleEnemy` (de `./types`); `Hero` (de `../../types`); `GameMath` (de `../gameMath`); efeitos externos: `executePreAttackSkills`, `onEnemyDamagedSkills`, `onRogueHitSkills`, `getShieldReduction`, `onHeroDamagedSkills`, `onHeroDeathSkills` (de `../skillEffects`); `applyPersonalityOnHit`, `applyProtectorShield` (de `../personalityEffects`); `applyEnemyPassiveSkills`, `executeEnemyPreAttackSkills`, `onEnemyHitSkills` (de `../enemySkillEffects`).
- Produces: `export function executeClassAbility(hero: Hero, state: BattleState): boolean`, `export function processHeroTurn(hero: Hero, state: BattleState, rng: () => number): void`, `export function processEnemyTurn(enemy: BattleEnemy, state: BattleState, rng: () => number, tankMitigation?: number, enemyHitChance?: number): void`.

> Esta é a raiz do grafo: `turns` importa `targeting`/`resolution`/`grid`, e **ninguém importa `turns`** (exceto o barril). Garante aciclicidade.

- [ ] **Step 1: Verificar quais símbolos de skillEffects/personalityEffects/enemySkillEffects o corpo usa**

Run: `grep -nE "executePreAttackSkills|onHeroDamagedSkills|onHeroDeathSkills|onRogueHitSkills|getShieldReduction|applyPersonalityOnHit|applyProtectorShield|applyEnemyPassiveSkills|executeEnemyPreAttackSkills|onEnemyHitSkills|onEnemyDamagedSkills" src/utils/battleEngine.ts`
Expected: lista de usos dentro de `executeClassAbility`/`processHeroTurn`/`processEnemyTurn`. Confirma exatamente quais importar (os imports de `battleEngine.ts:14-16` são a referência — copiar só os usados em turns).

- [ ] **Step 2: Criar `src/utils/battle/turns.ts`**

Mover `executeClassAbility` (448-510), `processHeroTurn` (515-671), `processEnemyTurn` (676-790). Trocar todo `this.selectTarget` → `selectTarget`, `this.findMovePath` → `findMovePath`, `this.calculateAttack` → `calculateAttack`, `this.executeClassAbility` → `executeClassAbility`. Corpo idêntico exceto essas substituições de `this.`:

```ts
import { Hero } from '../../types';
import { GameMath } from '../gameMath';
import {
  executePreAttackSkills,
  onHeroDamagedSkills,
  onHeroDeathSkills,
  onRogueHitSkills,
  getShieldReduction,
} from '../skillEffects';
import { applyPersonalityOnHit, applyProtectorShield } from '../personalityEffects';
import {
  applyEnemyPassiveSkills,
  executeEnemyPreAttackSkills,
  onEnemyHitSkills,
  onEnemyDamagedSkills,
} from '../enemySkillEffects';
import { BattleState, BattleEnemy } from './types';
import { selectTarget } from './targeting';
import { calculateAttack } from './resolution';
import { findMovePath } from './grid';

/**
 * Executa uma habilidade de classe específica antes do turno normal (cura do
 * Healer + AoE Bastião). Retorna true se consumiu o turno.
 */
export function executeClassAbility(hero: Hero, state: BattleState): boolean {
  if (hero.classId === 'HEALER') {
    const mostInjured = [...state.heroes]
      .filter(h => h.id !== hero.id && h.hpCurrent > 0 && h.hpCurrent < h.hpMax)
      .sort((a, b) => (a.hpCurrent / a.hpMax) - (b.hpCurrent / b.hpMax))[0];

    if (mostInjured && (mostInjured.hpCurrent / mostInjured.hpMax) < 0.7) {
      const healAmount = Math.max(1, Math.floor(hero.mp * 0.8));
      const prevHp = mostInjured.hpCurrent;
      mostInjured.hpCurrent = Math.min(mostInjured.hpMax, mostInjured.hpCurrent + healAmount);
      const actualHeal = mostInjured.hpCurrent - prevHp;

      const healTxt = `${hero.name} curou ${mostInjured.name} em ${actualHeal} HP`;
      state.log.push(healTxt);
      state.actions.push({
        round: state.rounds,
        actorType: 'hero',
        actorId: hero.id,
        actorName: hero.name,
        actionType: 'heal',
        targetId: mostInjured.id,
        amount: actualHeal,
        text: healTxt,
      });

      if (state.flags['bastion_armed']) {
        const centerPos = state.heroPositions[mostInjured.id];
        if (centerPos !== undefined) {
          for (const ally of state.heroes) {
            if (ally.id === mostInjured.id || ally.hpCurrent <= 0) continue;
            const allyPos = state.heroPositions[ally.id];
            if (allyPos === undefined) continue;
            if (GameMath.getHexDistance(centerPos, allyPos) <= 2) {
              const prev = ally.hpCurrent;
              ally.hpCurrent = Math.min(ally.hpMax, ally.hpCurrent + healAmount);
              const heal = ally.hpCurrent - prev;
              if (heal > 0) {
                const t = `${hero.name} curou ${ally.name} em ${heal} HP (Bastião)`;
                state.log.push(t);
                state.actions.push({
                  round: state.rounds,
                  actorType: 'hero',
                  actorId: hero.id,
                  actorName: hero.name,
                  actionType: 'heal',
                  targetId: ally.id,
                  amount: heal,
                  text: t,
                });
              }
            }
          }
        }
        delete state.flags['bastion_armed'];
      }

      state.handlers.onHealApplied(state, hero, mostInjured, actualHeal);
      return true;
    }
  }
  return false;
}

/**
 * Processa o turno completo de um herói.
 */
export function processHeroTurn(hero: Hero, state: BattleState, rng: () => number) {
  if (hero.hpCurrent <= 0) return;

  applyProtectorShield(hero, state);

  const aliveEnemies = state.enemies.filter(e => e.hp > 0);
  if (aliveEnemies.length === 0) return;

  if (executeClassAbility(hero, state)) return;

  const preTarget = aliveEnemies.length > 0
    ? selectTarget(hero, state.heroPositions[hero.id] ?? 45, aliveEnemies, rng, {
        lastAttackerId: state.lastAttacker[hero.id],
      })
    : undefined;
  if (executePreAttackSkills(hero, preTarget, state, rng)) return;

  const getOccupied = () => new Set([...Object.values(state.heroPositions), ...Object.values(state.enemyPositions)]);
  const getAlliesInDanger = () => state.heroes.filter(h => h.hpCurrent / h.hpMax < 0.3).map(h => h.id);

  const currentPos = state.heroPositions[hero.id] ?? 45;
  const initialTarget = selectTarget(hero, currentPos, aliveEnemies, rng, {
    lastAttackerId: state.lastAttacker[hero.id],
    alliesInDanger: getAlliesInDanger(),
    threats: state.threats
  });

  if (initialTarget) {
    const targetPos = state.enemyPositions[initialTarget.id];
    const dist = GameMath.getHexDistance(currentPos, targetPos);
    const initialBuffs = state.buffs[hero.id] ?? [];
    let initialRangeBonus = 0;
    for (const b of initialBuffs) {
      if (b.type === 'rangeFlat') initialRangeBonus += b.value;
    }
    const range = (hero.range ?? 1) + initialRangeBonus;

    if (dist > range) {
      const move = hero.movement ?? 2;
      const nextPos = findMovePath(currentPos, targetPos, move, getOccupied());

      if (nextPos !== currentPos) {
        const moveTxt = `${hero.name} moveu-se para a posição ${nextPos}`;
        state.log.push(moveTxt);
        state.actions.push({
          round: state.rounds,
          actorType: 'hero',
          actorId: hero.id,
          actorName: hero.name,
          actionType: 'move',
          text: moveTxt,
          fromPosition: currentPos,
          toPosition: nextPos,
        });
        state.heroPositions[hero.id] = nextPos;
      }
    }
  }

  const updatedPos = state.heroPositions[hero.id] ?? currentPos;
  const finalTarget = selectTarget(hero, updatedPos, aliveEnemies, rng, {
    lastAttackerId: state.lastAttacker[hero.id],
    alliesInDanger: getAlliesInDanger(),
    threats: state.threats
  });

  if (!finalTarget) return;

  const finalDist = GameMath.getHexDistance(updatedPos, state.enemyPositions[finalTarget.id]);
  const buffs = state.buffs[hero.id] ?? [];
  let rangeBonus = 0;
  for (const b of buffs) {
    if (b.type === 'rangeFlat') rangeBonus += b.value;
  }
  const effectiveRange = (hero.range ?? 1) + rangeBonus;

  if (finalDist <= effectiveRange) {
    const hitChance = GameMath.calcHitChance(hero.atk, 0, 1);
    const result = calculateAttack(hero, finalTarget, hitChance, 'hero', state.rounds, rng, finalDist, state);

    if (result) {
      state.actions.push(result.action);
      state.log.push(result.action.text);
      let actualHeroDmg = result.dmg;
      const enemyShield = getShieldReduction(state, finalTarget.id);
      if (enemyShield > 0) {
        actualHeroDmg = Math.max(1, Math.floor(actualHeroDmg * (1 - enemyShield)));
      }
      finalTarget.hp = Math.max(0, finalTarget.hp - actualHeroDmg);
      onEnemyDamagedSkills(finalTarget, state);

      if (actualHeroDmg > 0) {
        const didMove = updatedPos !== currentPos;
        state.lastAttacker[finalTarget.id] = hero.id;
        state.handlers.onAttackResolved(state, hero as any, finalTarget as any, actualHeroDmg, finalDist);
        if (hero.classId === 'ROGUE') {
          onRogueHitSkills(hero, finalTarget, state, rng);
        }
        const extraAttack = applyPersonalityOnHit(hero, finalTarget, state, actualHeroDmg, rng, didMove);
        if (extraAttack && finalTarget.hp <= 0) {
          const nextAlive = state.enemies.find(e => e.alive && e.id !== finalTarget.id);
          if (nextAlive) {
            const nextDist = GameMath.getHexDistance(updatedPos, state.enemyPositions[nextAlive.id]);
            if (nextDist <= effectiveRange) {
              const extraResult = calculateAttack(hero, nextAlive, 0.8, 'hero', state.rounds, rng, nextDist, state);
              if (extraResult) {
                state.actions.push(extraResult.action);
                state.log.push(extraResult.action.text);
                let extraDmg = extraResult.dmg;
                const extraShield = getShieldReduction(state, nextAlive.id);
                if (extraShield > 0) {
                  extraDmg = Math.max(1, Math.floor(extraDmg * (1 - extraShield)));
                }
                nextAlive.hp = Math.max(0, nextAlive.hp - extraDmg);
                onEnemyDamagedSkills(nextAlive, state);
                if (extraDmg > 0) {
                  state.lastAttacker[nextAlive.id] = hero.id;
                  state.handlers.onAttackResolved(state, hero as any, nextAlive as any, extraDmg, nextDist);
                  if (hero.classId === 'ROGUE') {
                    onRogueHitSkills(hero, nextAlive, state, rng);
                  }
                }
                if (nextAlive.hp <= 0) {
                  nextAlive.alive = false;
                  delete state.enemyPositions[nextAlive.id];
                }
              }
            }
          }
        }
      }

      if (finalTarget.hp <= 0) {
        finalTarget.alive = false;
        delete state.enemyPositions[finalTarget.id];
        const defeatTxt = `${finalTarget.id} foi derrotado!`;
        state.log.push(defeatTxt);
        state.actions.push({
          round: state.rounds,
          actorType: 'hero',
          actorId: hero.id,
          actorName: hero.name,
          actionType: 'defeat',
          targetId: finalTarget.id,
          text: defeatTxt,
        });
      }
    }
  }
}

/**
 * Processa o turno completo de um inimigo.
 */
export function processEnemyTurn(enemy: BattleEnemy, state: BattleState, rng: () => number, tankMitigation: number = 0, enemyHitChance: number = 0.8) {
  if (enemy.hp <= 0) return;
  applyEnemyPassiveSkills(enemy, state);

  const aliveHeroes = state.heroes.filter(h => h.hpCurrent > 0);
  if (aliveHeroes.length === 0) return;

  const getOccupied = () => new Set([...Object.values(state.heroPositions), ...Object.values(state.enemyPositions)]);
  const getEnemiesInDanger = () => state.enemies.filter(e => e.hp / e.maxHp < 0.3).map(e => e.id);

  const modifyScore = (candidate: Hero, baseScore: number) =>
    state.handlers.modifyTargetScore(state, enemy, candidate, baseScore);

  const currentPos = state.enemyPositions[enemy.id] ?? 0;
  const initialTarget = selectTarget(enemy, currentPos, aliveHeroes, rng, {
    lastAttackerId: state.lastAttacker[enemy.id],
    alliesInDanger: getEnemiesInDanger(),
    modifyScore,
  });

  if (initialTarget) {
    const targetPos = state.heroPositions[initialTarget.id] ?? 45;
    const dist = GameMath.getHexDistance(currentPos, targetPos);
    const range = enemy.range ?? 1;

    if (dist > range) {
      const move = enemy.movement ?? 2;
      const nextPos = findMovePath(currentPos, targetPos, move, getOccupied());

      if (nextPos !== currentPos) {
        const moveTxt = `${enemy.id} moveu-se para a posição ${nextPos}`;
        state.log.push(moveTxt);
        state.actions.push({
          round: state.rounds,
          actorType: 'enemy',
          actorId: enemy.id,
          actorName: enemy.id,
          actionType: 'move',
          text: moveTxt,
          fromPosition: currentPos,
          toPosition: nextPos,
        });
        state.enemyPositions[enemy.id] = nextPos;
      }
    }
  }

  const updatedPos = state.enemyPositions[enemy.id] ?? currentPos;
  const finalTarget = selectTarget(enemy, updatedPos, aliveHeroes, rng, {
    lastAttackerId: state.lastAttacker[enemy.id],
    alliesInDanger: getEnemiesInDanger(),
    modifyScore,
  });

  if (!finalTarget) return;

  const finalDist = GameMath.getHexDistance(updatedPos, state.heroPositions[finalTarget.id]);
  const finalRange = enemy.range ?? 1;

  if (executeEnemyPreAttackSkills(enemy, finalTarget, state, rng())) return;

  if (finalDist <= finalRange) {
    const result = calculateAttack(enemy, finalTarget, enemyHitChance, 'enemy', state.rounds, rng, finalDist, state);

    if (result) {
      let finalDmg = result.dmg;
      if (finalTarget.classId !== 'TANK' && tankMitigation > 0) {
        finalDmg = Math.max(1, Math.floor(finalDmg * (1 - tankMitigation)));
        result.action.amount = finalDmg;
        result.action.text = `${enemy.id} causou ${finalDmg} de dano em ${finalTarget.name} (Reduzido por Tank)`;
      }

      const shieldReduction = getShieldReduction(state, finalTarget.id);
      if (shieldReduction > 0) {
        finalDmg = Math.max(1, Math.floor(finalDmg * (1 - shieldReduction)));
        result.action.amount = finalDmg;
        result.action.text += ` (Escudo: -${Math.round(shieldReduction * 100)}%)`;
      }

      state.actions.push(result.action);
      state.log.push(result.action.text);
      finalTarget.hpCurrent = Math.max(0, finalTarget.hpCurrent - finalDmg);

      state.handlers.onHeroDamaged(state, finalTarget, finalTarget.hpCurrent);
      onHeroDamagedSkills(finalTarget, state);
      if (finalDmg > 0) {
        state.handlers.onAttackResolved(state, enemy as any, finalTarget as any, finalDmg, finalDist);
        onEnemyHitSkills(enemy, finalTarget, state, rng());
        state.lastAttacker[finalTarget.id] = enemy.id;
        state.threats[enemy.id] = finalTarget.id;
      }

      if (finalTarget.hpCurrent <= 0) {
        onHeroDeathSkills(finalTarget, state);
        delete state.heroPositions[finalTarget.id];
        const incapTxt = `${finalTarget.name} está incapacitado!`;
        state.log.push(incapTxt);
        state.actions.push({
          round: state.rounds,
          actorType: 'enemy',
          actorId: enemy.id,
          actorName: enemy.id,
          actionType: 'defeat',
          targetId: finalTarget.id,
          text: incapTxt,
        });
      }
    }
  }
}
```

> **Importante:** `processDoTBuffs` e `processEnemyRegenBuffs` (importados em `battleEngine.ts:14,16`) **não** são usados pelos 3 métodos de turno — eles são chamados por `battleSim.ts:59,7,8`, não pelo engine. Não importar em `turns.ts`. Confirmar com o grep do Step 1.

- [ ] **Step 3: Transformar `battleEngine.ts` no barril final**

Substituir **todo** o conteúdo de `src/utils/battleEngine.ts` por:

```ts
export type {
  SynergyId,
  BuffType,
  Buff,
  BattleEnemy,
  SynergyHandlers,
  BattleState,
} from './battle/types';

import { createEnemies, findMovePath } from './battle/grid';
import { calculateAttack, cleanExpiredBuffs } from './battle/resolution';
import { selectTarget } from './battle/targeting';
import { initializeBattle } from './battle/setup';
import { executeClassAbility, processHeroTurn, processEnemyTurn } from './battle/turns';

/**
 * Fachada do motor de batalha. Mantém a forma pública `BattleEngine.metodo(...)`
 * consumida por battleSim.ts, missionHandler.ts, missionTickHandler.ts e a suíte.
 * A lógica vive nos módulos coesos em ./battle/*.
 */
export const BattleEngine = {
  createEnemies,
  initializeBattle,
  cleanExpiredBuffs,
  findMovePath,
  selectTarget,
  calculateAttack,
  executeClassAbility,
  processHeroTurn,
  processEnemyTurn,
};
```

- [ ] **Step 4: Type-check (call sites externos inalterados)**

Run: `npx tsc --noEmit`
Expected: 0 erros. `battleSim.ts` (`BattleEngine.initializeBattle/cleanExpiredBuffs/processHeroTurn/processEnemyTurn`), `missionHandler.ts` e `missionTickHandler.ts` (`BattleEngine.createEnemies`) resolvem pelo barril.

- [ ] **Step 5: Suíte de battle + golden + suíte completa**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/battleEngine.test.ts src/__tests__/utils/battleEngine.advanced.test.ts src/__tests__/utils/battleSim.test.ts src/__tests__/utils/battleSim.edgecases.test.ts src/__tests__/utils/battleEngine.golden.test.ts`
Expected: PASS, `0 written` no golden (igualdade byte-a-byte do outcome por seed). **Se o golden falhar, a modularização introduziu divergência — investigar com systematic-debugging, NÃO atualizar o snapshot com `-u`.**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand --testPathIgnorePatterns '/node_modules/' '/dist/' '/.worktrees/' 'gameContext.offline.test.tsx'`
Expected: PASS — 63 suites, **443 testes** (440 da Task 5 + 3 do golden da Task 6). 0 vermelhos.

- [ ] **Step 6: Confirmar barril ≤ 60 LOC e ≥ 5 arquivos em battle/**

Run: `wc -l src/utils/battleEngine.ts && ls src/utils/battle/`
Expected: `battleEngine.ts` **≤ 60 LOC**; `battle/` contém `types.ts grid.ts targeting.ts resolution.ts setup.ts turns.ts` (6 arquivos).

- [ ] **Step 7: Confirmar call sites de produção inalterados**

Run: `grep -rn "BattleEngine\.createEnemies(" src --include=*.ts | grep -v __tests__ | grep -v .worktrees`
Expected: **3** linhas — `missionHandler.ts`, `missionHandler.ts` (linhas 103 e 235) e `missionTickHandler.ts` (createEnemies do loop, antes em tickHandler.ts:322).

- [ ] **Step 8: Commit**

```bash
git add src/utils/battle/turns.ts src/utils/battleEngine.ts
git commit -m "refactor(battle): extrair turnos para battle/turns.ts; battleEngine vira fachada (barril)"
```

---

## Task 13: Smoke no browser e verificação final

**Files:** nenhum arquivo de código alterado (validação de runtime + checagem dos critérios de aceitação).

**Interfaces:**
- Consumes: tudo das Tasks 1-12.
- Produces: evidência de que o barril não quebrou os call sites de `BattleEngine.*` em runtime (não só no tsc) e que todos os critérios de aceitação do spec batem.

- [ ] **Step 1: Suíte completa final + type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand --testPathIgnorePatterns '/node_modules/' '/dist/' '/.worktrees/' 'gameContext.offline.test.tsx'`
Expected: PASS — 63 suites, 443 testes, 0 vermelhos. (425 baseline + 2+2+2+3+6+3 = 18 novos.)

- [ ] **Step 2: Conferir todos os critérios de aceitação do spec via comandos**

```bash
echo "=== AC3: tickHandler <= 260 ==="; wc -l src/context/tickHandler.ts
echo "=== AC6: barril <= 60 + >=5 arquivos battle/ ==="; wc -l src/utils/battleEngine.ts; ls src/utils/battle/ | wc -l
echo "=== AC4: novos módulos existem ==="; ls src/context/missionTickHandler.ts src/context/progressTrackers.ts src/context/bossTemplate.ts
echo "=== AC5: 0 adaptadores de boss fora de bossTemplate.ts ==="; grep -rnE "minHeroes: boss\.minHeroes" src/context
echo "=== AC7: 3 call sites createEnemies em produção ==="; grep -rn "BattleEngine\.createEnemies(" src --include=*.ts | grep -v __tests__ | grep -v .worktrees
```

Expected:
- AC3: ≤ 260.
- AC6: ≤ 60; `6`.
- AC4: as 3 paths listadas (sem erro de "No such file").
- AC5: **só** `src/context/bossTemplate.ts`.
- AC7: exatamente **3** linhas.

- [ ] **Step 3: Iniciar o dev server web (Expo) em background**

```bash
pkill -f "expo start" 2>/dev/null; sleep 1
nohup npx expo start --web --port 8081 > /tmp/expo-refac.log 2>&1 &
disown
```

Aguardar o bundle: monitorar `/tmp/expo-refac.log` até aparecer `Web is waiting on http://localhost:8081` (ou linha equivalente de "Bundled"). Não declarar pronto antes disso.

- [ ] **Step 4: Smoke do fluxo de combate no browser (Playwright MCP)**

Validação concreta (substitui o teste unit nesta task de runtime):
1. Navegar para `http://localhost:8081`.
2. Recrutar/usar heróis disponíveis e **iniciar 1 missão** (a tela de Missões).
3. Aguardar a animação de batalha rodar até o `MissionResultModal` aparecer.
4. **Tirar screenshot** do `MissionResultModal` mostrando resultado e gold creditado (`gold > 0` numa vitória).

Critério de aprovação: o modal de resultado aparece com gold creditado e **sem** erro de console do tipo `undefined is not a function` / `BattleEngine.X is not a function`. Isso confirma que o `this.` → import direto (Task 12) não quebrou os call sites em runtime.

Se a UI travar ou o console acusar erro de `BattleEngine`, **parar** e usar systematic-debugging — não fechar a task.

- [ ] **Step 5: Encerrar o dev server**

```bash
pkill -f "expo start"
```

- [ ] **Step 6: Commit de encerramento (se houver algo pendente) e push**

```bash
git status
git add -A
git commit -m "chore(refatoracao-habilitadora): refatoração comportamento-preservante completa (SPEC 6)" || echo "nada a commitar"
git push
```

> Observação: as Tasks 1-12 já commitaram suas unidades. Este Step só captura qualquer arquivo solto (ex.: snapshot regenerado por engano) e empurra a branch `feat/refatoracao-habilitadora`.

---

## Dependências e notas de execução

- **Depende de SPEC 1** (Estabilização Técnica & Boot Mobile): a "baseline verde idêntica" que guarda esta refatoração pressupõe `tsc` em 0 erros e a suíte limpa com `.worktrees/` ignorado. Hoje a config padrão do jest **não** ignora `.worktrees/` e há 1 suite quebrada vinda de worktree — por isso **todos os comandos de suíte deste plano usam o `--testPathIgnorePatterns` explícito** com `'/.worktrees/'`. Se SPEC 1 já tiver ajustado `jest.unit.config.js` para ignorar `.worktrees/`, o flag extra vira redundante (inofensivo).
- **Destrava SPEC 4** (Balance & Economia): `battle/targeting.ts` e `battle/resolution.ts` isolados permitem instrumentar mira e dano sem importar o monólito; `ProcessMissionsResult` tipado facilita harness de simulação. Não é gate de SPEC 4, é acelerador.
- **Worktree:** executar em `.worktrees/refatoracao-habilitadora` na branch `feat/refatoracao-habilitadora` (convenção do projeto). Cada Task é independente e reversível.
- **Ordem inviolável:** Task 6 (snapshot golden) **antes** de qualquer mudança em `battleEngine.ts` (Tasks 7-12) — o snapshot tem de ser gravado contra o código monolítico.
- **Regra de ouro da modularização:** se o golden falhar em qualquer Task 7-12, é bug da extração (provavelmente `this.` não convertido). Reverter o passo e converter `this.X` → import direto método a método. **Nunca** `jest -u` para "consertar" o snapshot.

---

*Gerado em 2026-06-20. Plano executável de SPEC 6 (Refatoração Habilitadora). Comportamento-preservante: nenhuma regra de jogo, balanço ou número de saída é alterado.*
