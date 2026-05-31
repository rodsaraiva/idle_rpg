# Battle Determinism Fix (#47)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar `computeBattleOutcome` totalmente determinístico sob um seed. Mesmo seed → resultado byte-idêntico. Corrige o flaky do `battleSim.test.ts` (~40%) e torna os balance sims reprodutíveis.

**Architecture:** Implementar `makeRng(seed)` (mulberry32) em `src/utils/math.ts`. Propagar um único stream de rng pelo setup (createEnemies) e combate (synergyEffects ARTILHARIA) via campo `rng` na interface `BattleState`. `BattleOpts.seed?: number` permite opt-in determinístico — produção segue com `Math.random` sem mudança de comportamento.

**Tech Stack:** TypeScript, Jest (`jest.unit.config.js`). Sem novas dependências.

**Spec:** [`docs/superpowers/specs/2026-05-31-battle-determinism-design.md`](../specs/2026-05-31-battle-determinism-design.md)

**Restrições invioláveis:**
- Produção inalterada: nenhum call site existente passa seed → Math.random default.
- FORA DE ESCOPO: `math.ts` gaussiana (linhas 11-16), heroFactory nome/personalidade.
- `npm test` + `npx tsc --noEmit` verdes antes de cada commit.
- Baseline tsc: 17 erros pré-existentes. Não piorar.

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/utils/math.ts` | Modify | Adicionar `makeRng(seed: number): () => number` (mulberry32) |
| `src/__tests__/utils/math.test.ts` | Create | Testes de `makeRng`: mesmo seed → mesma sequência; seeds diferentes → sequências diferentes |
| `src/utils/battleEngine.ts` | Modify | `BattleState.rng: () => number`; `createEnemies(template, rng)` aceita rng; `initializeBattle` aceita e repassa rng |
| `src/utils/synergyEffects.ts` | Modify | ARTILHARIA linhas 119/132: `state.rng()` em vez de `Math.random()` |
| `src/utils/battleSim.ts` | Modify | `BattleOpts.seed?: number`; resolver rng e passar para `initializeBattle` |
| `src/__tests__/utils/battleSim.test.ts` | Modify | Injetar seed; adicionar teste de determinismo ponta-a-ponta |
| `src/__tests__/utils/battleEngine.test.ts` | Modify | Adicionar `rng` nos construtores de `BattleState` de helpers de teste |
| `src/__tests__/utils/battleEngine.advanced.test.ts` | Modify | Idem — todos os `makeState()` adicionam `rng: Math.random` |
| `scripts/simulations/missions/battles.ts` | Modify | Aceitar `--seed=<n>` e passar para `runMissionSimulation` / `computeBattleOutcome` |

---

## Task 1 — `makeRng(seed)` em `src/utils/math.ts`

**Files:**
- Modify: `src/utils/math.ts`
- Create: `src/__tests__/utils/math.test.ts`

### TDD

- [ ] **Step 1: Criar `src/__tests__/utils/math.test.ts` com testes falhando**

```ts
import { makeRng } from '../../utils/math';

describe('makeRng (mulberry32)', () => {
  test('mesmo seed produz mesma sequência', () => {
    const r1 = makeRng(42);
    const r2 = makeRng(42);
    const seq1 = Array.from({ length: 20 }, () => r1());
    const seq2 = Array.from({ length: 20 }, () => r2());
    expect(seq1).toEqual(seq2);
  });

  test('seeds diferentes produzem sequências diferentes', () => {
    const r1 = makeRng(1);
    const r2 = makeRng(2);
    const seq1 = Array.from({ length: 10 }, () => r1());
    const seq2 = Array.from({ length: 10 }, () => r2());
    expect(seq1).not.toEqual(seq2);
  });

  test('retorna valores em [0, 1)', () => {
    const r = makeRng(99);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 2: Implementar `makeRng` em `src/utils/math.ts`**

```ts
/**
 * Mulberry32 PRNG seedável — qualidade suficiente para jogos/simulações (não-cripto).
 * Retorna valores em [0, 1).
 */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}
```

- [ ] **Step 3: `npm test -- --testPathPattern="math.test"` verde**

---

## Task 2 — Teste de determinismo ponta-a-ponta (guarda de regressão)

**File:** `src/__tests__/utils/battleSim.test.ts`

> Escrever PRIMEIRO o teste que DEVE FALHAR antes de qualquer mudança no pipeline.

- [ ] **Step 1: Adicionar teste de determinismo em `battleSim.test.ts`**

```ts
import { makeRng } from '../../utils/math';

test('mesmo seed produz resultado byte-idêntico (determinismo ponta-a-ponta)', () => {
  const template = MISSIONS.find((m) => m.id === 'mission_1')!;
  const hero = { 
    id: 'h1', name: 'Det', hpMax: 20, hpCurrent: 20, atk: 8, mp: 0, 
    defense: 3, crit: 5, agility: 5, currentTask: 'IDLE' as any, classId: 'WARRIOR' as any 
  };
  const a = computeBattleOutcome(template, [hero], { seed: 42 });
  const b = computeBattleOutcome(template, [hero], { seed: 42 });
  expect(a).toEqual(b);
});
```

- [ ] **Step 2: Confirmar que o teste FALHA (Math.random no setup)**

```
npm test -- --testPathPattern="battleSim.test"
```

Esperado: FAIL no teste de determinismo.

---

## Task 3 — `BattleState.rng` + `createEnemies` + `initializeBattle`

**File:** `src/utils/battleEngine.ts`

- [ ] **Step 1: Adicionar `rng: () => number` na interface `BattleState`**

```ts
export interface BattleState {
  // ... campos existentes ...
  rng: () => number;
}
```

- [ ] **Step 2: `createEnemies(template, rng = Math.random)` — substituir os 4 `Math.random`**

Signature: `createEnemies(template: MissionTemplate, rng: () => number = Math.random): BattleEnemy[]`

Substituições:
- Linha ~113: `Math.floor(Math.random() * (i + 1))` → `Math.floor(rng() * (i + 1))`
- Linha ~123: `Math.random() < 0.5` → `rng() < 0.5`
- Linha ~141: `assignEnemySkills(difficulty, isBoss, Math.random)` → `assignEnemySkills(difficulty, isBoss, rng)`
- Linha ~165: `assignEnemySkills(difficulty, isBoss, Math.random)` → `assignEnemySkills(difficulty, isBoss, rng)`

- [ ] **Step 3: `initializeBattle` aceita e repassa rng**

Adicionar `rng?: () => number` em opts. Gravar `rng` em `state`.

```ts
initializeBattle(
  heroes: Hero[],
  template: MissionTemplate,
  opts: { heroPositions?: Record<string, number>; rng?: () => number } = {}
): BattleState {
  const rng = opts.rng ?? Math.random;
  const enemies = this.createEnemies(template, rng);
  // ...
  const state: BattleState = {
    // ...demais campos...
    rng,
  };
```

- [ ] **Step 4: Corrigir todos os construtores de `BattleState` nos testes que faltam `rng`**

Após Step 1, `tsc` vai apontar todos os locais. Adicionar `rng: Math.random` em cada `makeState()` de teste.

---

## Task 4 — `BattleOpts.seed` + resolver rng em `computeBattleOutcome`

**File:** `src/utils/battleSim.ts`

- [ ] **Step 1: Adicionar `seed?: number` em `BattleOpts`**

```ts
interface BattleOpts {
  // ... campos existentes ...
  seed?: number;
}
```

- [ ] **Step 2: Resolver rng com precedência correta**

```ts
const rng = opts.rng ?? (opts.seed != null ? makeRng(opts.seed) : Math.random);
```

- [ ] **Step 3: Passar `rng` para `initializeBattle`**

```ts
const state = BattleEngine.initializeBattle(heroes, template, {
  heroPositions: opts.heroPositions,
  rng,
});
```

---

## Task 5 — `synergyEffects.ts` ARTILHARIA usa `state.rng`

**File:** `src/utils/synergyEffects.ts`

- [ ] **Step 1: Substituir `Math.random()` nas linhas 119 e 132**

```ts
// linha ~119
if (state.rng() >= 0.5) return;
// linha ~132  
const pick = candidates[Math.floor(state.rng() * candidates.length)];
```

---

## Task 6 — Verificação: testes verdes + determinismo

- [ ] **Step 1: `npm test -- --testPathPattern="battleSim"` — todos passam incluindo o de determinismo**
- [ ] **Step 2: `npx tsc --noEmit` — 17 erros (baseline), sem regressão**
- [ ] **Step 3: Rodar `battleSim.test.ts` 10× seguidas — todas passam**

---

## Task 7 — `battles.ts` aceita `--seed=<n>`

**File:** `scripts/simulations/missions/battles.ts`

- [ ] **Step 1: Parsear `--seed=<n>` dos args**

```ts
const seedArg = args.find(a => a.startsWith('--seed='))?.split('=')[1];
const seed = seedArg != null ? parseInt(seedArg, 10) : undefined;
```

- [ ] **Step 2: Passar seed para `runMissionSimulation` (ou diretamente para `computeBattleOutcome`)**

Nota: `runMissionSimulation` não usa `computeBattleOutcome` — tem seu próprio loop. Para a flag de script, a forma mais simples é documentar como usar ou passar o seed para um wrapper. Avaliar na implementação.

---

## Run + Expected

```bash
# Testes unitários
cd /root/rodrigo/idle_rpg/.worktrees/det
npm test -- --testPathPattern="math.test|battleSim.test|battleEngine"

# Type-check
npx tsc --noEmit

# Simulação reprodutível (2× deve dar mesma saída)
npm run simulate:m1 -- --seed=42
npm run simulate:m1 -- --seed=42
```

**Expected:**
- `math.test.ts`: 3 passed
- `battleSim.test.ts`: 3 passed (incluindo determinismo)
- `npx tsc`: 17 erros (sem regressão)
- Duas runs de `simulate:m1 --seed=42`: saída idêntica

---

## Commit

```
fix(battle): torna computeBattleOutcome determinístico via seed (mulberry32)

Propaga rng seedável pelo pipeline completo (createEnemies + synergyEffects ARTILHARIA).
Resolve flaky do battleSim.test.ts. Produção inalterada (default Math.random).
```
