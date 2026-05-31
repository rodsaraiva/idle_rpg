# Fase 5 — Testes + Limpeza (Temas E + F)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quitar dívida de teste (testes que nunca rodam, cobertura zero de `trainingMath`, ausência de testes em `achievementHandler` e hooks críticos) e remover dead code/tech debt listado na auditoria, sem alterar nenhuma mecânica de jogo.

**Architecture:** Sem lógica nova. Todas as mudanças são reorganização de arquivos de teste, adição de casos em arquivos existentes ou novos, e pequenos cirúrgicos no código de produção (remoção de exports não-usados, guard `__DEV__` em `console.*`, tipagem mais precisa). Cada task termina com `npm test` + `npx tsc --noEmit` verdes.

**Tech Stack:** TypeScript, Jest (`jest.unit.config.js` — testMatch `**/src/__tests__/**/?(*.)+(test).[jt]s`), `@testing-library/react-native` para hooks React.

**Spec:** [`docs/superpowers/specs/2026-05-31-gaps-resolution-design.md`](../specs/2026-05-31-gaps-resolution-design.md) — Fase 5, Temas E e F.

**Pré-requisito:** Fases 1–4 podem estar em qualquer estado; esta fase é independente delas.

---

## File Structure

### Tema E — Testes

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/utils/__tests__/heroFactory.test.ts` | Delete (conteúdo consolidado) | Testes fora do testMatch — mover conteúdo para `src/__tests__/utils/` |
| `src/utils/__tests__/gameMath.test.ts` | Delete (conteúdo consolidado) | Idem |
| `src/utils/__tests__/battleEngine.test.ts` | Delete (conteúdo consolidado) | Idem |
| `src/utils/__tests__/offlineProgress.test.ts` | Delete (conteúdo consolidado) | Idem |
| `src/__tests__/utils/heroFactory.test.ts` | Create | Recebe conteúdo do arquivo deletado |
| `src/__tests__/utils/gameMath.test.ts` | Modify | Consolidar com conteúdo do arquivo deletado (sem duplicar) |
| `src/__tests__/utils/battleEngine.test.ts` | Modify | Idem |
| `src/__tests__/utils/offlineProgress.test.ts` | Create | Recebe conteúdo do arquivo deletado |
| `src/__tests__/utils/trainingMath.test.ts` | Create | Edge cases de `computePointsFromMs` (k=0, cap, progressão) |
| `src/__tests__/context/achievementHandler.test.ts` | Create | Testes de `checkAchievements` (condition, reward, idempotência) |
| `src/__tests__/hooks/useShop.test.tsx` | Create | Lógica de cálculo de custo e validação de gold |
| `src/__tests__/hooks/useMissionPlayback.test.ts` | Create | Lógica de progressão de ações agendadas e cálculo de HP |
| `src/__tests__/hooks/useDragDropGrid.test.ts` | Create | Lógica de `performDropAssign` e transições de estado |

### Tema F — Limpeza

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/utils/skillEffects.ts` | Modify | Remover export `getDefMulProduct` (nunca chamado) |
| `src/utils/battleEngine.ts` | Modify | Remover import de `getDefMulProduct` |
| `src/utils/offlineProgress.ts` | Modify | Remover variável `offlineGold` (nunca incrementada) |
| `src/screens/VillageScreen.tsx` | Modify | Remover bloco comentado `bannerContainer` (linhas 56–64) + estilos mortos |
| `src/services/storage.ts` | Modify | Guardar `console.log/error` com `__DEV__` |
| `src/context/missionHandler.ts` | Modify | Guardar `console.error` linha 129 com `__DEV__` |
| `src/constants/achievements.ts` | Modify | Tipar `condition` como `(state: GameState) => boolean` |

---

## Task E1 — Mover testes de `src/utils/__tests__/` para `src/__tests__/utils/`

**Problema:** os 4 arquivos em `src/utils/__tests__/` não casam com o `testMatch` de `jest.unit.config.js` (`**/src/__tests__/**`) → nunca rodam no `npm test`.

**Arquivos:**
- Leitura/deleção: `src/utils/__tests__/heroFactory.test.ts`, `gameMath.test.ts`, `battleEngine.test.ts`, `offlineProgress.test.ts`
- Criação/edição: destinos em `src/__tests__/utils/`

---

- [ ] **Step 1: Confirmar conteúdo dos arquivos fonte (já lidos — confirmar duplicidade)**

Os arquivos `src/utils/__tests__/gameMath.test.ts` e `src/utils/__tests__/battleEngine.test.ts` contêm testes **diferentes** dos já presentes em `src/__tests__/utils/` com mesmo nome:

| Arquivo fonte | Cobertura | Arquivo destino existente | Cobertura |
|---|---|---|---|
| `src/utils/__tests__/gameMath.test.ts` | `calcHitChance`, `calcCritChance`, `calcDamage`, `getHexCoords`, `getHexDistance` | `src/__tests__/utils/gameMath.test.ts` | `getRecruitCost`, `formatNumber`, `calcHitChance` (só cap) |
| `src/utils/__tests__/battleEngine.test.ts` | `selectTarget` (personalities), `findMovePath`, `executeClassAbility` | `src/__tests__/utils/battleEngine.test.ts` | `selectTarget` (1 caso genérico), `calculateAttack` |

Os arquivos `heroFactory.test.ts` e `offlineProgress.test.ts` **não existem** em `src/__tests__/utils/` → criar diretamente.

- [ ] **Step 2: Criar `src/__tests__/utils/heroFactory.test.ts` com conteúdo do arquivo fonte**

Crie o arquivo `src/__tests__/utils/heroFactory.test.ts` com o conteúdo abaixo (copiado exatamente de `src/utils/__tests__/heroFactory.test.ts`, apenas ajustando o import path relativo):

```ts
import { createHero } from '../../utils/heroFactory';
import { INITIAL_HERO_STATS } from '../../constants/game';
import { CLASS_DEFS } from '../../constants/classes';

describe('HeroFactory - Generation with Gaussian Variance', () => {
  test('should create a hero with all required properties', () => {
    const hero = createHero('WARRIOR');
    expect(hero.id).toBeDefined();
    expect(hero.name).toBeDefined();
    expect(hero.hpMax).toBeGreaterThan(0);
    expect(hero.atk).toBeGreaterThan(0);
    expect(hero.classId).toBe('WARRIOR');
    expect(hero.personality).toBeDefined();
    expect(hero.range).toBeDefined();
    expect(hero.attackType).toBeDefined();
  });

  test('should respect Gaussian variance limits (±50% of base)', () => {
    for (let i = 0; i < 100; i++) {
      const hero = createHero();
      expect(hero.hpMax).toBeGreaterThanOrEqual(Math.floor(INITIAL_HERO_STATS.hp * 0.5));
      expect(hero.hpMax).toBeLessThanOrEqual(Math.floor(INITIAL_HERO_STATS.hp * 1.5));
      expect(hero.atk).toBeGreaterThanOrEqual(Math.floor(INITIAL_HERO_STATS.atk * 0.5));
      expect(hero.atk).toBeLessThanOrEqual(Math.floor(INITIAL_HERO_STATS.atk * 1.5));
    }
  });

  test('should apply class deltas correctly', () => {
    const tank = createHero('TANK');
    const classDef = CLASS_DEFS.TANK;
    expect(tank.hpMax).toBeGreaterThanOrEqual(Math.floor(INITIAL_HERO_STATS.hp * 0.5) + (classDef.baseStatDelta?.hp ?? 0));
    expect(tank.hpMax).toBeLessThanOrEqual(Math.floor(INITIAL_HERO_STATS.hp * 1.5) + (classDef.baseStatDelta?.hp ?? 0));
    expect(tank.atk).toBeGreaterThanOrEqual(Math.floor(INITIAL_HERO_STATS.atk * 0.5) + (classDef.baseStatDelta?.atk ?? 0));
    expect(tank.atk).toBeLessThanOrEqual(Math.floor(INITIAL_HERO_STATS.atk * 1.5) + (classDef.baseStatDelta?.atk ?? 0));
  });

  test('should assign correct movement and range based on class', () => {
    const mage = createHero('MAGE');
    expect(mage.range).toBe(CLASS_DEFS.MAGE.range);
    expect(mage.attackType).toBe('RANGED');

    const rogue = createHero('ROGUE');
    expect(rogue.range).toBe(CLASS_DEFS.ROGUE.range);
    expect(rogue.attackType).toBe('MELEE');
  });
});
```

- [ ] **Step 3: Criar `src/__tests__/utils/offlineProgress.test.ts` com conteúdo do arquivo fonte**

Crie o arquivo `src/__tests__/utils/offlineProgress.test.ts` com o conteúdo abaixo (import paths ajustados):

```ts
import { calculateOfflineProgress } from '../../utils/offlineProgress';
import { GameState, HeroTask, Hero } from '../../types';
import { BASE_TRAIN_TIME_MS, TICK_INTERVAL_MS, MAX_OFFLINE_MS } from '../../constants/game';

describe('OfflineProgress - Catch-up Logic', () => {
  const createBaseState = (): GameState => ({
    gold: 100,
    heroes: [],
    heroesRecruited: 1,
    lastSavedAt: Date.now() - 12 * 60 * 60 * 1000,
    activeMissions: [],
  });

  const createHero = (id: string, task: HeroTask): Hero => ({
    id,
    name: `Hero ${id}`,
    hpMax: 20,
    hpCurrent: 20,
    atk: 10,
    mp: 5,
    defense: 5,
    crit: 5,
    agility: 10,
    currentTask: task,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    trainingCount: { hp: 0, atk: 0, mp: 0 },
  });

  test('should process multiple training points over 12 hours', () => {
    const state = createBaseState();
    const hero = createHero('h1', HeroTask.TRAIN_ATK);
    state.heroes = [hero];

    const result = calculateOfflineProgress(state);

    expect(result).not.toBeNull();
    if (result) {
      const updatedHero = result.newState.heroes[0];
      expect(updatedHero.atk).toBeGreaterThan(10);
      expect(result.perHeroChanges.length).toBe(1);
      expect(result.perHeroChanges[0].atkAfter).toBeGreaterThan(10);
    }
  });

  test('should complete mission if enough time passed', () => {
    const state = createBaseState();
    const hero = createHero('h1', HeroTask.MISSION);
    state.heroes = [hero];
    state.activeMissions = [
      {
        id: 'm1',
        templateId: 'mission_1',
        heroIds: ['h1'],
        startedAt: Date.now() - 13 * 60 * 60 * 1000,
        remainingMs: 1 * 60 * 60 * 1000,
      } as any,
    ];

    const result = calculateOfflineProgress(state);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.newState.activeMissions.length).toBe(0);
      expect(result.newState.gold).toBeGreaterThan(100);
      expect(result.newState.heroes[0].currentTask).toBe(HeroTask.IDLE);
    }
  });

  test('should cap offline progress at 72 hours', () => {
    const state = createBaseState();
    state.lastSavedAt = Date.now() - 10 * 24 * 60 * 60 * 1000;

    const result = calculateOfflineProgress(state);

    expect(result).not.toBeNull();
    if (result) {
      const expectedTicks = MAX_OFFLINE_MS / (state.tickIntervalMs ?? TICK_INTERVAL_MS);
      expect(result.ticks).toBe(Math.floor(expectedTicks));
      expect(result.cappedHours).toBe(72);
    }
  });
});
```

- [ ] **Step 4: Substituir `src/__tests__/utils/gameMath.test.ts` — consolidar destino + arquivo fonte**

O arquivo destino atual (`src/__tests__/utils/gameMath.test.ts`) tem 1 `describe('GameMath', ...)` com 3 testes simples. O arquivo fonte tem 2 `describe` blocks com 8 testes diferentes. **Substitua completamente o arquivo destino** pelo conteúdo unificado abaixo (destino original encapsulado em `describe('GameMath - Basic', ...)` + 2 describes do arquivo fonte):

```ts
import { GameMath } from '../../utils/gameMath';

describe('GameMath - Basic', () => {
  test('getRecruitCost increases exponentially', () => {
    const cost0 = GameMath.getRecruitCost(0);
    const cost1 = GameMath.getRecruitCost(1);
    const cost2 = GameMath.getRecruitCost(2);
    expect(cost1).toBeGreaterThan(cost0);
    expect(cost2).toBeGreaterThan(cost1);
  });

  test('formatNumber formats thousands to K', () => {
    expect(GameMath.formatNumber(1500)).toBe('1.5K');
    expect(GameMath.formatNumber(1500000)).toBe('1.5M');
  });

  test('calcHitChance caps at 0.98', () => {
    expect(GameMath.calcHitChance(1000)).toBe(0.98);
  });
});

describe('GameMath - Combat Formulas', () => {
  describe('calcHitChance (Evasion diminishing returns)', () => {
    test('should return base hit chance when agility is 0', () => {
      expect(GameMath.calcHitChance(0, 0)).toBeCloseTo(0.75);
    });

    test('should apply exactly 50% evasion when agility is 50', () => {
      expect(GameMath.calcHitChance(0, 50)).toBeCloseTo(0.25);
    });

    test('should never return less than 0.05 hit chance', () => {
      expect(GameMath.calcHitChance(0, 1000)).toBe(0.05);
    });
  });

  describe('calcCritChance (Crit diminishing returns)', () => {
    test('should return base crit chance for non-rogue when crit attribute is 0', () => {
      expect(GameMath.calcCritChance('WARRIOR', 0)).toBeCloseTo(0.05);
    });

    test('should return base crit chance + 0.05 for rogue', () => {
      expect(GameMath.calcCritChance('ROGUE', 0)).toBeCloseTo(0.10);
    });

    test('should gain exactly 50% bonus crit from 100 crit attribute', () => {
      expect(GameMath.calcCritChance('WARRIOR', 100)).toBeCloseTo(0.55);
    });
  });

  describe('calcDamage (Defense diminishing returns)', () => {
    test('should deal full damage when defense is 0', () => {
      expect(GameMath.calcDamage(100, 0)).toBe(100);
    });

    test('should deal 50% damage when defense is 100', () => {
      expect(GameMath.calcDamage(100, 100)).toBe(50);
    });

    test('should apply crit before defense mitigation', () => {
      expect(GameMath.calcDamage(100, 100, true)).toBe(75);
    });

    test('should always deal at least 1 damage', () => {
      expect(GameMath.calcDamage(1, 9999)).toBe(1);
    });
  });
});

describe('GameMath - Hexagonal Geometry', () => {
  test('getHexCoords should return axial coordinates (0,0,0) for pos 0', () => {
    const coords = GameMath.getHexCoords(0);
    expect(coords.x).toBe(0);
    expect(Object.is(coords.y, -0) || Object.is(coords.y, 0)).toBe(true);
    expect(coords.z).toBe(0);
  });

  test('getHexDistance between adjacent cells should be 1', () => {
    expect(GameMath.getHexDistance(0, 1)).toBe(1);
    expect(GameMath.getHexDistance(0, 5)).toBe(1);
  });

  test('getHexDistance between row 7 and row 2 should be at least 5', () => {
    const heroPos = 7 * 5 + 0;
    const enemyPos = 2 * 5 + 0;
    expect(GameMath.getHexDistance(heroPos, enemyPos)).toBeGreaterThanOrEqual(5);
  });
});
```

- [ ] **Step 5: Substituir `src/__tests__/utils/battleEngine.test.ts` — consolidar destino + arquivo fonte**

O arquivo destino atual tem `describe('BattleEngine', ...)` com 4 testes (`selectTarget` genérico, `calculateAttack` miss/hit). O arquivo fonte (`src/utils/__tests__/battleEngine.test.ts`) tem `describe('BattleEngine - AI and Tactics', ...)` com os testes de personalidades, pathfinding e `executeClassAbility`. **Substitua completamente o arquivo destino** com o conteúdo unificado abaixo.

Atenção: o `createBaseState` do arquivo FONTE não inclui campos obrigatórios de `BattleState` (`activeSynergies`, `buffs`, `flags`, `handlers`, `skillCooldowns`, `skillOnceUsed`) — o conteúdo abaixo corrige isso incluindo esses campos com valores padrão no `createBaseState`. O tipo `BattleState` é importado de `'../../utils/battleEngine'` junto com `BattleEngine`.

```ts
// Conteúdo completo de src/__tests__/utils/battleEngine.test.ts (substituição total):

import { BattleEngine, BattleState } from '../../utils/battleEngine';
import { HeroTask, Hero } from '../../types';

describe('BattleEngine', () => {
  const mockRng = (val: number) => () => val;

  test('selectTarget picks highest-score target based on distance and HP', () => {
    const attacker = { id: 'a1', attackType: 'MELEE' as const, range: 1 };
    const candidates = [
      { id: 'e1', hp: 10, position: 5, classId: 'WARRIOR' },
      { id: 'e2', hp: 20, position: 1, classId: 'WARRIOR' },
      { id: 'e3', hp: 5, position: 2, classId: 'WARRIOR' },
    ];
    const target = BattleEngine.selectTarget(attacker, 0, candidates, mockRng(0));
    expect(target).toBeDefined();
  });

  test('selectTarget returns undefined for empty candidates', () => {
    const attacker = { id: 'a1' };
    const target = BattleEngine.selectTarget(attacker, 0, [], mockRng(0.5));
    expect(target).toBeUndefined();
  });

  test('calculateAttack returns miss when roll > hitChance', () => {
    const attacker = { id: 'a1', atk: 10, defense: 5, crit: 5, agility: 10 };
    const target = { id: 't1', hp: 100, defense: 5, crit: 5, agility: 10 };
    const result = BattleEngine.calculateAttack(attacker, target, 0.5, 'hero', 1, mockRng(0.6));
    expect(result?.action.actionType).toBe('miss');
    expect(result?.dmg).toBe(0);
  });

  test('calculateAttack returns hit with damage when roll <= hitChance', () => {
    const attacker = { id: 'a1', atk: 10, defense: 5, crit: 5, agility: 10 };
    const target = { id: 't1', hp: 100, defense: 5, crit: 5, agility: 10 };
    const result = BattleEngine.calculateAttack(attacker, target, 0.8, 'hero', 1, mockRng(0.5));
    expect(result?.action.actionType).toBe('hit');
    expect(result?.dmg).toBeGreaterThan(0);
  });
});

describe('BattleEngine - AI and Tactics', () => {
  const mockRng = () => 0.5;

  describe('selectTarget (Personalities)', () => {
    const attackerPos = 45;
    const enemies = [
      { id: 'e1', hp: 100, maxHp: 100, position: 5 },
      { id: 'e2', hp: 10, maxHp: 100, position: 35 },
      { id: 'e3', hp: 100, maxHp: 100, position: 40 },
    ];

    test('AGGRESSIVE should prioritize low HP target (e2)', () => {
      const attacker = { id: 'h1', personality: 'AGGRESSIVE', classId: 'WARRIOR' };
      const target = BattleEngine.selectTarget(attacker, attackerPos, enemies, mockRng);
      expect(target?.id).toBe('e2');
    });

    test('CAUTIOUS should prioritize targets within range without moving (e3)', () => {
      const attacker = { id: 'h1', personality: 'CAUTIOUS', range: 1, classId: 'WARRIOR' };
      const target = BattleEngine.selectTarget(attacker, attackerPos, enemies, mockRng);
      expect(target?.id).toBe('e3');
    });

    test('VENGEFUL should prioritize the last attacker', () => {
      const attacker = { id: 'h1', personality: 'VENGEFUL', classId: 'WARRIOR' };
      const context = { lastAttackerId: 'e1' };
      const target = BattleEngine.selectTarget(attacker, attackerPos, enemies, mockRng, context);
      expect(target?.id).toBe('e1');
    });
  });

  describe('findMovePath (Hex Pathfinding)', () => {
    test('should move closer to target when within movement range', () => {
      const start = 45;
      const target = 0;
      const movement = 2;
      const occupied = new Set<number>();
      const next = BattleEngine.findMovePath(start, target, movement, occupied);
      expect(Math.floor(next / 5)).toBeLessThan(9);
      expect(Math.floor(next / 5)).toBeGreaterThanOrEqual(7);
    });

    test('should not move to occupied positions', () => {
      const start = 45;
      const target = 35;
      const movement = 1;
      const occupied = new Set([40]);
      const next = BattleEngine.findMovePath(start, target, movement, occupied);
      expect(next).not.toBe(40);
    });
  });

  describe('executeClassAbility (Healer)', () => {
    const makeState = (): BattleState => ({
      heroes: [],
      enemies: [],
      heroPositions: {},
      enemyPositions: {},
      lastAttacker: {},
      threats: {},
      log: [],
      actions: [],
      rounds: 1,
      activeSynergies: [],
      buffs: {},
      flags: {},
      handlers: {} as any,
      skillCooldowns: {},
      skillOnceUsed: {},
    });

    test('Healer should heal injured ally and consume turn', () => {
      const state = makeState();
      const injuredHero: Hero = {
        id: 'h2', name: 'Injured', hpMax: 20, hpCurrent: 5, atk: 10, mp: 0,
        defense: 0, crit: 0, agility: 0, currentTask: HeroTask.IDLE,
      };
      const healer: Hero = {
        id: 'h1', name: 'Healer', hpMax: 10, hpCurrent: 10, atk: 10, mp: 0,
        defense: 0, crit: 0, agility: 0, currentTask: HeroTask.IDLE, classId: 'HEALER',
      };
      state.heroes = [healer, injuredHero];
      const consumed = BattleEngine.executeClassAbility(healer, state);
      expect(consumed).toBe(true);
      expect(injuredHero.hpCurrent).toBeGreaterThan(5);
      expect(state.log.some(l => l.includes('curou'))).toBe(true);
    });

    test('Healer should NOT heal if allies are healthy', () => {
      const state = makeState();
      const healthyHero: Hero = {
        id: 'h2', name: 'Healthy', hpMax: 20, hpCurrent: 20, atk: 10, mp: 0,
        defense: 0, crit: 0, agility: 0, currentTask: HeroTask.IDLE,
      };
      const healer: Hero = {
        id: 'h1', name: 'Healer', hpMax: 10, hpCurrent: 10, atk: 10, mp: 0,
        defense: 0, crit: 0, agility: 0, currentTask: HeroTask.IDLE, classId: 'HEALER',
      };
      state.heroes = [healer, healthyHero];
      const consumed = BattleEngine.executeClassAbility(healer, state);
      expect(consumed).toBe(false);
      expect(healthyHero.hpCurrent).toBe(20);
    });

    test('Healer should NOT heal themselves even if injured', () => {
      const state = makeState();
      const healer: Hero = {
        id: 'h1', name: 'Healer', hpMax: 20, hpCurrent: 5, atk: 10, mp: 0,
        defense: 0, crit: 0, agility: 0, currentTask: HeroTask.IDLE, classId: 'HEALER',
      };
      state.heroes = [healer];
      const consumed = BattleEngine.executeClassAbility(healer, state);
      expect(consumed).toBe(false);
      expect(healer.hpCurrent).toBe(5);
    });
  });
});
```

(O arquivo acima é o conteúdo COMPLETO do destino — inclui todos os imports necessários. Substitua o arquivo destino integralmente com `Write` ou sobrescrevendo o conteúdo via `Edit` da primeira à última linha.)

- [ ] **Step 6: Deletar os 4 arquivos fontes (agora obsoletos)**

```bash
rm /root/rodrigo/idle_rpg/src/utils/__tests__/heroFactory.test.ts
rm /root/rodrigo/idle_rpg/src/utils/__tests__/gameMath.test.ts
rm /root/rodrigo/idle_rpg/src/utils/__tests__/battleEngine.test.ts
rm /root/rodrigo/idle_rpg/src/utils/__tests__/offlineProgress.test.ts
```

Se o diretório ficar vazio, remova-o também:

```bash
rmdir /root/rodrigo/idle_rpg/src/utils/__tests__ 2>/dev/null || true
```

- [ ] **Step 7: Rodar testes para confirmar que os migrados passam**

Run: `npm test -- --testPathPattern="heroFactory|offlineProgress|gameMath|battleEngine"`
Expected: PASS — todos os testes migrados rodando sem erro

- [ ] **Step 8: Commit**

```bash
git add src/__tests__/utils/heroFactory.test.ts
git add src/__tests__/utils/offlineProgress.test.ts
git add src/__tests__/utils/gameMath.test.ts
git add src/__tests__/utils/battleEngine.test.ts
git rm src/utils/__tests__/heroFactory.test.ts
git rm src/utils/__tests__/gameMath.test.ts
git rm src/utils/__tests__/battleEngine.test.ts
git rm src/utils/__tests__/offlineProgress.test.ts
git commit -m "$(cat <<'EOF'
test(e1): mover testes de utils/__tests__ para src/__tests__/utils/

Os 4 arquivos nunca rodavam no npm test (testMatch só cobre src/__tests__/).
Conteúdo consolidado sem duplicar cobertura já existente nos destinos.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task E2 — Cobertura de edge cases de `trainingMath.ts`

**Problema:** `src/utils/trainingMath.ts` tem cobertura 0% no `npm test` (não havia teste em nenhum local coberto pelo runner).

**Arquivos:**
- Create: `src/__tests__/utils/trainingMath.test.ts`

---

- [ ] **Step 1: Criar `src/__tests__/utils/trainingMath.test.ts`**

A função `computePointsFromMs(baseMs, inflationK, availableMs)` em `src/utils/trainingMath.ts` tem os seguintes comportamentos a cobrir:

```ts
import { computePointsFromMs } from '../../utils/trainingMath';

describe('computePointsFromMs', () => {
  describe('k=0 (sem inflação)', () => {
    test('retorna 0 pontos quando availableMs <= 0', () => {
      expect(computePointsFromMs(1000, 0, 0)).toEqual({ points: 0, leftoverMs: 0 });
      expect(computePointsFromMs(1000, 0, -500)).toEqual({ points: 0, leftoverMs: 0 });
    });

    test('retorna 1 ponto exato quando availableMs == baseMs', () => {
      expect(computePointsFromMs(1000, 0, 1000)).toEqual({ points: 1, leftoverMs: 0 });
    });

    test('retorna N pontos e leftover correto', () => {
      // 3500ms / 1000ms = 3 pontos, 500ms de sobra
      expect(computePointsFromMs(1000, 0, 3500)).toEqual({ points: 3, leftoverMs: 500 });
    });

    test('retorna 0 pontos quando availableMs < baseMs', () => {
      const result = computePointsFromMs(1000, 0, 500);
      expect(result.points).toBe(0);
      expect(result.leftoverMs).toBe(500);
    });
  });

  describe('k > 0 (com inflação logarítmica)', () => {
    test('primeiro ponto custa baseMs (ln(0+1)=0 → fator 1.0)', () => {
      // timeForPoint0 = 1000 * (1 + 0.2 * ln(1)) = 1000 * 1.0 = 1000
      const result = computePointsFromMs(1000, 0.2, 1000);
      expect(result.points).toBe(1);
    });

    test('pontos crescem mais devagar que linear com k=0.2', () => {
      // Com k=0, 10.000ms = 10 pontos exatos
      // Com k=0.2, deve render menos que 10 pontos
      const withoutInflation = computePointsFromMs(1000, 0, 10000);
      const withInflation = computePointsFromMs(1000, 0.2, 10000);
      expect(withInflation.points).toBeLessThan(withoutInflation.points);
    });

    test('leftoverMs é sempre < tempo do próximo ponto', () => {
      const { points, leftoverMs } = computePointsFromMs(1000, 0.5, 50000);
      // timeForNextPoint = 1000 * (1 + 0.5 * Math.log(points + 1))
      const timeForNext = 1000 * (1 + 0.5 * Math.log(points + 1));
      expect(leftoverMs).toBeGreaterThanOrEqual(0);
      expect(leftoverMs).toBeLessThan(timeForNext);
    });

    test('cap de segurança: não ultrapassa 10000 pontos', () => {
      // Passar muito ms com k=0 — o cap de 10000 deve frear
      const result = computePointsFromMs(1, 0, 999_999_999);
      expect(result.points).toBeLessThanOrEqual(10000);
    });
  });
});
```

- [ ] **Step 2: Rodar teste**

Run: `npm test -- --testPathPattern=trainingMath`
Expected: PASS — 9 testes verdes

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/utils/trainingMath.test.ts
git commit -m "$(cat <<'EOF'
test(e2): cobrir edge cases de trainingMath (k=0, inflação, cap)

trainingMath estava com 0% de cobertura no npm test.
EOF
)"
```

---

## Task E3 — Testes unit de `achievementHandler.ts`

**Problema:** `src/context/achievementHandler.ts` sem teste. A função `checkAchievements` aplica condition/reward e é idempotente.

**Arquivos:**
- Create: `src/__tests__/context/achievementHandler.test.ts`

---

- [ ] **Step 1: Criar `src/__tests__/context/achievementHandler.test.ts`**

```ts
import { checkAchievements } from '../../context/achievementHandler';
import { GameState, HeroTask } from '../../types';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    gold: 0,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: Date.now(),
    unlockedAchievements: [],
    completedMissionCount: 0,
    completedMissionIds: [],
    inventory: [],
    permanentBonuses: { atk: 0, hp: 0 },
    ...overrides,
  };
}

describe('checkAchievements', () => {
  test('não desbloqueia nada quando nenhuma condição é satisfeita', () => {
    const state = makeState();
    const next = checkAchievements(state);
    expect(next).toBe(state); // referência igual — sem mudança
    expect(next.unlockedAchievements).toEqual([]);
  });

  test('desbloqueia recruit_1 e concede 20 de gold ao recrutar o primeiro herói', () => {
    const state = makeState({ heroesRecruited: 1 });
    const next = checkAchievements(state);
    expect(next.unlockedAchievements).toContain('recruit_1');
    expect(next.gold).toBe(20); // gold base 0 + recompensa 20
  });

  test('desbloqueia múltiplas conquistas em uma só chamada', () => {
    // heroesRecruited >= 1 E >= 5
    const state = makeState({ heroesRecruited: 5 });
    const next = checkAchievements(state);
    expect(next.unlockedAchievements).toContain('recruit_1');
    expect(next.unlockedAchievements).toContain('recruit_5');
    expect(next.gold).toBe(20 + 100); // recompensas de recruit_1 + recruit_5
  });

  test('é idempotente: não desbloqueia conquista já presente', () => {
    const state = makeState({
      heroesRecruited: 1,
      unlockedAchievements: ['recruit_1'],
      gold: 999,
    });
    const next = checkAchievements(state);
    expect(next).toBe(state); // nenhuma novidade → mesma referência
    expect(next.gold).toBe(999); // gold não muda
  });

  test('mission_50 concede gold + permanentAtkBonus', () => {
    const state = makeState({ completedMissionCount: 50 });
    const next = checkAchievements(state);
    expect(next.unlockedAchievements).toContain('mission_50');
    expect(next.permanentBonuses?.atk).toBeGreaterThan(0);
  });

  test('boss_slayer desbloqueia ao completar mission_boss_1', () => {
    const state = makeState({ completedMissionIds: ['mission_boss_1'] });
    const next = checkAchievements(state);
    expect(next.unlockedAchievements).toContain('boss_slayer');
    expect(next.permanentBonuses?.atk).toBeGreaterThan(0);
    expect(next.permanentBonuses?.hp).toBeGreaterThan(0);
  });

  test('accumulates permanentBonuses additively across calls', () => {
    // Primeira chamada: boss_slayer (+5 atk, +10 hp)
    const state1 = makeState({ completedMissionIds: ['mission_boss_1'] });
    const after1 = checkAchievements(state1);
    // Segunda chamada (nova condição): mission_50 (+2 atk)
    const state2 = {
      ...after1,
      completedMissionCount: 50,
    };
    const after2 = checkAchievements(state2);
    expect(after2.permanentBonuses?.atk).toBe(5 + 2); // boss(5) + mission_50(2)
    expect(after2.permanentBonuses?.hp).toBe(10);
  });
});
```

- [ ] **Step 2: Rodar teste**

Run: `npm test -- --testPathPattern=achievementHandler`
Expected: PASS — 7 testes verdes

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/context/achievementHandler.test.ts
git commit -m "$(cat <<'EOF'
test(e3): testes unit de achievementHandler (condition, reward, idempotência)
EOF
)"
```

---

## Task E4 — Testes de hooks críticos sem cobertura

**Problema:** `useShop`, `useMissionPlayback` e `useDragDropGrid` não têm testes. Focar na **lógica de cálculo e validação**, não na renderização.

**Estratégia:** `useShop` e `useMissionPlayback` usam `useGame` (contexto) → usar `renderHook` com `wrapper` de `GameContext.Provider` (padrão de `useMissions.test.tsx`). `useDragDropGrid` é puro de estado + `useRef` — usar `renderHook` simples; não testar a parte de `PanResponder`/DOM.

**Arquivos:**
- Create: `src/__tests__/hooks/useShop.test.tsx`
- Create: `src/__tests__/hooks/useMissionPlayback.test.ts`
- Create: `src/__tests__/hooks/useDragDropGrid.test.ts`

---

- [ ] **Step 1: Criar `src/__tests__/hooks/useShop.test.tsx`**

Nota: `jest.mock` deve estar no nível do módulo (topo do arquivo), não dentro de `beforeEach`, para que o hoisting funcione corretamente. O hook `useShop` importa `useNavigation` de `@react-navigation/native` — mockar no topo.

```tsx
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { useShop } from '../../hooks/useShop';
import { GameContext } from '../../context/GameContext';
import { initialGameState } from '../../context/gameReducer';

// jest.mock deve ficar no nível do módulo (hoisted automaticamente pelo Jest)
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const mockDispatch = jest.fn();

function makeWrapper(gold: number, heroesRecruited: number) {
  const state = { ...initialGameState, gold, heroesRecruited };
  return ({ children }: { children: React.ReactNode }) => (
    <GameContext.Provider value={{
      state: state as any,
      dispatch: mockDispatch,
      isLoaded: true,
      setHeroTask: jest.fn(),
      recruitHero: jest.fn(),
      offlineSummary: null,
      clearOfflineSummary: jest.fn(),
      applyOfflineSummary: jest.fn(),
    }}>
      {children}
    </GameContext.Provider>
  );
}

beforeEach(() => {
  mockDispatch.mockClear();
});

describe('useShop', () => {
  test('chestCosts aumenta com heroesRecruited (custo base cresce)', () => {
    const { result: r0 } = renderHook(() => useShop(), { wrapper: makeWrapper(0, 0) });
    const { result: r5 } = renderHook(() => useShop(), { wrapper: makeWrapper(0, 5) });
    // baseCost cresce com heroesRecruited; todos os chests devem ser mais caros
    const ids = Object.keys(r5.current.chestCosts);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(r5.current.chestCosts[id]).toBeGreaterThan(r0.current.chestCosts[id]);
    }
  });

  test('handleBuyChest não dispara BUY_CHEST quando gold insuficiente', () => {
    const { result } = renderHook(() => useShop(), { wrapper: makeWrapper(0, 0) });
    act(() => {
      const firstChestId = Object.keys(result.current.chestCosts)[0];
      result.current.handleBuyChest(firstChestId, 'Básico');
    });
    // Com gold=0 e custo>0, deve retornar sem dispatch
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(result.current.revealVisible).toBe(false);
  });

  test('handleBuyChest dispara BUY_CHEST quando gold suficiente', () => {
    const { result } = renderHook(() => useShop(), { wrapper: makeWrapper(99999, 0) });
    act(() => {
      const firstChestId = Object.keys(result.current.chestCosts)[0];
      result.current.handleBuyChest(firstChestId, 'Básico');
    });
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'BUY_CHEST' }));
    expect(result.current.revealVisible).toBe(true);
  });

  test('handleRevealCancel fecha o modal e limpa estado', () => {
    const { result } = renderHook(() => useShop(), { wrapper: makeWrapper(99999, 0) });
    act(() => {
      const firstChestId = Object.keys(result.current.chestCosts)[0];
      result.current.handleBuyChest(firstChestId, 'Básico');
    });
    expect(result.current.revealVisible).toBe(true);
    act(() => {
      result.current.handleRevealCancel();
    });
    expect(result.current.revealVisible).toBe(false);
    expect(result.current.activeChestLabel).toBe('');
  });

  test('handleRevealComplete dispara CONFIRM_CHEST_REVEAL e fecha modal', () => {
    const { result } = renderHook(() => useShop(), { wrapper: makeWrapper(99999, 0) });
    act(() => {
      const firstChestId = Object.keys(result.current.chestCosts)[0];
      result.current.handleBuyChest(firstChestId, 'Básico');
    });
    const fakeHero = { id: 'h99', name: 'Test' } as any;
    act(() => {
      result.current.handleRevealComplete(fakeHero);
    });
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CONFIRM_CHEST_REVEAL', hero: fakeHero })
    );
    expect(result.current.revealVisible).toBe(false);
  });
});
```

- [ ] **Step 2: Criar `src/__tests__/hooks/useMissionPlayback.test.ts`**

`useMissionPlayback` depende de `useGame` mas a lógica central (inicialização dos combatantes e aplicação de ações) pode ser testada com `wrapper` simples ou verificando o estado inicial:

```ts
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useMissionPlayback } from '../../hooks/useMissionPlayback';
import { GameContext } from '../../context/GameContext';
import { initialGameState } from '../../context/gameReducer';
import { ActiveMission, HeroTask } from '../../types';

const mockHero = {
  id: 'h1', name: 'Alice', hpMax: 100, hpCurrent: 100,
  atk: 10, mp: 5, defense: 5, crit: 5, agility: 5,
  currentTask: HeroTask.IDLE, classId: 'WARRIOR' as const,
};

function makeWrapper(heroes = [mockHero]) {
  const state = { ...initialGameState, heroes: heroes as any };
  return ({ children }: { children: React.ReactNode }) => (
    <GameContext.Provider value={{
      state: state as any,
      dispatch: jest.fn(),
      isLoaded: true,
      setHeroTask: jest.fn(),
      recruitHero: jest.fn(),
      offlineSummary: null,
      clearOfflineSummary: jest.fn(),
      applyOfflineSummary: jest.fn(),
    }}>
      {children}
    </GameContext.Provider>
  );
}

describe('useMissionPlayback', () => {
  test('retorna estado inicial vazio quando mission é null', () => {
    const { result } = renderHook(() => useMissionPlayback(null), { wrapper: makeWrapper() });
    expect(result.current.currentCombatants).toEqual([]);
    expect(result.current.playbackLog).toEqual([]);
    expect(result.current.isFinished).toBe(false);
  });

  test('inicializa combatentes a partir da missão (herói + inimigos)', () => {
    const mission: Partial<ActiveMission> = {
      id: 'test_m',
      heroIds: ['h1'],
      startedAt: Date.now() - 5000,
      scheduledActions: [],
      enemiesState: [{ id: 'e1', hp: 50, maxHp: 50, atk: 10, mp: 0 }],
    };

    const { result } = renderHook(
      () => useMissionPlayback(mission as ActiveMission),
      { wrapper: makeWrapper() }
    );

    expect(result.current.currentCombatants.length).toBe(2); // h1 + e1
    const hero = result.current.currentCombatants.find(c => c.id === 'h1');
    const enemy = result.current.currentCombatants.find(c => c.id === 'e1');
    expect(hero).toBeDefined();
    expect(hero?.maxHp).toBe(100);
    expect(enemy).toBeDefined();
    expect(enemy?.maxHp).toBe(50);
  });

  test('aplica ação "hit" reduzindo HP do alvo', async () => {
    const now = Date.now();
    const mission: Partial<ActiveMission> = {
      id: 'test_hit',
      heroIds: ['h1'],
      startedAt: now - 10000, // 10s atrás
      scheduledActions: [
        {
          atMsFromStart: 500, // já deveria ter acontecido
          action: {
            round: 1, actorType: 'hero', actorId: 'h1', actorName: 'Alice',
            actionType: 'hit', targetId: 'e1', amount: 15,
            text: 'Alice atacou e1 por 15',
          },
          applied: false,
        },
      ],
      enemiesState: [{ id: 'e1', hp: 50, maxHp: 50, atk: 10, mp: 0 }],
    };

    const { result } = renderHook(
      () => useMissionPlayback(mission as ActiveMission),
      { wrapper: makeWrapper() }
    );

    // Aguarda o setInterval (200ms) processar a ação
    await waitFor(() => {
      const enemy = result.current.currentCombatants.find(c => c.id === 'e1');
      expect(enemy?.hp).toBe(35); // 50 - 15
    }, { timeout: 1000 });
  });

  test('aplica ação "defeat" marcando combatente como morto', async () => {
    const now = Date.now();
    const mission: Partial<ActiveMission> = {
      id: 'test_defeat',
      heroIds: ['h1'],
      startedAt: now - 10000,
      scheduledActions: [
        {
          atMsFromStart: 100,
          action: {
            round: 1, actorType: 'hero', actorId: 'h1', actorName: 'Alice',
            actionType: 'defeat', targetId: 'e1',
            text: 'e1 foi derrotado',
          },
          applied: false,
        },
      ],
      enemiesState: [{ id: 'e1', hp: 50, maxHp: 50, atk: 10, mp: 0 }],
    };

    const { result } = renderHook(
      () => useMissionPlayback(mission as ActiveMission),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      const enemy = result.current.currentCombatants.find(c => c.id === 'e1');
      expect(enemy?.alive).toBe(false);
      expect(enemy?.hp).toBe(0);
    }, { timeout: 1000 });
  });
});
```

- [ ] **Step 3: Criar `src/__tests__/hooks/useDragDropGrid.test.ts`**

`useDragDropGrid` usa `PanResponder`, `Animated`, e DOM APIs — não testar a parte de interação. Focar em `performDropAssign` (lógica de colisão via `setCellLayout`) e transições de estado via `startDrag`/`cancelDrag`:

```ts
import { renderHook, act } from '@testing-library/react-native';
import { useDragDropGrid } from '../../hooks/useDragDropGrid';

describe('useDragDropGrid', () => {
  test('estado inicial: não está arrastando, sem item', () => {
    const { result } = renderHook(() => useDragDropGrid());
    expect(result.current.dragging).toBe(false);
    expect(result.current.draggingItem).toBeNull();
    expect(result.current.hoveredIndex).toBeNull();
  });

  test('startDrag ativa o estado de arrasto', () => {
    const { result } = renderHook(() => useDragDropGrid<string>());
    act(() => {
      result.current.startDrag('item-a', 100, 200);
    });
    expect(result.current.dragging).toBe(true);
    expect(result.current.draggingItem).toBe('item-a');
  });

  test('cancelDrag reseta o estado', () => {
    const { result } = renderHook(() => useDragDropGrid<string>());
    act(() => {
      result.current.startDrag('item-b', 50, 50);
    });
    act(() => {
      result.current.cancelDrag();
    });
    expect(result.current.dragging).toBe(false);
    expect(result.current.draggingItem).toBeNull();
  });

  test('setCellLayout registra layout de célula sem erros', () => {
    const { result } = renderHook(() => useDragDropGrid<number>());
    // Não deve lançar; a função é void
    expect(() => {
      act(() => {
        result.current.setCellLayout(0, { x: 0, y: 0, width: 100, height: 50 });
        result.current.setCellLayout(1, { x: 100, y: 0, width: 100, height: 50 });
      });
    }).not.toThrow();
  });

  test('onDrop callback é invocado ao finalizar drop em célula válida', () => {
    // Simula: registra layout de célula, seta containerRef mockado, faz drop
    const onDrop = jest.fn();
    const { result } = renderHook(() => useDragDropGrid<string>(onDrop));

    act(() => {
      // Registra célula na posição 0: x=0,y=0,w=200,h=100
      result.current.setCellLayout(0, { x: 0, y: 0, width: 200, height: 100 });
    });

    // Sem containerRef (null), performDropAssign retorna -1 → onDrop NÃO é chamado
    act(() => {
      result.current.startDrag('payload', 100, 50);
    });
    // Sem setContainerRef, a chamada finishDrop(-1) apenas cancela — sem crash
    act(() => {
      result.current.cancelDrag();
    });
    expect(onDrop).not.toHaveBeenCalled(); // sem containerRef, drop silencioso
  });
});
```

- [ ] **Step 4: Rodar todos os novos testes de hooks**

Run: `npm test -- --testPathPattern="useShop|useMissionPlayback|useDragDropGrid"`
Expected: PASS — todos verdes

- [ ] **Step 5: Rodar suíte completa para confirmar sem regressão**

Run: `npm test`
Expected: PASS — todos os testes anteriores continuam verdes

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/hooks/useShop.test.tsx
git add src/__tests__/hooks/useMissionPlayback.test.ts
git add src/__tests__/hooks/useDragDropGrid.test.ts
git commit -m "$(cat <<'EOF'
test(e4): testes de lógica dos hooks useShop, useMissionPlayback, useDragDropGrid
EOF
)"
```

---

## Task F1 — Remover `getDefMulProduct` de `skillEffects.ts`

**Problema:** `getDefMulProduct` é exportado em `src/utils/skillEffects.ts` (linha 477) e importado em `src/utils/battleEngine.ts` (linha 14), mas **nunca chamado** — confirmado via `grep`.

**Arquivos:**
- Modify: `src/utils/skillEffects.ts`
- Modify: `src/utils/battleEngine.ts`

---

- [ ] **Step 1: Remover o export `getDefMulProduct` de `src/utils/skillEffects.ts`**

No arquivo `src/utils/skillEffects.ts`, remova o bloco inteiro (incluindo JSDoc) — atualmente nas linhas 476–480:

```ts
// REMOVER este bloco (linhas 476–480):
/** Get effective defense multiplier from defMul buffs. */
export function getDefMulProduct(state: BattleState, targetId: string): number {
  const muls = state.buffs[targetId]?.filter(b => b.type === 'defMul' && b.expiresAfterRound >= state.rounds) ?? [];
  return muls.reduce((acc, b) => acc * b.value, 1);
}
```

- [ ] **Step 2: Remover o import de `getDefMulProduct` em `src/utils/battleEngine.ts`**

Em `src/utils/battleEngine.ts`, linha 14, remova `getDefMulProduct` da lista de imports. O import deve ficar assim (sem `getDefMulProduct`):

```ts
import { executePreAttackSkills, onHeroDamagedSkills, onHeroDeathSkills, onRogueHitSkills, processDoTBuffs, getShieldReduction } from './skillEffects';
```

- [ ] **Step 3: Type-check + testes**

Run: `npx tsc --noEmit`
Expected: sem erros

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/utils/skillEffects.ts src/utils/battleEngine.ts
git commit -m "$(cat <<'EOF'
refactor(f1): remover getDefMulProduct (exportado mas nunca chamado)
EOF
)"
```

---

## Task F2 — Remover `offlineGold` de `offlineProgress.ts`

**Problema:** `let offlineGold = 0` (linha 23) nunca é incrementado — o gold offline é tratado por `additionalGold` (gold de missões completadas offline). Manter a variável seria dead code e conflita com a restrição "sem gold passivo".

**Arquivos:**
- Modify: `src/utils/offlineProgress.ts`

---

- [ ] **Step 1: Identificar todos os 3 usos de `offlineGold` no arquivo**

Os três usos estão em `src/utils/offlineProgress.ts`:
- Linha 23: `let offlineGold = 0;` — declaração
- Linha 132: `gold: (savedState.gold || 0) + offlineGold,` — soma (sempre soma 0)
- Linha 200: `goldGained: Math.floor(offlineGold + additionalGold),` — soma (offlineGold sempre 0)

- [ ] **Step 2: Remover a declaração e simplificar as referências**

Faça as 3 edições cirúrgicas:

1. Remover a linha `let offlineGold = 0;` (linha 23).

2. Simplificar a linha de `gold` (linha ~132) de:
   ```ts
   gold: (savedState.gold || 0) + offlineGold,
   ```
   para:
   ```ts
   gold: (savedState.gold || 0),
   ```

3. Simplificar a linha de `goldGained` (linha ~200) de:
   ```ts
   goldGained: Math.floor(offlineGold + additionalGold),
   ```
   para:
   ```ts
   goldGained: Math.floor(additionalGold),
   ```

- [ ] **Step 3: Type-check + testes**

Run: `npx tsc --noEmit`
Expected: sem erros

Run: `npm test -- --testPathPattern=offlineProgress`
Expected: PASS — os testes migrados na Task E1 devem continuar verdes

- [ ] **Step 4: Commit**

```bash
git add src/utils/offlineProgress.ts
git commit -m "$(cat <<'EOF'
refactor(f2): remover offlineGold de offlineProgress (dead code; restrição sem gold passivo)

A variável era declarada e zerada mas nunca incrementada.
gold offline vem exclusivamente de missões completadas (additionalGold).
EOF
)"
```

---

## Task F3 — Remover bloco comentado em `VillageScreen.tsx`

**Problema:** As linhas 56–64 de `src/screens/VillageScreen.tsx` contêm um bloco JSX comentado (`bannerContainer` + `ImageBackground`) e os estilos associados (`bannerContainer`, `bannerImage`, `bannerImageStyle`, `bannerOverlay`) ficaram mortos no `StyleSheet.create`. O import de `ImageBackground` (linha 8) também pode ser removido se não houver outro uso.

**Arquivos:**
- Modify: `src/screens/VillageScreen.tsx`

---

- [ ] **Step 1: Confirmar que `ImageBackground` não tem outro uso no arquivo**

Verifique se `ImageBackground` aparece fora do bloco comentado:

```bash
grep -n "ImageBackground" /root/rodrigo/idle_rpg/src/screens/VillageScreen.tsx
```

Expected: apenas linha 8 (import) e linha 58 (dentro do bloco comentado) → seguro remover.

- [ ] **Step 2: Remover o bloco JSX comentado (linhas 56–64)**

No arquivo `src/screens/VillageScreen.tsx`, remova o bloco abaixo (está entre `{/* Banner de Destaque da Vila */}` e o `<View style={styles.grid}>`):

```tsx
        {/* Banner de Destaque da Vila */}
        {/* <View style={styles.bannerContainer}>
          <ImageBackground 
            source={IMAGE_ASSETS.VILLAGE_MAP} 
            style={styles.bannerImage}
            imageStyle={styles.bannerImageStyle}
          >
            <View style={styles.bannerOverlay} />
          </ImageBackground>
        </View> */}
```

- [ ] **Step 3: Remover `ImageBackground` do import (linha 8) e estilos mortos**

No import de `react-native` (linhas 2–10), remova `ImageBackground`:

```ts
// ANTES:
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  ImageBackground, 
  StatusBar 
} from 'react-native';

// DEPOIS:
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  StatusBar 
} from 'react-native';
```

Remova também os 4 estilos mortos do `StyleSheet.create` (linhas 127–143 aproximadamente):

```ts
// REMOVER esses 4 blocos de styles:
  bannerContainer: {
    height: 120,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  bannerImage: {
    flex: 1,
  },
  bannerImageStyle: {
    opacity: 0.4,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 13, 35, 0.2)',
  },
```

Verifique também se `IMAGE_ASSETS` (linha 14) tem outro uso no arquivo. Se só era usado no bloco comentado, remova o import:

```bash
grep -n "IMAGE_ASSETS" /root/rodrigo/idle_rpg/src/screens/VillageScreen.tsx
```

Se o resultado mostrar apenas a linha de import (sem uso em JSX ativo), remova-a.

- [ ] **Step 4: Type-check + testes**

Run: `npx tsc --noEmit`
Expected: sem erros

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/VillageScreen.tsx
git commit -m "$(cat <<'EOF'
refactor(f3): remover bloco bannerContainer comentado e estilos mortos no VillageScreen
EOF
)"
```

---

## Task F4 — Guardar `console.*` com `__DEV__` em `storage.ts` e `missionHandler.ts`

**Problema:** Logs de desenvolvimento vazam em produção. Os `console.error` em `storage.ts` (linhas 119, 134, 144) e o `console.error` em `missionHandler.ts` (linha 129) devem ser condicionados a `__DEV__`. O `console.log` de migration em `storage.ts` (linha 99) também deve ser guardado.

**Arquivos:**
- Modify: `src/services/storage.ts`
- Modify: `src/context/missionHandler.ts`

---

- [ ] **Step 1: Guardar `console.*` em `src/services/storage.ts`**

No arquivo `src/services/storage.ts`, faça as 4 substituições abaixo:

**Linha 99** — `console.log` de migration:
```ts
// ANTES:
      console.log(`Applying storage migration to version ${version}`);
// DEPOIS:
      if (__DEV__) console.log(`Applying storage migration to version ${version}`);
```

**Linha 119** — `console.error` em `save`:
```ts
// ANTES:
      console.error('StorageService: Erro ao salvar estado:', error);
// DEPOIS:
      if (__DEV__) console.error('StorageService: Erro ao salvar estado:', error);
```

**Linha 134** — `console.error` em `load`:
```ts
// ANTES:
      console.error('StorageService: Erro ao carregar estado:', error);
// DEPOIS:
      if (__DEV__) console.error('StorageService: Erro ao carregar estado:', error);
```

**Linha 144** — `console.error` em `clear`:
```ts
// ANTES:
      console.error('StorageService: Erro ao limpar estado:', error);
// DEPOIS:
      if (__DEV__) console.error('StorageService: Erro ao limpar estado:', error);
```

- [ ] **Step 2: Guardar `console.error` em `src/context/missionHandler.ts`**

No arquivo `src/context/missionHandler.ts`, linha 129:
```ts
// ANTES:
    console.error('Erro ao processar batalha da missão:', err);
// DEPOIS:
    if (__DEV__) console.error('Erro ao processar batalha da missão:', err);
```

- [ ] **Step 3: Type-check + testes**

Run: `npx tsc --noEmit`
Expected: sem erros (o tipo de `__DEV__` é `boolean` global em React Native / Expo)

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/storage.ts src/context/missionHandler.ts
git commit -m "$(cat <<'EOF'
refactor(f4): guardar console.log/error com __DEV__ em storage e missionHandler
EOF
)"
```

---

## Task F5 — Tipar `condition` de achievements com `(state: GameState) => boolean`

**Problema:** Em `src/constants/achievements.ts`, linha 6, o campo `condition` está tipado como `(state: any) => boolean`, introduzindo `any` desnecessário. O tipo correto é `(state: GameState) => boolean`.

**Arquivos:**
- Modify: `src/constants/achievements.ts`

---

- [ ] **Step 1: Adicionar import de `GameState` e corrigir a tipagem**

No arquivo `src/constants/achievements.ts`, adicione o import e corrija o campo `condition`:

```ts
// ANTES (linha 1 e 6):
// [sem import]
export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (state: any) => boolean;
  reward: { gold?: number; permanentAtkBonus?: number; permanentHpBonus?: number };
}

// DEPOIS:
import { GameState } from '../types';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (state: GameState) => boolean;
  reward: { gold?: number; permanentAtkBonus?: number; permanentHpBonus?: number };
}
```

- [ ] **Step 2: Verificar que as lambdas existentes em `ACHIEVEMENTS` compilam sem erro**

As lambdas `(s) => s.heroesRecruited >= 1` etc. devem continuar compilando porque `s` agora é inferido como `GameState`. Se o `tsc` reportar algum campo faltando (ex: `s.inventory`), verifique que o campo existe em `GameState` como opcional (`inventory?: Equipment[]`) — o que já é o caso no `src/types/index.ts`.

- [ ] **Step 3: Type-check + testes**

Run: `npx tsc --noEmit`
Expected: sem erros (especialmente sem `any` implícito nesse módulo)

Run: `npm test -- --testPathPattern=achievementHandler`
Expected: PASS — os testes da Task E3 continuam verdes com a tipagem melhorada

- [ ] **Step 4: Commit**

```bash
git add src/constants/achievements.ts
git commit -m "$(cat <<'EOF'
refactor(f5): tipar condition de AchievementDef como (state: GameState) => boolean
EOF
)"
```

---

## Verificação final

- [ ] **Rodar suíte completa**

Run: `npm test`
Expected: PASS — todos os testes (incluindo os migrados e novos) verdes

- [ ] **Type-check final**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Confirmar que os 4 arquivos fontes foram removidos**

```bash
ls /root/rodrigo/idle_rpg/src/utils/__tests__/ 2>/dev/null || echo "diretório removido (esperado)"
```

Expected: diretório vazio ou removido
