# Sinergias Qualitativas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o sistema atual de sinergias (puramente cosmético no `BattleEngine` real e fraco multiplicador de stats em `battleSim.ts`) por 6 efeitos mecânicos qualitativos disparados via hooks dentro do `BattleEngine`. Stats permanentes do `Hero` nunca são mutados.

**Architecture:** Cada sinergia ativa registra handlers (`onBattleStart`, `onAttackResolved`, `onHeroDamaged`, `onHealApplied`, `shouldIgnoreDefense`, `modifyTargetScore`) num objeto consolidado armazenado em `BattleState.handlers`. Efeitos vivem em `state.buffs` (stacks por ator) e `state.flags` (estado transiente). `BattleEngine` consulta esses buffs durante `calculateAttack`/`processHeroTurn` e dispara hooks em pontos definidos.

**Tech Stack:** TypeScript, Jest. Reuso integral da arquitetura de combate existente em `src/utils/battleEngine.ts`. Sem novas dependências.

**Spec:** [`docs/superpowers/specs/2026-04-10-sinergias-qualitativas-design.md`](../specs/2026-04-10-sinergias-qualitativas-design.md)

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/utils/battleEngine.ts` | Modify | Tipos `SynergyId`, `BuffType`, `Buff`, `SynergyHandlers`. Estende `BattleState`. Adiciona hooks de leitura de buffs em `calculateAttack`/`processHeroTurn`. Adiciona `BattleEngine.initializeBattle` e `BattleEngine.cleanExpiredBuffs`. Dispara hooks nos pontos certos. |
| `src/utils/synergyEffects.ts` | Create | `createSynergyHandlers(active: SynergyId[])` retornando handlers consolidados. Implementação isolada de cada uma das 6 sinergias. |
| `src/constants/synergies.ts` | Modify | `SynergyDef` ganha `id: SynergyId`. Remove/depreca `getSynergyMultipliers`. `getActiveSynergies` continua existindo (inalterado). |
| `src/utils/battleSim.ts` | Modify | Remove o bloco que muta `hero.atk/defense/mp` (linhas 41-49). Usa `BattleEngine.initializeBattle`. Adiciona `cleanExpiredBuffs` no início de cada round. |
| `scripts/utils/simulationRunner.ts` | Modify | Usa `BattleEngine.initializeBattle`. Adiciona `cleanExpiredBuffs` no início de cada round. |
| `src/__tests__/utils/synergies.test.ts` | Modify | Remove os 2 testes de `getSynergyMultipliers`. Mantém os 3 testes de `getActiveSynergies`. |
| `src/__tests__/utils/synergyEffects.test.ts` | Create | Um teste mecânico por sinergia (6 testes), no nível do `BattleEngine`. |

---

## Task 1: Foundation — tipos e `id` em `SynergyDef`

**Files:**
- Modify: `src/utils/battleEngine.ts` (topo do arquivo, perto dos imports)
- Modify: `src/constants/synergies.ts`

- [ ] **Step 1: Adicionar tipos `SynergyId`, `BuffType`, `Buff` no topo de `src/utils/battleEngine.ts`**

Logo abaixo dos imports existentes (após linha 9), adicione:

```ts
export type SynergyId =
  | 'LINHA_DE_FRENTE'
  | 'MURALHA_E_FLECHA'
  | 'BASTIAO'
  | 'CAOS_ARCANO'
  | 'EMBOSCADA'
  | 'ARTILHARIA';

export type BuffType =
  | 'atkMul'        // multiplicador de ATK do atacante
  | 'critFlat'      // soma flat ao crit (ex: +20)
  | 'rangeFlat'     // soma flat ao alcance
  | 'defDebuffMul'  // multiplicador <1 aplicado à defesa do alvo
  | 'taunt';        // soma flat ao score quando este ator é alvo de seleção

export interface Buff {
  source: SynergyId;
  type: BuffType;
  value: number;
  expiresAfterRound: number; // -1 = persistente até source desativar
}
```

- [ ] **Step 2: Modificar `src/constants/synergies.ts` para adicionar `id`**

Substitua o conteúdo atual por:

```ts
import { ClassId } from '../types';
import type { SynergyId } from '../utils/battleEngine';

export interface SynergyDef {
  id: SynergyId;
  classes: [ClassId, ClassId];
  name: string;
  description: string;
}

export const SYNERGIES: SynergyDef[] = [
  { id: 'LINHA_DE_FRENTE', classes: ['WARRIOR', 'HEALER'], name: 'Linha de Frente', description: 'Curar o Guerreiro o enfurece (+30% ATK por 1 turno)' },
  { id: 'MURALHA_E_FLECHA', classes: ['TANK', 'ARCHER'], name: 'Muralha e Flecha', description: 'Tanque atrai inimigos. Arqueiro ganha +1 alcance e +20 crit enquanto Tanque vivo' },
  { id: 'CAOS_ARCANO', classes: ['ROGUE', 'MAGE'], name: 'Caos Arcano', description: 'Mago disjunta defesas: alvos atacados perdem 50% de DEF por 1 turno' },
  { id: 'BASTIAO', classes: ['TANK', 'HEALER'], name: 'Bastião', description: 'Tanque abaixo de 50% HP libera cura em área no próximo cast do Curandeiro' },
  { id: 'EMBOSCADA', classes: ['WARRIOR', 'ROGUE'], name: 'Emboscada', description: 'Guerreiro e Ladino ignoram defesa nos rounds 1 e 2' },
  { id: 'ARTILHARIA', classes: ['ARCHER', 'MAGE'], name: 'Artilharia', description: 'Ataques à distância (≥2 hex) têm 50% de chance de respingar 50% do dano em vizinho' },
];

/** Returns synergy definitions active for a given team. */
export function getActiveSynergies(classIds: ClassId[]): SynergyDef[] {
  return SYNERGIES.filter(s =>
    classIds.includes(s.classes[0]) && classIds.includes(s.classes[1])
  );
}

/** @deprecated kept temporarily for battleSim.ts compatibility — removed in Task 4. */
export function getSynergyMultipliers(_classIds: ClassId[]): { atk: number; defense: number; heal: number } {
  return { atk: 1, defense: 1, heal: 1 };
}
```

- [ ] **Step 3: Rodar testes para verificar que nada quebrou**

Run: `npm test -- --testPathPattern=synergies`
Expected: PASS — os 5 testes existentes continuam verdes (`getActiveSynergies` inalterado; `getSynergyMultipliers` agora retorna sempre `{1,1,1}`, mas os testes só checam que valores são `>1` ou `=1`, então um teste vai falhar — passamos para o step 4).

- [ ] **Step 4: Atualizar testes que dependiam dos antigos multiplicadores**

Em `src/__tests__/utils/synergies.test.ts`, remova os blocos `test('multipliers stack from multiple synergies'...)` e `test('no synergies returns neutral multipliers'...)`. Substitua-os por nada (serão substituídos por testes mecânicos no Task 5+).

Resultado esperado do arquivo após edição:

```ts
import { getActiveSynergies } from '../../constants/synergies';

describe('Synergies', () => {
  test('detects WARRIOR + HEALER synergy', () => {
    const active = getActiveSynergies(['WARRIOR', 'HEALER']);
    expect(active.length).toBe(1);
    expect(active[0].name).toBe('Linha de Frente');
  });

  test('detects multiple synergies', () => {
    const active = getActiveSynergies(['WARRIOR', 'HEALER', 'TANK', 'ARCHER']);
    expect(active.length).toBeGreaterThanOrEqual(2);
  });

  test('no synergies for single class', () => {
    const active = getActiveSynergies(['WARRIOR']);
    expect(active.length).toBe(0);
  });
});
```

- [ ] **Step 5: Rodar suíte completa**

Run: `npm test`
Expected: PASS. Atenção a `battleSim.test.ts` — pode ter casos com tolerância apertada que dependiam dos multiplicadores antigos. Se algum quebrar, anote os IDs e siga para Step 6.

- [ ] **Step 6: Ajustar testes de `battleSim` se quebrarem**

Se `battleSim.test.ts` ou `battleSim.edgecases.test.ts` falharem, abra o teste, leia o que ele esperava e ajuste o valor esperado (não a lógica do teste). Os multiplicadores antigos eram pequenos (~10-20%), o impacto deve ser mínimo.

- [ ] **Step 7: Commit**

```bash
git add src/utils/battleEngine.ts src/constants/synergies.ts src/__tests__/utils/synergies.test.ts
git commit -m "feat(combat): adicionar SynergyId/Buff e id em SynergyDef"
```

---

## Task 2: Estender `BattleState` e criar `synergyEffects.ts` skeleton

**Files:**
- Modify: `src/utils/battleEngine.ts` (interface `BattleState`)
- Create: `src/utils/synergyEffects.ts`
- Create: `src/__tests__/utils/synergyEffects.test.ts`

- [ ] **Step 1: Estender `BattleState` em `src/utils/battleEngine.ts`**

Localize a interface `BattleState` (linha 28). Substitua por:

```ts
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
}
```

- [ ] **Step 2: Criar `src/utils/synergyEffects.ts` com handlers no-op**

```ts
import { Hero } from '../types';
import {
  BattleState,
  BattleEnemy,
  SynergyHandlers,
  SynergyId,
} from './battleEngine';

const NOOP_HANDLERS: SynergyHandlers = {
  onBattleStart: () => {},
  onHealApplied: () => {},
  onHeroDamaged: () => {},
  onAttackResolved: () => {},
  shouldIgnoreDefense: () => false,
  modifyTargetScore: (_state, _enemy, _candidate, baseScore) => baseScore,
};

/**
 * Builds a SynergyHandlers object that fans out each hook to every active
 * synergy's individual handler. Inactive synergies contribute nothing.
 */
export function createSynergyHandlers(active: SynergyId[]): SynergyHandlers {
  if (!active || active.length === 0) return NOOP_HANDLERS;

  // Each synergy's handler set will be appended here in later tasks.
  const perSynergy: Partial<SynergyHandlers>[] = [];

  return {
    onBattleStart: (state) => {
      for (const h of perSynergy) h.onBattleStart?.(state);
    },
    onHealApplied: (state, healer, target, amount) => {
      for (const h of perSynergy) h.onHealApplied?.(state, healer, target, amount);
    },
    onHeroDamaged: (state, hero, hpAfter) => {
      for (const h of perSynergy) h.onHeroDamaged?.(state, hero, hpAfter);
    },
    onAttackResolved: (state, attacker, target, dmg, distance) => {
      for (const h of perSynergy) h.onAttackResolved?.(state, attacker, target, dmg, distance);
    },
    shouldIgnoreDefense: (state, attacker) => {
      for (const h of perSynergy) {
        if (h.shouldIgnoreDefense?.(state, attacker)) return true;
      }
      return false;
    },
    modifyTargetScore: (state, enemy, candidate, baseScore) => {
      let score = baseScore;
      for (const h of perSynergy) {
        if (h.modifyTargetScore) score = h.modifyTargetScore(state, enemy, candidate, score);
      }
      return score;
    },
  };
}

export const _NOOP_HANDLERS = NOOP_HANDLERS; // exported for tests only
```

- [ ] **Step 3: Criar teste de smoke `src/__tests__/utils/synergyEffects.test.ts`**

```ts
import { createSynergyHandlers } from '../../utils/synergyEffects';

describe('createSynergyHandlers', () => {
  test('empty list returns no-op handlers', () => {
    const h = createSynergyHandlers([]);
    expect(typeof h.onBattleStart).toBe('function');
    expect(h.shouldIgnoreDefense({} as any, {} as any)).toBe(false);
    expect(h.modifyTargetScore({} as any, {} as any, {} as any, 100)).toBe(100);
  });

  test('non-empty list returns object with all hooks defined', () => {
    const h = createSynergyHandlers(['LINHA_DE_FRENTE']);
    expect(h.onBattleStart).toBeDefined();
    expect(h.onHealApplied).toBeDefined();
    expect(h.onHeroDamaged).toBeDefined();
    expect(h.onAttackResolved).toBeDefined();
    expect(h.shouldIgnoreDefense).toBeDefined();
    expect(h.modifyTargetScore).toBeDefined();
  });
});
```

- [ ] **Step 4: Rodar os novos testes**

Run: `npm test -- --testPathPattern=synergyEffects`
Expected: PASS (2 testes).

- [ ] **Step 5: Rodar suíte completa**

Run: `npm test`
Expected: PASS — ainda nenhuma alteração de comportamento.

⚠️ **Atenção**: como `BattleState` agora exige `activeSynergies`, `buffs`, `flags`, `handlers`, todas as construções de `BattleState` (em `battleSim.ts`, `simulationRunner.ts`, e em testes) vão quebrar TypeScript. Resolveremos no Task 4. Por enquanto, se a build estiver quebrando, adicione os 4 campos como `as any` provisoriamente nos testes que constroem `BattleState` à mão. Anote essas localizações para limpar no Task 4.

- [ ] **Step 6: Commit**

```bash
git add src/utils/battleEngine.ts src/utils/synergyEffects.ts src/__tests__/utils/synergyEffects.test.ts
git commit -m "feat(combat): adicionar SynergyHandlers + skeleton de synergyEffects"
```

---

## Task 3: `BattleEngine.initializeBattle` e `cleanExpiredBuffs`

**Files:**
- Modify: `src/utils/battleEngine.ts`

- [ ] **Step 1: Adicionar imports em `battleEngine.ts`**

No topo do arquivo, adicione:

```ts
import { getActiveSynergies } from '../constants/synergies';
import { createSynergyHandlers } from './synergyEffects';
import { ClassId } from '../types';
```

- [ ] **Step 2: Adicionar `initializeBattle` e `cleanExpiredBuffs` no `BattleEngine`**

Adicione estes dois métodos dentro do objeto `BattleEngine`, antes de `processHeroTurn`:

```ts
  /**
   * Constructs a fresh BattleState with synergy handlers wired up and
   * positions initialized. Both production (battleSim) and the simulator
   * runner should call this instead of building BattleState by hand.
   */
  initializeBattle(
    heroes: Hero[],
    template: MissionTemplate,
    opts: { heroPositions?: Record<string, number> } = {}
  ): BattleState {
    const enemies = this.createEnemies(template);
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
    };

    handlers.onBattleStart(state);
    return state;
  },

  /**
   * Removes buffs whose expiresAfterRound is < current round.
   * Persistent buffs (expiresAfterRound === -1) are kept.
   * Call this at the start of each round, before any hero/enemy turn.
   */
  cleanExpiredBuffs(state: BattleState): void {
    for (const actorId of Object.keys(state.buffs)) {
      state.buffs[actorId] = state.buffs[actorId].filter(
        b => b.expiresAfterRound === -1 || b.expiresAfterRound >= state.rounds
      );
      if (state.buffs[actorId].length === 0) delete state.buffs[actorId];
    }
  },
```

- [ ] **Step 3: Teste rápido em `synergyEffects.test.ts`**

Adicione no fim do `describe`:

```ts
  test('BattleEngine.initializeBattle returns state with handlers and empty buffs', () => {
    const { BattleEngine } = require('../../utils/battleEngine');
    const fakeTemplate = {
      id: 'test', name: 'Test', minHeroes: 1, maxHeroes: 1,
      rewardMin: 1, rewardMax: 2,
      enemies: [{ hp: 1, atk: 1, mp: 0, count: 1 }],
    };
    const heroes = [{ id: 'h1', classId: 'WARRIOR', hpMax: 10, hpCurrent: 10, atk: 5, mp: 0, defense: 5, crit: 0, agility: 5, range: 1, movement: 2, name: 'h1' }] as any;
    const state = BattleEngine.initializeBattle(heroes, fakeTemplate);
    expect(state.activeSynergies).toEqual([]);
    expect(state.buffs).toEqual({});
    expect(state.flags).toEqual({});
    expect(state.handlers).toBeDefined();
  });

  test('cleanExpiredBuffs removes expired buffs and keeps persistent ones', () => {
    const { BattleEngine } = require('../../utils/battleEngine');
    const state: any = {
      rounds: 5,
      buffs: {
        h1: [
          { source: 'LINHA_DE_FRENTE', type: 'atkMul', value: 1.3, expiresAfterRound: 4 }, // expired
          { source: 'MURALHA_E_FLECHA', type: 'critFlat', value: 20, expiresAfterRound: -1 }, // persistent
          { source: 'CAOS_ARCANO', type: 'defDebuffMul', value: 0.5, expiresAfterRound: 6 }, // active
        ],
      },
    };
    BattleEngine.cleanExpiredBuffs(state);
    expect(state.buffs.h1).toHaveLength(2);
    expect(state.buffs.h1.find((b: any) => b.source === 'LINHA_DE_FRENTE')).toBeUndefined();
  });
```

- [ ] **Step 4: Rodar os novos testes**

Run: `npm test -- --testPathPattern=synergyEffects`
Expected: PASS (4 testes total).

- [ ] **Step 5: Commit**

```bash
git add src/utils/battleEngine.ts src/__tests__/utils/synergyEffects.test.ts
git commit -m "feat(combat): BattleEngine.initializeBattle e cleanExpiredBuffs"
```

---

## Task 4: Refatorar `battleSim.ts` e `simulationRunner.ts` para usar `initializeBattle`

**Files:**
- Modify: `src/utils/battleSim.ts`
- Modify: `scripts/utils/simulationRunner.ts`
- Modify: `src/constants/synergies.ts` (remover `getSynergyMultipliers`)

- [ ] **Step 1: Substituir construção manual de `BattleState` em `battleSim.ts`**

Localize as linhas 38-67 (do `const heroes = heroesIn.map...` até o fechamento do `state: BattleState`) e substitua por:

```ts
  const heroes = heroesIn.map((h) => ({ ...h }));

  const state = BattleEngine.initializeBattle(heroes, template, {
    heroPositions: opts.heroPositions,
  });
```

Remova também o import `getSynergyMultipliers` (linha 6) e o import `ClassId` se ele não for mais usado em outro lugar do arquivo.

- [ ] **Step 2: Adicionar `cleanExpiredBuffs` no início de cada round em `battleSim.ts`**

Localize a linha `state.rounds += 1;` (dentro do `while`). Logo depois dela, adicione:

```ts
    BattleEngine.cleanExpiredBuffs(state);
```

- [ ] **Step 3: Substituir construção manual em `scripts/utils/simulationRunner.ts`**

Abra `scripts/utils/simulationRunner.ts`. Localize o bloco que cria `state: BattleState`. Substitua a inicialização inteira por:

```ts
    const state = BattleEngine.initializeBattle(activeHeroes, mission as MissionTemplate);

    // Override hero positions to the simulator's preferred bottom-row layout
    activeHeroes.forEach((h, idx) => {
      state.heroPositions[h.id] = baseHeroPositions[baseHeroPositions.length - 1 - idx] ?? 45;
    });
```

(Remova o `state.heroPositions = {}; state.enemyPositions = {};` etc. — `initializeBattle` já criou tudo; só precisamos sobrescrever as posições dos heróis.)

- [ ] **Step 4: Adicionar `cleanExpiredBuffs` no início de cada round em `simulationRunner.ts`**

Localize a linha que incrementa `state.rounds` ou marca o início do round. Logo depois dela, adicione:

```ts
    BattleEngine.cleanExpiredBuffs(state);
```

- [ ] **Step 5: Remover `getSynergyMultipliers` de `src/constants/synergies.ts`**

Delete completamente o bloco:

```ts
/** @deprecated kept temporarily for battleSim.ts compatibility — removed in Task 4. */
export function getSynergyMultipliers(_classIds: ClassId[]): { atk: number; defense: number; heal: number } {
  return { atk: 1, defense: 1, heal: 1 };
}
```

- [ ] **Step 6: Rodar a suíte completa**

Run: `npm test`
Expected: PASS. Pode haver flutuações pequenas em testes de `battleSim.test.ts` que comparavam números exatos de dano (porque o multiplicador antigo de até 1.20 sumiu). Se isso acontecer, use `toBeGreaterThanOrEqual`/`toBeLessThanOrEqual` em vez de `toBe`, ou ajuste valores esperados.

- [ ] **Step 7: Rodar simulação para garantir que script ainda roda**

Run: `npm run simulate:m1`
Expected: termina sem erros. Não precisa olhar os números (vão estar planos — todas as sinergias são no-op por enquanto).

- [ ] **Step 8: Commit**

```bash
git add src/utils/battleSim.ts scripts/utils/simulationRunner.ts src/constants/synergies.ts
git commit -m "refactor(combat): battleSim e simulationRunner usam BattleEngine.initializeBattle"
```

---

## Task 5: Wire hooks dentro de `BattleEngine` (chamadas + leitura de buffs)

**Files:**
- Modify: `src/utils/battleEngine.ts`

Esta task adiciona todas as chamadas a `state.handlers.*` e leitura de buffs nos pontos certos. Como os handlers ainda são no-op, **nenhum comportamento muda** — só estamos preparando o terreno.

- [ ] **Step 1: Atualizar `calculateAttack` para consultar buffs**

Substitua a função inteira `calculateAttack` em `src/utils/battleEngine.ts` por:

```ts
  calculateAttack(
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

    // Read attacker buffs
    let atkMul = 1;
    let critFlat = 0;
    if (state) {
      const attackerBuffs = state.buffs[attacker.id] ?? [];
      for (const b of attackerBuffs) {
        if (b.type === 'atkMul') atkMul *= b.value;
        else if (b.type === 'critFlat') critFlat += b.value;
      }
    }

    // Read target debuffs
    let defMul = 1;
    if (state) {
      const targetBuffs = state.buffs[target.id] ?? [];
      for (const b of targetBuffs) {
        if (b.type === 'defDebuffMul') defMul *= b.value;
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
  },
```

- [ ] **Step 2: Atualizar `processHeroTurn` para passar `state` e disparar hooks**

Localize, dentro de `processHeroTurn`, a chamada `this.calculateAttack(hero, finalTarget, hitChance, 'hero', state.rounds, rng, finalDist)`. Substitua por:

```ts
      // Apply rangeFlat buffs to hero range
      const buffs = state.buffs[hero.id] ?? [];
      let rangeBonus = 0;
      for (const b of buffs) {
        if (b.type === 'rangeFlat') rangeBonus += b.value;
      }
      const effectiveRange = (hero.range ?? 1) + rangeBonus;

      if (finalDist <= effectiveRange) {
        const hitChance = GameMath.calcHitChance(hero.atk, 0, 1);
        const result = this.calculateAttack(hero, finalTarget, hitChance, 'hero', state.rounds, rng, finalDist, state);
```

⚠️ Atenção: o `if (finalDist <= finalRange)` original já existe. Substitua o bloco anterior `const finalRange = hero.range ?? 1;` e o `if` correspondente pelo código acima (que agora usa `effectiveRange`).

Logo depois do `if (result) { state.actions.push(...); finalTarget.hp = ... }`, ANTES do `if (finalTarget.hp <= 0)`, adicione:

```ts
        if (result.dmg > 0) {
          state.handlers.onAttackResolved(state, hero as any, finalTarget as any, result.dmg, finalDist);
        }
```

Também aplique `rangeFlat` ao cálculo inicial em `processHeroTurn` que decide movimento. Localize a linha `const range = hero.range ?? 1;` (perto do início do método) e troque por:

```ts
      const initialBuffs = state.buffs[hero.id] ?? [];
      let initialRangeBonus = 0;
      for (const b of initialBuffs) {
        if (b.type === 'rangeFlat') initialRangeBonus += b.value;
      }
      const range = (hero.range ?? 1) + initialRangeBonus;
```

- [ ] **Step 3: Disparar `onHealApplied` em `executeClassAbility`**

Em `executeClassAbility`, depois do bloco que aplica heal e empurra a action, ANTES de `return true`, adicione:

```ts
        state.handlers.onHealApplied(state, hero, mostInjured, actualHeal);
```

- [ ] **Step 4: Disparar `onHeroDamaged` e `onAttackResolved` em `processEnemyTurn`**

Localize o bloco `if (result) { let finalDmg = result.dmg; ... finalTarget.hpCurrent = Math.max(0, ...) }`. Logo após `finalTarget.hpCurrent = Math.max(0, ...)`, ANTES do `if (result.dmg > 0)`, adicione:

```ts
        state.handlers.onHeroDamaged(state, finalTarget, finalTarget.hpCurrent);
        if (finalDmg > 0) {
          state.handlers.onAttackResolved(state, enemy as any, finalTarget as any, finalDmg, finalDist);
        }
```

E atualize a chamada a `calculateAttack` em `processEnemyTurn` para passar `state` como último parâmetro:

```ts
      const result = this.calculateAttack(enemy, finalTarget, enemyHitChance, 'enemy', state.rounds, rng, finalDist, state);
```

- [ ] **Step 5: Adicionar `modifyTargetScore` em `selectTarget` quando atacante é inimigo**

A função `selectTarget` é genérica (usada por heróis e inimigos). Adicione um parâmetro opcional `modifyScore` no `context`:

```ts
  selectTarget<T extends { id: string; hp?: number; hpCurrent?: number; position?: number; classId?: string; range?: number }>(
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
```

Logo antes do `return { target, score };` no `.map(...)`, adicione:

```ts
      if (context.modifyScore) {
        score = context.modifyScore(target, score);
      }
```

Em `processEnemyTurn`, nas duas chamadas a `selectTarget(enemy, ...)`, passe `modifyScore`:

```ts
    const initialTarget = this.selectTarget(enemy, currentPos, aliveHeroes, rng, {
      lastAttackerId: state.lastAttacker[enemy.id],
      alliesInDanger: getEnemiesInDanger(),
      modifyScore: (candidate, baseScore) =>
        state.handlers.modifyTargetScore(state, enemy, candidate as Hero, baseScore),
    });
```

(E o mesmo para `finalTarget`.)

- [ ] **Step 6: Rodar a suíte completa**

Run: `npm test`
Expected: PASS. Como handlers são no-op, comportamento permanece idêntico.

- [ ] **Step 7: Commit**

```bash
git add src/utils/battleEngine.ts
git commit -m "feat(combat): wire SynergyHandlers hooks em BattleEngine (no-op)"
```

---

## Task 6: Implementar `LINHA_DE_FRENTE` (Furor)

**Files:**
- Modify: `src/utils/synergyEffects.ts`
- Modify: `src/__tests__/utils/synergyEffects.test.ts`

- [ ] **Step 1: Escrever teste falhante**

Adicione no `describe` de `synergyEffects.test.ts`:

```ts
  test('LINHA_DE_FRENTE: curar Guerreiro aplica buff Furor (atkMul 1.30 por 1 turno)', () => {
    const handlers = createSynergyHandlers(['LINHA_DE_FRENTE']);
    const state: any = { rounds: 3, buffs: {}, flags: {} };
    const healer: any = { id: 'h1', classId: 'HEALER', name: 'Aria' };
    const warrior: any = { id: 'w1', classId: 'WARRIOR', name: 'Brak', hpMax: 100, hpCurrent: 50 };

    handlers.onHealApplied(state, healer, warrior, 20);

    expect(state.buffs['w1']).toBeDefined();
    expect(state.buffs['w1']).toHaveLength(1);
    const buff = state.buffs['w1'][0];
    expect(buff.source).toBe('LINHA_DE_FRENTE');
    expect(buff.type).toBe('atkMul');
    expect(buff.value).toBe(1.30);
    expect(buff.expiresAfterRound).toBe(4); // rounds + 1
  });

  test('LINHA_DE_FRENTE: refresh em vez de stack', () => {
    const handlers = createSynergyHandlers(['LINHA_DE_FRENTE']);
    const state: any = { rounds: 3, buffs: {}, flags: {} };
    const healer: any = { id: 'h1', classId: 'HEALER' };
    const warrior: any = { id: 'w1', classId: 'WARRIOR' };

    handlers.onHealApplied(state, healer, warrior, 10);
    state.rounds = 4;
    handlers.onHealApplied(state, healer, warrior, 10);

    expect(state.buffs['w1']).toHaveLength(1);
    expect(state.buffs['w1'][0].expiresAfterRound).toBe(5);
  });

  test('LINHA_DE_FRENTE: não dispara se alvo não é WARRIOR', () => {
    const handlers = createSynergyHandlers(['LINHA_DE_FRENTE']);
    const state: any = { rounds: 1, buffs: {}, flags: {} };
    const healer: any = { id: 'h1', classId: 'HEALER' };
    const tank: any = { id: 't1', classId: 'TANK' };

    handlers.onHealApplied(state, healer, tank, 10);
    expect(state.buffs['t1']).toBeUndefined();
  });
```

- [ ] **Step 2: Rodar o teste — deve falhar**

Run: `npm test -- --testPathPattern=synergyEffects`
Expected: FAIL — `state.buffs['w1']` é undefined porque `createSynergyHandlers` ainda não tem implementação real.

- [ ] **Step 3: Implementar `LINHA_DE_FRENTE` em `synergyEffects.ts`**

Crie o registro de implementações por sinergia. Adicione antes de `createSynergyHandlers`:

```ts
const SYNERGY_IMPLS: Record<SynergyId, Partial<SynergyHandlers>> = {
  LINHA_DE_FRENTE: {
    onHealApplied: (state, _healer, target, amount) => {
      if (target.classId !== 'WARRIOR' || amount <= 0) return;
      const existing = state.buffs[target.id] ?? [];
      const filtered = existing.filter(b => b.source !== 'LINHA_DE_FRENTE');
      filtered.push({
        source: 'LINHA_DE_FRENTE',
        type: 'atkMul',
        value: 1.30,
        expiresAfterRound: state.rounds + 1,
      });
      state.buffs[target.id] = filtered;
    },
  },
  MURALHA_E_FLECHA: {},
  BASTIAO: {},
  CAOS_ARCANO: {},
  EMBOSCADA: {},
  ARTILHARIA: {},
};
```

Atualize `createSynergyHandlers` para popular `perSynergy` a partir de `SYNERGY_IMPLS`:

```ts
export function createSynergyHandlers(active: SynergyId[]): SynergyHandlers {
  if (!active || active.length === 0) return NOOP_HANDLERS;
  const perSynergy: Partial<SynergyHandlers>[] = active.map(id => SYNERGY_IMPLS[id]);

  return {
    // ... (mesmo corpo de antes)
  };
}
```

- [ ] **Step 4: Rodar o teste — deve passar**

Run: `npm test -- --testPathPattern=synergyEffects`
Expected: PASS.

- [ ] **Step 5: Rodar suíte completa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/synergyEffects.ts src/__tests__/utils/synergyEffects.test.ts
git commit -m "feat(synergy): implementar Linha de Frente (Furor)"
```

---

## Task 7: Implementar `CAOS_ARCANO` (Disjunção)

**Files:**
- Modify: `src/utils/synergyEffects.ts`
- Modify: `src/__tests__/utils/synergyEffects.test.ts`

- [ ] **Step 1: Escrever teste falhante**

Adicione:

```ts
  test('CAOS_ARCANO: ataque do Mago aplica defDebuffMul 0.5 no alvo', () => {
    const handlers = createSynergyHandlers(['CAOS_ARCANO']);
    const state: any = { rounds: 2, buffs: {}, flags: {} };
    const mage: any = { id: 'm1', classId: 'MAGE' };
    const enemy: any = { id: 'e1', defense: 20 };

    handlers.onAttackResolved(state, mage, enemy, 8, 3);

    expect(state.buffs['e1']).toBeDefined();
    const buff = state.buffs['e1'][0];
    expect(buff.source).toBe('CAOS_ARCANO');
    expect(buff.type).toBe('defDebuffMul');
    expect(buff.value).toBe(0.5);
    expect(buff.expiresAfterRound).toBe(3);
  });

  test('CAOS_ARCANO: outras classes não disparam', () => {
    const handlers = createSynergyHandlers(['CAOS_ARCANO']);
    const state: any = { rounds: 1, buffs: {}, flags: {} };
    const archer: any = { id: 'a1', classId: 'ARCHER' };
    const enemy: any = { id: 'e1' };

    handlers.onAttackResolved(state, archer, enemy, 10, 3);
    expect(state.buffs['e1']).toBeUndefined();
  });

  test('CAOS_ARCANO: dano zero não dispara', () => {
    const handlers = createSynergyHandlers(['CAOS_ARCANO']);
    const state: any = { rounds: 1, buffs: {}, flags: {} };
    const mage: any = { id: 'm1', classId: 'MAGE' };
    const enemy: any = { id: 'e1' };

    handlers.onAttackResolved(state, mage, enemy, 0, 3);
    expect(state.buffs['e1']).toBeUndefined();
  });
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npm test -- --testPathPattern=synergyEffects`
Expected: FAIL.

- [ ] **Step 3: Implementar em `SYNERGY_IMPLS.CAOS_ARCANO`**

```ts
  CAOS_ARCANO: {
    onAttackResolved: (state, attacker, target, dmg, _distance) => {
      if ((attacker as any).classId !== 'MAGE' || dmg <= 0) return;
      const existing = state.buffs[target.id] ?? [];
      const filtered = existing.filter(b => b.source !== 'CAOS_ARCANO');
      filtered.push({
        source: 'CAOS_ARCANO',
        type: 'defDebuffMul',
        value: 0.5,
        expiresAfterRound: state.rounds + 1,
      });
      state.buffs[target.id] = filtered;
    },
  },
```

- [ ] **Step 4: Rodar — deve passar**

Run: `npm test -- --testPathPattern=synergyEffects`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/synergyEffects.ts src/__tests__/utils/synergyEffects.test.ts
git commit -m "feat(synergy): implementar Caos Arcano (Disjunção)"
```

---

## Task 8: Implementar `EMBOSCADA` (Surpresa)

**Files:**
- Modify: `src/utils/synergyEffects.ts`
- Modify: `src/__tests__/utils/synergyEffects.test.ts`

- [ ] **Step 1: Escrever teste falhante**

```ts
  test('EMBOSCADA: shouldIgnoreDefense true para Guerreiro/Ladino nos rounds 1-2', () => {
    const handlers = createSynergyHandlers(['EMBOSCADA']);
    const warrior: any = { id: 'w1', classId: 'WARRIOR' };
    const rogue: any = { id: 'r1', classId: 'ROGUE' };

    expect(handlers.shouldIgnoreDefense({ rounds: 1 } as any, warrior)).toBe(true);
    expect(handlers.shouldIgnoreDefense({ rounds: 2 } as any, rogue)).toBe(true);
  });

  test('EMBOSCADA: shouldIgnoreDefense false após round 2', () => {
    const handlers = createSynergyHandlers(['EMBOSCADA']);
    const warrior: any = { classId: 'WARRIOR' };
    expect(handlers.shouldIgnoreDefense({ rounds: 3 } as any, warrior)).toBe(false);
  });

  test('EMBOSCADA: outras classes não disparam', () => {
    const handlers = createSynergyHandlers(['EMBOSCADA']);
    const archer: any = { classId: 'ARCHER' };
    expect(handlers.shouldIgnoreDefense({ rounds: 1 } as any, archer)).toBe(false);
  });
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npm test -- --testPathPattern=synergyEffects`
Expected: FAIL.

- [ ] **Step 3: Implementar em `SYNERGY_IMPLS.EMBOSCADA`**

```ts
  EMBOSCADA: {
    shouldIgnoreDefense: (state, attacker) => {
      if (state.rounds > 2) return false;
      const cid = (attacker as any).classId;
      return cid === 'WARRIOR' || cid === 'ROGUE';
    },
  },
```

- [ ] **Step 4: Rodar — deve passar**

Run: `npm test -- --testPathPattern=synergyEffects`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/synergyEffects.ts src/__tests__/utils/synergyEffects.test.ts
git commit -m "feat(synergy): implementar Emboscada (Surpresa)"
```

---

## Task 9: Implementar `MURALHA_E_FLECHA` (Posição Fortificada)

**Files:**
- Modify: `src/utils/synergyEffects.ts`
- Modify: `src/__tests__/utils/synergyEffects.test.ts`

- [ ] **Step 1: Escrever teste falhante**

```ts
  test('MURALHA_E_FLECHA: onBattleStart aplica taunt em Tanques e crit/range em Arqueiros', () => {
    const handlers = createSynergyHandlers(['MURALHA_E_FLECHA']);
    const tank: any = { id: 't1', classId: 'TANK', hpCurrent: 50 };
    const archer: any = { id: 'a1', classId: 'ARCHER', hpCurrent: 40 };
    const warrior: any = { id: 'w1', classId: 'WARRIOR', hpCurrent: 60 };
    const state: any = { rounds: 0, heroes: [tank, archer, warrior], buffs: {}, flags: {} };

    handlers.onBattleStart(state);

    expect(state.buffs['t1'].some((b: any) => b.type === 'taunt' && b.value === 60)).toBe(true);
    expect(state.buffs['a1'].some((b: any) => b.type === 'rangeFlat' && b.value === 1)).toBe(true);
    expect(state.buffs['a1'].some((b: any) => b.type === 'critFlat' && b.value === 20)).toBe(true);
    expect(state.buffs['w1']).toBeUndefined();
  });

  test('MURALHA_E_FLECHA: onHeroDamaged remove buffs quando último Tanque morre', () => {
    const handlers = createSynergyHandlers(['MURALHA_E_FLECHA']);
    const tank: any = { id: 't1', classId: 'TANK', hpCurrent: 0, hpMax: 100 };
    const archer: any = { id: 'a1', classId: 'ARCHER', hpCurrent: 40 };
    const state: any = {
      rounds: 3,
      heroes: [tank, archer],
      buffs: {
        t1: [{ source: 'MURALHA_E_FLECHA', type: 'taunt', value: 60, expiresAfterRound: -1 }],
        a1: [
          { source: 'MURALHA_E_FLECHA', type: 'rangeFlat', value: 1, expiresAfterRound: -1 },
          { source: 'MURALHA_E_FLECHA', type: 'critFlat', value: 20, expiresAfterRound: -1 },
        ],
      },
      flags: {},
    };

    handlers.onHeroDamaged(state, tank, 0);

    expect(state.buffs['t1']).toBeUndefined();
    expect(state.buffs['a1']).toBeUndefined();
  });

  test('MURALHA_E_FLECHA: modifyTargetScore soma taunt quando alvo é Tanque', () => {
    const handlers = createSynergyHandlers(['MURALHA_E_FLECHA']);
    const tank: any = { id: 't1', classId: 'TANK' };
    const state: any = {
      rounds: 1,
      buffs: { t1: [{ source: 'MURALHA_E_FLECHA', type: 'taunt', value: 60, expiresAfterRound: -1 }] },
      flags: {},
    };

    const score = handlers.modifyTargetScore(state, {} as any, tank, 100);
    expect(score).toBe(160);
  });
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npm test -- --testPathPattern=synergyEffects`
Expected: FAIL.

- [ ] **Step 3: Implementar em `SYNERGY_IMPLS.MURALHA_E_FLECHA`**

```ts
  MURALHA_E_FLECHA: {
    onBattleStart: (state) => {
      const tanksAlive = state.heroes.some(h => h.classId === 'TANK' && h.hpCurrent > 0);
      if (!tanksAlive) return;
      for (const h of state.heroes) {
        if (h.hpCurrent <= 0) continue;
        if (h.classId === 'TANK') {
          state.buffs[h.id] = [
            ...(state.buffs[h.id] ?? []),
            { source: 'MURALHA_E_FLECHA', type: 'taunt', value: 60, expiresAfterRound: -1 },
          ];
        } else if (h.classId === 'ARCHER') {
          state.buffs[h.id] = [
            ...(state.buffs[h.id] ?? []),
            { source: 'MURALHA_E_FLECHA', type: 'rangeFlat', value: 1, expiresAfterRound: -1 },
            { source: 'MURALHA_E_FLECHA', type: 'critFlat', value: 20, expiresAfterRound: -1 },
          ];
        }
      }
    },
    onHeroDamaged: (state, hero, hpAfter) => {
      if (hero.classId !== 'TANK' || hpAfter > 0) return;
      const anyTankAlive = state.heroes.some(h => h.classId === 'TANK' && h.hpCurrent > 0);
      if (anyTankAlive) return;
      // Remove all MURALHA_E_FLECHA buffs across the team
      for (const id of Object.keys(state.buffs)) {
        state.buffs[id] = state.buffs[id].filter(b => b.source !== 'MURALHA_E_FLECHA');
        if (state.buffs[id].length === 0) delete state.buffs[id];
      }
    },
    modifyTargetScore: (state, _enemy, candidate, baseScore) => {
      const buffs = state.buffs[candidate.id] ?? [];
      let bonus = 0;
      for (const b of buffs) {
        if (b.type === 'taunt') bonus += b.value;
      }
      return baseScore + bonus;
    },
  },
```

- [ ] **Step 4: Rodar — deve passar**

Run: `npm test -- --testPathPattern=synergyEffects`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/synergyEffects.ts src/__tests__/utils/synergyEffects.test.ts
git commit -m "feat(synergy): implementar Muralha e Flecha (Posição Fortificada)"
```

---

## Task 10: Implementar `BASTIAO` (Sopro de Esperança)

**Files:**
- Modify: `src/utils/synergyEffects.ts`
- Modify: `src/utils/battleEngine.ts` (executeClassAbility precisa ler a flag e fazer AoE)
- Modify: `src/__tests__/utils/synergyEffects.test.ts`

- [ ] **Step 1: Escrever teste falhante**

```ts
  test('BASTIAO: arma flag quando Tanque vai abaixo de 50% HP', () => {
    const handlers = createSynergyHandlers(['BASTIAO']);
    const tank: any = { id: 't1', classId: 'TANK', hpMax: 100 };
    const state: any = { rounds: 2, heroes: [tank], buffs: {}, flags: {} };

    handlers.onHeroDamaged(state, tank, 40);
    expect(state.flags['bastion_armed']).toBe(true);
  });

  test('BASTIAO: não rearma se Tanque acima de 50%', () => {
    const handlers = createSynergyHandlers(['BASTIAO']);
    const tank: any = { id: 't1', classId: 'TANK', hpMax: 100 };
    const state: any = { rounds: 2, heroes: [tank], buffs: {}, flags: {} };

    handlers.onHeroDamaged(state, tank, 80);
    expect(state.flags['bastion_armed']).toBeFalsy();
  });

  test('BASTIAO: não dispara para classe diferente', () => {
    const handlers = createSynergyHandlers(['BASTIAO']);
    const archer: any = { id: 'a1', classId: 'ARCHER', hpMax: 100 };
    const state: any = { rounds: 2, heroes: [archer], buffs: {}, flags: {} };

    handlers.onHeroDamaged(state, archer, 10);
    expect(state.flags['bastion_armed']).toBeFalsy();
  });
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npm test -- --testPathPattern=synergyEffects`
Expected: FAIL.

- [ ] **Step 3: Implementar `onHeroDamaged` em `SYNERGY_IMPLS.BASTIAO`**

```ts
  BASTIAO: {
    onHeroDamaged: (state, hero, hpAfter) => {
      if (hero.classId !== 'TANK') return;
      if (state.flags['bastion_armed']) return;
      const pct = hpAfter / (hero.hpMax || 1);
      if (pct < 0.5) {
        state.flags['bastion_armed'] = true;
      }
    },
  },
```

- [ ] **Step 4: Rodar — flag arming testado, passa**

Run: `npm test -- --testPathPattern=synergyEffects`
Expected: PASS.

- [ ] **Step 5: Modificar `executeClassAbility` em `battleEngine.ts` para consumir a flag**

Localize a função `executeClassAbility`. Substitua o bloco interno completo do `if (mostInjured && (mostInjured.hpCurrent / mostInjured.hpMax) < 0.7)` por:

```ts
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

        // Bastião AoE: if armed, also heal allies within 2 hex of mostInjured
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
```

- [ ] **Step 6: Adicionar teste de integração para o AoE**

```ts
  test('BASTIAO: AoE consome flag e cura aliados em raio 2', () => {
    const { BattleEngine } = require('../../utils/battleEngine');
    const tank: any = { id: 't1', classId: 'TANK', name: 'T', hpMax: 100, hpCurrent: 30 };
    const healer: any = { id: 'h1', classId: 'HEALER', name: 'H', mp: 20, hpMax: 50, hpCurrent: 50 };
    const ally: any = { id: 'w1', classId: 'WARRIOR', name: 'W', hpMax: 80, hpCurrent: 40 };
    const state: any = {
      heroes: [tank, healer, ally],
      enemies: [],
      heroPositions: { t1: 45, h1: 46, w1: 47 },
      enemyPositions: {},
      lastAttacker: {},
      threats: {},
      log: [],
      actions: [],
      rounds: 3,
      activeSynergies: ['BASTIAO'],
      buffs: {},
      flags: { bastion_armed: true },
      handlers: createSynergyHandlers(['BASTIAO']),
    };

    BattleEngine.executeClassAbility(healer, state);

    expect(state.flags['bastion_armed']).toBeUndefined();
    expect(tank.hpCurrent).toBeGreaterThan(30); // primary heal
    expect(ally.hpCurrent).toBeGreaterThan(40); // AoE heal
  });
```

- [ ] **Step 7: Rodar todos os testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/utils/synergyEffects.ts src/utils/battleEngine.ts src/__tests__/utils/synergyEffects.test.ts
git commit -m "feat(synergy): implementar Bastião (Sopro de Esperança)"
```

---

## Task 11: Implementar `ARTILHARIA` (Bombardeio)

**Files:**
- Modify: `src/utils/synergyEffects.ts`
- Modify: `src/__tests__/utils/synergyEffects.test.ts`

⚠️ **Cuidado com loop**: o handler `onAttackResolved` aplica dano secundário, mas **não** deve disparar `onAttackResolved` de novo. A implementação deve mutar `enemy.hp` direto e empurrar uma `MissionAction` no `state.actions` sem reentrar nos hooks.

- [ ] **Step 1: Escrever teste falhante**

```ts
  test('ARTILHARIA: ataque ranged ≥2 hex tem 50% chance de respingar 50% do dano', () => {
    const handlers = createSynergyHandlers(['ARTILHARIA']);
    const archer: any = { id: 'a1', classId: 'ARCHER', name: 'Ari' };
    const target: any = { id: 'e1', hp: 10, position: 5 };
    const neighbor: any = { id: 'e2', hp: 10, position: 6 };
    const farEnemy: any = { id: 'e3', hp: 10, position: 30 };
    const state: any = {
      rounds: 1,
      buffs: {},
      flags: {},
      enemies: [target, neighbor, farEnemy],
      enemyPositions: { e1: 5, e2: 6, e3: 30 },
      log: [],
      actions: [],
      _rng: () => 0.4, // sub-50% → splash dispara
    };
    // We pass rng via closure. Implementation will use a known location.
    // For deterministic test, override Math.random:
    const origRandom = Math.random;
    Math.random = () => 0.4;
    try {
      handlers.onAttackResolved(state, archer, target, 8, 3);
    } finally {
      Math.random = origRandom;
    }

    expect(neighbor.hp).toBe(6); // 10 - floor(8*0.5) = 6
    expect(farEnemy.hp).toBe(10); // distance > 2
  });

  test('ARTILHARIA: rng acima de 50% não dispara', () => {
    const handlers = createSynergyHandlers(['ARTILHARIA']);
    const archer: any = { id: 'a1', classId: 'ARCHER' };
    const target: any = { id: 'e1', hp: 10, position: 5 };
    const neighbor: any = { id: 'e2', hp: 10, position: 6 };
    const state: any = {
      rounds: 1,
      buffs: {},
      flags: {},
      enemies: [target, neighbor],
      enemyPositions: { e1: 5, e2: 6 },
      log: [],
      actions: [],
    };
    const origRandom = Math.random;
    Math.random = () => 0.6;
    try {
      handlers.onAttackResolved(state, archer, target, 8, 3);
    } finally {
      Math.random = origRandom;
    }
    expect(neighbor.hp).toBe(10);
  });

  test('ARTILHARIA: não dispara em melee (distance < 2)', () => {
    const handlers = createSynergyHandlers(['ARTILHARIA']);
    const archer: any = { id: 'a1', classId: 'ARCHER' };
    const target: any = { id: 'e1', hp: 10, position: 5 };
    const neighbor: any = { id: 'e2', hp: 10, position: 6 };
    const state: any = {
      rounds: 1,
      buffs: {},
      flags: {},
      enemies: [target, neighbor],
      enemyPositions: { e1: 5, e2: 6 },
      log: [],
      actions: [],
    };
    const origRandom = Math.random;
    Math.random = () => 0.0;
    try {
      handlers.onAttackResolved(state, archer, target, 8, 1);
    } finally {
      Math.random = origRandom;
    }
    expect(neighbor.hp).toBe(10);
  });
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npm test -- --testPathPattern=synergyEffects`
Expected: FAIL.

- [ ] **Step 3: Implementar em `SYNERGY_IMPLS.ARTILHARIA`**

Adicione import no topo de `synergyEffects.ts`:

```ts
import { GameMath } from './gameMath';
```

E a implementação:

```ts
  ARTILHARIA: {
    onAttackResolved: (state, attacker, target, dmg, distance) => {
      const cid = (attacker as any).classId;
      if (cid !== 'ARCHER' && cid !== 'MAGE') return;
      if (distance < 2 || dmg <= 0) return;
      if (Math.random() >= 0.5) return;

      const targetPos = state.enemyPositions[target.id];
      if (targetPos === undefined) return;

      const candidates = state.enemies.filter(e =>
        e.id !== target.id &&
        e.hp > 0 &&
        state.enemyPositions[e.id] !== undefined &&
        GameMath.getHexDistance(targetPos, state.enemyPositions[e.id]!) <= 2
      );
      if (candidates.length === 0) return;

      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const splashDmg = Math.max(1, Math.floor(dmg * 0.5));
      pick.hp = Math.max(0, pick.hp - splashDmg);
      const txt = `Bombardeio: ${(attacker as any).name ?? (attacker as any).id} causou ${splashDmg} de dano em respingo em ${pick.id}`;
      state.log.push(txt);
      state.actions.push({
        round: state.rounds,
        actorType: 'hero',
        actorId: (attacker as any).id,
        actorName: (attacker as any).name ?? (attacker as any).id,
        actionType: 'hit',
        targetId: pick.id,
        amount: splashDmg,
        text: txt,
      });
    },
  },
```

- [ ] **Step 4: Rodar — deve passar**

Run: `npm test -- --testPathPattern=synergyEffects`
Expected: PASS.

- [ ] **Step 5: Rodar suíte completa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/synergyEffects.ts src/__tests__/utils/synergyEffects.test.ts
git commit -m "feat(synergy): implementar Artilharia (Bombardeio)"
```

---

## Task 12: Regenerar `BALANCE_REPORT.md` e validar critério de aceitação

**Files:**
- Modify: `scripts/simulations/BALANCE_REPORT.md`

- [ ] **Step 1: Rodar análise de balanceamento completa**

Run: `npx ts-node --project tsconfig.sim.json scripts/simulations/balance_analysis.ts`
Expected: gera `scripts/simulations/BALANCE_REPORT.md` atualizado. Pode levar 1-3 minutos (2000 iterações × cenários).

- [ ] **Step 2: Inspecionar a seção 6 (Validação de Sinergias)**

Run: `sed -n '/## 6. Validação de Sinergias/,/## 7/p' scripts/simulations/BALANCE_REPORT.md`

Expected: tabela com 6 sinergias. **Critério de aceitação**: cada sinergia tem `Δ Win Rate ≥ +5pp` e está marcada como "Funcional ✅".

- [ ] **Step 3: Se alguma sinergia falhar (<5pp), ajustar magnitudes**

Apenas mexa em **valores numéricos** em `synergyEffects.ts` (não mude a mecânica):
- Linha de Frente: `1.30` → `1.40` ou `1.50`
- Caos Arcano: `0.5` → `0.4` ou `0.3` (debuff mais forte)
- Emboscada: já é binário (ignora 100%) — se precisar reduzir, tente "ignora 70%" calculando `effectiveDef = Math.floor(target.defense * 0.3)` em vez de zerar
- Muralha: `taunt 60` → `100`; `crit 20` → `30`
- Bastião: `healAmount` no AoE pode virar `Math.floor(healAmount * 1.2)` para amplificar
- Artilharia: chance `0.5` → `0.7`, ou splash `0.5` → `0.7`

Após ajustar, volte ao Step 1.

- [ ] **Step 4: Rodar suíte unitária mais uma vez**

Run: `npm test`
Expected: PASS — caso ajustes de Step 3 quebrem testes unitários (que assumem valores específicos), atualize o teste para o novo valor.

- [ ] **Step 5: Rodar suíte E2E**

Run: `npm run test:e2e`
Expected: PASS. Sem regressões na UI/navegação.

- [ ] **Step 6: Commit do relatório atualizado**

```bash
git add scripts/simulations/BALANCE_REPORT.md src/utils/synergyEffects.ts src/__tests__/utils/synergyEffects.test.ts
git commit -m "chore(balance): regenerar relatório com sinergias qualitativas funcionais"
```

---

## Critério de "pronto"

- [ ] Todos os 12 tasks marcados completos
- [ ] `npm test` verde
- [ ] `npm run test:e2e` verde
- [ ] `BALANCE_REPORT.md` mostra Δ ≥ +5pp para cada uma das 6 sinergias, todas "Funcional ✅"
- [ ] Sem `Hero` mutado fora do contexto de batalha (verificar com `git grep "hero.atk = " src/`)
