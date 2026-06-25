# SPEC 7 — Conteúdo & End-game — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estender o end-game de 6 missões + 1 boss para uma escada difficulty 6→10 em 3 zonas, uma classe nova (Comandante), meta-progressão de **Legado sem reset** (Selos ganhos por marcos/atividade → árvore de bônus permanentes) e eventos sazonais rotativos por seed.

**Architecture:** Reducer puro (`gameReducer.ts`) + handlers por domínio. Conteúdo em `constants/`. Combate determinístico via `battle/*`. Legado e eventos são campos opcionais novos em `GameState`, com migração de save idempotente. Bônus de Legado entram **só** como multiplicador de recompensa de atividade / desconto de custo — nunca crédito passivo de gold, nunca DEF/CRIT/AGI.

**Tech Stack:** TypeScript, Expo (React Native/Web), Jest (`jest.unit.config.js`). Determinismo via `mulberry32` (seed de combate) e seeds de janela (`getWeeklySeed`/`getDailySeed`).

## Global Constraints

- **Sem gold passivo:** nenhum handler novo credita `state.gold` sem ação do jogador (missão/quest/boss). Selos de Legado **não** são gold. Bônus de Legado só multiplicam recompensa de atividade ou descontam custo. (memória `feedback_no_free_gold`)
- **DEF/CRIT/AGI não treináveis e não tocados por Legado/evento:** bônus de Legado nunca escrevem em `defense`/`crit`/`agility`. (memória `feedback_no_trainable_secondary_stats`)
- **Determinismo:** combate e seleção de evento dependem só de seed; mesma seed → mesmo resultado.
- **Compat de save:** todos os campos novos são `?:` opcionais; save antigo carrega sem crash via migration idempotente.
- **Uma classe nova só:** Comandante. Invocador fica fora deste plano (custo de balance/motor).
- **Gates binários:** `npx tsc --noEmit` → 0 erros; `./node_modules/.bin/jest --config jest.unit.config.js --runInBand` → verde a cada task.
- **Rodapé de commit:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Extensões de tipo + migração de save

**Files:**
- Modify: `src/types/index.ts` (GameState ~85-128; `MissionRequirement` em `src/constants/missions.ts`)
- Modify: `src/constants/missions.ts` (interface `MissionRequirement`)
- Modify: `src/services/storage.ts` (`CURRENT_VERSION`, `migrations`)
- Test: `src/__tests__/services/storage.legacy-migration.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  // src/types/index.ts — campos top-level novos em GameState
  legacy?: { level: number; totalExp: number; sealsEarned: string[] };
  activeEvent?: { id: string; startedAt: number; endsAt: number; seed: number } | null;
  legacyUpgrades?: Record<string, number>; // upgradeId -> ranks comprados
  ```
  ```typescript
  // src/constants/missions.ts — union estendido
  type MissionRequirement['type'] = 'min_stat' | 'class_needed' | 'min_avg_stat' | 'mission_cleared';
  // novo campo opcional: missionId?: string;
  ```

- [ ] **Step 1: Teste de migração falhando**

```typescript
// src/__tests__/services/storage.legacy-migration.test.ts
import { migrateState, CURRENT_VERSION } from '../../services/storage';

test('save v10 migra para versão atual com legacy/activeEvent default', () => {
  const old: any = { __version: 10, gold: 100, heroes: [], onboarding: { version: 1, step: 'done', startedAt: 1, hintsSeen: {} } };
  const migrated = migrateState(old);
  expect(migrated.legacy).toEqual({ level: 0, totalExp: 0, sealsEarned: [] });
  expect(migrated.activeEvent).toBeNull();
  expect(migrated.legacyUpgrades).toEqual({});
  expect(migrated.gold).toBe(100); // progresso preservado
});

test('CURRENT_VERSION avançou para 11', () => {
  expect(CURRENT_VERSION).toBe(11);
});
```

> Nota: se `migrateState` não for exportado hoje, exporte-o (ou use o caminho público de migração já existente em `storage.ts`). Verifique o nome real da função de migração antes de escrever o import.

- [ ] **Step 2: Rodar e ver falhar**

Run: `./node_modules/.bin/jest --config jest.unit.config.js src/__tests__/services/storage.legacy-migration.test.ts`
Expected: FAIL (CURRENT_VERSION é 10; sem legacy).

- [ ] **Step 3: Implementar tipos + migração**

Em `src/types/index.ts`, adicione os 3 campos opcionais ao `GameState`.

Em `src/constants/missions.ts`, estenda `MissionRequirement`:
```typescript
export interface MissionRequirement {
  type: 'min_stat' | 'class_needed' | 'min_avg_stat' | 'mission_cleared';
  stat?: 'hp' | 'atk' | 'mp';
  value?: number;
  classId?: ClassId;
  missionId?: string; // usado por 'mission_cleared'
  label: string;
}
```

Em `src/services/storage.ts`, `CURRENT_VERSION = 11` e adicione a migration 11:
```typescript
11: (data) => {
  if (data.legacy === undefined) data.legacy = { level: 0, totalExp: 0, sealsEarned: [] };
  if (data.activeEvent === undefined) data.activeEvent = null;
  if (data.legacyUpgrades === undefined) data.legacyUpgrades = {};
  return data;
},
```

- [ ] **Step 4: Rodar e ver passar**

Run: `./node_modules/.bin/jest --config jest.unit.config.js src/__tests__/services/storage.legacy-migration.test.ts && npx tsc --noEmit`
Expected: PASS, tsc 0.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/constants/missions.ts src/services/storage.ts src/__tests__/services/storage.legacy-migration.test.ts
git commit -m "feat(spec7): tipos de Legado/evento + gate mission_cleared + migração save v11"
```

---

### Task 2: Gate `mission_cleared` + rastreio de `completedMissionIds`

**Files:**
- Modify: `src/context/missionHandler.ts` (`validateMissionRequirements`, `handleCompleteMission`)
- Test: `src/__tests__/context/missionHandler.missionCleared.test.ts`

**Interfaces:**
- Consumes: `MissionRequirement` com `type: 'mission_cleared'`, `missionId` (Task 1); `state.completedMissionIds`.
- Produces: validador retorna `req.label` quando `missionId` não está em `completedMissionIds`; `handleCompleteMission` passa a adicionar `mission.templateId` a `completedMissionIds` (sem duplicar).

- [ ] **Step 1: Teste falhando**

```typescript
// src/__tests__/context/missionHandler.missionCleared.test.ts
import { validateMissionRequirements } from '../../context/missionHandler';
import type { GameState } from '../../types';

const baseState = (cleared: string[]): GameState => ({
  gold: 0, heroes: [], heroesRecruited: 0, lastSavedAt: 0,
  completedMissionIds: cleared,
} as any);

test('mission_cleared bloqueia quando pré-requisito não foi limpo', () => {
  const tmpl: any = { id: 'z2_1', requirements: [{ type: 'mission_cleared', missionId: 'mission_boss_1', label: 'Derrote o Dragão antes' }] };
  expect(validateMissionRequirements(tmpl, [], baseState([]))).toBe('Derrote o Dragão antes');
});

test('mission_cleared libera quando pré-requisito foi limpo', () => {
  const tmpl: any = { id: 'z2_1', requirements: [{ type: 'mission_cleared', missionId: 'mission_boss_1', label: 'Derrote o Dragão antes' }] };
  expect(validateMissionRequirements(tmpl, [], baseState(['mission_boss_1']))).toBeNull();
});
```

> `validateMissionRequirements` hoje recebe `(template, heroes)`. Esta task muda a assinatura para `(template, heroes, state)` para acessar `completedMissionIds`. Atualize todos os call sites em `missionHandler.ts`.

- [ ] **Step 2: Ver falhar** — `./node_modules/.bin/jest --config jest.unit.config.js missionHandler.missionCleared` → FAIL.

- [ ] **Step 3: Implementar**

Em `validateMissionRequirements`, adicione `state: GameState` ao terceiro parâmetro e o case:
```typescript
} else if (req.type === 'mission_cleared') {
  if (!(state.completedMissionIds ?? []).includes(req.missionId!)) {
    return req.label;
  }
}
```
Atualize call sites para passar `state`. Em `handleCompleteMission`, ao final, garanta o rastreio:
```typescript
const templateId = mission.templateId;
const completedIds = state.completedMissionIds ?? [];
return {
  ...state,
  // ...resto já existente...
  completedMissionIds: completedIds.includes(templateId) ? completedIds : [...completedIds, templateId],
};
```

- [ ] **Step 4: Ver passar** — jest do arquivo + `npx tsc --noEmit` → PASS, 0.

- [ ] **Step 5: Commit**

```bash
git add src/context/missionHandler.ts src/__tests__/context/missionHandler.missionCleared.test.ts
git commit -m "feat(spec7): gate mission_cleared e rastreio idempotente de completedMissionIds"
```

---

### Task 3: Zonas Z2–Z4 (difficulty 6→10)

**Files:**
- Modify: `src/constants/missions.ts` (acrescentar missões à pool)
- Test: `src/__tests__/constants/missions.zones.test.ts`

**Interfaces:**
- Consumes: `mission_cleared` gate (Task 2); `MissionTemplate` existente.
- Produces: ≥6 missões novas em 3 zonas encadeadas. IDs estáveis: `z2_costa_1`, `z2_costa_2`, `z3_picos_1`, `z3_picos_2`, `z4_abismo_1`, `z4_abismo_boss`. Cada uma com `difficulty` 6→10 e `requirements` encadeando a anterior.

- [ ] **Step 1: Teste falhando**

```typescript
// src/__tests__/constants/missions.zones.test.ts
import { MISSIONS } from '../../constants/missions';

test('escada cobre difficulty 6→10', () => {
  const diffs = MISSIONS.map(m => m.difficulty ?? 0);
  for (const d of [6, 7, 8, 9, 10]) expect(diffs).toContain(d);
});

test('zonas novas encadeiam via mission_cleared', () => {
  const z2 = MISSIONS.find(m => m.id === 'z2_costa_1')!;
  expect(z2.requirements?.some(r => r.type === 'mission_cleared')).toBe(true);
});

test('curva de recompensa é monotônica não-decrescente por difficulty', () => {
  const byDiff = [...MISSIONS].filter(m => m.difficulty).sort((a, b) => a.difficulty! - b.difficulty!);
  for (let i = 1; i < byDiff.length; i++) {
    expect(byDiff[i].rewardMax).toBeGreaterThanOrEqual(byDiff[i - 1].rewardMax);
  }
});
```

- [ ] **Step 2: Ver falhar** — FAIL (sem missões z2/z3/z4).

- [ ] **Step 3: Implementar** — acrescente as 6 missões à pool seguindo a forma de `MissionTemplate` existente (reusa enemies/scale/ref). Encadeie: `z2_costa_1.requirements = [{ type: 'mission_cleared', missionId: '<id do boss atual difficulty 5>', label: '...' }]`, e assim por diante até `z4_abismo_boss`. `rewardMin/rewardMax` crescentes e coerentes com a curva atual (verifique o último valor da pool difficulty-5 antes de fixar números).

> Os números finais de reward serão validados pelo harness na Task 12. Aqui basta a curva monotônica e gates corretos.

- [ ] **Step 4: Ver passar** — jest do arquivo + `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/constants/missions.ts src/__tests__/constants/missions.zones.test.ts
git commit -m "feat(spec7): zonas Z2-Z4 (difficulty 6-10) encadeadas por mission_cleared"
```

---

### Task 4: Classe Comandante (definição)

**Files:**
- Modify: `src/constants/classes.ts` (`ClassId`, `CLASSES`, ability union)
- Test: `src/__tests__/constants/classes.commander.test.ts`

**Interfaces:**
- Produces: `ClassId` ganha `'COMMANDER'`; `ClassDef.ability` ganha `'COMMANDER_RALLY'`; `CLASSES.COMMANDER` definido (suporte ofensivo, MELEE ou RANGED curto, sem treino de DEF/CRIT/AGI).

- [ ] **Step 1: Teste falhando**

```typescript
// src/__tests__/constants/classes.commander.test.ts
import { CLASSES } from '../../constants/classes';

test('Comandante existe com ability COMMANDER_RALLY', () => {
  const c = CLASSES.COMMANDER;
  expect(c).toBeDefined();
  expect(c.ability).toBe('COMMANDER_RALLY');
});

test('Comandante não treina DEF/CRIT/AGI', () => {
  const ts: any = CLASSES.COMMANDER.trainSpeed ?? {};
  expect(ts.defense).toBeUndefined();
  expect(ts.crit).toBeUndefined();
  expect(ts.agility).toBeUndefined();
});
```

- [ ] **Step 2: Ver falhar** — FAIL.

- [ ] **Step 3: Implementar** — adicione `'COMMANDER'` ao `ClassId`, `'COMMANDER_RALLY'` ao union `ability`, e:
```typescript
COMMANDER: {
  id: 'COMMANDER',
  displayName: 'Comandante',
  baseStatDelta: { atk: 4, hp: 6, mp: 4 },
  trainSpeed: { hp: 1.0, atk: 1.1, mp: 0.8 },
  ability: 'COMMANDER_RALLY',
  attackType: 'MELEE',
  range: 1,
},
```
Verifique se há registros paralelos (ícone/cor/sprite da classe em DS/telas) e adicione o mínimo para não quebrar `tsc`.

- [ ] **Step 4: Ver passar** — jest + `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/constants/classes.ts src/__tests__/constants/classes.commander.test.ts
git commit -m "feat(spec7): classe Comandante (suporte ofensivo, COMMANDER_RALLY)"
```

---

### Task 5: COMMANDER_RALLY no combate

**Files:**
- Modify: `src/utils/battle/turns.ts` (`executeClassAbility`)
- Test: `src/__tests__/utils/battle/commanderRally.test.ts`

**Interfaces:**
- Consumes: `CLASSES.COMMANDER` (Task 4); o mecanismo de buff temporário do `BattleState`.
- Produces: quando um Comandante vivo age e ainda não deu rally nesta batalha, aplica buff de ATK (≈20% do ATK do Comandante, ≥1) a todos os aliados vivos por 3 turnos; consome o turno; registra em `state.log`/`state.actions`.

> **Verificação obrigatória antes de codar:** abra `src/utils/battle/turns.ts` e `src/utils/battle/types.ts` e confirme COMO buffs temporários de ATK são representados e aplicados hoje (campo em `BattleState`, decremento por turno, ponto onde o ATK efetivo é lido no cálculo de dano). Espelhe exatamente esse mecanismo — não invente um `state.buffs` se a engine usar outro nome. Se não existir buff de ATK temporário, adicione o campo mínimo e decremente-o no início do turno do herói.

- [ ] **Step 1: Teste falhando (determinístico)**

```typescript
// src/__tests__/utils/battle/commanderRally.test.ts
import { BattleEngine } from '../../../utils/battleEngine';
// monta dois times idênticos com mesma seed, um com Comandante outro sem;
// roda a batalha e verifica que o dano agregado dos aliados com rally > sem rally,
// ou que o ATK efetivo de um aliado sobe no turno seguinte ao rally.
test('COMMANDER_RALLY eleva ATK efetivo dos aliados por 3 turnos (seed fixa)', () => {
  // Arrange: estado de batalha seedado com 1 Comandante + 1 Warrior.
  // Act: processa turnos até o Comandante agir.
  // Assert: ATK efetivo do Warrior no turno seguinte > ATK base.
  // (preencher com a API real de turns.ts após a verificação do mecanismo de buff)
});
```

- [ ] **Step 2: Ver falhar** — FAIL.

- [ ] **Step 3: Implementar** em `executeClassAbility`, ramo `hero.classId === 'COMMANDER'`, espelhando o padrão do `HEALER_BUFF`/buffs existentes: aplicar o buff a cada aliado vivo, marcar flag de "rally usado" (ex.: `state.flags['commander_rallied_'+hero.id]`) para não repetir, empilhar log/action, `return true`.

- [ ] **Step 4: Ver passar** — jest do arquivo + `npx tsc --noEmit`. Rode também a suíte de combate (`./node_modules/.bin/jest --config jest.unit.config.js battle`) para garantir 0 regressão e snapshots verdes.

- [ ] **Step 5: Commit**

```bash
git add src/utils/battle/turns.ts src/__tests__/utils/battle/commanderRally.test.ts
git commit -m "feat(spec7): COMMANDER_RALLY — buff de ATK do time por 3 turnos no combate"
```

---

### Task 6: Selos de Legado + nivelamento

**Files:**
- Create: `src/constants/legacy.ts` (definição dos Selos + thresholds de nível)
- Create: `src/context/legacyHandler.ts` (`checkLegacySeals`)
- Modify: ponto de tick/conclusão para chamar `checkLegacySeals` (ex.: dentro de `handleCompleteMission` ou no fim do `handleTick`)
- Test: `src/__tests__/context/legacyHandler.test.ts`

**Interfaces:**
- Consumes: `state.legacy`, `state.completedMissionIds`, marcos de zona/boss (Task 3).
- Produces:
  ```typescript
  // src/constants/legacy.ts
  export interface LegacySeal {
    id: string; name: string; icon: string;
    condition: (s: GameState) => boolean; // ex.: limpou z4_abismo_boss
    exp: number;
  }
  export const LEGACY_SEALS: LegacySeal[];
  export function legacyExpThreshold(level: number): number; // ex.: (level+1)*100
  // src/context/legacyHandler.ts
  export function checkLegacySeals(state: GameState): GameState;
  ```

**Invariante crítica:** `checkLegacySeals` **nunca** altera `state.gold`. Selo é meta-moeda própria (exp/level), não gold.

- [ ] **Step 1: Teste falhando**

```typescript
// src/__tests__/context/legacyHandler.test.ts
import { checkLegacySeals } from '../../context/legacyHandler';

const withCleared = (ids: string[]): any => ({ gold: 50, heroes: [], completedMissionIds: ids, legacy: { level: 0, totalExp: 0, sealsEarned: [] } });

test('concede selo de zona uma única vez e nunca mexe em gold', () => {
  const s1 = checkLegacySeals(withCleared(['z2_costa_1']));
  expect(s1.legacy!.sealsEarned).toContain('seal_costa');
  expect(s1.gold).toBe(50); // invariante: sem gold passivo
  const s2 = checkLegacySeals(s1); // idempotente
  expect(s2.legacy!.sealsEarned.filter(x => x === 'seal_costa')).toHaveLength(1);
});

test('acumular exp promove nível', () => {
  // limpar marcos suficientes para cruzar legacyExpThreshold(0)
  const s = checkLegacySeals(withCleared(['z2_costa_1', 'z2_costa_2', 'z3_picos_1']));
  expect(s.legacy!.level).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 2: Ver falhar** — FAIL.

- [ ] **Step 3: Implementar** `LEGACY_SEALS` (um selo por zona limpa + selos de boss), `legacyExpThreshold`, e `checkLegacySeals` espelhando `checkAchievements` (loop, pula já-ganhos, soma exp, promove nível em while, retorna `state` inalterado se nada novo). Plugue a chamada no fim de `handleCompleteMission` (após rastrear `completedMissionIds`).

- [ ] **Step 4: Ver passar** — jest + `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/constants/legacy.ts src/context/legacyHandler.ts src/context/missionHandler.ts src/__tests__/context/legacyHandler.test.ts
git commit -m "feat(spec7): Selos de Legado por marco + nivelamento (sem tocar gold)"
```

---

### Task 7: Árvore de upgrades de Legado + integração econômica

**Files:**
- Create: `src/constants/legacyUpgrades.ts`
- Modify: `src/context/legacyHandler.ts` (`buyLegacyUpgrade`)
- Modify: `src/utils/heroUtils.ts` (aplicar bônus de ritmo/recompensa)
- Modify: `src/context/gameReducer.ts` (action `BUY_LEGACY_UPGRADE`)
- Test: `src/__tests__/context/legacyUpgrades.test.ts`

**Interfaces:**
- Consumes: `state.legacy.level` (pontos gastáveis = nível − ranks já comprados), `state.legacyUpgrades`.
- Produces:
  ```typescript
  // src/constants/legacyUpgrades.ts
  export interface LegacyUpgrade { id: string; name: string; maxRank: number; effect: 'missionRewardPct' | 'missionDurationPct' | 'trainSpeedPct' | 'missionSlot'; perRank: number; }
  export const LEGACY_UPGRADES: LegacyUpgrade[];
  export function legacyRewardMultiplier(state: GameState): number;     // 1 + somatório de missionRewardPct
  export function legacyDurationMultiplier(state: GameState): number;    // 1 - somatório de missionDurationPct (mín 0.5)
  // src/context/legacyHandler.ts
  export function buyLegacyUpgrade(state: GameState, upgradeId: string): GameState;
  ```

**Invariantes:** nenhum `effect` toca DEF/CRIT/AGI nem credita gold direto. `legacyRewardMultiplier` é aplicado **sobre a recompensa de missão concluída** (multiplica atividade), nunca sobre saldo ocioso.

- [ ] **Step 1: Teste falhando**

```typescript
// src/__tests__/context/legacyUpgrades.test.ts
import { buyLegacyUpgrade } from '../../context/legacyHandler';
import { legacyRewardMultiplier } from '../../constants/legacyUpgrades';

const lvl = (level: number): any => ({ gold: 0, heroes: [], legacy: { level, totalExp: 0, sealsEarned: [] }, legacyUpgrades: {} });

test('comprar upgrade gasta ponto e aplica multiplicador de recompensa', () => {
  const s = buyLegacyUpgrade(lvl(1), 'reward_1');
  expect(s.legacyUpgrades!['reward_1']).toBe(1);
  expect(legacyRewardMultiplier(s)).toBeGreaterThan(1);
});

test('não compra sem pontos disponíveis', () => {
  const s = buyLegacyUpgrade(lvl(0), 'reward_1');
  expect(s.legacyUpgrades!['reward_1'] ?? 0).toBe(0); // sem mudança
});

test('upgrade nunca credita gold direto', () => {
  const s = buyLegacyUpgrade(lvl(3), 'reward_1');
  expect(s.gold).toBe(0);
});
```

- [ ] **Step 2: Ver falhar** — FAIL.

- [ ] **Step 3: Implementar** `LEGACY_UPGRADES` (4 nós: `reward_1` missionRewardPct, `haste_1` missionDurationPct, `train_1` trainSpeedPct, `slot_1` missionSlot), `buyLegacyUpgrade` (guarda de pontos disponíveis = `level − Σ ranks`), os multiplicadores, e a action no reducer. Em `handleCompleteMission`, aplique `legacyRewardMultiplier(state)` à recompensa **depois** de `applyGoldBonus` (stacking multiplicativo). Onde a duração de missão é calculada, aplique `legacyDurationMultiplier`. Onde o treino é calculado, aplique o fator de treino.

- [ ] **Step 4: Ver passar** — jest + `npx tsc --noEmit`. Rode o teste-invariante de "sem gold passivo" existente da suíte (grep por `gold passivo`/`no_free_gold`) para garantir 0 regressão.

- [ ] **Step 5: Commit**

```bash
git add src/constants/legacyUpgrades.ts src/context/legacyHandler.ts src/utils/heroUtils.ts src/context/gameReducer.ts src/context/missionHandler.ts src/__tests__/context/legacyUpgrades.test.ts
git commit -m "feat(spec7): árvore de Legado (recompensa/haste/treino/slot) integrada à economia"
```

---

### Task 8: Eventos sazonais (pool + refresh idempotente)

**Files:**
- Create: `src/constants/events.ts`
- Create: `src/context/eventHandler.ts` (`refreshActiveEvent`)
- Modify: `src/context/tickHandler.ts` (ou onde `refreshWeeklyState`/`refreshDailyQuests` são chamados) para chamar `refreshActiveEvent`
- Test: `src/__tests__/context/eventHandler.test.ts`

**Interfaces:**
- Consumes: padrão de `refreshWeeklyState` (seed de janela + idempotência).
- Produces:
  ```typescript
  // src/constants/events.ts
  export interface SeasonalEvent { id: string; name: string; icon: string; modifier: { missionRewardPct?: number; forgeHastePct?: number }; }
  export const SEASONAL_EVENTS: SeasonalEvent[]; // 3-5 eventos curados
  export function getEventSeed(now: number): number;          // janela mensal (YYYYMM)
  export function pickEvent(seed: number): SeasonalEvent;      // determinístico
  // src/context/eventHandler.ts
  export function refreshActiveEvent(state: GameState, now?: number): GameState;
  export function activeEventRewardMultiplier(state: GameState, now?: number): number;
  ```

- [ ] **Step 1: Teste falhando**

```typescript
// src/__tests__/context/eventHandler.test.ts
import { refreshActiveEvent } from '../../context/eventHandler';
import { pickEvent, getEventSeed } from '../../constants/events';

const JAN = new Date(2026, 0, 15).getTime();
const FEB = new Date(2026, 1, 15).getTime();

test('refresh é idempotente dentro da mesma janela', () => {
  const s1 = refreshActiveEvent({ gold: 0, heroes: [] } as any, JAN);
  const s2 = refreshActiveEvent(s1, JAN);
  expect(s2.activeEvent).toBe(s1.activeEvent); // mesma referência: no-op
});

test('troca de janela seleciona evento determinístico do pool', () => {
  const s1 = refreshActiveEvent({ gold: 0, heroes: [] } as any, JAN);
  const s2 = refreshActiveEvent(s1, FEB);
  expect(s2.activeEvent!.id).toBe(pickEvent(getEventSeed(FEB)).id);
});
```

- [ ] **Step 2: Ver falhar** — FAIL.

- [ ] **Step 3: Implementar** `SEASONAL_EVENTS` (ex.: Invasão Goblin +reward, Festival da Forja +forgeHaste, etc.), `getEventSeed` (janela mensal), `pickEvent` (`seed % length`), `refreshActiveEvent` espelhando `refreshWeeklyState` (idempotente por janela), e `activeEventRewardMultiplier`. Plugue `refreshActiveEvent` no mesmo ponto de tick onde `refreshWeeklyState` roda. Aplique `activeEventRewardMultiplier` em `handleCompleteMission` (stacking com Legado/Pantheon).

- [ ] **Step 4: Ver passar** — jest + `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/constants/events.ts src/context/eventHandler.ts src/context/tickHandler.ts src/context/missionHandler.ts src/__tests__/context/eventHandler.test.ts
git commit -m "feat(spec7): eventos sazonais rotativos por seed + modificador de recompensa"
```

---

### Task 9: UI — Tela de Legado

**Files:**
- Create: `src/screens/LegacyScreen.tsx` (ou padrão de telas vigente em `src/screens/`)
- Modify: navegação (registrar a rota; verifique o navegador atual)
- Test: `src/__tests__/screens/legacyScreen.logic.test.ts` (lógica de "pontos disponíveis" / "pode comprar", sem render)

**Interfaces:**
- Consumes: `state.legacy.level`, `state.legacyUpgrades`, `LEGACY_UPGRADES`, `buyLegacyUpgrade`.

> Validação visual fica **manual-pending** (sandbox não sobe Expo). Teste cobre só a lógica derivada.

- [ ] **Step 1: Teste de lógica falhando** — função pura `availableLegacyPoints(state)` e `canBuy(state, upgradeId)` extraídas para `legacyUpgrades.ts`; teste verifica pontos = level − Σ ranks e `canBuy` falso sem pontos / em maxRank.
- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** as funções puras + a tela usando tokens do DS "Reino" (SPEC 2) e os componentes-base (moldura/selo). Sem valores hardcoded de cor — usar tokens.
- [ ] **Step 4: Ver passar** (lógica) + `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git add src/screens/LegacyScreen.tsx src/constants/legacyUpgrades.ts src/__tests__/screens/legacyScreen.logic.test.ts
git commit -m "feat(spec7): tela de Legado (árvore de upgrades) — visual manual-pending"
```

---

### Task 10: UI — Mapa de Zonas + Banner de Evento

**Files:**
- Create/Modify: componente de mapa de zonas em `src/screens/` ou na Vila-mapa (SPEC 3)
- Create: `src/components/EventBanner.tsx`
- Test: `src/__tests__/screens/zoneMap.logic.test.ts` (lógica de bloqueado/desbloqueado)

**Interfaces:**
- Consumes: `completedMissionIds`, `validateMissionRequirements` (status de desbloqueio), `state.activeEvent`.

> Validação visual **manual-pending**.

- [ ] **Step 1: Teste de lógica falhando** — `zoneStatus(state)` retorna `{ z1: 'unlocked', z2: 'locked'|'unlocked', ... }` derivado dos gates; banner mostra `activeEvent` quando presente.
- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** a função pura + componentes (tokens do DS, `village_map.png` se a Vila-mapa do SPEC 3 expõe slots).
- [ ] **Step 4: Ver passar** (lógica) + `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git add src/screens src/components/EventBanner.tsx src/__tests__/screens/zoneMap.logic.test.ts
git commit -m "feat(spec7): mapa de zonas + banner de evento — visual manual-pending"
```

---

### Task 11: Re-rodar balance com 7 classes + verificação final

**Files:**
- Modify: `scripts/simulations/balance_analysis.ts` (incluir Comandante no sweep, se a lista de classes for hardcoded)
- Modify: `.superpowers/sdd/progress.md` (registrar hashes SPEC7)
- Modify: `docs/superpowers/DEBITO-2026-H2.md` (seção A: validação visual das 3 telas novas)

- [ ] **Step 1:** Rodar o harness incluindo Comandante: `npx ts-node scripts/simulations/balance_analysis.ts --ci` (ou o comando real do projeto). Conferir que o gate de thresholds passa com 7 classes; winrate por zona dentro da banda.
- [ ] **Step 2:** Se algum threshold falhar, ajustar `baseStatDelta` do Comandante / rewards das zonas e re-rodar (não enfraquecer thresholds).
- [ ] **Step 3:** `npx tsc --noEmit` → 0; `./node_modules/.bin/jest --config jest.unit.config.js --runInBand` → verde; conferir 3 snapshots de combate intactos.
- [ ] **Step 4:** Atualizar `progress.md` (SPEC7 Task 1..11 com hashes) e a seção A do débito (validação visual em emulador das telas de Legado/Zonas/Banner).
- [ ] **Step 5: Commit**

```bash
git add scripts/simulations/balance_analysis.ts .superpowers/sdd/progress.md docs/superpowers/DEBITO-2026-H2.md
git commit -m "chore(spec7): balance com 7 classes + verificação estática + registro de débito visual"
```

---

## Self-Review (cobertura do spec)

- Zonas Z2–Z4 difficulty 6→10 → Task 3 ✅
- `mission_cleared` gate → Tasks 1–2 ✅
- Classe Comandante + COMMANDER_RALLY → Tasks 4–5 ✅
- Ascensão **redesenhada como Legado sem reset** (decisão do dono) → Tasks 6–7 ✅ (sem reset destrutivo; Selos por marco/atividade, não por reset)
- Moeda de ascensão → exp/level de Legado (Task 6) ✅
- Árvore de upgrades → Task 7 ✅
- Eventos sazonais + refresh → Task 8 ✅
- Campos de estado + migração → Task 1 ✅
- Integração de bônus sem DEF/CRIT/AGI nem gold passivo → Tasks 6–8 (invariantes em teste) ✅
- UI (Legado, Zonas, Banner) → Tasks 9–10 (visual manual-pending) ✅
- Balance 7 classes como gate → Task 11 ✅

**Fora de escopo (não no spec ou device-bound):** reset destrutivo de conta (descartado pela decisão do dono); Invocador (adiado); calendário fixo de feriados (rotativo por seed só).
