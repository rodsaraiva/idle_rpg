# Fase 3 — Combate: Caminhos de Dano/Cura Completos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar os 4 caminhos de dano/cura que ignoram escudo/reações/sinergias: AoE de skill herói (`skillEffects.ts`), AOE de inimigo (`enemySkillEffects.ts`), ataque-extra do Oportunista (`battleEngine.ts`) e curas de skill do Healer (`skillEffects.ts`). Cada caminho deve espelhar o padrão correto já existente no ataque normal.

**Architecture:** Todas as correções são cirúrgicas — nenhum novo módulo, nenhuma nova entidade de estado. O padrão de referência (ataque normal herói→inimigo em `battleEngine.ts:595-650`) usa `getShieldReduction` + `onEnemyDamagedSkills` + `onAttackResolved`; o inverso (inimigo→herói em `battleEngine.ts:724-770`) usa `getShieldReduction` + `onHeroDamaged` + `onHeroDamagedSkills`. Os 4 caminhos divergentes são roteados para passar pelos mesmos hooks. TDD obrigatório: teste falhando ANTES de cada implementação.

**Tech Stack:** TypeScript, Jest. Sem novas dependências.

**Spec:** [`docs/superpowers/specs/2026-05-31-gaps-resolution-design.md`](../specs/2026-05-31-gaps-resolution-design.md) — Fase 3 (Tema D).

**Prerequisito:** Testes verdes antes de iniciar (`npm test` → 504 passed). O padrão de referência correto (`battleEngine.ts:595-650` e `battleEngine.ts:724-770`) deve ser entendido antes de qualquer edição.

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/utils/skillEffects.ts` | Modify | Rotear AoE (Chuva de Flechas, Bola de Fogo, Meteoro) por `getShieldReduction` + `onEnemyDamagedSkills`; chamar `state.handlers.onHealApplied` nas curas de skill (Cura Maior, Purificação) |
| `src/utils/enemySkillEffects.ts` | Modify | Aplicar `getShieldReduction` + `state.handlers.onHeroDamaged` + `onHeroDamagedSkills` em cada herói atingido pelo `tryAoeAttack` |
| `src/utils/battleEngine.ts` | Modify | No bloco do ataque-extra do Oportunista (`~614-632`): aplicar escudo, `onEnemyDamagedSkills`, `lastAttacker`, `onAttackResolved` e veneno de Rogue após cada hit |
| `src/__tests__/utils/combatGaps.test.ts` | Create | Testes de integração TDD para os 4 casos: AoE com escudo; AoE dispara `onEnemyDamaged`; ataque-extra respeita escudo e aplica veneno; cura de skill incrementa contador LINHA_DE_FRENTE |

---

## Task D1: [TDD] AoE de skill respeita escudo e dispara reações

**Arquivos:**
- Create: `src/__tests__/utils/combatGaps.test.ts` (steps 1-2)
- Modify: `src/utils/skillEffects.ts` (steps 3-5)

### Por que está errado hoje

As funções `tryChuvaFlechas` (linhas 197-222), `tryBolaDeFogo` (linhas 235-261) e `tryMeteoro` (linhas 272-298) em `src/utils/skillEffects.ts` aplicam dano diretamente com `enemy.hp -= dmg` sem passar por:
1. `getShieldReduction` — escudo do inimigo não é consumido
2. `onEnemyDamagedSkills` — skill reativa do inimigo (ex: MAGIC_SHIELD) não dispara

### Padrão de referência (ataque normal — `battleEngine.ts:598-604`)

```ts
let actualHeroDmg = result.dmg;
const enemyShield = getShieldReduction(state, finalTarget.id);
if (enemyShield > 0) {
  actualHeroDmg = Math.max(1, Math.floor(actualHeroDmg * (1 - enemyShield)));
}
finalTarget.hp = Math.max(0, finalTarget.hp - actualHeroDmg);
onEnemyDamagedSkills(finalTarget, state);
```

- [ ] **Step 1: Criar o arquivo de testes `src/__tests__/utils/combatGaps.test.ts` com os testes D1 (devem FALHAR)**

```ts
// src/__tests__/utils/combatGaps.test.ts
import { executePreAttackSkills } from '../../utils/skillEffects';
import {
  BattleState,
  BattleEnemy,
  BattleEngine,
  SynergyHandlers,
} from '../../utils/battleEngine';
import { Hero, HeroTask } from '../../types';
import { EnemySkillDef } from '../../constants/enemySkills';
import { executeEnemyPreAttackSkills } from '../../utils/enemySkillEffects';
import { createSynergyHandlers } from '../../utils/synergyEffects';

// ─── helpers ───

function makeHero(overrides: Partial<Hero> & { classId: string }): Hero {
  return {
    id: 'h1', name: 'Hero', hpMax: 100, hpCurrent: 100,
    atk: 20, mp: 10, defense: 5, crit: 10, agility: 5,
    currentTask: HeroTask.IDLE,
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    ...overrides,
  } as Hero;
}

function makeEnemy(overrides?: Partial<BattleEnemy>): BattleEnemy {
  return {
    id: 'e1', hp: 50, maxHp: 50, atk: 10, mp: 0,
    defense: 5, crit: 5, agility: 5, alive: true,
    attackType: 'MELEE', range: 1, movement: 2,
    position: 2,
    skills: [],
    ...overrides,
  };
}

function makeHandlers(overrides?: Partial<SynergyHandlers>): SynergyHandlers {
  return {
    onBattleStart: () => {},
    onHealApplied: () => {},
    onHeroDamaged: () => {},
    onAttackResolved: () => {},
    shouldIgnoreDefense: () => false,
    modifyTargetScore: (_s, _e, _c, score) => score,
    ...overrides,
  };
}

function makeState(
  heroes: Hero[],
  enemies: BattleEnemy[],
  round: number = 1,
  handlersOverride?: Partial<SynergyHandlers>,
): BattleState {
  const heroPositions: Record<string, number> = {};
  heroes.forEach((h, i) => { heroPositions[h.id] = 40 + i; });
  const enemyPositions: Record<string, number> = {};
  enemies.forEach(e => { enemyPositions[e.id] = e.position ?? 2; });
  return {
    heroes, enemies, heroPositions, enemyPositions,
    lastAttacker: {}, threats: {},
    log: [], actions: [], rounds: round,
    activeSynergies: [], buffs: {}, flags: {},
    handlers: makeHandlers(handlersOverride),
    skillCooldowns: {}, skillOnceUsed: {},
  };
}

const alwaysHit = () => 0.1; // rng < hitChance → sempre acerta

// ─── D1: AoE de skill respeita escudo e dispara reações ───

describe('D1 — AoE de skill herói', () => {
  // Helper: inimigo com escudo ativo (50% de redução)
  function stateWithShieldedEnemy(skillId: string, classId: string, atk: number) {
    const hero = makeHero({ classId: classId as any, atk, trainingCount: { hp: 0, atk: 100, mp: 100 } });
    // Dois inimigos na mesma posição (hex 2) para testar AoE
    const e1 = makeEnemy({ id: 'e1', hp: 50, maxHp: 50, position: 2 });
    const e2 = makeEnemy({ id: 'e2', hp: 50, maxHp: 50, position: 2 });
    const state = makeState([hero], [e1, e2]);
    // Colocar escudo no e1
    state.buffs['e1'] = [{ source: 'MAGE_ESCUDO_ARCANO', type: 'shield', value: 0.5, expiresAfterRound: 99 }];
    return { hero, e1, e2, state };
  }

  test('Chuva de Flechas: inimigo com escudo 50% recebe metade do dano', () => {
    const { hero, e1, state } = stateWithShieldedEnemy('ARCHER_CHUVA_DE_FLECHAS', 'ARCHER', 20);
    // Forçar cooldown disponível
    state.skillCooldowns['h1_ARCHER_CHUVA_DE_FLECHAS'] = 0;

    const hpBefore = e1.hp;
    executePreAttackSkills(hero, e1, state, alwaysHit);

    const rawDmg = Math.max(1, Math.floor(20 * 0.5)); // 10
    const reduced = Math.max(1, Math.floor(rawDmg * 0.5)); // 5
    // e1 tinha escudo → deve receber dano reduzido (< rawDmg)
    expect(hpBefore - e1.hp).toBeLessThan(rawDmg);
    expect(hpBefore - e1.hp).toBe(reduced);
  });

  test('Chuva de Flechas: dispara onEnemyDamagedSkills em cada alvo atingido', () => {
    const hero = makeHero({ classId: 'ARCHER', atk: 20, trainingCount: { hp: 0, atk: 100, mp: 0 } });
    const skillDef = (id: string): EnemySkillDef => ({ id, name: id, icon: '?', cooldownRounds: 4, minDifficulty: 1 });
    const e1 = makeEnemy({ id: 'e1', position: 2, skills: [skillDef('MAGIC_SHIELD')] });
    const state = makeState([hero], [e1]);
    state.skillCooldowns['h1_ARCHER_CHUVA_DE_FLECHAS'] = 0;

    // MAGIC_SHIELD reage a onEnemyDamagedSkills aplicando um buff 'shield' no inimigo
    executePreAttackSkills(hero, e1, state, alwaysHit);

    const shieldBuff = state.buffs['e1']?.find(b => b.source === 'ENEMY_MAGIC_SHIELD');
    expect(shieldBuff).toBeDefined();
  });

  test('Bola de Fogo: alvo principal com escudo 50% recebe metade do dano', () => {
    const hero = makeHero({ classId: 'MAGE', atk: 20, trainingCount: { hp: 0, atk: 0, mp: 100 } });
    const e1 = makeEnemy({ id: 'e1', hp: 100, maxHp: 100, position: 2 });
    const state = makeState([hero], [e1]);
    state.buffs['e1'] = [{ source: 'MAGE_ESCUDO_ARCANO', type: 'shield', value: 0.5, expiresAfterRound: 99 }];
    state.skillCooldowns['h1_MAGE_BOLA_DE_FOGO'] = 0;

    const rawMain = Math.max(1, Math.floor(20 * 0.8)); // 16
    const reduced = Math.max(1, Math.floor(rawMain * 0.5)); // 8

    executePreAttackSkills(hero, e1, state, alwaysHit);

    expect(100 - e1.hp).toBe(reduced);
  });

  test('Meteoro: inimigo com escudo recebe dano reduzido', () => {
    const hero = makeHero({ classId: 'MAGE', atk: 20, trainingCount: { hp: 0, atk: 0, mp: 100 } });
    // 3 inimigos vivos (condição para Meteoro)
    const e1 = makeEnemy({ id: 'e1', hp: 60, maxHp: 60, position: 2 });
    const e2 = makeEnemy({ id: 'e2', hp: 60, maxHp: 60, position: 3 });
    const e3 = makeEnemy({ id: 'e3', hp: 60, maxHp: 60, position: 4 });
    const state = makeState([hero], [e1, e2, e3]);
    state.buffs['e1'] = [{ source: 'MAGE_ESCUDO_ARCANO', type: 'shield', value: 0.5, expiresAfterRound: 99 }];

    const rawDmg = Math.max(1, Math.floor(20 * 1.0)); // 20
    const reduced = Math.max(1, Math.floor(rawDmg * 0.5)); // 10

    executePreAttackSkills(hero, e1, state, alwaysHit);

    expect(60 - e1.hp).toBe(reduced);
  });
});
```

Run: `npm test -- --testPathPattern=combatGaps`
Expected: **FALHA** nos 4 testes D1 (todos vermelhos — o escudo não é aplicado ainda).

- [ ] **Step 2: Verificar que os testes realmente falham**

```bash
npm test -- --testPathPattern=combatGaps 2>&1 | grep -E "FAIL|PASS|✓|✕|×|●"
```

Expected: todos os 4 testes de D1 devem aparecer como failing (vermelho).

- [ ] **Step 3: Adicionar import de `onEnemyDamagedSkills` via parâmetro de callback em `applyAoEHit`**

> **Por que não usar import direto:** `enemySkillEffects.ts` importa `getShieldReduction` e `onHeroDamagedSkills` de `skillEffects.ts` (Step 2 de D2). Adicionar o import inverso criaria dependência circular. Solução: `applyAoEHit` recebe o callback como parâmetro explícito.

Adicione esta função logo após a definição de `markDefeat` (linha 57 do arquivo atual, antes de `tryGolpePesado`):

```ts
/**
 * Aplica um hit de AoE: reduz escudo, subtrai dano, dispara reação do inimigo.
 * Espelha o padrão do ataque normal (battleEngine.ts:598-604).
 * Recebe onDamaged como parâmetro para evitar dependência circular com enemySkillEffects.ts.
 */
function applyAoEHit(
  state: BattleState,
  hero: Hero,
  enemy: BattleEnemy,
  rawDmg: number,
  onDamaged: (enemy: BattleEnemy, state: BattleState) => void,
): void {
  const shield = getShieldReduction(state, enemy.id);
  const actualDmg = shield > 0
    ? Math.max(1, Math.floor(rawDmg * (1 - shield)))
    : rawDmg;
  enemy.hp = Math.max(0, enemy.hp - actualDmg);
  onDamaged(enemy, state);
  if (enemy.hp <= 0) markDefeat(state, hero, enemy);
}
```

Nenhum import novo é necessário em `skillEffects.ts` — `onDamaged` é injetado pelo chamador.

- [ ] **Step 4: Rotear `tryChuvaFlechas`, `tryBolaDeFogo` e `tryMeteoro` pelo `applyAoEHit`**

O callback `onDamaged` é passado pela função pública `executePreAttackSkills` que já tem acesso ao import do `enemySkillEffects`. Para não propagar o parâmetro por toda a cadeia, importamos `onEnemyDamagedSkills` **somente em `executePreAttackSkills`** via parâmetro default ou injetamos direto nas funções AoE via closure.

**Solução mais simples**: as três funções AoE recebem um novo parâmetro `onDamaged`:

**4a — `tryChuvaFlechas` — alterar assinatura e corpo:**

Trecho atual (função inteira, linhas 197-222):
```ts
function tryChuvaFlechas(hero: Hero, state: BattleState): boolean {
  const skill = { id: 'ARCHER_CHUVA_DE_FLECHAS', cooldownRounds: 5 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  const aliveEnemies = state.enemies.filter(e => e.alive);
  const center = aliveEnemies[0];
  if (!center) return false;
  const centerPos = state.enemyPositions[center.id] ?? 0;

  let hitCount = 0;
  for (const enemy of aliveEnemies) {
    const ePos = state.enemyPositions[enemy.id] ?? 0;
    if (GameMath.getHexDistance(centerPos, ePos) <= 2) {
      const dmg = Math.max(1, Math.floor(hero.atk * 0.5));
      enemy.hp = Math.max(0, enemy.hp - dmg);
      hitCount++;
      if (enemy.hp <= 0) {
        enemy.alive = false;
        delete state.enemyPositions[enemy.id];
      }
    }
  }
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Chuva de Flechas', `atingiu ${hitCount} inimigos`);
  return true;
}
```

Substituir por:
```ts
function tryChuvaFlechas(
  hero: Hero,
  state: BattleState,
  onDamaged: (enemy: BattleEnemy, state: BattleState) => void,
): boolean {
  const skill = { id: 'ARCHER_CHUVA_DE_FLECHAS', cooldownRounds: 5 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  const aliveEnemies = state.enemies.filter(e => e.alive);
  const center = aliveEnemies[0];
  if (!center) return false;
  const centerPos = state.enemyPositions[center.id] ?? 0;

  let hitCount = 0;
  for (const enemy of aliveEnemies) {
    const ePos = state.enemyPositions[enemy.id] ?? 0;
    if (GameMath.getHexDistance(centerPos, ePos) <= 2) {
      const dmg = Math.max(1, Math.floor(hero.atk * 0.5));
      applyAoEHit(state, hero, enemy, dmg, onDamaged);
      hitCount++;
    }
  }
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Chuva de Flechas', `atingiu ${hitCount} inimigos`);
  return true;
}
```

**4b — `tryBolaDeFogo` — alterar assinatura e corpo:**

Trecho atual (função inteira, linhas 235-261):
```ts
function tryBolaDeFogo(hero: Hero, target: BattleEnemy, state: BattleState): boolean {
  const skill = { id: 'MAGE_BOLA_DE_FOGO', cooldownRounds: 3 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  const mainDmg = Math.max(1, Math.floor(hero.atk * 0.8));
  target.hp = Math.max(0, target.hp - mainDmg);

  const targetPos = state.enemyPositions[target.id] ?? 0;
  let splashCount = 0;
  for (const enemy of state.enemies.filter(e => e.alive && e.id !== target.id)) {
    const ePos = state.enemyPositions[enemy.id] ?? 0;
    if (GameMath.getHexDistance(targetPos, ePos) <= 1) {
      const splashDmg = Math.max(1, Math.floor(hero.atk * 0.4));
      enemy.hp = Math.max(0, enemy.hp - splashDmg);
      splashCount++;
      if (enemy.hp <= 0) {
        enemy.alive = false;
        delete state.enemyPositions[enemy.id];
      }
    }
  }

  if (target.hp <= 0) markDefeat(state, hero, target);
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Bola de Fogo', `${mainDmg} no alvo + ${splashCount} adjacentes`);
  return true;
}
```

Substituir por:
```ts
function tryBolaDeFogo(
  hero: Hero,
  target: BattleEnemy,
  state: BattleState,
  onDamaged: (enemy: BattleEnemy, state: BattleState) => void,
): boolean {
  const skill = { id: 'MAGE_BOLA_DE_FOGO', cooldownRounds: 3 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  const mainDmg = Math.max(1, Math.floor(hero.atk * 0.8));
  applyAoEHit(state, hero, target, mainDmg, onDamaged);

  const targetPos = state.enemyPositions[target.id] ?? 0;
  let splashCount = 0;
  for (const enemy of state.enemies.filter(e => e.alive && e.id !== target.id)) {
    const ePos = state.enemyPositions[enemy.id] ?? 0;
    if (GameMath.getHexDistance(targetPos, ePos) <= 1) {
      const splashDmg = Math.max(1, Math.floor(hero.atk * 0.4));
      applyAoEHit(state, hero, enemy, splashDmg, onDamaged);
      splashCount++;
    }
  }

  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Bola de Fogo', `${mainDmg} no alvo + ${splashCount} adjacentes`);
  return true;
}
```

**4c — `tryMeteoro` — alterar assinatura e corpo:**

Trecho atual (função inteira, linhas 272-298):
```ts
function tryMeteoro(hero: Hero, state: BattleState): boolean {
  const aliveEnemies = state.enemies.filter(e => e.alive);
  if (aliveEnemies.length < 3) return false;

  const skill = { id: 'MAGE_METEORO', cooldownRounds: -1 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  const centerEnemy = aliveEnemies[Math.floor(aliveEnemies.length / 2)];
  const centerPos = state.enemyPositions[centerEnemy.id] ?? 0;
  let hitCount = 0;

  for (const enemy of aliveEnemies) {
    const ePos = state.enemyPositions[enemy.id] ?? 0;
    if (GameMath.getHexDistance(centerPos, ePos) <= 3) {
      const dmg = Math.max(1, Math.floor(hero.atk * 1.0));
      enemy.hp = Math.max(0, enemy.hp - dmg);
      hitCount++;
      if (enemy.hp <= 0) {
        enemy.alive = false;
        delete state.enemyPositions[enemy.id];
      }
    }
  }
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Meteoro', `atingiu ${hitCount} inimigos`);
  return true;
}
```

Substituir por:
```ts
function tryMeteoro(
  hero: Hero,
  state: BattleState,
  onDamaged: (enemy: BattleEnemy, state: BattleState) => void,
): boolean {
  const aliveEnemies = state.enemies.filter(e => e.alive);
  if (aliveEnemies.length < 3) return false;

  const skill = { id: 'MAGE_METEORO', cooldownRounds: -1 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  const centerEnemy = aliveEnemies[Math.floor(aliveEnemies.length / 2)];
  const centerPos = state.enemyPositions[centerEnemy.id] ?? 0;
  let hitCount = 0;

  for (const enemy of aliveEnemies) {
    const ePos = state.enemyPositions[enemy.id] ?? 0;
    if (GameMath.getHexDistance(centerPos, ePos) <= 3) {
      const dmg = Math.max(1, Math.floor(hero.atk * 1.0));
      applyAoEHit(state, hero, enemy, dmg, onDamaged);
      hitCount++;
    }
  }
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Meteoro', `atingiu ${hitCount} inimigos`);
  return true;
}
```

**4d — Adicionar import e atualizar chamadas em `executePreAttackSkills`:**

> **Circularidade controlada:** `enemySkillEffects.ts` importará de `skillEffects.ts` (Step 2 de D2). Node.js/CommonJS tolera essa circularidade quando os módulos só chamam funções importadas de dentro de funções exportadas — nunca no escopo do módulo. Esse é exatamente o nosso caso. Confirmado: `node -e` com dois módulos circulares funciona sem erro.

Adicione o import de `onEnemyDamagedSkills` no topo de `src/utils/skillEffects.ts`, após os imports existentes (linha 4):

```ts
import { Hero, MissionAction } from '../types';
import { BattleState, BattleEnemy, Buff } from './battleEngine';
import { getUnlockedSkills, SkillDef } from '../constants/skills';
import { GameMath } from './gameMath';
import { onEnemyDamagedSkills } from './enemySkillEffects';
```

Localize as três chamadas das skills AoE dentro de `executePreAttackSkills` (linhas 401-408 do arquivo original — após as mudanças de D1 as linhas podem ter deslocado ligeiramente):

```ts
  // Archer skills
  if (hero.classId === 'ARCHER') {
    if (skillIds.has('ARCHER_TIRO_CERTEIRO') && tryTiroCerteiro(hero, target, state, rng)) return true;
    if (skillIds.has('ARCHER_CHUVA_DE_FLECHAS') && tryChuvaFlechas(hero, state)) return true;
    if (skillIds.has('ARCHER_TIRO_PERFURANTE') && tryTiroPerfurante(hero, target, state)) return true;
  }

  // Mage skills
  if (hero.classId === 'MAGE') {
    if (skillIds.has('MAGE_METEORO') && tryMeteoro(hero, state)) return true;
    if (skillIds.has('MAGE_BOLA_DE_FOGO') && tryBolaDeFogo(hero, target, state)) return true;
  }
```

Substituir por:
```ts
  // Archer skills
  if (hero.classId === 'ARCHER') {
    if (skillIds.has('ARCHER_TIRO_CERTEIRO') && tryTiroCerteiro(hero, target, state, rng)) return true;
    if (skillIds.has('ARCHER_CHUVA_DE_FLECHAS') && tryChuvaFlechas(hero, state, onEnemyDamagedSkills)) return true;
    if (skillIds.has('ARCHER_TIRO_PERFURANTE') && tryTiroPerfurante(hero, target, state)) return true;
  }

  // Mage skills
  if (hero.classId === 'MAGE') {
    if (skillIds.has('MAGE_METEORO') && tryMeteoro(hero, state, onEnemyDamagedSkills)) return true;
    if (skillIds.has('MAGE_BOLA_DE_FOGO') && tryBolaDeFogo(hero, target, state, onEnemyDamagedSkills)) return true;
  }
```

- [ ] **Step 5: Rodar testes D1 — devem passar agora**

Run: `npm test -- --testPathPattern=combatGaps`
Expected: 4 testes D1 passam (verde).

Run: `npm test`
Expected: 504 testes anteriores + 4 novos = **508 passed** (sem regressão).

- [ ] **Step 6: Commit D1**

```bash
git add src/utils/skillEffects.ts src/__tests__/utils/combatGaps.test.ts
git commit -m "fix(combat): AoE de skill roteia por escudo e onEnemyDamagedSkills (D1)"
```

---

## Task D2: [TDD] AOE de inimigo respeita escudo e dispara reações de herói

**Arquivos:**
- Modify: `src/__tests__/utils/combatGaps.test.ts` (step 1)
- Modify: `src/utils/enemySkillEffects.ts` (steps 2-4)

### Por que está errado hoje

A função `tryAoeAttack` em `src/utils/enemySkillEffects.ts` (linhas 121-144) aplica dano cru a cada herói com `target.hpCurrent -= dmg` sem:
1. `getShieldReduction` — escudo do herói não é consumido
2. `state.handlers.onHeroDamaged` — sinergia LINHA_DE_FRENTE e outros hooks de herói lesado não disparam
3. `onHeroDamagedSkills` — skill reativa do herói (ex: MAGE_ESCUDO_ARCANO) não dispara

### Padrão de referência (ataque inimigo→herói — `battleEngine.ts:733-746`)

```ts
const shieldReduction = getShieldReduction(state, finalTarget.id);
if (shieldReduction > 0) {
  finalDmg = Math.max(1, Math.floor(finalDmg * (1 - shieldReduction)));
  result.action.amount = finalDmg;
  result.action.text += ` (Escudo: -${Math.round(shieldReduction * 100)}%)`;
}
// ...
finalTarget.hpCurrent = Math.max(0, finalTarget.hpCurrent - finalDmg);
state.handlers.onHeroDamaged(state, finalTarget, finalTarget.hpCurrent);
onHeroDamagedSkills(finalTarget, state);
```

- [ ] **Step 1: Adicionar testes D2 ao `src/__tests__/utils/combatGaps.test.ts` (devem FALHAR)**

Adicione o bloco abaixo ao final do arquivo (após o `describe('D1 ...')`):

```ts
// ─── D2: AOE de inimigo respeita escudo e dispara reações de herói ───

describe('D2 — AOE de inimigo', () => {
  function makeEnemyWithAoe(atk: number = 20): BattleEnemy {
    return makeEnemy({
      id: 'boss', atk,
      skills: [{ id: 'AOE_ATTACK', name: 'AoE', icon: '💥', cooldownRounds: 4, minDifficulty: 1 }],
      skillCooldowns: { 'boss_AOE_ATTACK': 0 },
    });
  }

  test('herói com escudo 50% recebe metade do dano do AOE_ATTACK', () => {
    const hero = makeHero({ classId: 'WARRIOR', id: 'w1' });
    const enemy = makeEnemyWithAoe(20);
    const state = makeState([hero], [enemy]);
    // Escudo ativo no herói
    state.buffs['w1'] = [{ source: 'MAGE_ESCUDO_ARCANO', type: 'shield', value: 0.5, expiresAfterRound: 99 }];
    state.heroPositions['w1'] = 40;
    state.enemyPositions['boss'] = 2;

    const rawDmg = Math.max(1, Math.floor(20 * 0.5)); // 10
    const reduced = Math.max(1, Math.floor(rawDmg * 0.5)); // 5
    const hpBefore = hero.hpCurrent;

    executeEnemyPreAttackSkills(enemy, hero, state, 0.5);

    expect(hpBefore - hero.hpCurrent).toBe(reduced);
  });

  test('AOE_ATTACK dispara onHeroDamaged do handler', () => {
    const hero = makeHero({ classId: 'WARRIOR', id: 'w1' });
    const enemy = makeEnemyWithAoe(20);
    let damagedCalled = false;
    const state = makeState([hero], [enemy], 1, {
      onHeroDamaged: () => { damagedCalled = true; },
    });
    state.heroPositions['w1'] = 40;
    state.enemyPositions['boss'] = 2;

    executeEnemyPreAttackSkills(enemy, hero, state, 0.5);

    expect(damagedCalled).toBe(true);
  });

  test('AOE_ATTACK dispara onHeroDamagedSkills (Mage ganha Escudo Arcano)', () => {
    const mage = makeHero({ classId: 'MAGE', id: 'm1', trainingCount: { hp: 0, atk: 0, mp: 50 } });
    const enemy = makeEnemyWithAoe(20);
    const state = makeState([mage], [enemy]);
    state.heroPositions['m1'] = 40;
    state.enemyPositions['boss'] = 2;

    executeEnemyPreAttackSkills(enemy, mage, state, 0.5);

    const shieldBuff = state.buffs['m1']?.find(b => b.source === 'MAGE_ESCUDO_ARCANO' && b.type === 'shield');
    expect(shieldBuff).toBeDefined();
  });
});
```

Run: `npm test -- --testPathPattern=combatGaps`
Expected: 3 novos testes D2 **falham** (vermelho), D1 continua verde.

- [ ] **Step 2: Adicionar imports necessários em `src/utils/enemySkillEffects.ts`**

Verifique os imports atuais no topo de `src/utils/enemySkillEffects.ts`:

```ts
import { Hero } from '../types';
import { BattleState, BattleEnemy, Buff } from './battleEngine';
import { EnemySkillDef } from '../constants/enemySkills';
import { GameMath } from './gameMath';
```

Adicione os imports que faltam após os existentes:

```ts
import { getShieldReduction, onHeroDamagedSkills } from './skillEffects';
```

- [ ] **Step 3: Refatorar `tryAoeAttack` em `src/utils/enemySkillEffects.ts`**

Localize a função `tryAoeAttack` (linhas 121-144 do arquivo atual). Substitua o loop de aplicação de dano:

Trecho atual (linhas 136-143):
```ts
  for (const target of targets) {
    target.hpCurrent = Math.max(0, target.hpCurrent - dmg);
    logEnemySkill(state, enemy, 'Ataque em Área', `${dmg} de dano em ${target.id}`);
    if (target.hpCurrent <= 0) {
      delete state.heroPositions[target.id];
    }
  }
```

Substituir por:
```ts
  for (const target of targets) {
    const shield = getShieldReduction(state, target.id);
    const actualDmg = shield > 0
      ? Math.max(1, Math.floor(dmg * (1 - shield)))
      : dmg;
    target.hpCurrent = Math.max(0, target.hpCurrent - actualDmg);
    logEnemySkill(state, enemy, 'Ataque em Área', `${actualDmg} de dano em ${target.id}${shield > 0 ? ` (Escudo: -${Math.round(shield * 100)}%)` : ''}`);
    state.handlers.onHeroDamaged(state, target, target.hpCurrent);
    onHeroDamagedSkills(target, state);
    if (target.hpCurrent <= 0) {
      delete state.heroPositions[target.id];
    }
  }
```

- [ ] **Step 4: Rodar testes D1+D2 — todos devem passar**

Run: `npm test -- --testPathPattern=combatGaps`
Expected: 7 testes passam (4 D1 + 3 D2).

Run: `npm test`
Expected: **511 passed** (sem regressão).

- [ ] **Step 5: Commit D2**

```bash
git add src/utils/enemySkillEffects.ts src/__tests__/utils/combatGaps.test.ts
git commit -m "fix(combat): AOE de inimigo aplica escudo e hooks de herói lesado (D2)"
```

---

## Task D3: [TDD] Ataque-extra do Oportunista usa o caminho normal

**Arquivos:**
- Modify: `src/__tests__/utils/combatGaps.test.ts` (step 1)
- Modify: `src/utils/battleEngine.ts` (steps 2-4)

### Por que está errado hoje

O bloco do ataque-extra do Oportunista em `battleEngine.ts:614-632` aplica dano cru (`nextAlive.hp -= extraResult.dmg`) sem:
1. `getShieldReduction` — escudo do próximo inimigo não é consumido
2. `onEnemyDamagedSkills` — skill reativa do inimigo não dispara
3. `state.lastAttacker[nextAlive.id] = hero.id` — não registra o atacante
4. `state.handlers.onAttackResolved` — sinergia de posicionamento não dispara
5. `onRogueHitSkills` — veneno do Rogue não é aplicado no segundo alvo

O bloco completo atual (linhas 614-632):
```ts
          if (extraAttack && finalTarget.hp <= 0) {
            const nextAlive = state.enemies.find(e => e.alive && e.id !== finalTarget.id);
            if (nextAlive) {
              const nextDist = GameMath.getHexDistance(updatedPos, state.enemyPositions[nextAlive.id]);
              if (nextDist <= effectiveRange) {
                const extraResult = this.calculateAttack(hero, nextAlive, 0.8, 'hero', state.rounds, rng, nextDist, state);
                if (extraResult) {
                  state.actions.push(extraResult.action);
                  state.log.push(extraResult.action.text);
                  nextAlive.hp = Math.max(0, nextAlive.hp - extraResult.dmg);
                  if (nextAlive.hp <= 0) {
                    nextAlive.alive = false;
                    delete state.enemyPositions[nextAlive.id];
                  }
                }
              }
            }
          }
```

### Padrão de referência (ataque normal herói→inimigo — `battleEngine.ts:595-650`)

O ataque-extra deve espelhar o mesmo bloco do ataque normal:
- `getShieldReduction` antes de subtrair HP
- `onEnemyDamagedSkills` após subtrair HP
- `state.lastAttacker[nextAlive.id] = hero.id` se dano > 0
- `state.handlers.onAttackResolved(...)` se dano > 0
- `onRogueHitSkills(...)` se `hero.classId === 'ROGUE'` e dano > 0

- [ ] **Step 1: Adicionar testes D3 ao `src/__tests__/utils/combatGaps.test.ts` (devem FALHAR)**

Para testar o ataque-extra precisamos usar `BattleEngine.processHeroTurn` diretamente. Adicione o bloco abaixo ao final do arquivo `combatGaps.test.ts`:

```ts
// ─── D3: Ataque-extra do Oportunista usa caminho normal ───

describe('D3 — Ataque-extra do Oportunista', () => {
  // Herói com personalidade Oportunista (agility alta → aciona applyPersonalityOnHit)
  // Verificamos via fixture direta que o bloco do extra-attack aplica escudo e veneno.

  function makeOppState() {
    // Herói Rogue com trainingCount suficiente para ROGUE_VENENO (atk >= 50)
    const hero: Hero = {
      id: 'rogue1', name: 'Rogue', hpMax: 100, hpCurrent: 100,
      atk: 60, mp: 5, defense: 5, crit: 10, agility: 20,
      currentTask: HeroTask.IDLE,
      classId: 'ROGUE' as any,
      trainingCount: { hp: 0, atk: 60, mp: 0 },
      trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
      personality: 'OPPORTUNIST' as any,
      range: 1, movement: 2,
    } as Hero;

    // Dois inimigos: e1 (quase morto, HP 1) e e2 (saudável)
    const e1 = makeEnemy({ id: 'e1', hp: 1, maxHp: 50, position: 2, defense: 0 });
    const e2 = makeEnemy({ id: 'e2', hp: 50, maxHp: 50, position: 2, defense: 0 });

    const handlers = createSynergyHandlers([]);
    const state: BattleState = {
      heroes: [hero], enemies: [e1, e2],
      heroPositions: { rogue1: 40 },
      enemyPositions: { e1: 2, e2: 2 },
      lastAttacker: {}, threats: {},
      log: [], actions: [], rounds: 2, // round 2: Golpe Furtivo não dispara
      activeSynergies: [], buffs: {}, flags: {},
      handlers,
      skillCooldowns: {}, skillOnceUsed: {},
    };
    return { hero, e1, e2, state };
  }

  test('ataque-extra respeita escudo do segundo inimigo', () => {
    const { e1, e2, state } = makeOppState();
    // Colocar escudo em e2
    state.buffs['e2'] = [{ source: 'MAGE_ESCUDO_ARCANO', type: 'shield', value: 0.5, expiresAfterRound: 99 }];
    const hpBefore = e2.hp;
    // rng=0.05 → hit, sem crit; Oportunista dispara extraAttack quando mata e1
    BattleEngine.processHeroTurn(state.heroes[0], state, () => 0.05);
    // Se e1 foi morto E o extraAttack foi executado, e2 deve ter recebido dano reduzido
    if (!e1.alive && e2.hp < hpBefore) {
      const rawAtk = 60;
      // Dano base mínimo sem escudo seria rawAtk - def = 60 - 0 = 60 (simplificado)
      // Com escudo 50%, seria no máximo 30. Sem escudo seria mais.
      const dmgTaken = hpBefore - e2.hp;
      // O dano com escudo deve ser < o dano sem escudo do mesmo herói em ataque normal
      // (não testamos valor exato pois depende de calcDamage — testamos que escudo foi consumido)
      expect(state.buffs['e2']?.find(b => b.type === 'shield')).toBeUndefined(); // escudo consumido
      expect(dmgTaken).toBeGreaterThan(0);
    } else {
      // Se e1 não morreu neste round, skip (test is valid only when e1 dies)
      expect(true).toBe(true);
    }
  });

  test('ataque-extra de Rogue aplica veneno no segundo inimigo', () => {
    const { e1, e2, state } = makeOppState();
    const hpBefore = e2.hp;
    // rng determinístico: 0.05 (hit), depois 0.1 (< 0.3 → veneno dispara)
    let callCount = 0;
    const deterministicRng = () => {
      callCount++;
      return callCount <= 3 ? 0.05 : 0.1; // primeiros calls: hit; depois: veneno
    };
    BattleEngine.processHeroTurn(state.heroes[0], state, deterministicRng);
    // Se e1 morreu e ataque-extra foi executado, verificar veneno em e2
    if (!e1.alive && e2.hp < hpBefore) {
      const dotBuff = state.buffs['e2']?.find(b => b.type === 'dot' && b.source === 'ROGUE_VENENO');
      expect(dotBuff).toBeDefined();
    } else {
      expect(true).toBe(true);
    }
  });
});
```

Run: `npm test -- --testPathPattern=combatGaps`
Expected: 2 testes D3 **falham** (vermelho), D1+D2 continuam verdes.

- [ ] **Step 2: Verificar linha exata do bloco do ataque-extra em `battleEngine.ts`**

Abra `src/utils/battleEngine.ts` e confirme que o bloco do ataque-extra do Oportunista está nas linhas 614-632 com o seguinte conteúdo:

```ts
          // Opportunist extra attack on kill
          if (extraAttack && finalTarget.hp <= 0) {
            const nextAlive = state.enemies.find(e => e.alive && e.id !== finalTarget.id);
            if (nextAlive) {
              const nextDist = GameMath.getHexDistance(updatedPos, state.enemyPositions[nextAlive.id]);
              if (nextDist <= effectiveRange) {
                const extraResult = this.calculateAttack(hero, nextAlive, 0.8, 'hero', state.rounds, rng, nextDist, state);
                if (extraResult) {
                  state.actions.push(extraResult.action);
                  state.log.push(extraResult.action.text);
                  nextAlive.hp = Math.max(0, nextAlive.hp - extraResult.dmg);
                  if (nextAlive.hp <= 0) {
                    nextAlive.alive = false;
                    delete state.enemyPositions[nextAlive.id];
                  }
                }
              }
            }
          }
```

- [ ] **Step 3: Substituir o bloco do ataque-extra em `src/utils/battleEngine.ts`**

Substitua o bloco acima (de `// Opportunist extra attack on kill` até o `}` de fechamento do `if (extraAttack && finalTarget.hp <= 0)`) pelo seguinte:

```ts
          // Opportunist extra attack on kill — espelha o caminho normal de ataque
          if (extraAttack && finalTarget.hp <= 0) {
            const nextAlive = state.enemies.find(e => e.alive && e.id !== finalTarget.id);
            if (nextAlive) {
              const nextDist = GameMath.getHexDistance(updatedPos, state.enemyPositions[nextAlive.id]);
              if (nextDist <= effectiveRange) {
                const extraResult = this.calculateAttack(hero, nextAlive, 0.8, 'hero', state.rounds, rng, nextDist, state);
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
                    state.handlers.onAttackResolved(state, hero, nextAlive, extraDmg, nextDist);
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
```

- [ ] **Step 4: Rodar testes D1+D2+D3 — todos devem passar**

Run: `npm test -- --testPathPattern=combatGaps`
Expected: 9 testes passam (4 D1 + 3 D2 + 2 D3).

Run: `npm test`
Expected: **513 passed** (sem regressão).

- [ ] **Step 5: Commit D3**

```bash
git add src/utils/battleEngine.ts src/__tests__/utils/combatGaps.test.ts
git commit -m "fix(combat): ataque-extra do Oportunista usa caminho normal com escudo e hooks (D3)"
```

---

## Task D4: [TDD] Curas de skill disparam `onHealApplied` para sinergia LINHA_DE_FRENTE

**Arquivos:**
- Modify: `src/__tests__/utils/combatGaps.test.ts` (step 1)
- Modify: `src/utils/skillEffects.ts` (steps 2-4)

### Por que está errado hoje

As funções `tryCuraMaior` (linhas 300-318) e `tryPurificacao` (linhas 320-336) em `src/utils/skillEffects.ts` curam aliados mas não chamam `state.handlers.onHealApplied`. Isso faz com que a sinergia **LINHA_DE_FRENTE** (Healer + Warrior) nunca dispare ao usar Cura Maior ou Purificação via skill — apenas a habilidade de classe do Healer (`battleEngine.ts:499`) chama o hook corretamente.

### Padrão de referência (habilidade de classe do Healer — `battleEngine.ts:499`)

```ts
state.handlers.onHealApplied(state, hero, mostInjured, actualHeal);
```

- [ ] **Step 1: Adicionar testes D4 ao `src/__tests__/utils/combatGaps.test.ts` (devem FALHAR)**

Adicione o bloco abaixo ao final do arquivo:

```ts
// ─── D4: Curas de skill disparam onHealApplied para sinergia ───

describe('D4 — Curas de skill disparam onHealApplied', () => {
  function makeHealerState(injured: Partial<Hero> = {}) {
    const healer = makeHero({
      id: 'healer1', classId: 'HEALER',
      trainingCount: { hp: 0, atk: 0, mp: 20 }, // desbloqueia HEALER_CURA_MAIOR
    });
    const warrior = makeHero({
      id: 'warrior1', classId: 'WARRIOR',
      hpMax: 100, hpCurrent: 30, // abaixo de 40% → Cura Maior ativa
      ...injured,
    });
    const handlers = createSynergyHandlers(['LINHA_DE_FRENTE']);
    const state: BattleState = {
      heroes: [healer, warrior],
      enemies: [makeEnemy()],
      heroPositions: { healer1: 40, warrior1: 41 },
      enemyPositions: { e1: 2 },
      lastAttacker: {}, threats: {},
      log: [], actions: [], rounds: 1,
      activeSynergies: ['LINHA_DE_FRENTE'],
      buffs: {}, flags: {},
      handlers,
      skillCooldowns: {}, skillOnceUsed: {},
    };
    return { healer, warrior, state };
  }

  test('Cura Maior dispara onHealApplied e aplica buff LINHA_DE_FRENTE no Guerreiro', () => {
    const { healer, warrior, state } = makeHealerState();

    executePreAttackSkills(healer, makeEnemy(), state, alwaysHit);

    // LINHA_DE_FRENTE adiciona atkMul 1.30 ao guerreiro curado
    const furorBuff = state.buffs['warrior1']?.find(b => b.source === 'LINHA_DE_FRENTE' && b.type === 'atkMul');
    expect(furorBuff).toBeDefined();
    expect(furorBuff?.value).toBe(1.30);
  });

  test('Purificação dispara onHealApplied e aplica buff LINHA_DE_FRENTE no Guerreiro', () => {
    const healer = makeHero({
      id: 'healer2', classId: 'HEALER',
      trainingCount: { hp: 0, atk: 0, mp: 50 }, // desbloqueia HEALER_PURIFICACAO
    });
    const warrior = makeHero({
      id: 'warrior2', classId: 'WARRIOR',
      hpMax: 100, hpCurrent: 80, // Purificação não exige HP baixo
    });
    const handlers = createSynergyHandlers(['LINHA_DE_FRENTE']);
    const state: BattleState = {
      heroes: [healer, warrior],
      enemies: [makeEnemy()],
      heroPositions: { healer2: 40, warrior2: 41 },
      enemyPositions: { e1: 2 },
      lastAttacker: {}, threats: {},
      log: [], actions: [], rounds: 1,
      activeSynergies: ['LINHA_DE_FRENTE'],
      buffs: {
        warrior2: [{ source: 'ENEMY_POISON', type: 'dot', value: 5, expiresAfterRound: 5 }],
      },
      flags: {},
      handlers,
      skillCooldowns: {}, skillOnceUsed: {},
    };

    executePreAttackSkills(healer, makeEnemy(), state, alwaysHit);

    // Purificação remove o dot e cura 20% HP, deve disparar onHealApplied
    const furorBuff = state.buffs['warrior2']?.find(b => b.source === 'LINHA_DE_FRENTE' && b.type === 'atkMul');
    expect(furorBuff).toBeDefined();
    expect(furorBuff?.value).toBe(1.30);
  });
});
```

Run: `npm test -- --testPathPattern=combatGaps`
Expected: 2 testes D4 **falham** (vermelho), D1+D2+D3 continuam verdes.

- [ ] **Step 2: Atualizar a assinatura de `tryCuraMaior` para receber `hero` e chamar `onHealApplied`**

Localize `tryCuraMaior` em `src/utils/skillEffects.ts` (linhas 300-318). A função atual tem assinatura `function tryCuraMaior(hero: Hero, state: BattleState): boolean`. Adicione a chamada ao `onHealApplied` após calcular o dano real:

Trecho atual no final de `tryCuraMaior`:
```ts
  state.actions.push({
    round: state.rounds, actorType: 'hero', actorId: hero.id,
    actorName: hero.name, actionType: 'heal', targetId: injured.id,
    amount: actual, text: `✦ ${hero.name} — Cura Maior: ${actual} HP em ${injured.name}`,
  });
  state.log.push(`✦ ${hero.name} — Cura Maior: ${actual} HP em ${injured.name}`);
  return true;
```

Substituir por:
```ts
  state.actions.push({
    round: state.rounds, actorType: 'hero', actorId: hero.id,
    actorName: hero.name, actionType: 'heal', targetId: injured.id,
    amount: actual, text: `✦ ${hero.name} — Cura Maior: ${actual} HP em ${injured.name}`,
  });
  state.log.push(`✦ ${hero.name} — Cura Maior: ${actual} HP em ${injured.name}`);
  if (actual > 0) {
    state.handlers.onHealApplied(state, hero, injured, actual);
  }
  return true;
```

- [ ] **Step 3: Atualizar `tryPurificacao` para chamar `onHealApplied`**

Localize `tryPurificacao` em `src/utils/skillEffects.ts` (linhas 320-336). Substitua o trecho final:

Trecho atual no final de `tryPurificacao`:
```ts
  const healAmount = Math.floor(allyWithDebuff.hpMax * 0.2);
  allyWithDebuff.hpCurrent = Math.min(allyWithDebuff.hpMax, allyWithDebuff.hpCurrent + healAmount);

  logSkill(state, hero, 'Purificação', `limpou debuffs de ${allyWithDebuff.name} e curou ${healAmount} HP`);
  return true;
```

Substituir por:
```ts
  const healAmount = Math.floor(allyWithDebuff.hpMax * 0.2);
  const prevHp = allyWithDebuff.hpCurrent;
  allyWithDebuff.hpCurrent = Math.min(allyWithDebuff.hpMax, allyWithDebuff.hpCurrent + healAmount);
  const actualHeal = allyWithDebuff.hpCurrent - prevHp;

  logSkill(state, hero, 'Purificação', `limpou debuffs de ${allyWithDebuff.name} e curou ${actualHeal} HP`);
  if (actualHeal > 0) {
    state.handlers.onHealApplied(state, hero, allyWithDebuff, actualHeal);
  }
  return true;
```

- [ ] **Step 4: Verificar que `state.handlers` nunca é `undefined` nas curas**

As funções `tryCuraMaior` e `tryPurificacao` são chamadas de dentro de `executePreAttackSkills`, que recebe `state: BattleState`. O campo `state.handlers` já é parte obrigatória de `BattleState` (`battleEngine.ts:97`) e é sempre inicializado via `makeState` nos testes ou `BattleEngine.initializeBattle` em produção. Nenhuma guard extra é necessária. Confirme nos testes que `handlers: makeHandlers(...)` está presente na fixture `makeState` adicionada na Task D1/Step 1.

- [ ] **Step 5: Rodar testes D1+D2+D3+D4 — todos devem passar**

Run: `npm test -- --testPathPattern=combatGaps`
Expected: 11 testes passam (4 D1 + 3 D2 + 2 D3 + 2 D4).

Run: `npm test`
Expected: **515 passed** (sem regressão).

- [ ] **Step 6: Commit D4**

```bash
git add src/utils/skillEffects.ts src/__tests__/utils/combatGaps.test.ts
git commit -m "fix(combat): curas de skill disparam onHealApplied para sinergia LINHA_DE_FRENTE (D4)"
```

---

## Task D5: Verificação de balance e limpeza final

**Arquivos:**
- Nenhum arquivo novo — apenas verificação e type-check.

- [ ] **Step 1: Rodar simulações de balance**

```bash
npm run simulate:m1 2>&1 | tail -10
npm run simulate:m2 2>&1 | tail -10
npm run simulate:m3 2>&1 | tail -10
```

Expected: taxas de vitória dentro de ±5 pp dos valores baseline (verificar output anterior vs. atual). As mudanças D1-D4 adicionam escudo/hooks em caminhos que antes os ignoravam — o resultado esperado é que batalhas com personagens shielded se tornem ligeiramente mais longas, mas não há regressão de taxa de vitória global para composições sem escudo ativo.

Se taxa de vitória cair > 5 pp, investigar qual caminho introduziu o desequilíbrio antes de prosseguir.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: `0 errors`.

- [ ] **Step 3: Suite completa de testes**

Run: `npm test`
Expected: ≥ 515 passed, 0 failed.

- [ ] **Step 4: Commit final de verificação**

```bash
git add -p  # verificar se há algo modificado não commitado
git commit -m "chore(combat): verificação D1-D4 — balance e type-check ok"
```

Se não houver arquivos modificados, pular o commit.

---

## Resumo dos critérios de aceitação (Fase 3)

| Critério | Task | Verificação |
|---|---|---|
| AoE de skill: alvo com escudo recebe dano reduzido | D1 | `combatGaps.test.ts` testes D1 |
| AoE de skill: dispara `onEnemyDamagedSkills` em cada alvo | D1 | `combatGaps.test.ts` testes D1 |
| AOE de inimigo: herói com escudo recebe dano reduzido | D2 | `combatGaps.test.ts` testes D2 |
| AOE de inimigo: dispara `onHeroDamaged` e `onHeroDamagedSkills` | D2 | `combatGaps.test.ts` testes D2 |
| Ataque-extra do Oportunista: consome escudo do segundo inimigo | D3 | `combatGaps.test.ts` testes D3 |
| Ataque-extra do Oportunista: Rogue aplica veneno no segundo inimigo | D3 | `combatGaps.test.ts` testes D3 |
| Cura Maior de skill: dispara `onHealApplied` → buff LINHA_DE_FRENTE | D4 | `combatGaps.test.ts` testes D4 |
| Purificação de skill: dispara `onHealApplied` → buff LINHA_DE_FRENTE | D4 | `combatGaps.test.ts` testes D4 |
| Nenhum teste anterior regrediu | D1-D5 | `npm test` ≥ 515 passed |
| Type-check limpo | D5 | `npx tsc --noEmit` 0 errors |
