# Fase 1 — Backend Wiring (Temas A + C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar bônus hoje inertes (`permanentBonuses`, `pantheonBonuses`) no combate e na UI; ligar os trackers semanais `itemsForged` e `fusionsCompleted` que nunca incrementam; centralizar a composição de stats num helper único `getEffectiveStats` eliminando a duplicação entre `missionHandler.ts` e `tickHandler.ts`.

**Architecture:** Criar `getEffectiveStats` em `src/utils/heroUtils.ts` como único ponto de verdade de stats de combate. Os dois sites que aplicam bônus de equipamento inline (handlers de missão) são refatorados para chamar o helper. Um helper paralelo `applyGoldBonus` centraliza a aplicação do bônus de gold do panteão nos dois sites de concessão de gold. Os trackers semanais são adicionados como chamada única ao lado do daily já existente. `HeroDetailsModal` exibe base vs. efetivo para tornar os bônus visíveis.

**Tech Stack:** TypeScript, React Native (Expo), Jest. Sem novas dependências.

**Spec:** [`docs/superpowers/specs/2026-05-31-gaps-resolution-design.md`](../specs/2026-05-31-gaps-resolution-design.md)

**Restrições invioláveis:**
- Sem gold passivo — gold só de missão completada.
- DEF/CRIT/AGI nunca crescem por treino, só por equipamento/passivos.
- Não aplicar bônus duas vezes (remover duplicação existente ao migrar para o helper).

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/utils/heroUtils.ts` | Modify | Adicionar `EffectiveStats`, `getEffectiveStats()`, `applyGoldBonus()` |
| `src/__tests__/utils/heroUtils.test.ts` | Create | Testes de `getEffectiveStats` (cada fonte isolada + combinada) e `applyGoldBonus` |
| `src/context/missionHandler.ts` | Modify | Substituir bloco inline de equipamento (linhas 89-109 e 261-280) por `getEffectiveStats`; aplicar `applyGoldBonus` na concessão de gold |
| `src/context/tickHandler.ts` | Modify | Substituir bloco inline de equipamento (linhas 261-279) no loop de missão por `getEffectiveStats`; aplicar `applyGoldBonus` ao gold acumulado |
| `src/context/equipmentHandler.ts` | Modify | Adicionar `updateWeeklyProgress(state, 'itemsForged', 1)` ao lado do daily (linha 46) |
| `src/context/pantheonHandler.ts` | Modify | Adicionar `updateWeeklyProgress(state, 'fusionsCompleted', 1)` em `handleFuseHeroes` (linha 120) |
| `src/components/HeroDetailsModal.tsx` | Modify | Exibir stats efetivos (base + delta) via `getEffectiveStats` |
| `src/__tests__/context/equipmentHandler.forge.test.ts` | Modify | Adicionar teste de incremento de tracker semanal `itemsForged` |
| `src/__tests__/context/pantheonHandler.test.ts` | Modify | Adicionar teste de incremento de tracker semanal `fusionsCompleted` |
| `src/__tests__/context/tickHandler.test.ts` | Modify | Adicionar teste de gold com bônus de panteão via tick |

---

## Task A1 — Criar `getEffectiveStats` e `applyGoldBonus` em `heroUtils.ts`

**Files:**
- Modify: `src/utils/heroUtils.ts`
- Create: `src/__tests__/utils/heroUtils.test.ts`

### TDD: testes primeiro

- [ ] **Step 1: Criar `src/__tests__/utils/heroUtils.test.ts` com testes falhando**

```ts
import { getEffectiveStats, applyGoldBonus } from '../../utils/heroUtils';
import { Hero, HeroTask, GameState } from '../../types';

function makeHero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 'h1',
    name: 'Test',
    hpMax: 50,
    hpCurrent: 40,
    atk: 10,
    mp: 5,
    defense: 5,
    crit: 10,
    agility: 5,
    currentTask: HeroTask.IDLE,
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
    ...overrides,
  } as Hero;
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    gold: 0,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: 0,
    inventory: [],
    ...overrides,
  };
}

describe('getEffectiveStats', () => {
  test('sem equipamento e sem bônus retorna stats base', () => {
    const hero = makeHero();
    const state = makeState();
    const eff = getEffectiveStats(hero, state);
    expect(eff.hpMax).toBe(50);
    expect(eff.atk).toBe(10);
    expect(eff.mp).toBe(5);
    expect(eff.defense).toBe(5);
    expect(eff.crit).toBe(10);
    expect(eff.agility).toBe(5);
  });

  test('equipamento com atk aplica flat sobre base', () => {
    const hero = makeHero({ equippedItems: ['eq1'] });
    const state = makeState({
      inventory: [{ id: 'eq1', name: 'Sword', type: 'weapon', statBonus: { atk: 5 }, tier: 1 }],
    });
    const eff = getEffectiveStats(hero, state);
    expect(eff.atk).toBe(15);
  });

  test('equipamento com hp aplica flat e hpMax escala hpCurrent proporcional', () => {
    const hero = makeHero({ hpCurrent: 40, hpMax: 50, equippedItems: ['eq1'] });
    const state = makeState({
      inventory: [{ id: 'eq1', name: 'Plate', type: 'armor', statBonus: { hp: 10 }, tier: 1 }],
    });
    const eff = getEffectiveStats(hero, state);
    expect(eff.hpMax).toBe(60);
    // hpCurrent: min(60, 40 + 10) = 50
    expect(eff.hpCurrent).toBe(50);
  });

  test('permanentBonuses flat atk aplica sobre base+equip', () => {
    const hero = makeHero({ equippedItems: ['eq1'] });
    const state = makeState({
      inventory: [{ id: 'eq1', name: 'Sword', type: 'weapon', statBonus: { atk: 5 }, tier: 1 }],
      permanentBonuses: { atk: 3, hp: 0 },
    });
    const eff = getEffectiveStats(hero, state);
    // base 10 + equip 5 + permanentBonus 3 = 18
    expect(eff.atk).toBe(18);
  });

  test('permanentBonuses flat hp aplica sobre base+equip e escala hpCurrent', () => {
    const hero = makeHero({ hpCurrent: 40, hpMax: 50 });
    const state = makeState({
      permanentBonuses: { atk: 0, hp: 10 },
    });
    const eff = getEffectiveStats(hero, state);
    expect(eff.hpMax).toBe(60);
    expect(eff.hpCurrent).toBe(50);
  });

  test('pantheonBonuses atkPercent aplica multiplicador sobre (base+equip+permanent)', () => {
    const hero = makeHero();
    const state = makeState({
      pantheonBonuses: { atkPercent: 10, hpPercent: 0, goldPercent: 0 },
    });
    const eff = getEffectiveStats(hero, state);
    // 10 * 1.10 = 11
    expect(eff.atk).toBe(11);
  });

  test('pantheonBonuses hpPercent aplica multiplicador sobre hpMax e escala hpCurrent', () => {
    const hero = makeHero({ hpCurrent: 40, hpMax: 50 });
    const state = makeState({
      pantheonBonuses: { atkPercent: 0, hpPercent: 10, goldPercent: 0 },
    });
    const eff = getEffectiveStats(hero, state);
    // 50 * 1.10 = 55
    expect(eff.hpMax).toBe(55);
    // hpCurrent: min(55, 40 + (55-50)) = 45
    expect(eff.hpCurrent).toBe(45);
  });

  test('DEF/CRIT/AGI recebem apenas equipamento, não permanentBonuses nem pantheonBonuses', () => {
    const hero = makeHero({ equippedItems: ['eq1'] });
    const state = makeState({
      inventory: [{ id: 'eq1', name: 'Shield', type: 'armor', statBonus: { defense: 3, crit: 2, agility: 1 }, tier: 1 }],
      permanentBonuses: { atk: 99, hp: 99 },
      pantheonBonuses: { atkPercent: 100, hpPercent: 100, goldPercent: 0 },
    });
    const eff = getEffectiveStats(hero, state);
    // defense = 5 (base) + 3 (equip) = 8 — NÃO sofre multiplicador de panteão
    expect(eff.defense).toBe(8);
    expect(eff.crit).toBe(12);
    expect(eff.agility).toBe(6);
  });

  test('combinação completa: equip + permanent + pantheon', () => {
    const hero = makeHero({ hpCurrent: 50, hpMax: 50, equippedItems: ['eq1'] });
    const state = makeState({
      inventory: [{ id: 'eq1', name: 'Sword', type: 'weapon', statBonus: { atk: 5, hp: 10 }, tier: 1 }],
      permanentBonuses: { atk: 2, hp: 5 },
      pantheonBonuses: { atkPercent: 10, hpPercent: 20, goldPercent: 5 },
    });
    const eff = getEffectiveStats(hero, state);
    // atk: (10 base + 5 equip + 2 permanent) * 1.10 = 17 * 1.10 = 18 (floor)
    expect(eff.atk).toBe(18);
    // hpMax: (50 base + 10 equip + 5 permanent) * 1.20 = 65 * 1.20 = 78
    expect(eff.hpMax).toBe(78);
  });
});

describe('applyGoldBonus', () => {
  test('sem pantheonBonuses retorna reward intacto', () => {
    const state = makeState();
    expect(applyGoldBonus(100, state)).toBe(100);
  });

  test('goldPercent 0 retorna reward intacto', () => {
    const state = makeState({ pantheonBonuses: { atkPercent: 5, hpPercent: 5, goldPercent: 0 } });
    expect(applyGoldBonus(100, state)).toBe(100);
  });

  test('goldPercent 5 retorna floor(100 * 1.05) = 105', () => {
    const state = makeState({ pantheonBonuses: { atkPercent: 0, hpPercent: 0, goldPercent: 5 } });
    expect(applyGoldBonus(100, state)).toBe(105);
  });

  test('goldPercent 8 com reward 50 retorna floor(50 * 1.08) = 54', () => {
    const state = makeState({ pantheonBonuses: { atkPercent: 0, hpPercent: 0, goldPercent: 8 } });
    expect(applyGoldBonus(50, state)).toBe(54);
  });
});
```

Run: `npm test -- --testPathPattern=heroUtils.test`
Expected: FAIL com "getEffectiveStats is not exported from '../../utils/heroUtils'" — confirma que os testes estão rodando antes da implementação.

- [ ] **Step 2: Implementar `EffectiveStats`, `getEffectiveStats` e `applyGoldBonus` em `src/utils/heroUtils.ts`**

Substituir o conteúdo completo do arquivo:

```ts
import { Hero, HeroTask, GameState } from '../types';
import { INCAPACITATED_HP_THRESHOLD } from '../constants/game';

/** HP is below the incapacitation threshold (< 3). */
export function isHeroIncapacitated(hero: Hero): boolean {
  return hero.hpCurrent < INCAPACITATED_HP_THRESHOLD;
}

/** Hero is currently on a mission. */
export function isHeroInMission(hero: Hero): boolean {
  return hero.currentTask === HeroTask.MISSION;
}

/** Hero is not on a mission and not incapacitated — can be sent on a new mission. */
export function isHeroAvailableForMission(hero: Hero): boolean {
  return !isHeroInMission(hero) && !isHeroIncapacitated(hero);
}

/** Hero's current HP is below max — eligible for infirmary healing. */
export function isHeroInjured(hero: Hero): boolean {
  return hero.hpCurrent < hero.hpMax;
}

/**
 * Stats de combate efetivos com todos os bônus aplicados.
 * hpCurrent é incluído para permitir escalonamento proporcional ao ganho de hpMax.
 */
export interface EffectiveStats {
  hpMax: number;
  hpCurrent: number;
  atk: number;
  mp: number;
  defense: number;
  crit: number;
  agility: number;
}

/**
 * Único ponto de verdade para stats de combate efetivos.
 *
 * Ordem de composição (determinística):
 *   1. base (treinado)
 *   2. + equipamento (flat, todos os stats)
 *   3. + permanentBonuses (flat atk e hp apenas — conquistas)
 *   4. × pantheonBonuses (multiplicador atkPercent e hpPercent)
 *
 * DEF / CRIT / AGI só recebem equipamento (restrição: não são treináveis diretamente).
 * hpCurrent escala proporcional ao ganho de hpMax em cada etapa.
 */
export function getEffectiveStats(hero: Hero, state: GameState): EffectiveStats {
  const inventory = state.inventory ?? [];
  const equipped = hero.equippedItems ?? [];

  // ── 1. Base ──────────────────────────────────────────────────────────────
  let hpMax = hero.hpMax;
  let hpCurrent = hero.hpCurrent;
  let atk = hero.atk;
  let mp = hero.mp;
  let defense = hero.defense ?? 0;
  let crit = hero.crit ?? 0;
  let agility = hero.agility ?? 0;

  // ── 2. Equipamento (flat) ─────────────────────────────────────────────────
  for (const eqId of equipped) {
    const item = inventory.find(e => e.id === eqId);
    if (!item) continue;
    const b = item.statBonus;
    if (b.hp) {
      const gain = b.hp;
      hpCurrent = Math.min(hpMax + gain, hpCurrent + gain);
      hpMax += gain;
    }
    if (b.atk) atk += b.atk;
    if (b.mp) mp += b.mp;
    if (b.defense) defense += b.defense;
    if (b.crit) crit += b.crit;
    if (b.agility) agility += b.agility;
  }

  // ── 3. permanentBonuses (flat atk e hp apenas) ──────────────────────────
  const perm = state.permanentBonuses;
  if (perm) {
    if (perm.hp) {
      const gain = perm.hp;
      hpCurrent = Math.min(hpMax + gain, hpCurrent + gain);
      hpMax += gain;
    }
    if (perm.atk) atk += perm.atk;
  }

  // ── 4. pantheonBonuses (multiplicador sobre atk e hpMax) ─────────────────
  const pan = state.pantheonBonuses;
  if (pan) {
    if (pan.atkPercent) {
      atk = Math.floor(atk * (1 + pan.atkPercent / 100));
    }
    if (pan.hpPercent) {
      const oldHpMax = hpMax;
      hpMax = Math.floor(hpMax * (1 + pan.hpPercent / 100));
      const hpGain = hpMax - oldHpMax;
      hpCurrent = Math.min(hpMax, hpCurrent + hpGain);
    }
  }

  return { hpMax, hpCurrent, atk, mp, defense, crit, agility };
}

/**
 * Aplica o bônus percentual de gold do panteão sobre uma recompensa.
 * Chamado no momento da concessão do gold (missão completa) — nunca antes.
 * Retorna floor para evitar frações de gold.
 */
export function applyGoldBonus(reward: number, state: GameState): number {
  const goldPercent = state.pantheonBonuses?.goldPercent ?? 0;
  if (goldPercent <= 0) return reward;
  return Math.floor(reward * (1 + goldPercent / 100));
}
```

Run: `npm test -- --testPathPattern=heroUtils.test`
Expected: PASS (12 testes)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add src/utils/heroUtils.ts src/__tests__/utils/heroUtils.test.ts
git commit -m "feat(stats): getEffectiveStats e applyGoldBonus — único ponto de verdade para bônus de combate"
```

---

## Task A2 — Refatorar `missionHandler.ts`: substituir blocos inline por `getEffectiveStats`

**Files:**
- Modify: `src/context/missionHandler.ts`

**Contexto:** Existem dois blocos que aplicam bônus de equipamento inline:
- Bloco 1 (linhas 89-109): em `handleStartMission`, constrói `heroesWithEquipment` para o `computeBattleOutcome` inicial.
- Bloco 2 (linhas 261-280 em `tickHandler.ts`): no loop de auto-restart de missão em looping — **este pertence a `tickHandler.ts` e é tratado na Task A3**.

- [ ] **Step 1: Importar `getEffectiveStats` em `missionHandler.ts`**

No topo de `src/context/missionHandler.ts`, linha 15, após a importação de `isHeroAvailableForMission`, adicionar:

```ts
import { isHeroAvailableForMission, getEffectiveStats } from '../utils/heroUtils';
```

(Substituir a linha existente `import { isHeroAvailableForMission } from '../utils/heroUtils';`)

- [ ] **Step 2: Substituir o bloco `heroesWithEquipment` inline por `getEffectiveStats`**

Em `src/context/missionHandler.ts`, localizar o bloco das linhas 88-109:

```ts
  // Apply equipment stat bonuses to hero copies for battle
  const heroesWithEquipment = heroesForMission.map(h => {
    const equipped = h.equippedItems || [];
    if (equipped.length === 0) return h;
    const copy = { ...h };
    for (const eqId of equipped) {
      const item = (state.inventory || []).find(e => e.id === eqId);
      if (!item) continue;
      const bonus = item.statBonus;
      if (bonus.hp) copy.hpMax += bonus.hp;
      if (bonus.atk) copy.atk += bonus.atk;
      if (bonus.mp) copy.mp += bonus.mp;
      if (bonus.defense) copy.defense = (copy.defense ?? 0) + bonus.defense;
      if (bonus.crit) copy.crit = (copy.crit ?? 0) + bonus.crit;
      if (bonus.agility) copy.agility = (copy.agility ?? 0) + bonus.agility;
    }
    // Also boost current HP proportionally
    if (copy.hpMax > h.hpMax) {
      copy.hpCurrent = Math.min(copy.hpMax, copy.hpCurrent + (copy.hpMax - h.hpMax));
    }
    return copy;
  });
```

Substituir por:

```ts
  // Apply all stat bonuses (equipment + permanentBonuses + pantheonBonuses) via central helper
  const heroesWithEquipment = heroesForMission.map(h => {
    const eff = getEffectiveStats(h, state);
    return { ...h, hpMax: eff.hpMax, hpCurrent: eff.hpCurrent, atk: eff.atk, mp: eff.mp, defense: eff.defense, crit: eff.crit, agility: eff.agility };
  });
```

- [ ] **Step 3: Aplicar `applyGoldBonus` na função `handleCompleteMission`**

Adicionar import de `applyGoldBonus` na mesma linha do Step 1:

```ts
import { isHeroAvailableForMission, getEffectiveStats, applyGoldBonus } from '../utils/heroUtils';
```

Localizar em `handleCompleteMission` (linha ~169) o trecho:

```ts
    gold: state.gold + reward,
```

Substituir por:

```ts
    gold: state.gold + applyGoldBonus(reward, state),
```

- [ ] **Step 4: Rodar testes**

Run: `npm test`
Expected: PASS — todos os testes existentes devem continuar verdes.

- [ ] **Step 5: Commit**

```bash
git add src/context/missionHandler.ts
git commit -m "refactor(mission): substituir cálculo inline de equip por getEffectiveStats e aplicar goldBonus"
```

---

## Task A3 — Refatorar `tickHandler.ts`: remover duplicação e aplicar gold bonus

**Files:**
- Modify: `src/context/tickHandler.ts`

**Contexto:** Há um segundo bloco de aplicação inline de equipamento em `tickHandler.ts` dentro da função `processMissions`, no ramo de missão em looping (linhas ~261-279). Também o gold ganho via tick (`goldGained`) deve ter o bônus de panteão aplicado.

- [ ] **Step 1: Importar `getEffectiveStats` e `applyGoldBonus` em `tickHandler.ts`**

No topo de `src/context/tickHandler.ts`, localizar a linha existente com imports de `battleSim`:

```ts
import { computeBattleOutcome } from '../utils/battleSim';
```

Adicionar após ela:

```ts
import { getEffectiveStats, applyGoldBonus } from '../utils/heroUtils';
```

- [ ] **Step 2: Substituir o bloco `heroesWithEquipment` inline no loop de looping**

Em `src/context/tickHandler.ts`, dentro de `processMissions`, localizar o bloco (linhas ~261-280):

```ts
          // Apply equipment stat bonuses for battle computation
          const heroesWithEquipment = heroesForNext.map(h => {
            const equipped = h.equippedItems || [];
            if (equipped.length === 0) return h;
            const copy = { ...h };
            for (const eqId of equipped) {
              const item = (state.inventory || []).find(e => e.id === eqId);
              if (!item) continue;
              const bonus = item.statBonus;
              if (bonus.hp) copy.hpMax += bonus.hp;
              if (bonus.atk) copy.atk += bonus.atk;
              if (bonus.mp) copy.mp += bonus.mp;
              if (bonus.defense) copy.defense = (copy.defense ?? 0) + bonus.defense;
              if (bonus.crit) copy.crit = (copy.crit ?? 0) + bonus.crit;
              if (bonus.agility) copy.agility = (copy.agility ?? 0) + bonus.agility;
            }
            if (copy.hpMax > h.hpMax) {
              copy.hpCurrent = Math.min(copy.hpMax, copy.hpCurrent + (copy.hpMax - h.hpMax));
            }
            return copy;
          });
```

Substituir por:

```ts
          // Apply all stat bonuses via central helper
          const heroesWithEquipment = heroesForNext.map(h => {
            const eff = getEffectiveStats(h, state);
            return { ...h, hpMax: eff.hpMax, hpCurrent: eff.hpCurrent, atk: eff.atk, mp: eff.mp, defense: eff.defense, crit: eff.crit, agility: eff.agility };
          });
```

- [ ] **Step 3: Aplicar `applyGoldBonus` no gold acumulado do tick**

Em `src/context/tickHandler.ts`, dentro de `processMissions`, localizar os dois sites onde `goldGained` é incrementado:

**Site 1** — ramo de looping (linha ~254):
```ts
      goldGained += c.reward;
```

**Site 2** — ramo de conclusão normal (linha ~336):
```ts
      goldGained += c.reward;
```

Ambos os sites devem ser substituídos por:

```ts
      goldGained += applyGoldBonus(c.reward, state);
```

(Nota: há exatamente duas ocorrências de `goldGained += c.reward;` em `processMissions`. Substituir as duas.)

- [ ] **Step 4: Rodar testes completos**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Adicionar teste de gold com bônus de panteão em `tickHandler.test.ts`**

Adicionar ao final de `src/__tests__/context/tickHandler.test.ts`:

```ts
describe('gold bonus via pantheonBonuses', () => {
  test('handleTick aplica goldPercent do panteão sobre reward da missão', () => {
    // Configurar missão já concluída (finishAt no passado) com precomputedOutcome.reward = 100
    const now = Date.now();
    const missionId = 'test-mission';
    const hero = createHero({ id: 'h1', currentTask: HeroTask.MISSION });
    const state = {
      ...initialGameState,
      gold: 0,
      heroes: [hero],
      pantheonBonuses: { goldPercent: 10, atkPercent: 0, hpPercent: 0 },
      activeMissions: [
        {
          id: missionId,
          templateId: 'mission_1', // deve casar com um id real de MISSIONS
          heroIds: ['h1'],
          startedAt: now - 100000,
          finishAt: now - 1000,
          looping: false,
          scheduledActions: [],
          enemiesState: [],
          precomputedOutcome: {
            reward: 100,
            rounds: 5,
            actions: [],
            log: [],
            success: true,
            casualties: [],
            enemyCasualties: 2,
          },
        },
      ],
    } as any;

    const next = handleTick(state, now);
    // 100 * 1.10 = 110
    expect(next.gold).toBe(110);
  });
});
```

Run: `npm test -- --testPathPattern=tickHandler.test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/context/tickHandler.ts src/__tests__/context/tickHandler.test.ts
git commit -m "refactor(tick): centralizar getEffectiveStats no loop de looping e aplicar goldBonus no processamento de missões"
```

---

## Task C1 — Tracker semanal `itemsForged` em `equipmentHandler.ts`

**Files:**
- Modify: `src/context/equipmentHandler.ts`
- Modify: `src/__tests__/context/equipmentHandler.forge.test.ts`

### TDD: teste primeiro

- [ ] **Step 1: Adicionar `import` de `refreshWeeklyState` no topo de `equipmentHandler.forge.test.ts`**

No topo de `src/__tests__/context/equipmentHandler.forge.test.ts`, após a linha existente
`import { handleForgeEquipment } from '../../context/equipmentHandler';`, adicionar:

```ts
import { refreshWeeklyState } from '../../context/weeklyHandler';
```

(O import deve ficar entre os demais imports no início do arquivo, não no final.)

- [ ] **Step 2: Adicionar os describes de tracker semanal ao final do arquivo**

Adicionar ao final de `src/__tests__/context/equipmentHandler.forge.test.ts` (após o último `}`):

```ts
describe('tracker semanal itemsForged', () => {
  test('FORGE_EQUIPMENT incrementa weeklyState.progress.itemsForged', () => {
    // Inicializar com weeklyState ativo
    const stateWithWeekly = refreshWeeklyState({ ...baseState });
    const result = handleForgeEquipment(stateWithWeekly, 1, 'weapon', Date.now());
    expect(result.weeklyState?.progress['itemsForged']).toBe(1);
  });

  test('forjar 3 itens acumula itemsForged = 3', () => {
    let s = refreshWeeklyState({ ...baseState });
    s = handleForgeEquipment(s, 1, 'weapon', Date.now());
    s = handleForgeEquipment(s, 1, 'weapon', Date.now());
    s = handleForgeEquipment(s, 1, 'weapon', Date.now());
    expect(s.weeklyState?.progress['itemsForged']).toBe(3);
  });
});
```

Run: `npm test -- --testPathPattern=equipmentHandler.forge.test`
Expected: FAIL com "Expected: 1, Received: undefined"

- [ ] **Step 3: Implementar — adicionar `updateWeeklyProgress` em `handleForgeEquipment`**

Em `src/context/equipmentHandler.ts`, após a linha existente `import { updateDailyProgress } from './dailyQuestHandler';` (linha 4), adicionar:

```ts
import { updateWeeklyProgress } from './weeklyHandler';
```

Localizar o final de `handleForgeEquipment` (linha 46):

```ts
  return updateDailyProgress(newState, 'itemsForged', 1);
```

Substituir por:

```ts
  const afterDaily = updateDailyProgress(newState, 'itemsForged', 1);
  return updateWeeklyProgress(afterDaily, 'itemsForged', 1);
```

- [ ] **Step 4: Rodar testes**

Run: `npm test -- --testPathPattern=equipmentHandler`
Expected: PASS (todos os testes de equipment)

- [ ] **Step 5: Commit**

```bash
git add src/context/equipmentHandler.ts src/__tests__/context/equipmentHandler.forge.test.ts
git commit -m "feat(weekly): tracker itemsForged incrementado na forja"
```

---

## Task C2 — Tracker semanal `fusionsCompleted` em `pantheonHandler.ts`

**Files:**
- Modify: `src/context/pantheonHandler.ts`
- Modify: `src/__tests__/context/pantheonHandler.test.ts`

### TDD: teste primeiro

- [ ] **Step 1: Adicionar import de `refreshWeeklyState` no topo de `pantheonHandler.test.ts`**

No topo de `src/__tests__/context/pantheonHandler.test.ts`, após a linha existente
`import { calculatePantheonBonuses, createFusedHero, handleFuseHeroes } from '../../context/pantheonHandler';`, adicionar:

```ts
import { refreshWeeklyState } from '../../context/weeklyHandler';
```

- [ ] **Step 2: Adicionar o teste dentro do `describe('handleFuseHeroes', ...)` existente**

Adicionar dentro do bloco `describe('handleFuseHeroes', ...)` em `src/__tests__/context/pantheonHandler.test.ts`, antes do `});` final desse describe:

```ts
    test('handleFuseHeroes incrementa fusionsCompleted no weeklyState', () => {
      const baseStateWithWeekly = refreshWeeklyState({
        gold: 100,
        heroes: [
          makeHero({ id: 'a' }),
          makeHero({ id: 'b' }),
          makeHero({ id: 'c' }),
        ],
        heroesRecruited: 3,
        lastSavedAt: Date.now(),
      });
      const newState = handleFuseHeroes(baseStateWithWeekly, ['a', 'b', 'c'] as [string, string, string]);
      expect(newState.weeklyState?.progress['fusionsCompleted']).toBe(1);
    });
```

Run: `npm test -- --testPathPattern=pantheonHandler.test`
Expected: FAIL com "Expected: 1, Received: undefined"

- [ ] **Step 3: Implementar — adicionar `updateWeeklyProgress` em `handleFuseHeroes`**

Em `src/context/pantheonHandler.ts`, após a linha 6 (`import { v4 as uuidv4 } from 'uuid';`), adicionar:

```ts
import { updateWeeklyProgress } from './weeklyHandler';
```

Localizar em `handleFuseHeroes` o trecho (linha ~117-125):

```ts
  const newState = {
    ...state,
    heroes: [...remainingHeroes, fusedHero],
    pantheonFusions: (state.pantheonFusions ?? 0) + 1,
  };

  newState.pantheonBonuses = calculatePantheonBonuses(newState.heroes);

  return newState;
```

Substituir por:

```ts
  const newState = {
    ...state,
    heroes: [...remainingHeroes, fusedHero],
    pantheonFusions: (state.pantheonFusions ?? 0) + 1,
  };

  newState.pantheonBonuses = calculatePantheonBonuses(newState.heroes);

  return updateWeeklyProgress(newState, 'fusionsCompleted', 1);
```

- [ ] **Step 4: Rodar testes**

Run: `npm test -- --testPathPattern=pantheonHandler.test`
Expected: PASS (todos os testes do pantheonHandler)

- [ ] **Step 5: Commit**

```bash
git add src/context/pantheonHandler.ts src/__tests__/context/pantheonHandler.test.ts
git commit -m "feat(weekly): tracker fusionsCompleted incrementado na fusão de heróis"
```

---

## Task C3 — Nota sobre `weeklyBossKills` (dependência da Fase 4)

O tracker `weeklyBossKills` será incrementado na Fase 4, quando o fluxo de combate de boss semanal for implementado. A função `updateWeeklyProgress(state, 'weeklyBossKills', 1)` deve ser chamada em `missionHandler`/`tickHandler` no ramo de conclusão da missão de boss (`isWeeklyBoss === true && success === true`). Nenhuma implementação aqui — apenas referência para o engenheiro da Fase 4.

---

## Task A4 — Exibir stats efetivos no `HeroDetailsModal.tsx`

**Files:**
- Modify: `src/components/HeroDetailsModal.tsx`

**Comportamento esperado:** A seção "Status de Combate" exibe o valor efetivo (base + todos os bônus). Se houver delta > 0, exibe o valor efetivo em destaque e o delta `(+N)` em verde ao lado. DEF/CRIT/AGI seguem a mesma lógica mas só recebem bônus de equipamento. Não há teste unit para componente UI — validação via browser (Playwright) na Fase 2.

- [ ] **Step 1: Importar `getEffectiveStats` no modal**

Em `src/components/HeroDetailsModal.tsx`, linha 8, após `import { useGame } from '../hooks/useGame';`, adicionar:

```ts
import { getEffectiveStats } from '../utils/heroUtils';
```

- [ ] **Step 2: Calcular stats efetivos no corpo do componente**

Em `src/components/HeroDetailsModal.tsx`, localizar após `const equippedEquipment = ...` (linha ~27), adicionar:

```ts
  const effectiveStats = getEffectiveStats(hero, state);

  // Deltas para mostrar o ganho dos bônus na UI
  const atkDelta = effectiveStats.atk - hero.atk;
  const hpMaxDelta = effectiveStats.hpMax - hero.hpMax;
  const mpDelta = effectiveStats.mp - hero.mp;
  const defenseDelta = effectiveStats.defense - (hero.defense ?? 0);
  const critDelta = effectiveStats.crit - (hero.crit ?? 0);
  const agilityDelta = effectiveStats.agility - (hero.agility ?? 0);
```

- [ ] **Step 3: Substituir os valores exibidos na seção "Status de Combate"**

Localizar a linha (linha ~79):

```tsx
              <StatItem label="Ataque" value={Math.floor(hero.atk)} icon="⚔️" color={theme.colors.atk} />
```

Substituir por:

```tsx
              <StatItem
                label="Ataque"
                value={atkDelta > 0 ? `${Math.floor(effectiveStats.atk)} (+${atkDelta})` : Math.floor(effectiveStats.atk)}
                icon="⚔️"
                color={theme.colors.atk}
              />
```

Localizar a linha (linha ~80):

```tsx
              <StatItem label="Mana" value={Math.floor(hero.mp)} icon="🔮" color={theme.colors.mp} />
```

Substituir por:

```tsx
              <StatItem
                label="Mana"
                value={mpDelta > 0 ? `${Math.floor(effectiveStats.mp)} (+${mpDelta})` : Math.floor(effectiveStats.mp)}
                icon="🔮"
                color={theme.colors.mp}
              />
```

Localizar o bloco da seção "Pontos de Vida" (linhas 74-76, que inclui o `Text` e o `HPBar`):

```tsx
                  <Text style={styles.hpValue}>{Math.floor(hero.hpCurrent)} / {Math.floor(hero.hpMax)}</Text>
                </View>
                <HPBar current={hero.hpCurrent} max={hero.hpMax} />
```

Substituir por:

```tsx
                  <Text style={styles.hpValue}>
                    {Math.floor(effectiveStats.hpCurrent)} / {Math.floor(effectiveStats.hpMax)}
                    {hpMaxDelta > 0 ? <Text style={{ color: theme.colors.success }}> (+{hpMaxDelta})</Text> : null}
                  </Text>
                </View>
                <HPBar current={effectiveStats.hpCurrent} max={effectiveStats.hpMax} />
```

- [ ] **Step 4: Substituir os valores na seção "Atributos Secundários"**

Localizar as linhas (linha ~99-101):

```tsx
              <StatItem label="Defesa" value={Math.floor(hero.defense || 0)} icon="🛡️" />
              <StatItem label="Crítico" value={`${Math.floor(hero.crit || 0)}%`} icon="🎯" />
              <StatItem label="Agilidade" value={Math.floor(hero.agility || 0)} icon="🏃" />
```

Substituir por:

```tsx
              <StatItem
                label="Defesa"
                value={defenseDelta > 0 ? `${Math.floor(effectiveStats.defense)} (+${defenseDelta})` : Math.floor(effectiveStats.defense)}
                icon="🛡️"
              />
              <StatItem
                label="Crítico"
                value={critDelta > 0 ? `${Math.floor(effectiveStats.crit)}% (+${critDelta})` : `${Math.floor(effectiveStats.crit)}%`}
                icon="🎯"
              />
              <StatItem
                label="Agilidade"
                value={agilityDelta > 0 ? `${Math.floor(effectiveStats.agility)} (+${agilityDelta})` : Math.floor(effectiveStats.agility)}
                icon="🏃"
              />
```

- [ ] **Step 5: Type-check e testes**

Run: `npx tsc --noEmit`
Expected: sem erros

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/HeroDetailsModal.tsx
git commit -m "feat(ui): HeroDetailsModal exibe stats efetivos com delta de bônus"
```

---

## Verificação final

- [ ] **Step 1: Rodar a suíte completa**

Run: `npm test`
Expected: todos os testes passam (≥ 343 testes unit)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 3: Simulações de batalha (smoke test de regressão)**

Run: `npm run simulate:m1`
Expected: finaliza sem erro, mostrando log de batalha com resultado (vitória ou derrota)

Run: `npm run simulate:m2`
Expected: sem erro

- [ ] **Step 4: Commit de encerramento de fase**

```bash
git add -p  # revisar qualquer arquivo não commitado
git commit -m "chore(fase1): fase 1 backend wiring completa — getEffectiveStats, goldBonus, trackers semanais"
git push
```

---

## Resumo das decisões de design

| Decisão | Justificativa |
|---|---|
| `getEffectiveStats` retorna cópia (não muta hero) | Segurança: o hero original no `GameState` nunca deve ter bônus assados |
| `hpCurrent` incluído no `EffectiveStats` | Permitir escalonamento proporcional ao ganho de hpMax sem lógica duplicada |
| `applyGoldBonus` separado de `getEffectiveStats` | Gold é recompensa de missão, não stat de herói; separa responsabilidades |
| DEF/CRIT/AGI excluídos de permanentBonuses/pantheon | Restrição de projeto: só crescem via equipamento/passivo |
| Ambos os sites de `goldGained += c.reward` convertidos | Evitar que missão normal e missão em looping tenham tratamento diferente |
| `weeklyBossKills` deixado para Fase 4 | Depende do fluxo de boss que ainda não existe; documentar a dependência aqui |
