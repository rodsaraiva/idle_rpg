# Crafting, Enemy Skills & Milestones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar sistema de materiais com drops de inimigos e crafting direcionado, skills de inimigo escalando por dificuldade, e notificações de marco via toast dourado.

**Architecture:** 3 features independentes. Materiais adicionam `GameState.materials` e mudam a forja para consumir materiais + taxa de gold, com drops calculados em `battleSim.ts`. Skills de inimigo estendem `BattleEnemy` e adicionam `enemySkillEffects.ts` espelhando `skillEffects.ts`. Milestones reutilizam `FeedbackService.emit('TOAST')` com tipo `milestone`.

**Tech Stack:** TypeScript, React Native (Expo), Jest. Sem novas dependências.

**Spec:** [`docs/superpowers/specs/2026-04-12-crafting-enemyskills-milestones-design.md`](../specs/2026-04-12-crafting-enemyskills-milestones-design.md)

---

## File Structure

### Phase A: Crafting com Materiais

| Arquivo | Ação | Responsabilidade |
|---------|------|------------------|
| `src/constants/materials.ts` | Create | `MaterialId`, `MATERIALS`, `FORGE_RECIPES`, `getDropsForEnemy()` |
| `src/types/index.ts` | Modify | `GameState.materials`, `MissionOutcome.materialDrops`, atualizar `FORGE_EQUIPMENT` action |
| `src/services/storage.ts` | Modify | Migration v8 |
| `src/constants/equipment.ts` | Modify | `generateEquipment` aceita `equipmentType` |
| `src/context/equipmentHandler.ts` | Modify | `handleForgeEquipment` valida materiais + tipo |
| `src/utils/battleSim.ts` | Modify | Acumular drops durante batalha |
| `src/context/tickHandler.ts` | Modify | Adicionar materialDrops ao state após missão |
| `src/__tests__/constants/materials.test.ts` | Create | Testes de drops e receitas |
| `src/__tests__/context/equipmentHandler.forge.test.ts` | Create | Testes de forja com materiais |

### Phase B: Skills de Inimigo

| Arquivo | Ação | Responsabilidade |
|---------|------|------------------|
| `src/constants/enemySkills.ts` | Create | `EnemySkillDef`, `ENEMY_SKILL_POOL`, `assignEnemySkills()` |
| `src/utils/enemySkillEffects.ts` | Create | 8 implementações de skills + hooks |
| `src/utils/battleEngine.ts` | Modify | Estender `BattleEnemy`, chamar enemy skill hooks |
| `src/utils/battleSim.ts` | Modify | Chamar `processEnemyRegenBuffs` no loop |
| `src/__tests__/constants/enemySkills.test.ts` | Create | Testes de atribuição |
| `src/__tests__/utils/enemySkillEffects.test.ts` | Create | Testes mecânicos das 8 skills |

### Phase C: Notificações de Marco

| Arquivo | Ação | Responsabilidade |
|---------|------|------------------|
| `src/services/milestones.ts` | Create | 7 funções de emissão de milestones |
| `src/services/feedback.ts` | Modify | Adicionar tipo `milestone` ao toast |
| `src/context/tickHandler.ts` | Modify | Detectar skill unlock |
| `src/context/pantheonHandler.ts` | Modify | Emitir milestones de fusão |
| `src/context/weeklyHandler.ts` | Modify | Emitir milestones semanais |
| `src/context/equipmentHandler.ts` | Modify | Emitir milestone de primeiro tier |
| `src/__tests__/services/milestones.test.ts` | Create | Testes dos 7 marcos |

---

# Phase A: Crafting com Materiais

## Task A1: Constantes de materiais e drops

**Files:**
- Create: `src/constants/materials.ts`
- Create: `src/__tests__/constants/materials.test.ts`

- [ ] **Step 1: Criar `src/constants/materials.ts`**

```ts
import { BattleEnemy } from '../utils/battleEngine';

export type MaterialId = 'iron' | 'crystal' | 'essence' | 'starstone';

export interface MaterialDef {
  id: MaterialId;
  name: string;
  icon: string;
}

export const MATERIALS: MaterialDef[] = [
  { id: 'iron', name: 'Fragmento de Ferro', icon: '⛏️' },
  { id: 'crystal', name: 'Cristal Arcano', icon: '💎' },
  { id: 'essence', name: 'Essência Vital', icon: '🧬' },
  { id: 'starstone', name: 'Pedra Estelar', icon: '🌟' },
];

export interface ForgeRecipe {
  materials: Partial<Record<MaterialId, number>>;
  gold: number;
}

export type EquipmentType = 'weapon' | 'armor' | 'accessory';

export const FORGE_RECIPES: Record<number, Record<EquipmentType, ForgeRecipe>> = {
  1: {
    weapon:    { materials: { iron: 3 }, gold: 10 },
    armor:     { materials: { essence: 3 }, gold: 10 },
    accessory: { materials: { crystal: 3 }, gold: 10 },
  },
  2: {
    weapon:    { materials: { iron: 8, essence: 2 }, gold: 30 },
    armor:     { materials: { essence: 8, crystal: 2 }, gold: 30 },
    accessory: { materials: { crystal: 8, iron: 2 }, gold: 30 },
  },
  3: {
    weapon:    { materials: { iron: 15, crystal: 5, starstone: 2 }, gold: 80 },
    armor:     { materials: { essence: 15, iron: 5, starstone: 2 }, gold: 80 },
    accessory: { materials: { crystal: 15, essence: 5, starstone: 2 }, gold: 80 },
  },
};

export interface MaterialDrop {
  materialId: MaterialId;
  quantity: number;
}

/**
 * Calculate material drops for a defeated enemy.
 */
export function getDropsForEnemy(
  enemy: { hp: number; atk: number; attackType?: 'MELEE' | 'RANGED' },
  missionDifficulty: number,
  rng: () => number,
): MaterialDrop[] {
  const dropChance = Math.min(0.8, (enemy.hp + enemy.atk) / 100);
  if (rng() >= dropChance) return [];

  const quantity = 1 + Math.floor(missionDifficulty / 3);
  const drops: MaterialDrop[] = [];

  // Primary material based on attack type
  const roll = rng();
  if (enemy.attackType === 'RANGED') {
    if (roll < 0.8) drops.push({ materialId: 'crystal', quantity });
    else if (roll < 0.9) drops.push({ materialId: 'essence', quantity });
    else drops.push({ materialId: 'iron', quantity });
  } else {
    if (roll < 0.8) drops.push({ materialId: 'iron', quantity });
    else if (roll < 0.9) drops.push({ materialId: 'essence', quantity });
    else drops.push({ materialId: 'crystal', quantity });
  }

  // Starstone: 2% chance only in difficulty >= 4
  if (missionDifficulty >= 4 && rng() < 0.02) {
    drops.push({ materialId: 'starstone', quantity: 1 });
  }

  return drops;
}

/**
 * Check if player has enough materials for a recipe.
 */
export function hasEnoughMaterials(
  playerMaterials: Record<string, number>,
  recipe: ForgeRecipe,
): boolean {
  for (const [mat, needed] of Object.entries(recipe.materials)) {
    if ((playerMaterials[mat] ?? 0) < (needed ?? 0)) return false;
  }
  return true;
}

/**
 * Deduct materials from player inventory. Returns new materials record.
 */
export function deductMaterials(
  playerMaterials: Record<string, number>,
  recipe: ForgeRecipe,
): Record<string, number> {
  const result = { ...playerMaterials };
  for (const [mat, needed] of Object.entries(recipe.materials)) {
    result[mat] = (result[mat] ?? 0) - (needed ?? 0);
  }
  return result;
}
```

- [ ] **Step 2: Criar teste `src/__tests__/constants/materials.test.ts`**

```ts
import { getDropsForEnemy, hasEnoughMaterials, deductMaterials, FORGE_RECIPES } from '../../constants/materials';

describe('materials', () => {
  test('getDropsForEnemy returns empty when rng >= dropChance', () => {
    const enemy = { hp: 5, atk: 2, attackType: 'MELEE' as const };
    const drops = getDropsForEnemy(enemy, 1, () => 0.99);
    expect(drops).toHaveLength(0);
  });

  test('getDropsForEnemy returns iron for MELEE enemy', () => {
    const enemy = { hp: 50, atk: 20, attackType: 'MELEE' as const };
    // rng: 0.01 (pass drop chance), 0.5 (iron, roll < 0.8)
    let call = 0;
    const rng = () => [0.01, 0.5][call++] ?? 0.5;
    const drops = getDropsForEnemy(enemy, 1, rng);
    expect(drops.length).toBeGreaterThanOrEqual(1);
    expect(drops[0].materialId).toBe('iron');
  });

  test('getDropsForEnemy returns crystal for RANGED enemy', () => {
    const enemy = { hp: 50, atk: 20, attackType: 'RANGED' as const };
    let call = 0;
    const rng = () => [0.01, 0.5][call++] ?? 0.5;
    const drops = getDropsForEnemy(enemy, 1, rng);
    expect(drops[0].materialId).toBe('crystal');
  });

  test('getDropsForEnemy quantity scales with difficulty', () => {
    const enemy = { hp: 100, atk: 50, attackType: 'MELEE' as const };
    let call = 0;
    const rng = () => [0.01, 0.5][call++] ?? 0.5;
    const drops = getDropsForEnemy(enemy, 6, rng);
    expect(drops[0].quantity).toBe(3); // 1 + floor(6/3)
  });

  test('starstone only drops on difficulty >= 4', () => {
    const enemy = { hp: 100, atk: 50, attackType: 'MELEE' as const };
    // rng: 0.01 (pass), 0.5 (iron), 0.001 (starstone pass)
    let call = 0;
    const rng = () => [0.01, 0.5, 0.001][call++] ?? 0.5;
    const drops = getDropsForEnemy(enemy, 4, rng);
    expect(drops.find(d => d.materialId === 'starstone')).toBeDefined();
  });

  test('starstone does not drop on difficulty < 4', () => {
    const enemy = { hp: 100, atk: 50, attackType: 'MELEE' as const };
    let call = 0;
    const rng = () => [0.01, 0.5, 0.001][call++] ?? 0.5;
    const drops = getDropsForEnemy(enemy, 3, rng);
    expect(drops.find(d => d.materialId === 'starstone')).toBeUndefined();
  });

  test('hasEnoughMaterials returns true when sufficient', () => {
    const mats = { iron: 10, essence: 5 };
    expect(hasEnoughMaterials(mats, FORGE_RECIPES[2].weapon)).toBe(true);
  });

  test('hasEnoughMaterials returns false when insufficient', () => {
    const mats = { iron: 2 };
    expect(hasEnoughMaterials(mats, FORGE_RECIPES[2].weapon)).toBe(false);
  });

  test('deductMaterials subtracts correctly', () => {
    const mats = { iron: 10, essence: 5 };
    const result = deductMaterials(mats, FORGE_RECIPES[2].weapon);
    expect(result.iron).toBe(2); // 10 - 8
    expect(result.essence).toBe(3); // 5 - 2
  });
});
```

- [ ] **Step 3: Rodar testes**

Run: `npx jest --config jest.unit.config.js --no-coverage --testPathPattern=materials`
Expected: PASS (9 testes)

- [ ] **Step 4: Commit**

```bash
git add src/constants/materials.ts src/__tests__/constants/materials.test.ts
git commit -m "feat(materials): constantes de materiais, drops e receitas com testes"
```

---

## Task A2: Estender tipos e storage

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/services/storage.ts`

- [ ] **Step 1: Adicionar `materials` ao `GameState`**

Em `src/types/index.ts`, na interface `GameState`, após `pantheonBonuses`:

```ts
  // crafting materials
  materials?: Record<string, number>;
```

- [ ] **Step 2: Adicionar `materialDrops` ao `MissionOutcome`**

Em `src/types/index.ts`, na interface `MissionOutcome`:

```ts
  materialDrops?: Record<string, number>;
```

- [ ] **Step 3: Atualizar `FORGE_EQUIPMENT` no `GameAction`**

Substituir a linha existente:

```ts
  | { type: 'FORGE_EQUIPMENT'; tier: number; now: number }
```

Por:

```ts
  | { type: 'FORGE_EQUIPMENT'; tier: number; equipmentType: 'weapon' | 'armor' | 'accessory'; now: number }
```

- [ ] **Step 4: Migration v8**

Em `src/services/storage.ts`, mudar `CURRENT_VERSION` de `7` para `8`. Adicionar:

```ts
8: (data) => {
  if (data.materials === undefined) data.materials = {};
  return data;
},
```

- [ ] **Step 5: Atualizar e2e que checa `_version`**

Em `tests/e2e/edge_cases.spec.ts`, mudar `expect(parsed._version).toBe(7)` para `toBe(8)`.

- [ ] **Step 6: Rodar testes**

Run: `npx jest --config jest.unit.config.js --no-coverage`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/services/storage.ts tests/e2e/edge_cases.spec.ts
git commit -m "feat(types): GameState.materials, MissionOutcome.materialDrops, migration v8"
```

---

## Task A3: Forja com materiais

**Files:**
- Modify: `src/constants/equipment.ts`
- Modify: `src/context/equipmentHandler.ts`
- Create: `src/__tests__/context/equipmentHandler.forge.test.ts`

- [ ] **Step 1: Atualizar `generateEquipment` para aceitar tipo**

Em `src/constants/equipment.ts`, localizar `generateEquipment(tier)` e mudar a assinatura para:

```ts
export function generateEquipment(tier: number, equipmentType?: 'weapon' | 'armor' | 'accessory'): Equipment {
```

Se `equipmentType` fornecido, filtrar templates para só aquele tipo antes de sortear. Se não fornecido, manter comportamento atual (aleatório).

- [ ] **Step 2: Atualizar `handleForgeEquipment` para validar materiais**

Em `src/context/equipmentHandler.ts`, importar:

```ts
import { FORGE_RECIPES, hasEnoughMaterials, deductMaterials, EquipmentType } from '../constants/materials';
```

Substituir a validação de gold existente por:

```ts
export function handleForgeEquipment(state: GameState, tier: number, equipmentType: EquipmentType, now: number): GameState {
  const tierDef = EQUIPMENT_TIERS.find(t => t.tier === tier);
  if (!tierDef) return state;

  const recipe = FORGE_RECIPES[tier]?.[equipmentType];
  if (!recipe) return state;

  if (state.gold < recipe.gold) return state;
  if (!hasEnoughMaterials(state.materials ?? {}, recipe)) return state;

  const equipment = generateEquipment(tier, equipmentType);
  const forgingQueue = [...(state.forgingQueue ?? []), { equipmentId: equipment.id, finishAt: now + tierDef.forgeTimeMs }];
  const inventory = [...(state.inventory ?? []), equipment];
  const materials = deductMaterials(state.materials ?? {}, recipe);

  return {
    ...state,
    gold: state.gold - recipe.gold,
    materials,
    inventory,
    forgingQueue,
  };
}
```

- [ ] **Step 3: Criar teste `src/__tests__/context/equipmentHandler.forge.test.ts`**

```ts
import { handleForgeEquipment } from '../../context/equipmentHandler';
import { GameState, HeroTask } from '../../types';

const baseState: GameState = {
  gold: 100,
  heroes: [],
  heroesRecruited: 0,
  lastSavedAt: Date.now(),
  materials: { iron: 20, crystal: 20, essence: 20, starstone: 5 },
  inventory: [],
  forgingQueue: [],
};

describe('handleForgeEquipment with materials', () => {
  test('forges weapon tier 1 and deducts materials + gold', () => {
    const state = handleForgeEquipment(baseState, 1, 'weapon', Date.now());
    expect(state.materials!.iron).toBe(17); // 20 - 3
    expect(state.gold).toBe(90); // 100 - 10
    expect(state.inventory!).toHaveLength(1);
  });

  test('rejects if insufficient materials', () => {
    const poor = { ...baseState, materials: { iron: 1 } };
    const state = handleForgeEquipment(poor, 1, 'weapon', Date.now());
    expect(state.inventory).toHaveLength(0);
  });

  test('rejects if insufficient gold', () => {
    const broke = { ...baseState, gold: 0 };
    const state = handleForgeEquipment(broke, 1, 'weapon', Date.now());
    expect(state.inventory).toHaveLength(0);
  });

  test('epic tier requires starstone', () => {
    const state = handleForgeEquipment(baseState, 3, 'weapon', Date.now());
    expect(state.materials!.starstone).toBe(3); // 5 - 2
    expect(state.inventory!).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Rodar testes**

Run: `npx jest --config jest.unit.config.js --no-coverage --testPathPattern=equipmentHandler`
Expected: PASS

- [ ] **Step 5: Rodar suíte completa**

Run: `npx jest --config jest.unit.config.js --no-coverage`
Expected: PASS — se testes existentes de forja quebrarem porque não passam `equipmentType`, ajustar para passar valor default.

- [ ] **Step 6: Commit**

```bash
git add src/constants/equipment.ts src/context/equipmentHandler.ts src/__tests__/context/equipmentHandler.forge.test.ts
git commit -m "feat(forge): forja consome materiais por tipo de equipamento"
```

---

## Task A4: Drops de materiais na batalha

**Files:**
- Modify: `src/utils/battleSim.ts`
- Modify: `src/context/tickHandler.ts`

- [ ] **Step 1: Acumular drops em `computeBattleOutcome`**

Em `src/utils/battleSim.ts`, importar:

```ts
import { getDropsForEnemy } from '../constants/materials';
```

Após o while loop de combate, antes de construir o return, calcular drops de todos os inimigos mortos:

```ts
  const materialDrops: Record<string, number> = {};
  const difficulty = template.difficulty ?? 1;
  for (const enemy of state.enemies.filter(e => e.hp <= 0)) {
    const drops = getDropsForEnemy(enemy, difficulty, rng);
    for (const drop of drops) {
      materialDrops[drop.materialId] = (materialDrops[drop.materialId] ?? 0) + drop.quantity;
    }
  }

  // On defeat, keep only 25%
  if (!success) {
    for (const key of Object.keys(materialDrops)) {
      materialDrops[key] = Math.floor(materialDrops[key] * 0.25);
      if (materialDrops[key] <= 0) delete materialDrops[key];
    }
  }
```

Adicionar `materialDrops` ao objeto retornado:

```ts
  return {
    success,
    reward,
    casualties,
    enemyCasualties: state.enemies.filter((e) => e.hp <= 0).length,
    rounds: state.rounds,
    log: state.log,
    actions: state.actions,
    materialDrops,
  };
```

- [ ] **Step 2: Adicionar drops ao state no `tickHandler.ts`**

Em `tickHandler.ts`, na função `processMissions`, onde o outcome da missão é processado, após adicionar gold, adicionar materiais. Localizar o bloco onde `goldGained` é acumulado e adicionar:

```ts
  // Accumulate material drops
  const materialDrops: Record<string, number> = {};
  // ... inside the loop where outcomes are processed:
  if (outcome.materialDrops) {
    for (const [mat, qty] of Object.entries(outcome.materialDrops)) {
      materialDrops[mat] = (materialDrops[mat] ?? 0) + qty;
    }
  }
```

E no `stateAfterTick`, mesclar materiais:

```ts
  if (Object.keys(materialDrops).length > 0) {
    const merged = { ...(stateAfterTick.materials ?? {}) };
    for (const [mat, qty] of Object.entries(materialDrops)) {
      merged[mat] = (merged[mat] ?? 0) + qty;
    }
    stateAfterTick = { ...stateAfterTick, materials: merged };
  }
```

- [ ] **Step 3: Rodar suíte completa**

Run: `npx jest --config jest.unit.config.js --no-coverage`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/utils/battleSim.ts src/context/tickHandler.ts
git commit -m "feat(drops): inimigos derrotados dropam materiais"
```

---

# Phase B: Skills de Inimigo

## Task B1: Definições de skills de inimigo

**Files:**
- Create: `src/constants/enemySkills.ts`
- Create: `src/__tests__/constants/enemySkills.test.ts`

- [ ] **Step 1: Criar `src/constants/enemySkills.ts`**

```ts
export interface EnemySkillDef {
  id: string;
  name: string;
  icon: string;
  cooldownRounds: number; // 0 = condicional, -1 = once, N = a cada N rounds
  minDifficulty: number;
}

export const ENEMY_SKILL_POOL: EnemySkillDef[] = [
  { id: 'CHARGE', name: 'Investida', icon: '💨', cooldownRounds: -1, minDifficulty: 1 },
  { id: 'CARAPACE', name: 'Couraça', icon: '🛡️', cooldownRounds: 0, minDifficulty: 2 },
  { id: 'INTIMIDATE', name: 'Grito Intimidante', icon: '😱', cooldownRounds: -1, minDifficulty: 3 },
  { id: 'REGEN', name: 'Regeneração', icon: '💚', cooldownRounds: 3, minDifficulty: 3 },
  { id: 'POISON', name: 'Veneno', icon: '🧪', cooldownRounds: 0, minDifficulty: 4 },
  { id: 'AOE_ATTACK', name: 'Ataque em Área', icon: '💥', cooldownRounds: 4, minDifficulty: 5 },
  { id: 'MAGIC_SHIELD', name: 'Escudo Mágico', icon: '🔮', cooldownRounds: 4, minDifficulty: 5 },
  { id: 'BOSS_FURY', name: 'Fúria do Boss', icon: '🔥', cooldownRounds: -1, minDifficulty: 6 },
];

/**
 * Assign skills to an enemy based on mission difficulty.
 */
export function assignEnemySkills(
  missionDifficulty: number,
  isBoss: boolean,
  rng: () => number,
): EnemySkillDef[] {
  const pool = ENEMY_SKILL_POOL.filter(s => s.minDifficulty <= missionDifficulty);
  if (pool.length === 0) return [];

  // Determine how many skills
  let maxSkills: number;
  if (missionDifficulty <= 2) maxSkills = 1;
  else if (missionDifficulty <= 4) maxSkills = 2;
  else maxSkills = 3;

  // Shuffle pool
  const shuffled = [...pool].sort(() => rng() - 0.5);

  // Chance of getting 0 skills at low difficulty
  if (missionDifficulty <= 2 && rng() > 0.5) return [];

  const picked = shuffled.slice(0, maxSkills);

  // Bosses always get BOSS_FURY if available
  if (isBoss) {
    const fury = ENEMY_SKILL_POOL.find(s => s.id === 'BOSS_FURY');
    if (fury && !picked.find(s => s.id === 'BOSS_FURY')) {
      picked.push(fury);
    }
  }

  return picked;
}
```

- [ ] **Step 2: Criar teste `src/__tests__/constants/enemySkills.test.ts`**

```ts
import { assignEnemySkills, ENEMY_SKILL_POOL } from '../../constants/enemySkills';

describe('enemySkills', () => {
  test('pool has 8 skills', () => {
    expect(ENEMY_SKILL_POOL).toHaveLength(8);
  });

  test('difficulty 1 assigns 0-1 skills from pool minDiff <= 1', () => {
    const skills = assignEnemySkills(1, false, () => 0.3);
    expect(skills.length).toBeLessThanOrEqual(1);
    for (const s of skills) {
      expect(s.minDifficulty).toBeLessThanOrEqual(1);
    }
  });

  test('difficulty 5 assigns up to 3 skills', () => {
    const skills = assignEnemySkills(5, false, () => 0.3);
    expect(skills.length).toBeLessThanOrEqual(3);
  });

  test('boss always gets BOSS_FURY', () => {
    const skills = assignEnemySkills(6, true, () => 0.3);
    expect(skills.find(s => s.id === 'BOSS_FURY')).toBeDefined();
  });

  test('low difficulty can return empty', () => {
    // rng > 0.5 at low diff = no skills
    const skills = assignEnemySkills(1, false, () => 0.9);
    expect(skills).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Rodar testes**

Run: `npx jest --config jest.unit.config.js --no-coverage --testPathPattern=enemySkills`
Expected: PASS (5 testes)

- [ ] **Step 4: Commit**

```bash
git add src/constants/enemySkills.ts src/__tests__/constants/enemySkills.test.ts
git commit -m "feat(enemy-skills): pool de 8 skills e assignEnemySkills"
```

---

## Task B2: Implementação de skills de inimigo

**Files:**
- Create: `src/utils/enemySkillEffects.ts`
- Create: `src/__tests__/utils/enemySkillEffects.test.ts`

- [ ] **Step 1: Criar `src/utils/enemySkillEffects.ts`**

```ts
import { Hero } from '../types';
import { BattleState, BattleEnemy, Buff } from './battleEngine';
import { EnemySkillDef } from '../constants/enemySkills';
import { GameMath } from './gameMath';

function isReady(enemy: BattleEnemy, skill: EnemySkillDef, state: BattleState): boolean {
  const key = `${enemy.id}_${skill.id}`;
  if (skill.cooldownRounds === -1) return !(enemy.skillOnceUsed?.[key]);
  if (skill.cooldownRounds === 0) return true;
  const readyAt = enemy.skillCooldowns?.[key] ?? 0;
  return state.rounds >= readyAt;
}

function markUsed(enemy: BattleEnemy, skill: EnemySkillDef, state: BattleState): void {
  const key = `${enemy.id}_${skill.id}`;
  if (skill.cooldownRounds === -1) {
    if (!enemy.skillOnceUsed) enemy.skillOnceUsed = {};
    enemy.skillOnceUsed[key] = true;
  } else if (skill.cooldownRounds > 0) {
    if (!enemy.skillCooldowns) enemy.skillCooldowns = {};
    enemy.skillCooldowns[key] = state.rounds + skill.cooldownRounds;
  }
}

function addBuff(state: BattleState, actorId: string, buff: Buff): void {
  if (!state.buffs[actorId]) state.buffs[actorId] = [];
  const idx = state.buffs[actorId].findIndex(b => b.source === buff.source && b.type === buff.type);
  if (idx >= 0) state.buffs[actorId][idx] = buff;
  else state.buffs[actorId].push(buff);
}

function logEnemySkill(state: BattleState, enemy: BattleEnemy, skillName: string, text: string): void {
  const msg = `⚡ ${enemy.id} — ${skillName}: ${text}`;
  state.log.push(msg);
  state.actions.push({
    round: state.rounds, actorType: 'enemy', actorId: enemy.id,
    actorName: enemy.id, actionType: 'hit', text: msg,
  });
}

// ─── Skill implementations ───

function tryCharge(enemy: BattleEnemy, state: BattleState): void {
  if (state.rounds !== 1) return;
  const skill = { id: 'CHARGE', cooldownRounds: -1 } as EnemySkillDef;
  if (!isReady(enemy, skill, state)) return;
  addBuff(state, enemy.id, { source: 'ENEMY_CHARGE', type: 'atkMul', value: 1.30, expiresAfterRound: state.rounds + 1 });
  markUsed(enemy, skill, state);
  logEnemySkill(state, enemy, 'Investida', '+30% ATK');
}

function tryCarapace(enemy: BattleEnemy, state: BattleState): void {
  if (enemy.hp / enemy.maxHp <= 0.5) return;
  const existing = state.buffs[enemy.id]?.find(b => b.source === 'ENEMY_CARAPACE');
  if (existing && existing.expiresAfterRound >= state.rounds) return;
  addBuff(state, enemy.id, { source: 'ENEMY_CARAPACE', type: 'defMul', value: 1.20, expiresAfterRound: state.rounds + 1 });
}

function tryIntimidate(enemy: BattleEnemy, state: BattleState): void {
  if (state.rounds !== 1) return;
  const skill = { id: 'INTIMIDATE', cooldownRounds: -1 } as EnemySkillDef;
  if (!isReady(enemy, skill, state)) return;
  const enemyPos = state.enemyPositions[enemy.id] ?? 0;
  for (const hero of state.heroes.filter(h => h.hpCurrent > 0)) {
    const heroPos = state.heroPositions[hero.id] ?? 0;
    if (GameMath.getHexDistance(enemyPos, heroPos) <= 2) {
      addBuff(state, hero.id, { source: 'ENEMY_INTIMIDATE', type: 'atkMul', value: 0.90, expiresAfterRound: state.rounds + 2 });
    }
  }
  markUsed(enemy, skill, state);
  logEnemySkill(state, enemy, 'Grito Intimidante', 'heróis próximos -10% ATK');
}

function tryPoison(enemy: BattleEnemy, target: Hero, state: BattleState, rng: () => number): void {
  if (rng() >= 0.2) return;
  addBuff(state, target.id, {
    source: 'ENEMY_POISON', type: 'dot',
    value: Math.max(1, Math.floor(enemy.atk * 0.05)),
    expiresAfterRound: state.rounds + 2,
  });
  logEnemySkill(state, enemy, 'Veneno', `envenenou ${target.name}`);
}

function tryAoeAttack(enemy: BattleEnemy, state: BattleState): boolean {
  const skill = { id: 'AOE_ATTACK', cooldownRounds: 4 } as EnemySkillDef;
  if (!isReady(enemy, skill, state)) return false;
  const enemyPos = state.enemyPositions[enemy.id] ?? 0;
  const aliveHeroes = state.heroes.filter(h => h.hpCurrent > 0);
  const targets = aliveHeroes
    .map(h => ({ hero: h, dist: GameMath.getHexDistance(enemyPos, state.heroPositions[h.id] ?? 0) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 2);
  if (targets.length === 0) return false;
  const dmg = Math.max(1, Math.floor(enemy.atk * 0.5));
  for (const { hero } of targets) {
    hero.hpCurrent = Math.max(0, hero.hpCurrent - dmg);
    if (hero.hpCurrent <= 0) delete state.heroPositions[hero.id];
  }
  markUsed(enemy, skill, state);
  logEnemySkill(state, enemy, 'Ataque em Área', `${dmg} dano em ${targets.length} heróis`);
  return true;
}

function tryMagicShield(enemy: BattleEnemy, state: BattleState): void {
  const skill = { id: 'MAGIC_SHIELD', cooldownRounds: 4 } as EnemySkillDef;
  if (!isReady(enemy, skill, state)) return;
  addBuff(state, enemy.id, { source: 'ENEMY_MAGIC_SHIELD', type: 'shield', value: 0.30, expiresAfterRound: state.rounds + 1 });
  markUsed(enemy, skill, state);
  logEnemySkill(state, enemy, 'Escudo Mágico', 'absorve 30% do próximo dano');
}

function tryBossFury(enemy: BattleEnemy, state: BattleState): void {
  if (enemy.hp / enemy.maxHp >= 0.25) return;
  const skill = { id: 'BOSS_FURY', cooldownRounds: -1 } as EnemySkillDef;
  if (!isReady(enemy, skill, state)) return;
  addBuff(state, enemy.id, { source: 'ENEMY_BOSS_FURY', type: 'atkMul', value: 1.50, expiresAfterRound: -1 });
  markUsed(enemy, skill, state);
  logEnemySkill(state, enemy, 'Fúria do Boss', '+50% ATK permanente!');
}

// ─── Public API ───

export function applyEnemyPassiveSkills(enemy: BattleEnemy, state: BattleState): void {
  if (!enemy.skills) return;
  const ids = new Set(enemy.skills.map(s => s.id));
  if (ids.has('CARAPACE')) tryCarapace(enemy, state);
  if (ids.has('BOSS_FURY')) tryBossFury(enemy, state);
}

export function executeEnemyPreAttackSkills(
  enemy: BattleEnemy, target: Hero, state: BattleState, rng: () => number
): boolean {
  if (!enemy.skills) return false;
  const ids = new Set(enemy.skills.map(s => s.id));
  if (ids.has('CHARGE')) tryCharge(enemy, state);
  if (ids.has('INTIMIDATE')) tryIntimidate(enemy, state);
  if (ids.has('AOE_ATTACK') && tryAoeAttack(enemy, state)) return true;
  return false;
}

export function onEnemyHitSkills(
  enemy: BattleEnemy, target: Hero, state: BattleState, rng: () => number
): void {
  if (!enemy.skills) return;
  const ids = new Set(enemy.skills.map(s => s.id));
  if (ids.has('POISON')) tryPoison(enemy, target, state, rng);
}

export function onEnemyDamagedSkills(enemy: BattleEnemy, state: BattleState): void {
  if (!enemy.skills) return;
  const ids = new Set(enemy.skills.map(s => s.id));
  if (ids.has('MAGIC_SHIELD')) tryMagicShield(enemy, state);
}

export function processEnemyRegenBuffs(state: BattleState): void {
  for (const enemy of state.enemies.filter(e => e.alive)) {
    if (!enemy.skills?.find(s => s.id === 'REGEN')) continue;
    const skill = { id: 'REGEN', cooldownRounds: 3 } as EnemySkillDef;
    if (!isReady(enemy, skill, state)) continue;
    const heal = Math.max(1, Math.floor(enemy.maxHp * 0.1));
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal);
    markUsed(enemy, skill, state);
    logEnemySkill(state, enemy, 'Regeneração', `+${heal} HP`);
  }
}
```

- [ ] **Step 2: Criar teste `src/__tests__/utils/enemySkillEffects.test.ts`**

```ts
import {
  applyEnemyPassiveSkills, executeEnemyPreAttackSkills,
  onEnemyHitSkills, onEnemyDamagedSkills, processEnemyRegenBuffs
} from '../../utils/enemySkillEffects';
import { BattleState, BattleEnemy } from '../../utils/battleEngine';
import { Hero, HeroTask } from '../../types';

function makeHero(overrides?: Partial<Hero>): Hero {
  return {
    id: 'h1', name: 'Hero', hpMax: 100, hpCurrent: 100,
    atk: 20, mp: 10, defense: 5, crit: 10, agility: 5,
    currentTask: HeroTask.IDLE,
    ...overrides,
  } as Hero;
}

function makeEnemy(overrides?: Partial<BattleEnemy>): BattleEnemy {
  return {
    id: 'e1', hp: 100, maxHp: 100, atk: 15, mp: 0,
    defense: 5, crit: 5, agility: 5, alive: true,
    attackType: 'MELEE', range: 1, movement: 2, position: 2,
    ...overrides,
  };
}

function makeState(heroes: Hero[], enemies: BattleEnemy[], round: number = 1): BattleState {
  const heroPositions: Record<string, number> = {};
  heroes.forEach((h, i) => { heroPositions[h.id] = 40 + i; });
  const enemyPositions: Record<string, number> = {};
  enemies.forEach(e => { enemyPositions[e.id] = e.position ?? 2; });
  return {
    heroes, enemies, heroPositions, enemyPositions,
    lastAttacker: {}, threats: {},
    log: [], actions: [], rounds: round,
    activeSynergies: [], buffs: {}, flags: {},
    handlers: {} as any,
    skillCooldowns: {}, skillOnceUsed: {},
  };
}

describe('enemySkillEffects', () => {
  test('CHARGE: +30% ATK buff on round 1', () => {
    const enemy = makeEnemy({ skills: [{ id: 'CHARGE', name: 'Investida', icon: '💨', cooldownRounds: -1, minDifficulty: 1 }] });
    const hero = makeHero();
    const state = makeState([hero], [enemy], 1);
    executeEnemyPreAttackSkills(enemy, hero, state, () => 0.5);
    const buff = state.buffs['e1']?.find(b => b.source === 'ENEMY_CHARGE');
    expect(buff?.value).toBe(1.30);
  });

  test('CARAPACE: +20% DEF when HP > 50%', () => {
    const enemy = makeEnemy({ hp: 80, skills: [{ id: 'CARAPACE', name: 'Couraça', icon: '🛡️', cooldownRounds: 0, minDifficulty: 2 }] });
    const state = makeState([makeHero()], [enemy]);
    applyEnemyPassiveSkills(enemy, state);
    const buff = state.buffs['e1']?.find(b => b.source === 'ENEMY_CARAPACE');
    expect(buff?.value).toBe(1.20);
  });

  test('CARAPACE: no buff when HP <= 50%', () => {
    const enemy = makeEnemy({ hp: 40, skills: [{ id: 'CARAPACE', name: 'Couraça', icon: '🛡️', cooldownRounds: 0, minDifficulty: 2 }] });
    const state = makeState([makeHero()], [enemy]);
    applyEnemyPassiveSkills(enemy, state);
    expect(state.buffs['e1']).toBeUndefined();
  });

  test('POISON: applies DoT on hit (20% chance)', () => {
    const enemy = makeEnemy({ atk: 20, skills: [{ id: 'POISON', name: 'Veneno', icon: '🧪', cooldownRounds: 0, minDifficulty: 4 }] });
    const hero = makeHero();
    const state = makeState([hero], [enemy]);
    onEnemyHitSkills(enemy, hero, state, () => 0.1); // < 0.2 → triggers
    const dot = state.buffs['h1']?.find(b => b.type === 'dot');
    expect(dot).toBeDefined();
  });

  test('BOSS_FURY: +50% ATK when HP < 25%', () => {
    const enemy = makeEnemy({ hp: 20, skills: [{ id: 'BOSS_FURY', name: 'Fúria', icon: '🔥', cooldownRounds: -1, minDifficulty: 6 }] });
    const state = makeState([makeHero()], [enemy]);
    applyEnemyPassiveSkills(enemy, state);
    const buff = state.buffs['e1']?.find(b => b.source === 'ENEMY_BOSS_FURY');
    expect(buff?.value).toBe(1.50);
  });

  test('REGEN: heals 10% maxHp every 3 rounds', () => {
    const enemy = makeEnemy({ hp: 50, maxHp: 100, skills: [{ id: 'REGEN', name: 'Regen', icon: '💚', cooldownRounds: 3, minDifficulty: 3 }] });
    const state = makeState([makeHero()], [enemy], 1);
    processEnemyRegenBuffs(state);
    expect(enemy.hp).toBe(60); // 50 + 10
  });

  test('MAGIC_SHIELD: 30% shield on damage', () => {
    const enemy = makeEnemy({ skills: [{ id: 'MAGIC_SHIELD', name: 'Escudo', icon: '🔮', cooldownRounds: 4, minDifficulty: 5 }] });
    const state = makeState([makeHero()], [enemy]);
    onEnemyDamagedSkills(enemy, state);
    const shield = state.buffs['e1']?.find(b => b.type === 'shield');
    expect(shield?.value).toBe(0.30);
  });

  test('AOE_ATTACK: damages 2 closest heroes', () => {
    const enemy = makeEnemy({ atk: 20, skills: [{ id: 'AOE_ATTACK', name: 'AoE', icon: '💥', cooldownRounds: 4, minDifficulty: 5 }] });
    const h1 = makeHero({ id: 'h1' });
    const h2 = makeHero({ id: 'h2' });
    const state = makeState([h1, h2], [enemy], 1);
    const consumed = executeEnemyPreAttackSkills(enemy, h1, state, () => 0.3);
    expect(consumed).toBe(true);
    expect(h1.hpCurrent).toBeLessThan(100);
    expect(h2.hpCurrent).toBeLessThan(100);
  });
});
```

- [ ] **Step 3: Rodar testes**

Run: `npx jest --config jest.unit.config.js --no-coverage --testPathPattern=enemySkillEffects`
Expected: PASS (8 testes)

- [ ] **Step 4: Commit**

```bash
git add src/utils/enemySkillEffects.ts src/__tests__/utils/enemySkillEffects.test.ts
git commit -m "feat(enemy-skills): 8 skills de inimigo com testes mecânicos"
```

---

## Task B3: Integrar skills de inimigo no BattleEngine

**Files:**
- Modify: `src/utils/battleEngine.ts`
- Modify: `src/utils/battleSim.ts`

- [ ] **Step 1: Estender `BattleEnemy` com campos de skills**

Em `src/utils/battleEngine.ts`, na interface `BattleEnemy`, adicionar:

```ts
  skills?: import('../constants/enemySkills').EnemySkillDef[];
  skillCooldowns?: Record<string, number>;
  skillOnceUsed?: Record<string, boolean>;
```

- [ ] **Step 2: Importar enemySkillEffects no battleEngine**

```ts
import { applyEnemyPassiveSkills, executeEnemyPreAttackSkills, onEnemyHitSkills, onEnemyDamagedSkills, processEnemyRegenBuffs } from './enemySkillEffects';
import { assignEnemySkills } from '../constants/enemySkills';
```

- [ ] **Step 3: Atribuir skills em `createEnemies`**

No final de `createEnemies`, após construir cada enemy, atribuir skills baseado na difficulty do template. Adicionar parâmetro `difficulty` ao método:

```ts
createEnemies(template: MissionTemplate): BattleEnemy[] {
```

No loop de criação, após `enemies.push(...)`, adicionar:

```ts
    const difficulty = template.difficulty ?? 1;
    // ... dentro do loop de criação de cada enemy:
    const isBoss = (edef.hp ?? 0) >= 100; // heurística: HP alto = boss
    const skills = assignEnemySkills(difficulty, isBoss, Math.random);
    // Adicionar ao enemy recém-criado:
    enemies[enemies.length - 1].skills = skills.length > 0 ? skills : undefined;
```

- [ ] **Step 4: Chamar skills em `processEnemyTurn`**

No início de `processEnemyTurn`, após o check `enemy.hp <= 0`, adicionar:

```ts
    applyEnemyPassiveSkills(enemy, state);
```

Antes do ataque (antes do bloco `if (finalDist <= finalRange)`), adicionar:

```ts
    if (executeEnemyPreAttackSkills(enemy, finalTarget, state, rng)) return;
```

Após hit bem-sucedido em herói (após `state.handlers.onAttackResolved`), adicionar:

```ts
    onEnemyHitSkills(enemy, finalTarget, state, rng);
```

Após herói receber dano de herói (em `processHeroTurn`, quando `finalTarget.hp` muda), após `onAttackResolved`, chamar:

```ts
    onEnemyDamagedSkills(finalTarget, state);
```

Nota: `onEnemyDamagedSkills` é chamado quando o INIMIGO recebe dano (do herói), então deve ser no `processHeroTurn` após reduzir `finalTarget.hp`.

- [ ] **Step 5: Chamar `processEnemyRegenBuffs` no loop de batalha**

Em `src/utils/battleSim.ts`, após `processDoTBuffs(state)`, adicionar:

```ts
import { processEnemyRegenBuffs } from './enemySkillEffects';
```

E no loop:

```ts
    processEnemyRegenBuffs(state);
```

Fazer o mesmo em `scripts/utils/simulationRunner.ts`.

- [ ] **Step 6: Aplicar shield de inimigo no `processHeroTurn`**

Em `processHeroTurn`, antes de `finalTarget.hp = Math.max(0, finalTarget.hp - result.dmg)`, aplicar shield do inimigo:

```ts
    let actualDmg = result.dmg;
    const enemyShield = getShieldReduction(state, finalTarget.id);
    if (enemyShield > 0) {
      actualDmg = Math.max(1, Math.floor(actualDmg * (1 - enemyShield)));
    }
    finalTarget.hp = Math.max(0, finalTarget.hp - actualDmg);
```

- [ ] **Step 7: Rodar suíte completa**

Run: `npx jest --config jest.unit.config.js --no-coverage`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/utils/battleEngine.ts src/utils/battleSim.ts scripts/utils/simulationRunner.ts
git commit -m "feat(combat): integrar skills de inimigo no BattleEngine"
```

---

# Phase C: Notificações de Marco

## Task C1: Serviço de milestones

**Files:**
- Modify: `src/services/feedback.ts`
- Create: `src/services/milestones.ts`
- Create: `src/__tests__/services/milestones.test.ts`

- [ ] **Step 1: Adicionar tipo `milestone` ao toast em `feedback.ts`**

Em `src/services/feedback.ts`, localizar o tipo de toast (linha ~22):

```ts
type?: 'success' | 'error' | 'info';
```

Mudar para:

```ts
type?: 'success' | 'error' | 'info' | 'milestone';
```

- [ ] **Step 2: Criar `src/services/milestones.ts`**

```ts
import { FeedbackService } from './feedback';
import { Hero } from '../types';

export function emitSkillUnlocked(heroName: string, skillIcon: string, skillName: string): void {
  FeedbackService.emit('TOAST', {
    message: `${skillIcon} ${heroName} desbloqueou ${skillName}!`,
    type: 'milestone',
    duration: 4000,
  });
}

export function emitFirstFusion(): void {
  FeedbackService.emit('TOAST', {
    message: '🏛️ Primeira fusão realizada!',
    type: 'milestone',
    duration: 4000,
  });
}

export function emitFusionResult(heroName: string, stars: number): void {
  FeedbackService.emit('TOAST', {
    message: `⭐ ${heroName} nasceu com ${'★'.repeat(stars)}!`,
    type: 'milestone',
    duration: 4000,
  });
}

export function emitWeeklyQuestComplete(): void {
  FeedbackService.emit('TOAST', {
    message: '📅 Quest semanal concluída!',
    type: 'milestone',
    duration: 4000,
  });
}

export function emitWeeklyBossDefeated(): void {
  FeedbackService.emit('TOAST', {
    message: '🐉 Boss semanal derrotado!',
    type: 'milestone',
    duration: 4000,
  });
}

export function emitFirstTierForged(tierName: string): void {
  FeedbackService.emit('TOAST', {
    message: `🔨 Primeiro equipamento ${tierName} forjado!`,
    type: 'milestone',
    duration: 4000,
  });
}

export function emitRareMaterialDrop(materialName: string): void {
  FeedbackService.emit('TOAST', {
    message: `💎 ${materialName} obtida!`,
    type: 'milestone',
    duration: 4000,
  });
}
```

- [ ] **Step 3: Criar teste `src/__tests__/services/milestones.test.ts`**

```ts
import { FeedbackService } from '../../services/feedback';
import {
  emitSkillUnlocked, emitFirstFusion, emitFusionResult,
  emitWeeklyQuestComplete, emitWeeklyBossDefeated,
  emitFirstTierForged, emitRareMaterialDrop,
} from '../../services/milestones';

describe('milestones', () => {
  let emitted: any[] = [];

  beforeEach(() => {
    emitted = [];
    FeedbackService.on('TOAST', (payload: any) => emitted.push(payload));
  });

  afterEach(() => {
    FeedbackService.off('TOAST', emitted.push.bind(emitted));
  });

  test('emitSkillUnlocked emits milestone toast', () => {
    emitSkillUnlocked('Brak', '⚔️', 'Golpe Pesado');
    expect(emitted).toHaveLength(1);
    expect(emitted[0].type).toBe('milestone');
    expect(emitted[0].message).toContain('Golpe Pesado');
  });

  test('emitFirstFusion emits milestone toast', () => {
    emitFirstFusion();
    expect(emitted).toHaveLength(1);
    expect(emitted[0].message).toContain('Primeira fusão');
  });

  test('emitFusionResult includes star count', () => {
    emitFusionResult('Fenix I', 2);
    expect(emitted[0].message).toContain('★★');
  });

  test('emitWeeklyQuestComplete emits toast', () => {
    emitWeeklyQuestComplete();
    expect(emitted[0].type).toBe('milestone');
  });

  test('emitWeeklyBossDefeated emits toast', () => {
    emitWeeklyBossDefeated();
    expect(emitted[0].message).toContain('Boss semanal');
  });

  test('emitFirstTierForged includes tier name', () => {
    emitFirstTierForged('Raro');
    expect(emitted[0].message).toContain('Raro');
  });

  test('emitRareMaterialDrop includes material name', () => {
    emitRareMaterialDrop('Pedra Estelar');
    expect(emitted[0].message).toContain('Pedra Estelar');
  });
});
```

- [ ] **Step 4: Rodar testes**

Run: `npx jest --config jest.unit.config.js --no-coverage --testPathPattern=milestones`
Expected: PASS (7 testes)

- [ ] **Step 5: Commit**

```bash
git add src/services/feedback.ts src/services/milestones.ts src/__tests__/services/milestones.test.ts
git commit -m "feat(milestones): 7 notificações de marco via toast dourado"
```

---

## Task C2: Integrar milestones nos handlers

**Files:**
- Modify: `src/context/tickHandler.ts`
- Modify: `src/context/pantheonHandler.ts`
- Modify: `src/context/weeklyHandler.ts`
- Modify: `src/context/equipmentHandler.ts`

- [ ] **Step 1: Detectar skill unlock no `tickHandler.ts`**

Importar:

```ts
import { getUnlockedSkills } from '../constants/skills';
import { emitSkillUnlocked, emitRareMaterialDrop } from '../services/milestones';
```

Na função `handleTick`, antes de `processTraining`, capturar skills atuais:

```ts
  const prevSkills: Record<string, string[]> = {};
  for (const hero of currentState.heroes) {
    prevSkills[hero.id] = getUnlockedSkills(hero).map(s => s.id);
  }
```

Após `processTraining` retornar os heróis treinados, comparar:

```ts
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

Após acumular materialDrops (Task A4), emitir milestone para Pedra Estelar:

```ts
  if (materialDrops['starstone'] && materialDrops['starstone'] > 0) {
    emitRareMaterialDrop('Pedra Estelar');
  }
```

- [ ] **Step 2: Emitir milestones de fusão no `pantheonHandler.ts`**

Importar:

```ts
import { emitFirstFusion, emitFusionResult } from '../services/milestones';
```

Em `handleFuseHeroes`, após criar `fusedHero` e antes de retornar:

```ts
  if ((state.pantheonFusions ?? 0) === 0) {
    emitFirstFusion();
  }
  emitFusionResult(fusedHero.name, fusedHero.stars ?? 1);
```

- [ ] **Step 3: Emitir milestones semanais no `weeklyHandler.ts`**

Importar:

```ts
import { emitWeeklyQuestComplete, emitWeeklyBossDefeated } from '../services/milestones';
```

Em `claimWeeklyQuest`, após marcar claimed:

```ts
  emitWeeklyQuestComplete();
```

Em `markWeeklyBossDefeated`:

```ts
  emitWeeklyBossDefeated();
```

- [ ] **Step 4: Emitir milestone de primeiro tier no `equipmentHandler.ts`**

Importar:

```ts
import { emitFirstTierForged } from '../services/milestones';
import { EQUIPMENT_TIERS } from '../constants/equipment';
```

Em `handleForgeEquipment`, após criar equipamento com sucesso, checar se é o primeiro do tier:

```ts
  const existingOfTier = (state.inventory ?? []).filter(eq => eq.tier === tier);
  if (existingOfTier.length === 0) {
    const tierDef = EQUIPMENT_TIERS.find(t => t.tier === tier);
    emitFirstTierForged(tierDef?.label ?? `Tier ${tier}`);
  }
```

- [ ] **Step 5: Rodar suíte completa**

Run: `npx jest --config jest.unit.config.js --no-coverage`
Expected: PASS

- [ ] **Step 6: Rodar E2E**

Run: `npx playwright test --reporter=line`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/context/tickHandler.ts src/context/pantheonHandler.ts src/context/weeklyHandler.ts src/context/equipmentHandler.ts
git commit -m "feat(milestones): integrar 7 marcos nos handlers"
```

---

## Critério de "pronto"

- [ ] Todas as tasks marcadas completas
- [ ] `npm test` verde (esperado ~280+ testes)
- [ ] `npm run test:e2e` verde
- [ ] Materiais dropam em simulação manual
- [ ] Skills de inimigo aparecem no log de batalha
- [ ] Toasts milestone disparam no cenário correto
