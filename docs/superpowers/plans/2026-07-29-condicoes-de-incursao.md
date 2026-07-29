# Condições de Incursão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada missão passa a carregar condições que mudam a luta e a recompensa, redefinidas a cada 5 execuções daquela missão.

**Architecture:** Derivar, não persistir. O save guarda só `worldSeed` e `missionRuns[templateId]`; as condições saem de função pura de `(worldSeed, templateId, bloco, difficulty)`. Os três caminhos que compõem combate (envio, rearme do loop, offline) chamam a mesma derivação e a mesma `aplicarCondicoes`, então online e offline não têm por onde divergir.

**Tech Stack:** TypeScript, React Native (Expo), Jest + ts-jest, `@testing-library/react-native`.

## Global Constraints

- `RUNS_PER_BLOCK = 5`.
- Zero a duas condições por bloco; "sem condição" é resultado legítimo do sorteio.
- Nenhuma condição mexe em stat de herói. Só campo de batalha e inimigos.
- Nada de `Math.random` nem `Date.now()` na derivação — funções puras, reprodutíveis.
- Boss semanal fora do escopo (`isWeeklyBoss` não recebe condições).
- Multiplicador da condição incide sobre o `reward` **antes** de `computeFinalGold`.
- pt-BR em nomes visíveis ao jogador; código e identificadores em inglês seguem o padrão do repo.
- Rodar `npx tsc --noEmit` e `./node_modules/.bin/jest --config jest.unit.config.js --runInBand` antes de cada commit.

---

### Task 1: Estado persistido e migração v15

**Files:**
- Modify: `src/types/index.ts` (interface `GameState`)
- Modify: `src/services/storage.ts:6` (`CURRENT_VERSION`), objeto `migrations`
- Modify: `src/context/gameReducer.ts` (`initialGameState`)
- Test: `src/__tests__/services/storage.conditions-migration.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `GameState.worldSeed: number`, `GameState.missionRuns: Record<string, number>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/services/storage.conditions-migration.test.ts
import { applyMigrationsForTest } from '../../services/storage';

test('save v14 ganha worldSeed derivado do 1º herói e missionRuns vazio', () => {
  const old: any = {
    _version: 14, gold: 7,
    heroes: [{ id: 'abc-123', hpMax: 10 }],
    lastSavedAt: 111,
  };
  const migrated = applyMigrationsForTest(old);
  expect(migrated._version).toBe(15);
  expect(typeof migrated.worldSeed).toBe('number');
  expect(migrated.worldSeed).toBeGreaterThan(0);
  expect(migrated.missionRuns).toEqual({});
});

test('worldSeed é estável: migrar duas vezes o mesmo save dá o mesmo valor', () => {
  const make = () => ({ _version: 14, gold: 7, heroes: [{ id: 'abc-123', hpMax: 10 }], lastSavedAt: 111 } as any);
  expect(applyMigrationsForTest(make()).worldSeed).toBe(applyMigrationsForTest(make()).worldSeed);
});

test('save sem heróis cai em lastSavedAt e ainda produz seed válido', () => {
  const migrated = applyMigrationsForTest({ _version: 14, gold: 0, heroes: [], lastSavedAt: 999 } as any);
  expect(migrated.worldSeed).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/services/storage.conditions-migration.test.ts`
Expected: FAIL — `applyMigrationsForTest` não é exportado.

- [ ] **Step 3: Write minimal implementation**

Em `src/types/index.ts`, dentro de `interface GameState`:

```ts
  /** Semente estável da guilda — alimenta a derivação de condições de incursão. */
  worldSeed?: number;
  /** templateId -> execuções concluídas. Define o bloco de condições vigente. */
  missionRuns?: Record<string, number>;
```

Em `src/services/storage.ts`, subir `CURRENT_VERSION` para `15`, exportar o helper de teste e adicionar a migração:

```ts
export const CURRENT_VERSION = 15; // Incremented for migrations

/** Hash estável de string -> inteiro positivo. Determinístico entre processos. */
function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1; // nunca 0: seed 0 degenera o rng
}

// dentro do objeto `migrations`:
  15: (data) => {
    // Semente da guilda: id do herói semeado é único e nunca troca; sem heróis, lastSavedAt.
    const base = data?.heroes?.[0]?.id ?? String(data?.lastSavedAt ?? 1);
    data.worldSeed = data.worldSeed ?? stableHash(String(base));
    data.missionRuns = data.missionRuns ?? {};
    return data;
  },

/** Exposto só para teste de migração — produção usa load(). */
export const applyMigrationsForTest = applyMigrations;
```

Em `src/context/gameReducer.ts`, no `initialGameState`:

```ts
  worldSeed: Math.floor(Math.random() * 2 ** 31) + 1,
  missionRuns: {},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/services/storage.conditions-migration.test.ts`
Expected: PASS (3 testes)

- [ ] **Step 5: Verificar que os testes de migração antigos continuam verdes**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/services/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/services/storage.ts src/context/gameReducer.ts src/__tests__/services/storage.conditions-migration.test.ts
git commit -m "feat(condicoes): worldSeed e missionRuns no save (migração v15)

Semente estável por guilda é o que permite derivar as condições em vez de
persistir — online e offline chegam ao mesmo resultado sem guardar nada."
```

---

### Task 2: Pool de condições e derivação pura

**Files:**
- Create: `src/constants/missionConditions.ts`
- Create: `src/utils/missionConditions.ts`
- Test: `src/__tests__/utils/missionConditions.test.ts`

**Interfaces:**
- Consumes: `GameState.worldSeed` (Task 1), `ENEMY_SKILL_POOL` de `src/constants/enemySkills.ts`.
- Produces:
  - `RUNS_PER_BLOCK: number`
  - `MissionCondition { id: string; name: string; icon: IconName; description: string; rewardMultiplier: number; minDifficulty: number; effect: ConditionEffect }`
  - `CONDITION_POOL: MissionCondition[]`
  - `blocoDe(runs: number): number`
  - `condicoesDe(worldSeed: number, templateId: string, bloco: number, difficulty: number): MissionCondition[]`
  - `multiplicadorDe(condicoes: MissionCondition[]): number`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/utils/missionConditions.test.ts
import { blocoDe, condicoesDe, multiplicadorDe, RUNS_PER_BLOCK } from '../../utils/missionConditions';
import { CONDITION_POOL, MAX_CONDITION_MULTIPLIER } from '../../constants/missionConditions';

describe('blocoDe', () => {
  test('as 5 primeiras execuções são o bloco 0', () => {
    expect(RUNS_PER_BLOCK).toBe(5);
    expect(blocoDe(0)).toBe(0);
    expect(blocoDe(4)).toBe(0);
  });

  test('a 6ª execução vira o bloco 1', () => {
    expect(blocoDe(5)).toBe(1);
    expect(blocoDe(24)).toBe(4);
  });
});

describe('condicoesDe', () => {
  test('mesmas entradas produzem exatamente as mesmas condições', () => {
    const a = condicoesDe(12345, 'mission_3', 2, 3);
    const b = condicoesDe(12345, 'mission_3', 2, 3);
    expect(a.map(c => c.id)).toEqual(b.map(c => c.id));
  });

  test('bloco diferente muda o sorteio ao menos uma vez em 20 blocos', () => {
    const seqs = Array.from({ length: 20 }, (_, i) => condicoesDe(12345, 'mission_3', i, 3).map(c => c.id).join('+'));
    expect(new Set(seqs).size).toBeGreaterThan(1);
  });

  test('guildas diferentes veem rotações diferentes', () => {
    const seqsA = Array.from({ length: 20 }, (_, i) => condicoesDe(111, 'mission_3', i, 3).map(c => c.id).join('+'));
    const seqsB = Array.from({ length: 20 }, (_, i) => condicoesDe(222, 'mission_3', i, 3).map(c => c.id).join('+'));
    expect(seqsA).not.toEqual(seqsB);
  });

  test('nunca passa de 2 condições', () => {
    for (let i = 0; i < 50; i++) {
      expect(condicoesDe(999, 'mission_5', i, 5).length).toBeLessThanOrEqual(2);
    }
  });

  test('respeita minDifficulty: missão difficulty 1 nunca recebe condição de tier alto', () => {
    for (let i = 0; i < 50; i++) {
      for (const c of condicoesDe(999, 'mission_1', i, 1)) {
        expect(c.minDifficulty).toBeLessThanOrEqual(1);
      }
    }
  });

  test('"sem condição" acontece: em 50 blocos ao menos um vem vazio', () => {
    const vazios = Array.from({ length: 50 }, (_, i) => condicoesDe(4242, 'mission_4', i, 4)).filter(cs => cs.length === 0);
    expect(vazios.length).toBeGreaterThan(0);
  });
});

describe('multiplicadorDe', () => {
  test('sem condição o multiplicador é 1', () => {
    expect(multiplicadorDe([])).toBe(1);
  });

  test('duas condições multiplicam, mas o teto segura', () => {
    const fortes = [...CONDITION_POOL].sort((a, b) => b.rewardMultiplier - a.rewardMultiplier).slice(0, 2);
    expect(multiplicadorDe(fortes)).toBeLessThanOrEqual(MAX_CONDITION_MULTIPLIER);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/missionConditions.test.ts`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/constants/missionConditions.ts
import { IconName } from '../components/ui/Icon';

export type ConditionEffect =
  | { kind: 'ambush' }                          // inimigos começam adjacentes
  | { kind: 'range'; delta: number }            // alcance dos inimigos
  | { kind: 'movement'; delta: number }         // movimento dos inimigos
  | { kind: 'heroRange'; delta: number }        // alcance dos heróis RANGED
  | { kind: 'extraEnemy' }                      // duplica um inimigo
  | { kind: 'elite'; hpFactor: number }         // um inimigo com mais HP
  | { kind: 'veteran' };                        // +1 na dificuldade do encontro (mais skills de inimigo)

export interface MissionCondition {
  id: string;
  name: string;
  icon: IconName;
  description: string;
  rewardMultiplier: number;
  minDifficulty: number;
  effect: ConditionEffect;
}

/** Teto do produto dos multiplicadores — duas condições fortes não podem explodir a economia. */
export const MAX_CONDITION_MULTIPLIER = 1.8;

export const CONDITION_POOL: MissionCondition[] = [
  { id: 'AMBUSH',    name: 'Emboscada',    icon: 'sword',  description: 'Os inimigos já estão em cima de você.',      rewardMultiplier: 1.25, minDifficulty: 1, effect: { kind: 'ambush' } },
  { id: 'HIGHGROUND',name: 'Terreno alto', icon: 'castle', description: 'Seus arqueiros enxergam mais longe.',        rewardMultiplier: 0.95, minDifficulty: 1, effect: { kind: 'heroRange', delta: 1 } },
  { id: 'FOG',       name: 'Névoa densa',  icon: 'potion', description: 'Ninguém enxerga além do braço.',             rewardMultiplier: 1.15, minDifficulty: 2, effect: { kind: 'range', delta: -1 } },
  { id: 'MUD',       name: 'Lamaçal',      icon: 'map-marker-path', description: 'O chão puxa cada passo.',           rewardMultiplier: 1.10, minDifficulty: 2, effect: { kind: 'movement', delta: -1 } },
  { id: 'HORDE',     name: 'Bando',        icon: 'shield', description: 'Vieram em maior número.',                    rewardMultiplier: 1.30, minDifficulty: 2, effect: { kind: 'extraEnemy' } },
  { id: 'ELITE',     name: 'Elite',        icon: 'trophy', description: 'Um deles é bem mais duro de matar.',         rewardMultiplier: 1.25, minDifficulty: 3, effect: { kind: 'elite', hpFactor: 1.5 } },
  { id: 'VETERAN',   name: 'Veteranos',    icon: 'anvil',  description: 'Esse bando já viu combate — luta com mais truques.', rewardMultiplier: 1.20, minDifficulty: 3, effect: { kind: 'veteran' } },
];
```

```ts
// src/utils/missionConditions.ts
import { makeRng } from './math';
import { CONDITION_POOL, MAX_CONDITION_MULTIPLIER, MissionCondition } from '../constants/missionConditions';

export const RUNS_PER_BLOCK = 5;

export function blocoDe(runs: number): number {
  return Math.floor(Math.max(0, runs) / RUNS_PER_BLOCK);
}

/** Hash estável das entradas do bloco — a mesma semente em qualquer caminho. */
export function seedDoBloco(worldSeed: number, templateId: string, bloco: number): number {
  let h = (worldSeed >>> 0) || 1;
  const s = `${templateId}#${bloco}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

/**
 * Condições vigentes do bloco. Pura: mesmas entradas, mesma saída, em qualquer processo.
 * 0 a 2 condições — "sem condição" é resultado legítimo e faz as outras pesarem.
 */
export function condicoesDe(
  worldSeed: number,
  templateId: string,
  bloco: number,
  difficulty: number
): MissionCondition[] {
  const rng = makeRng(seedDoBloco(worldSeed, templateId, bloco));
  const elegiveis = CONDITION_POOL.filter((c) => c.minDifficulty <= difficulty);
  if (elegiveis.length === 0) return [];

  const r = rng();
  const quantas = r < 0.25 ? 0 : r < 0.75 ? 1 : 2;
  if (quantas === 0) return [];

  const restantes = [...elegiveis];
  const escolhidas: MissionCondition[] = [];
  for (let i = 0; i < quantas && restantes.length > 0; i++) {
    const idx = Math.floor(rng() * restantes.length) % restantes.length;
    escolhidas.push(restantes[idx]!);
    restantes.splice(idx, 1);
  }
  return escolhidas;
}

/** Produto dos multiplicadores, limitado pelo teto. */
export function multiplicadorDe(condicoes: MissionCondition[]): number {
  const produto = condicoes.reduce((acc, c) => acc * c.rewardMultiplier, 1);
  return Math.min(produto, MAX_CONDITION_MULTIPLIER);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/missionConditions.test.ts`
Expected: PASS. Se "sem condição" ou "difficulty 1" falharem, ajuste os limiares de `quantas` — não os testes.

- [ ] **Step 5: Commit**

```bash
git add src/constants/missionConditions.ts src/utils/missionConditions.ts src/__tests__/utils/missionConditions.test.ts
git commit -m "feat(condicoes): pool e derivação pura por (seed, missão, bloco)

Derivar em vez de persistir é o que garante que online e offline concordem
sem nenhum estado extra no save."
```

---

### Task 3: Aplicar condições ao template

**Files:**
- Create: `src/utils/applyConditions.ts`
- Test: `src/__tests__/utils/applyConditions.test.ts`

**Interfaces:**
- Consumes: `MissionCondition`, `ConditionEffect` (Task 2), `MissionTemplate` de `src/constants/missions.ts`, `ENEMY_SKILL_POOL` de `src/constants/enemySkills.ts`.
- Produces: `aplicarCondicoes(tpl: MissionTemplate, condicoes: MissionCondition[], seed: number): MissionTemplate`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/utils/applyConditions.test.ts
import { aplicarCondicoes } from '../../utils/applyConditions';
import { MissionTemplate } from '../../constants/missions';
import { CONDITION_POOL } from '../../constants/missionConditions';

const cond = (id: string) => CONDITION_POOL.find(c => c.id === id)!;

function tpl(): MissionTemplate {
  return {
    id: 'mission_x', name: 'Teste', minHeroes: 1, durationMs: 10_000,
    rewardMin: 10, rewardMax: 20, difficulty: 3,
    enemies: [{ hp: 10, atk: 2, mp: 0, defense: 1, crit: 1, agility: 3, count: 2, range: 2, movement: 2 }],
  };
}

test('sem condições devolve template equivalente', () => {
  const out = aplicarCondicoes(tpl(), [], 1);
  expect(out.enemies).toEqual(tpl().enemies);
});

test('não muta o template original', () => {
  const original = tpl();
  aplicarCondicoes(original, [cond('HORDE'), cond('ELITE')], 1);
  expect(original.enemies![0]!.count).toBe(2);
  expect(original.enemies![0]!.hp).toBe(10);
});

test('Bando adiciona um inimigo a mais', () => {
  const antes = tpl().enemies!.reduce((n, e) => n + (e.count ?? 1), 0);
  const depois = aplicarCondicoes(tpl(), [cond('HORDE')], 1).enemies!.reduce((n, e) => n + (e.count ?? 1), 0);
  expect(depois).toBe(antes + 1);
});

test('Elite deixa um inimigo com 50% mais HP', () => {
  const out = aplicarCondicoes(tpl(), [cond('ELITE')], 1);
  const hps = out.enemies!.map(e => e.hp);
  expect(Math.max(...hps)).toBe(15);
});

test('Névoa reduz o alcance dos inimigos, nunca abaixo de 1', () => {
  const out = aplicarCondicoes(tpl(), [cond('FOG')], 1);
  expect(out.enemies!.every(e => (e.range ?? 1) >= 1)).toBe(true);
  expect(out.enemies![0]!.range).toBe(1);
});

test('Lamaçal reduz movimento, nunca abaixo de 1', () => {
  const out = aplicarCondicoes(tpl(), [cond('MUD')], 1);
  expect(out.enemies![0]!.movement).toBe(1);
});

test('mesma seed escolhe o mesmo inimigo para Elite', () => {
  const a = aplicarCondicoes(tpl(), [cond('ELITE')], 77).enemies!.map(e => e.hp);
  const b = aplicarCondicoes(tpl(), [cond('ELITE')], 77).enemies!.map(e => e.hp);
  expect(a).toEqual(b);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/applyConditions.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/applyConditions.ts
import { MissionTemplate } from '../constants/missions';
import { MissionCondition } from '../constants/missionConditions';
import { makeRng } from './math';

type Enemy = NonNullable<MissionTemplate['enemies']>[number];

/**
 * Devolve uma cópia do template com as condições aplicadas.
 * Puro: nada de Math.random — o alvo de "um inimigo" sai da seed do bloco,
 * então online e offline marcam exatamente o mesmo inimigo.
 */
export function aplicarCondicoes(
  tpl: MissionTemplate,
  condicoes: MissionCondition[],
  seed: number
): MissionTemplate {
  if (condicoes.length === 0) return { ...tpl, enemies: tpl.enemies?.map((e) => ({ ...e })) };

  const rng = makeRng(seed);
  let enemies: Enemy[] = (tpl.enemies ?? []).map((e) => ({ ...e }));
  let ambush = false;
  let heroRangeDelta = 0;

  for (const c of condicoes) {
    const ef = c.effect;
    switch (ef.kind) {
      case 'ambush':
        ambush = true;
        break;
      case 'range':
        enemies = enemies.map((e) => ({ ...e, range: Math.max(1, (e.range ?? 1) + ef.delta) }));
        break;
      case 'movement':
        enemies = enemies.map((e) => ({ ...e, movement: Math.max(1, (e.movement ?? 1) + ef.delta) }));
        break;
      case 'heroRange':
        heroRangeDelta += ef.delta;
        break;
      case 'extraEnemy': {
        if (enemies.length === 0) break;
        const i = Math.floor(rng() * enemies.length) % enemies.length;
        enemies[i] = { ...enemies[i]!, count: (enemies[i]!.count ?? 1) + 1 };
        break;
      }
      case 'elite': {
        if (enemies.length === 0) break;
        const i = Math.floor(rng() * enemies.length) % enemies.length;
        const alvo = enemies[i]!;
        // separa 1 inimigo do grupo para não turbinar a horda inteira
        const restante = (alvo.count ?? 1) - 1;
        enemies[i] = { ...alvo, count: Math.max(1, restante) };
        enemies.push({ ...alvo, count: 1, hp: Math.round(alvo.hp * ef.hpFactor) });
        break;
      }
      case 'veteran':
        // assignEnemySkills(missionDifficulty, isBoss, rng) distribui skills por ENCONTRO,
        // não por inimigo — então "veterano" sobe a dificuldade do encontro em 1.
        break;
    }
  }

  return {
    ...tpl,
    enemies,
    ...(ambush ? { conditionAmbush: true } : {}),
    ...(heroRangeDelta !== 0 ? { conditionHeroRange: heroRangeDelta } : {}),
    ...(condicoes.some((c) => c.effect.kind === 'veteran')
      ? { difficulty: Math.min(6, (tpl.difficulty ?? 1) + 1) }
      : {}),
  } as MissionTemplate;
}
```

Adicionar em `src/constants/missions.ts`, na interface `MissionTemplate`:

```ts
  /** Postos por condições de incursão — o motor lê na inicialização da batalha. */
  conditionAmbush?: boolean;
  conditionHeroRange?: number;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/applyConditions.test.ts`
Expected: PASS (7 testes)

- [ ] **Step 5: Commit**

```bash
git add src/utils/applyConditions.ts src/constants/missions.ts src/__tests__/utils/applyConditions.test.ts
git commit -m "feat(condicoes): aplicar condições ao template antes do combate

Template modificado é o ponto de entrada natural: computeBattleOutcome já
recebe o template, então os três caminhos passam pela mesma transformação."
```

---

### Task 4: Motor lê `conditionAmbush` e `conditionHeroRange`

**Files:**
- Modify: `src/utils/battleEngine.ts` (ou o módulo de `src/utils/battle/*` responsável por `initializeBattle`)
- Test: `src/__tests__/utils/battle/conditionsInBattle.test.ts`

**Interfaces:**
- Consumes: `MissionTemplate.conditionAmbush`, `MissionTemplate.conditionHeroRange` (Task 3).
- Produces: comportamento observável — posições iniciais e alcance efetivo.

- [ ] **Step 1: Localizar `initializeBattle`**

Run: `grep -rn "initializeBattle" src/utils/battle*/*.ts src/utils/battleEngine.ts | head`
Anote o arquivo que monta posições iniciais de inimigos e heróis.

- [ ] **Step 2: Write the failing test**

```ts
// src/__tests__/utils/battle/conditionsInBattle.test.ts
import { computeBattleOutcome } from '../../../utils/battleSim';
import { MissionTemplate } from '../../../constants/missions';
import { Hero, HeroTask } from '../../../types';

function hero(): Hero {
  return {
    id: 'h1', name: 'H', hpMax: 40, hpCurrent: 40, atk: 8, mp: 0,
    defense: 2, crit: 5, agility: 5, currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  } as Hero;
}

function base(): MissionTemplate {
  return {
    id: 'mission_x', name: 'T', minHeroes: 1, durationMs: 10_000, rewardMin: 5, rewardMax: 5,
    difficulty: 2,
    enemies: [{ hp: 12, atk: 3, mp: 0, defense: 1, crit: 1, agility: 3, count: 1, range: 1, movement: 2 }],
  };
}

test('Emboscada encurta a batalha: contato acontece antes', () => {
  const normal = computeBattleOutcome(base(), [hero()], { seed: 42 });
  const ambush = computeBattleOutcome({ ...base(), conditionAmbush: true }, [hero()], { seed: 42 });
  expect(ambush.actions.length).toBeLessThan(normal.actions.length);
});

test('conditionHeroRange muda o desenrolar do combate com a mesma seed', () => {
  const normal = computeBattleOutcome(base(), [hero()], { seed: 7 });
  const alto = computeBattleOutcome({ ...base(), conditionHeroRange: 1 }, [hero()], { seed: 7 });
  expect(alto.actions).not.toEqual(normal.actions);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/battle/conditionsInBattle.test.ts`
Expected: FAIL — hoje as duas saídas são idênticas, porque o motor ignora os campos.

- [ ] **Step 4: Implementar no motor**

Na inicialização da batalha, depois de posicionar os inimigos:

```ts
// Emboscada: inimigos começam colados no time em vez do lado oposto do grid.
if (template.conditionAmbush) {
  posicionarInimigosAdjacentes(enemyStates, heroStates);
}
// Terreno alto: só heróis RANGED enxergam mais longe.
if (template.conditionHeroRange) {
  heroStates.forEach((h) => {
    if (h.attackType === 'RANGED') h.range = Math.max(1, h.range + template.conditionHeroRange!);
  });
}
```

`posicionarInimigosAdjacentes` mora no mesmo módulo do `initializeBattle` e é determinística — percorre as casas na ordem fixa do grid, sem `rng`, para não quebrar a reprodutibilidade por seed:

```ts
/** Emboscada: cada inimigo ocupa a 1ª casa livre vizinha ao herói mais próximo. Ordem fixa, sem rng. */
function posicionarInimigosAdjacentes(inimigos: BattleUnit[], herois: BattleUnit[]): void {
  const ocupadas = new Set(herois.map((h) => chaveDaCasa(h.position)));
  for (const inimigo of inimigos) {
    const alvo = herois[0];               // ordem estável: o time chega ordenado
    if (!alvo) break;
    const vizinhas = casasVizinhas(alvo.position);   // ordem fixa do grid hexagonal
    const livre = vizinhas.find((c) => !ocupadas.has(chaveDaCasa(c)) && dentroDoGrid(c));
    if (livre) {
      inimigo.position = livre;
      ocupadas.add(chaveDaCasa(livre));
    }
    // sem casa livre: o inimigo fica onde estava — emboscada parcial, nunca posição inválida
  }
}
```

`casasVizinhas`, `chaveDaCasa` e `dentroDoGrid` já existem no módulo de grid; se tiverem outro nome, use os do arquivo em vez de criar novos.

- [ ] **Step 5: Run test to verify it passes**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/battle/`
Expected: PASS, incluindo os testes de determinismo que já existiam.

- [ ] **Step 6: Commit**

```bash
git add src/utils/ src/__tests__/utils/battle/conditionsInBattle.test.ts
git commit -m "feat(condicoes): motor honra emboscada e alcance de terreno alto

Sem isso a condição seria só um rótulo — o combate precisa mudar de verdade."
```

---

### Task 5: Envio com condições e contador de execuções

**Files:**
- Modify: `src/context/missionHandler.ts:53` (exportar `buildBattleMission`), `:162`, `:209`
- Modify: `src/context/missionTickHandler.ts` (incrementar `missionRuns` onde credita ouro)
- Test: `src/__tests__/context/missionConditions.start.test.ts`

**Interfaces:**
- Consumes: `condicoesDe`, `blocoDe`, `seedDoBloco` (Task 2), `aplicarCondicoes` (Task 3).
- Produces: `export function buildBattleMission(...)`; `ActiveMission.conditionIds?: string[]` (registro do que valeu naquele ciclo, para o resumo).

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/context/missionConditions.start.test.ts
import { gameReducer, initialGameState } from '../../context/gameReducer';
import { condicoesDe, blocoDe } from '../../utils/missionConditions';
import { HeroTask } from '../../types';

function estado(runs: number) {
  return {
    ...initialGameState,
    worldSeed: 4242,
    missionRuns: { mission_1: runs },
    heroes: [{ ...initialGameState.heroes[0]!, currentTask: HeroTask.IDLE }],
  } as any;
}

test('missão iniciada registra as condições do bloco vigente', () => {
  const s = estado(7); // bloco 1
  const next = gameReducer(s, { type: 'START_MISSION', templateId: 'mission_1', heroIds: [s.heroes[0].id], now: 1000 } as any);
  const esperado = condicoesDe(4242, 'mission_1', blocoDe(7), 1).map(c => c.id);
  expect(next.activeMissions![0]!.conditionIds ?? []).toEqual(esperado);
});

test('boss semanal não recebe condições', () => {
  const s = estado(0);
  const next = gameReducer(s, { type: 'START_WEEKLY_BOSS', heroIds: [s.heroes[0].id], now: 1000 } as any);
  expect(next.activeMissions?.[0]?.conditionIds ?? []).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/missionConditions.start.test.ts`
Expected: FAIL — `conditionIds` não existe.

- [ ] **Step 3: Implementar**

Em `src/types/index.ts`, em `ActiveMission`:

```ts
  /** Ids das condições vigentes no ciclo — registro para o resumo, nunca fonte de verdade. */
  conditionIds?: string[];
```

Em `src/context/missionHandler.ts`, tornar `buildBattleMission` exportado e, dentro dele, antes de `computeBattleOutcome`:

```ts
const semCondicoes = params.isWeeklyBoss;
const condicoes = semCondicoes
  ? []
  : condicoesDe(
      state.worldSeed ?? 1,
      params.templateId,
      blocoDe(state.missionRuns?.[params.templateId] ?? 0),
      template.difficulty ?? 1
    );
const templateFinal = aplicarCondicoes(
  template,
  condicoes,
  seedDoBloco(state.worldSeed ?? 1, params.templateId, blocoDe(state.missionRuns?.[params.templateId] ?? 0))
);
```

Usar `templateFinal` no `computeBattleOutcome` e gravar `conditionIds: condicoes.map(c => c.id)` na `ActiveMission`.

Em `src/context/missionTickHandler.ts`, no mesmo ponto que soma `goldGained` para um ciclo concluído:

```ts
missionRuns[c.mission.templateId] = (missionRuns[c.mission.templateId] ?? 0) + 1;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/context/missionHandler.ts src/context/missionTickHandler.ts src/__tests__/context/missionConditions.start.test.ts
git commit -m "feat(condicoes): envio aplica o bloco vigente e conta execuções

O contador incrementa no mesmo ponto que credita o ouro — é a definição de
execução concluída, e garante que os dois caminhos contem igual."
```

---

### Task 6: Rearme do loop atravessa blocos

**Files:**
- Modify: `src/context/missionTickHandler.ts:242` (usar `buildBattleMission` no rearme)
- Test: `src/__tests__/context/missionConditions.loop.test.ts`

**Interfaces:**
- Consumes: `buildBattleMission` exportado (Task 5).
- Produces: nada novo.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/context/missionConditions.loop.test.ts
import { condicoesDe, blocoDe, RUNS_PER_BLOCK } from '../../utils/missionConditions';

test('um loop de 25 ciclos atravessa 5 blocos', () => {
  const blocos = new Set(Array.from({ length: 25 }, (_, i) => blocoDe(i)));
  expect(blocos.size).toBe(5);
  expect(RUNS_PER_BLOCK).toBe(5);
});

test('condições do ciclo 5 diferem do ciclo 4 em pelo menos uma missão do catálogo', () => {
  const mudou = ['mission_1','mission_2','mission_3','mission_4','mission_5','mission_6'].some((id) => {
    const a = condicoesDe(4242, id, blocoDe(4), 3).map(c => c.id).join('+');
    const b = condicoesDe(4242, id, blocoDe(5), 3).map(c => c.id).join('+');
    return a !== b;
  });
  expect(mudou).toBe(true);
});
```

Mais o teste de integração de rearme, na fixture de `src/__tests__/utils/offlineProgress.loop.test.ts`:

```ts
import { processMissions } from '../../context/missionTickHandler';
import { MISSIONS } from '../../constants/missions';
import { GameState, Hero, HeroTask, ActiveMission } from '../../types';

const M0 = MISSIONS[0]!;

function heroi(): Hero {
  return {
    id: 'h1', name: 'Herói', hpMax: 500, hpCurrent: 500, atk: 999, mp: 10,
    defense: 50, crit: 10, agility: 10, currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  } as Hero;
}

test('o ciclo que vira o bloco já roda com as condições novas', () => {
  const now = Date.now();
  const h = heroi();
  const missao: ActiveMission = {
    id: 'm1', templateId: M0.id, heroIds: ['h1'],
    startedAt: now - 1000, finishAt: now - 1, scheduledActions: [], enemiesState: [],
    precomputedOutcome: {
      reward: 100, rounds: 1, actions: [], log: [], success: true, casualties: [], enemyCasualties: 1,
    },
    loop: { mode: 'endless' },
  };
  const estado = {
    gold: 0, heroes: [h], heroesRecruited: 1, lastSavedAt: now,
    worldSeed: 4242,
    missionRuns: { [M0.id]: 4 },   // o próximo ciclo concluído vira o bloco 1
    activeMissions: [missao],
  } as GameState;

  const resultado = processMissions(estado, [h], now);

  const recriada = resultado.newActiveMissions?.[0] ?? resultado.activeMissions?.[0];
  const esperado = condicoesDe(4242, M0.id, blocoDe(5), M0.difficulty ?? 1).map((c) => c.id);
  expect(recriada?.conditionIds ?? []).toEqual(esperado);
});
```

Se o nome do campo de retorno de `processMissions` for outro, use o que o arquivo de produção devolve — o que importa é ler a `ActiveMission` recriada.

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/missionConditions.loop.test.ts`
Expected: FAIL no teste de rearme — hoje o rearme monta o combate por conta própria, sem condições.

- [ ] **Step 3: Implementar**

Substituir o bloco de rearme (`missionTickHandler.ts:225-250`) por uma chamada a `buildBattleMission`, passando o estado com `missionRuns` já incrementado — assim o ciclo seguinte enxerga o bloco novo.

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/context/missionTickHandler.ts src/__tests__/context/missionConditions.loop.test.ts
git commit -m "feat(condicoes): rearme do loop usa o mesmo montador do envio

Dois montadores de combate são duas verdades — foi assim que nasceram as seis
divergências que o loop expôs."
```

---

### Task 7: Offline recomputa na virada de bloco

**Files:**
- Modify: `src/utils/offlineProgress.ts` (laço de ciclos de loop)
- Test: `src/__tests__/utils/offlineProgress.conditions.test.ts`

**Interfaces:**
- Consumes: `condicoesDe`, `blocoDe`, `seedDoBloco` (Task 2), `aplicarCondicoes` (Task 3).
- Produces: nada novo.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/utils/offlineProgress.conditions.test.ts
import { calculateOfflineProgress } from '../../utils/offlineProgress';
import { processMissions } from '../../context/missionTickHandler';
import { MISSIONS } from '../../constants/missions';
import { computeCycleDurationMs } from '../../utils/missionLoop';
import { condicoesDe, blocoDe, multiplicadorDe } from '../../utils/missionConditions';
import { GameState, Hero, HeroTask, ActiveMission } from '../../types';

const M0 = MISSIONS[0]!;
const CICLO = computeCycleDurationMs(0);
const REWARD = 100;

function heroi(): Hero {
  return {
    id: 'h1', name: 'Herói', hpMax: 500, hpCurrent: 500, atk: 999, mp: 10,
    defense: 50, crit: 10, agility: 10, currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  } as Hero;
}

function estado(decorridoMs: number, runs: number, ciclos: number): GameState {
  const agora = Date.now();
  const missao: ActiveMission = {
    id: 'm1', templateId: M0.id, heroIds: ['h1'],
    startedAt: agora - decorridoMs, scheduledActions: [], enemiesState: [],
    precomputedOutcome: {
      reward: REWARD, rounds: 1, actions: [], log: [], success: true, casualties: [], enemyCasualties: 1,
    },
    loop: { mode: 'times', remaining: ciclos, total: ciclos },
  };
  return {
    gold: 0, heroes: [heroi()], heroesRecruited: 1,
    lastSavedAt: agora - decorridoMs,
    worldSeed: 4242, missionRuns: { [M0.id]: runs },
    activeMissions: [missao],
  } as GameState;
}

test('ouro de um loop que atravessa blocos soma o multiplicador de cada bloco', () => {
  const CICLOS = 10;
  const runsIniciais = 3;                       // bloco 0 tem 2 ciclos, depois vira
  const resumo = calculateOfflineProgress(estado(CICLO * (CICLOS + 1), runsIniciais, CICLOS))!;

  const esperado = Array.from({ length: CICLOS }, (_, i) => {
    const bloco = blocoDe(runsIniciais + i);
    const mult = multiplicadorDe(condicoesDe(4242, M0.id, bloco, M0.difficulty ?? 1));
    return Math.floor(REWARD * mult);
  }).reduce((a, b) => a + b, 0);

  expect(resumo.goldGained).toBe(esperado);
});

test('offline recomputa uma vez por bloco, não uma vez por ciclo', () => {
  const battleSim = require('../../utils/battleSim');
  const spy = jest.spyOn(battleSim, 'computeBattleOutcome');
  calculateOfflineProgress(estado(CICLO * 26, 0, 25));
  // 25 ciclos cruzam 5 blocos: 5 recomputações, não 25
  expect(spy.mock.calls.length).toBeLessThanOrEqual(5);
  spy.mockRestore();
});

test('paridade: mesmo ciclo, mesmo ouro pelos dois caminhos', () => {
  const now = Date.now();
  const h = heroi();
  const e = estado(CICLO + 1, 0, 1);
  const online = processMissions({ ...e, lastSavedAt: now }, [h], now + CICLO + 1);
  const offline = calculateOfflineProgress(e)!;
  expect(offline.goldGained).toBe(online.goldGained);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/offlineProgress.conditions.test.ts`
Expected: FAIL — hoje o offline reusa um único `precomputedOutcome` para todos os ciclos.

- [ ] **Step 3: Implementar**

No laço de ciclos do offline: manter o outcome atual enquanto o bloco não virar; ao cruzar `RUNS_PER_BLOCK`, recomputar com `aplicarCondicoes` do bloco novo. Ciclos dentro do mesmo bloco continuam reusando, como hoje.

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/`
Expected: PASS, incluindo os testes de paridade que já existiam.

- [ ] **Step 5: Commit**

```bash
git add src/utils/offlineProgress.ts src/__tests__/utils/offlineProgress.conditions.test.ts
git commit -m "fix(offline): recomputa o combate na virada de bloco

Reusar um único outcome para 25 ciclos divergiria do online exatamente no
eixo novo. Recomputar por bloco custa 5, não 25."
```

---

### Task 8: Recompensa com multiplicador da condição

**Files:**
- Modify: `src/context/missionTickHandler.ts` (onde calcula `rewardFinal`), `src/utils/offlineProgress.ts`
- Test: `src/__tests__/utils/rewards.conditions.test.ts`

**Interfaces:**
- Consumes: `multiplicadorDe` (Task 2), `computeFinalGold` de `src/utils/rewards.ts:11`.
- Produces: nada novo.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/utils/rewards.conditions.test.ts
import { computeFinalGold } from '../../utils/rewards';
import { multiplicadorDe } from '../../utils/missionConditions';
import { CONDITION_POOL } from '../../constants/missionConditions';

test('condição multiplica antes do computeFinalGold, panteão vem por cima', () => {
  const state: any = { gold: 0, heroes: [], pantheonBonuses: { goldPercent: 10, atkPercent: 0, hpPercent: 0 } };
  const horde = CONDITION_POOL.find(c => c.id === 'HORDE')!;   // 1.30
  const base = 100;
  const comCondicao = Math.floor(base * multiplicadorDe([horde]));  // 130
  expect(computeFinalGold(comCondicao, state)).toBe(143);            // 130 * 1.10
});

test('sem condição o valor é idêntico ao de hoje', () => {
  const state: any = { gold: 0, heroes: [] };
  expect(computeFinalGold(Math.floor(100 * multiplicadorDe([])), state)).toBe(100);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/rewards.conditions.test.ts`
Expected: PASS nos dois se `multiplicadorDe` já existir — nesse caso o teste serve de trava. Se falhar, o multiplicador não está sendo aplicado.

- [ ] **Step 3: Implementar nos dois caminhos**

Online (`missionTickHandler.ts`) e offline (`offlineProgress.ts`), no ponto onde hoje está `computeFinalGold(c.reward, state)`:

```ts
const condicoes = condicoesDe(/* ...bloco do ciclo... */);
const rewardComCondicao = Math.floor(c.reward * multiplicadorDe(condicoes));
goldGained += computeFinalGold(rewardComCondicao, state);
```

- [ ] **Step 4: Rodar a suíte inteira**

Run: `npx tsc --noEmit && ./node_modules/.bin/jest --config jest.unit.config.js --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/context/missionTickHandler.ts src/utils/offlineProgress.ts src/__tests__/utils/rewards.conditions.test.ts
git commit -m "feat(condicoes): multiplicador da condição antes de computeFinalGold

Condição é da missão; panteão, legado e evento continuam por cima, na ordem
já documentada em rewards.ts."
```

---

### Task 9: UI — chips no Quadro e na confirmação

**Files:**
- Create: `src/components/ConditionChips.tsx`
- Modify: `src/components/MissionListItem.tsx`, `src/components/MissionHeroSelectionModal.tsx`
- Test: `src/__tests__/components/ConditionChips.test.tsx`

**Interfaces:**
- Consumes: `condicoesDe`, `blocoDe`, `RUNS_PER_BLOCK` (Task 2), `useGame` para ler `worldSeed`/`missionRuns`.
- Produces: `<ConditionChips templateId difficulty />`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/ConditionChips.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
jest.mock('../../components/ui/Icon', () => ({ Icon: (p: any) => require('react').createElement('Icon', p) }));
import { ConditionChips } from '../../components/ConditionChips';
import { GameContext } from '../../context/GameContext';
import { initialGameState } from '../../context/gameReducer';
import { condicoesDe, blocoDe } from '../../utils/missionConditions';

function wrap(node: React.ReactNode, missionRuns: Record<string, number>) {
  return (
    <GameContext.Provider value={{
      state: { ...initialGameState, worldSeed: 4242, missionRuns } as any,
      dispatch: jest.fn(), isLoaded: true, setHeroTask: jest.fn(), recruitHero: jest.fn(),
      offlineSummary: null, clearOfflineSummary: jest.fn(), applyOfflineSummary: jest.fn(),
      advanceOnboarding: jest.fn(), skipOnboarding: jest.fn(), markHintSeen: jest.fn(), resetOnboarding: jest.fn(),
    } as any}>{node}</GameContext.Provider>
  );
}

test('mostra o nome de cada condição vigente', () => {
  const esperadas = condicoesDe(4242, 'mission_5', blocoDe(2), 5);
  const { queryByText } = render(wrap(<ConditionChips templateId="mission_5" difficulty={5} />, { mission_5: 2 }));
  for (const c of esperadas) expect(queryByText(c.name)).toBeTruthy();
});

test('mostra quantas incursões ainda valem', () => {
  const { getByText } = render(wrap(<ConditionChips templateId="mission_5" difficulty={5} />, { mission_5: 2 }));
  expect(getByText(/3 incurs/)).toBeTruthy(); // 5 - (2 % 5)
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/components/ConditionChips.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar**

```tsx
// src/components/ConditionChips.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { Icon } from './ui/Icon';
import { useGame } from '../hooks/useGame';
import { condicoesDe, blocoDe, RUNS_PER_BLOCK } from '../utils/missionConditions';

/** Condições vigentes da missão. Missão sem condição não renderiza nada — o vazio também informa. */
export function ConditionChips({ templateId, difficulty }: { templateId: string; difficulty: number }) {
  const { state } = useGame();
  const runs = state.missionRuns?.[templateId] ?? 0;
  const condicoes = condicoesDe(state.worldSeed ?? 1, templateId, blocoDe(runs), difficulty);
  if (condicoes.length === 0) return null;

  const restam = RUNS_PER_BLOCK - (runs % RUNS_PER_BLOCK);
  return (
    <View style={styles.row}>
      {condicoes.map((c) => (
        <View key={c.id} style={styles.chip}>
          <Icon name={c.icon} size={14} color={theme.colors.goldBright} />
          <Text style={styles.label}>{c.name}</Text>
        </View>
      ))}
      <Text style={styles.validade}>vale por {restam} incursões</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm, marginTop: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 2, paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm, borderWidth: 1,
    borderColor: theme.colors.borderGold, backgroundColor: theme.colors.surfaceRaised,
  },
  label: { ...theme.type.caption, color: theme.colors.textPrimary },
  validade: { ...theme.type.caption, color: theme.colors.textMuted },
});
```

Inserir `<ConditionChips templateId={mission.id} difficulty={mission.difficulty ?? 1} />` no `MissionListItem` (abaixo da linha de requisitos) e no `MissionHeroSelectionModal` (abaixo do título da missão).

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/components/`
Expected: PASS

- [ ] **Step 5: Validar no browser**

```bash
npx expo start --web --port 8081   # em background pelo runner da sessão
```
Abrir `http://localhost:8081`, ir em Missões e confirmar: chips aparecem, contagem de validade bate, missão sem condição não mostra chip órfão.

- [ ] **Step 6: Commit**

```bash
git add src/components/ConditionChips.tsx src/components/MissionListItem.tsx src/components/MissionHeroSelectionModal.tsx src/__tests__/components/ConditionChips.test.tsx
git commit -m "feat(condicoes): chips no Quadro e na confirmação de envio

A escolha só é informada se o jogador vê a condição antes de apertar ENVIAR."
```

---

### Task 10: Resumo do loop por bloco

**Files:**
- Modify: `src/components/LoopSummaryModal.tsx`, `src/utils/missionLoop.ts` (`accumulateTally`)
- Modify: `src/types/index.ts` (`LoopTally`)
- Test: `src/__tests__/utils/missionLoop.conditions.test.ts`

**Interfaces:**
- Consumes: `ActiveMission.conditionIds` (Task 5), `CONDITION_POOL` (Task 2).
- Produces: `LoopTally.byCondition?: Record<string, number>` — quantos ciclos rodaram sob cada condição.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/utils/missionLoop.conditions.test.ts
import { accumulateTally } from '../../utils/missionLoop';

test('acumula quantos ciclos rodaram sob cada condição', () => {
  let tally = accumulateTally(undefined, { gold: 10, materials: {}, casualties: [], conditionIds: ['FOG'] } as any);
  tally = accumulateTally(tally, { gold: 10, materials: {}, casualties: [], conditionIds: ['FOG'] } as any);
  tally = accumulateTally(tally, { gold: 10, materials: {}, casualties: [], conditionIds: ['HORDE'] } as any);
  expect(tally.byCondition).toEqual({ FOG: 2, HORDE: 1 });
});

test('ciclo sem condição não polui o mapa', () => {
  const tally = accumulateTally(undefined, { gold: 5, materials: {}, casualties: [], conditionIds: [] } as any);
  expect(tally.byCondition ?? {}).toEqual({});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/missionLoop.conditions.test.ts`
Expected: FAIL — `byCondition` não existe.

- [ ] **Step 3: Implementar**

Adicionar `byCondition?: Record<string, number>` em `LoopTally`, alimentar em `accumulateTally` a partir de `cycle.conditionIds`, e no `LoopSummaryModal` renderizar uma linha por condição com nome, ícone e contagem, acima do total de ouro.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc --noEmit && ./node_modules/.bin/jest --config jest.unit.config.js --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/utils/missionLoop.ts src/components/LoopSummaryModal.tsx src/__tests__/utils/missionLoop.conditions.test.ts
git commit -m "feat(condicoes): resumo do loop conta os ciclos por condição

O resumo passa a contar uma história em vez de um número."
```

---

### Task 11: Medição de balanço

**Files:**
- Modify: `scripts/simulations/` (harness existente), `scripts/simulations/BALANCE_REPORT.md`
- Test: gate de CI existente (`balance:check`)

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: números medidos para calibrar `rewardMultiplier` do pool e `MAX_CONDITION_MULTIPLIER`.

- [ ] **Step 1: Rodar a medição antes de qualquer ajuste**

```bash
npm run balance:check 2>&1 | tail -30
```
Anote o rendimento de ouro por missão no estado atual.

- [ ] **Step 2: Medir com condições ativas**

Rodar o harness com o pool ligado e comparar o ouro/hora nas missões iniciais e nas avançadas.

- [ ] **Step 3: Ajustar o pool a partir da medição**

Calibrar `rewardMultiplier` de cada condição e `MAX_CONDITION_MULTIPLIER` para que o ouro/hora médio fique dentro da faixa que o harness já considera saudável. **A compensação pendente do loop** (unificação da duração do ciclo aperta o começo em 56–66% e afrouxa o fim) entra na mesma conta — as duas mudanças mexem no mesmo número e não podem ser calibradas isoladamente.

- [ ] **Step 4: Registrar**

Atualizar `scripts/simulations/BALANCE_REPORT.md` com antes/depois e a justificativa dos valores escolhidos.

- [ ] **Step 5: Commit**

```bash
git add src/constants/missionConditions.ts scripts/simulations/BALANCE_REPORT.md
git commit -m "balance(condicoes): calibra multiplicadores a partir da medição

Números do harness, não do chute — e junto com a compensação pendente do loop,
que mexe no mesmo ouro/hora."
```

---

## Verificação final

- [ ] `npx tsc --noEmit` → 0 erros
- [ ] `./node_modules/.bin/jest --config jest.unit.config.js --runInBand` → tudo verde
- [ ] `npm run lint` → 0 erros
- [ ] App aberto no browser: chips no Quadro, condição repetida na confirmação, resumo de loop por condição
- [ ] Save v14 existente abre sem perder progresso (testar com save real no localStorage)
