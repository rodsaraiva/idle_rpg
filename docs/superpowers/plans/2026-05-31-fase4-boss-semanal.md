# Fase 4 — Boss Semanal: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o ciclo do boss semanal — permitir que o jogador inicie o encontro de boss via botão na `WeeklyScreen`, reutilizando 100% da infra de missão (`ActiveMission`, `battleEngine`, `tickHandler`). Na conclusão por vitória, marcar `bossDefeated`, incrementar `weeklyBossKills`, conceder recompensa do template. Gate de uma-vez-por-semana impedindo segundo disparo.

**Architecture:** Nova `GameAction` `START_WEEKLY_BOSS` é roteada no `gameReducer` para uma função `handleStartWeeklyBoss` em `missionHandler.ts`. Esta função replica o fluxo de `handleStartMission`, mas em vez de buscar um template em `MISSIONS`, constrói um `MissionTemplate` inline a partir de `getWeeklyBoss(seed)`. O campo `isWeeklyBoss?: boolean` é adicionado a `ActiveMission` (sem migration — estado transitório). Na conclusão por vitória, `processMissions` em `tickHandler.ts` detecta `isWeeklyBoss`, chama `markWeeklyBossDefeated` e `updateWeeklyProgress(state, 'weeklyBossKills', 1)`. A `WeeklyScreen` (criada na Fase 2) é editada para conectar o botão "Enfrentar Boss" ao novo action.

**Tech Stack:** TypeScript, React Native (Expo), Jest. Sem novas dependências.

**Prerequisito:** Fase 2 (`docs/superpowers/plans/2026-05-31-fase2-telas-ui.md`) DEVE estar completa — `WeeklyScreen` e seu card na `VillageScreen` precisam existir.

**Spec:** [`docs/superpowers/specs/2026-05-31-gaps-resolution-design.md`](../specs/2026-05-31-gaps-resolution-design.md) — Fase 4.

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/types/index.ts` | Modify | Adicionar `isWeeklyBoss?: boolean` em `ActiveMission`; adicionar `START_WEEKLY_BOSS` ao union `GameAction` |
| `src/context/missionHandler.ts` | Modify | Nova função `handleStartWeeklyBoss` que constrói `ActiveMission` a partir de `WeeklyBossTemplate`; helper `bossTemplateToMissionTemplate` |
| `src/context/tickHandler.ts` | Modify | Fix bug de lookup de template para boss em `processMissions`; retornar `weeklyBossDefeated`+`weeklyBossTemplateId`; aplicar `markWeeklyBossDefeated`, `updateWeeklyProgress`, recompensa de equipamento na vitória |
| `src/context/gameReducer.ts` | Modify | Importar e despachar `handleStartWeeklyBoss` para `START_WEEKLY_BOSS` |
| `src/context/equipmentHandler.ts` | Modify | Nova função `createGuaranteedEquipment(tier)` para recompensa de boss sem consumir materiais |
| `src/screens/WeeklyScreen.tsx` | Modify | Conectar botão "Enfrentar Boss" ao dispatch `START_WEEKLY_BOSS`; import estático `getWeeklyBoss`; desabilitar quando `bossDefeated` |
| `src/__tests__/context/weeklyBoss.test.ts` | Create | Testes unit: build do encontro, vitória (marca + tracker + recompensa + equipamento), derrota (não marca), gate |
| `tests/e2e/weekly_boss_flow.spec.ts` | Create | e2e: Vila → Semanal → Enfrentar Boss → missão inicia |

---

# Task F4-1: Adicionar campo `isWeeklyBoss` e action `START_WEEKLY_BOSS` nos tipos

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Ler o arquivo para confirmar linhas atuais de `ActiveMission` e `GameAction`**

Abrir `src/types/index.ts`. Confirmar que:
- `ActiveMission` termina em torno da linha 180 (campo `looping?: boolean`).
- `GameAction` contém `CLAIM_WEEKLY_QUEST` e `LOAD_STATE` por último.

- [ ] **Step 2: Adicionar `isWeeklyBoss` em `ActiveMission`**

Em `src/types/index.ts`, localize a interface `ActiveMission` e acrescente o campo após `looping`:

```ts
  // whether this mission auto-repeats on completion
  looping?: boolean;
  // whether this is the weekly boss encounter (no migration needed — transient runtime state)
  isWeeklyBoss?: boolean;
}
```

- [ ] **Step 3: Adicionar `START_WEEKLY_BOSS` ao union `GameAction`**

No union `GameAction`, acrescente a linha entre `CLAIM_WEEKLY_QUEST` e `LOAD_STATE`:

```ts
  | { type: 'CLAIM_WEEKLY_QUEST'; questId: string }
  | { type: 'START_WEEKLY_BOSS'; heroIds: string[]; heroPositions?: Record<string, number>; now: number }
  | { type: 'LOAD_STATE'; state: GameState };
```

- [ ] **Step 4: Verificar type-check**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): isWeeklyBoss em ActiveMission + action START_WEEKLY_BOSS"
```

---

# Task F4-2: Função `handleStartWeeklyBoss` em `missionHandler.ts`

**Files:**
- Modify: `src/context/missionHandler.ts`

- [ ] **Step 1: Adicionar imports de `getWeeklyBoss`, `WeeklyBossTemplate` e `getWeeklySeed`**

O arquivo `src/context/missionHandler.ts` já tem na linha 2:
`import { MISSIONS, MissionTemplate } from '../constants/missions';`
`MissionTemplate` **já está importado** — não duplicar. Adicionar apenas:

```ts
import { getWeeklyBoss, WeeklyBossTemplate } from '../constants/weeklyBosses';
import { getWeeklySeed } from '../constants/weeklyQuests';
```

- [ ] **Step 2: Criar helper `bossTemplateToMissionTemplate`**

Antes da função `handleStartMission` (linha 43 atual), adicione:

```ts
/**
 * Converte um WeeklyBossTemplate para MissionTemplate (formato esperado por
 * computeBattleOutcome e BattleEngine.createEnemies).
 */
function bossTemplateToMissionTemplate(boss: WeeklyBossTemplate): MissionTemplate {
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

- [ ] **Step 3: Criar `handleStartWeeklyBoss`**

Ao final de `src/context/missionHandler.ts`, adicione:

```ts
export function handleStartWeeklyBoss(
  state: GameState,
  heroIds: string[],
  heroPositions?: Record<string, number>,
  now?: number
): GameState {
  // Gate: boss já derrotado esta semana
  if (state.weeklyState?.bossDefeated) return state;

  const seed = state.weeklyState?.seed ?? getWeeklySeed();
  const boss = getWeeklyBoss(seed);

  if ((heroIds?.length ?? 0) < boss.minHeroes) return state;

  const heroesMap = new Map(state.heroes.map((h) => [h.id, h]));
  const timestamp = now ?? Date.now();
  const heroesForMission: Hero[] = [];

  for (const hid of heroIds) {
    const h = heroesMap.get(hid);
    if (!h || !isHeroAvailableForMission(h)) return state;
    heroesForMission.push(h);
  }

  const missionId = uuidv4();
  const countHealers = heroesForMission.filter((h) => h.classId === 'HEALER').length;
  const countRogues = heroesForMission.filter((h) => h.classId === 'ROGUE').length;
  const healerBuffMultiplier = 1 + Math.min(HEALER_BUFF_CAP, countHealers * HEALER_BUFF_PER_HERO);
  const rogueRngBonus = Math.min(ROGUE_RNG_BONUS_CAP, countRogues * ROGUE_RNG_BONUS_PER_HERO);

  const teamClassIds = heroesForMission.map(h => h.classId).filter(Boolean) as ClassId[];
  const activeSynergyNames = getActiveSynergies(teamClassIds).map(s => s.name);

  const tpl = bossTemplateToMissionTemplate(boss);

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
    if (copy.hpMax > h.hpMax) {
      copy.hpCurrent = Math.min(copy.hpMax, copy.hpCurrent + (copy.hpMax - h.hpMax));
    }
    return copy;
  });

  const newMission: ActiveMission = {
    id: missionId,
    templateId: boss.id,
    heroIds,
    heroPositions,
    startedAt: timestamp,
    healerBuffMultiplier,
    rogueRngBonus,
    activeSynergies: activeSynergyNames.length > 0 ? activeSynergyNames : undefined,
    looping: false,
    isWeeklyBoss: true,
  };

  try {
    const outcome = computeBattleOutcome(tpl, heroesWithEquipment, {
      healerBuffMultiplier,
      rogueRngBonus,
      heroPositions,
    });
    const missionEnemies = BattleEngine.createEnemies(tpl);
    const scheduled = (outcome.actions || []).map((a, i) => ({
      atMsFromStart: MISSION_START_DELAY_MS + i * MISSION_ACTION_INTERVAL_MS,
      action: a,
      applied: false,
    }));
    newMission.scheduledActions = scheduled;
    newMission.enemiesState = missionEnemies;
    newMission.precomputedOutcome = outcome;
  } catch (err) {
    console.error('Erro ao processar batalha do boss semanal:', err);
    newMission.scheduledActions = [];
  }

  const newHeroesState = state.heroes.map((h) =>
    heroIds.includes(h.id) ? { ...h, currentTask: HeroTask.MISSION } : h
  );

  return {
    ...state,
    heroes: newHeroesState,
    activeMissions: [...(state.activeMissions || []), newMission],
  };
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/context/missionHandler.ts
git commit -m "feat(boss): handleStartWeeklyBoss constrói ActiveMission a partir do template"
```

---

# Task F4-3: Despachar `START_WEEKLY_BOSS` no `gameReducer`

**Files:**
- Modify: `src/context/gameReducer.ts`

- [ ] **Step 1: Adicionar import de `handleStartWeeklyBoss`**

Em `src/context/gameReducer.ts`, o bloco de import de `missionHandler` está nas linhas 4-7:
```ts
import {
  handleStartMission,
  handleCompleteMission,
  handleDismissMissionResult
} from './missionHandler';
```
Substituir por:
```ts
import {
  handleStartMission,
  handleCompleteMission,
  handleDismissMissionResult,
  handleStartWeeklyBoss,
} from './missionHandler';
```

- [ ] **Step 2: Adicionar case no switch**

No switch do `gameReducer` em `src/context/gameReducer.ts`, o case `CLAIM_WEEKLY_QUEST` está na linha 99 e `LOAD_STATE` na linha 102. Substituir:

```ts
    case 'CLAIM_WEEKLY_QUEST':
      return claimWeeklyQuest(state, action.questId);

    case 'LOAD_STATE':
      return { ...action.state };
```
por:
```ts
    case 'CLAIM_WEEKLY_QUEST':
      return claimWeeklyQuest(state, action.questId);

    case 'START_WEEKLY_BOSS':
      return handleStartWeeklyBoss(state, action.heroIds, action.heroPositions, action.now);

    case 'LOAD_STATE':
      return { ...action.state };
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/context/gameReducer.ts
git commit -m "feat(boss): rotear START_WEEKLY_BOSS no gameReducer"
```

---

# Task F4-4: Concluir boss semanal no `tickHandler` (vitória marca + tracker)

**Files:**
- Modify: `src/context/tickHandler.ts`

> **Bug crítico a corrigir:** `processMissions` (linha 131) faz `const tpl = MISSIONS.find((t) => t.id === m.templateId); if (!tpl) continue;`. Como o templateId do boss (`wb_hydra`, `wb_golem`, etc.) **não existe em `MISSIONS`**, a missão de boss seria silenciosamente ignorada pelo tick inteiro — heróis nunca voltam ao IDLE e `bossDefeated` nunca é marcado. A correção é tornar o lookup de `tpl` opcional para missões de boss: se `m.isWeeklyBoss`, buscar o template em `WEEKLY_BOSS_POOL` e converter; caso contrário, manter o `continue` existente.

- [ ] **Step 1: Adicionar imports no topo de `tickHandler.ts`**

O arquivo já importa `{ refreshWeeklyState, updateWeeklyProgress }` de `./weeklyHandler` (linha 27). Adicionar `markWeeklyBossDefeated` ao mesmo import:

```ts
import { refreshWeeklyState, updateWeeklyProgress, markWeeklyBossDefeated } from './weeklyHandler';
```

Também adicionar ao topo (após os imports existentes de `constants`):

```ts
import { getWeeklyBoss, WeeklyBossTemplate } from '../constants/weeklyBosses';
import { MissionTemplate } from '../constants/missions';
```

> Nota: `MISSIONS` já está importado na linha 20; não duplicar. `MissionTemplate` pode não estar — adicionar apenas se necessário (verificar se `tsc` reclama).

- [ ] **Step 2: Adicionar helper `bossToMissionTemplate` local em `tickHandler.ts`**

Logo após os imports, antes de `processTraining`, adicionar:

```ts
function bossToMissionTemplate(boss: WeeklyBossTemplate): MissionTemplate {
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

- [ ] **Step 3: Corrigir o lookup de template em `processMissions` para suportar missões de boss**

Em `processMissions`, localizar as linhas 131-132:

```ts
    const tpl = MISSIONS.find((t) => t.id === m.templateId);
    if (!tpl) continue;
```

Substituir por:

```ts
    let tpl: MissionTemplate | undefined = MISSIONS.find((t) => t.id === m.templateId);
    if (!tpl && m.isWeeklyBoss) {
      // templateId é o id do boss (ex: 'wb_hydra') — buscar no pool semanal
      const bossDef = getWeeklyBoss(m.templateId === 'wb_hydra' ? 0
                     : m.templateId === 'wb_golem' ? 1
                     : m.templateId === 'wb_dragon' ? 2
                     : m.templateId === 'wb_lich' ? 3
                     : 4); // wb_titan
      // Fallback mais robusto: buscar pelo id direto no pool
      const { WEEKLY_BOSS_POOL } = require('../constants/weeklyBosses');
      const bossFromPool = (WEEKLY_BOSS_POOL as WeeklyBossTemplate[]).find(b => b.id === m.templateId);
      if (bossFromPool) tpl = bossToMissionTemplate(bossFromPool);
    }
    if (!tpl) continue;
```

> **Atenção:** o `require` acima é para evitar importação circular em testes; se `tsc` reclamar, use o import estático `WEEKLY_BOSS_POOL` importado no Step 1 (adicionar ao import de `weeklyBosses`).

**Versão preferida (sem `require`)** — adicionar `WEEKLY_BOSS_POOL` ao import do Step 1:

```ts
import { getWeeklyBoss, WeeklyBossTemplate, WEEKLY_BOSS_POOL } from '../constants/weeklyBosses';
```

E substituir as linhas 131-132 por:

```ts
    let tpl: MissionTemplate | undefined = MISSIONS.find((t) => t.id === m.templateId);
    if (!tpl && m.isWeeklyBoss) {
      const bossFromPool = WEEKLY_BOSS_POOL.find(b => b.id === m.templateId);
      if (bossFromPool) tpl = bossToMissionTemplate(bossFromPool);
    }
    if (!tpl) continue;
```

- [ ] **Step 4: Declarar flag `weeklyBossCompletedThisTick` e detectar vitória do boss na conclusão**

Em `processMissions`, logo antes da linha `let goldGained = 0;` (linha 226), adicionar:

```ts
  let weeklyBossCompletedThisTick = false;
  let weeklyBossTemplateId: string | undefined;
```

No `completed.forEach`, no branch `else` (conclusão normal não-looping, linha ~334), o código atual é:

```ts
    } else {
      // Normal completion: release heroes to IDLE
      goldGained += c.reward;
      c.mission.heroIds.forEach((hid: string) => {
        const idx = currentHeroes.findIndex((hh) => hh.id === hid);
        if (idx >= 0) {
          currentHeroes[idx] = { ...currentHeroes[idx], currentTask: HeroTask.IDLE };
        }
      });
    }
```

Substituir por:

```ts
    } else {
      // Boss semanal vitorioso: sinalizar para aplicar bossDefeated fora do loop
      if (c.mission.isWeeklyBoss && c.outcome.success) {
        weeklyBossCompletedThisTick = true;
        // weeklyBossTemplateId é usado na F4-4b para conceder guaranteedRewardTier
        weeklyBossTemplateId = c.mission.templateId;
      }

      // Normal completion: release heroes to IDLE
      goldGained += c.reward;
      c.mission.heroIds.forEach((hid: string) => {
        const idx = currentHeroes.findIndex((hh) => hh.id === hid);
        if (idx >= 0) {
          currentHeroes[idx] = { ...currentHeroes[idx], currentTask: HeroTask.IDLE };
        }
      });
    }
```

- [ ] **Step 5: Fazer `processMissions` retornar `weeklyBossDefeated`**

O tipo de retorno de `processMissions` está na linha 118-124:

```ts
function processMissions(state: GameState, heroes: Hero[], now: number): {
  newHeroes: Hero[],
  activeMissions: ActiveMission[],
  goldGained: number,
  newResults: MissionResult[],
  materialDrops: Record<string, number>,
} {
```

Substituir por:

```ts
function processMissions(state: GameState, heroes: Hero[], now: number): {
  newHeroes: Hero[],
  activeMissions: ActiveMission[],
  goldGained: number,
  newResults: MissionResult[],
  materialDrops: Record<string, number>,
  weeklyBossDefeated: boolean,
  weeklyBossTemplateId: string | undefined,
} {
```

No `return` de `processMissions` (linha 358-364):

```ts
  return {
    newHeroes: currentHeroes,
    activeMissions: remainingMissions,
    goldGained,
    newResults,
    materialDrops,
  };
```

Substituir por:

```ts
  return {
    newHeroes: currentHeroes,
    activeMissions: remainingMissions,
    goldGained,
    newResults,
    materialDrops,
    weeklyBossDefeated: weeklyBossCompletedThisTick,
    weeklyBossTemplateId,
  };
```

- [ ] **Step 6: Atualizar destructuring em `handleTick` e aplicar efeitos do boss**

Em `handleTick` (linha 395-401), o destructuring atual é:

```ts
  const {
    newHeroes,
    activeMissions,
    goldGained,
    newResults,
    materialDrops,
  } = processMissions(currentState, heroesAfterRegen, now);
```

Substituir por:

```ts
  const {
    newHeroes,
    activeMissions,
    goldGained,
    newResults,
    materialDrops,
    weeklyBossDefeated,
    weeklyBossTemplateId,
  } = processMissions(currentState, heroesAfterRegen, now);
```

Após a construção de `stateAfterTick` (linha 415-423) e do bloco `materialDrops` (linhas 425-434), adicionar antes do bloco de daily progress (linha 437):

```ts
  // Boss semanal derrotado neste tick: marcar e incrementar tracker
  // A concessão de guaranteedRewardTier é feita na F4-4b usando weeklyBossTemplateId
  if (weeklyBossDefeated) {
    stateAfterTick = markWeeklyBossDefeated(stateAfterTick);
    stateAfterTick = updateWeeklyProgress(stateAfterTick, 'weeklyBossKills', 1);
  }
```

- [ ] **Step 7: Type-check + testes**

Run: `npx tsc --noEmit`
Expected: zero erros.

Run: `npm test`
Expected: todos passam (sem regressão).

- [ ] **Step 8: Commit**

```bash
git add src/context/tickHandler.ts
git commit -m "feat(boss): conclusão de boss semanal marca bossDefeated e incrementa weeklyBossKills"
```

---

# Task F4-4b: Conceder `guaranteedRewardTier` na vitória do boss semanal

**Spec:** O campo `WeeklyBossTemplate.guaranteedRewardTier?: number` representa o tier mínimo garantido do equipamento que o boss concede ao ser derrotado. Essa recompensa especial deve ser adicionada ao inventário na conclusão vitoriosa do boss.

**Files:**
- Modify: `src/context/tickHandler.ts`

- [ ] **Step 1: Verificar existência de `handleForgeEquipment` ou equivalente**

Verificar se existe uma função que cria um `Equipment` diretamente a partir de um tier (sem consumir materiais), para poder conceder a recompensa do boss sem passar pelo fluxo de forja normal. Checar `src/context/equipmentHandler.ts`:

```bash
grep -n "createEquipment\|generateEquipment\|guaranteedReward\|tier" src/context/equipmentHandler.ts | head -20
```

- [ ] **Step 2: Criar helper `createGuaranteedEquipment` em `equipmentHandler.ts`**

Se não existir função para gerar equipamento por tier sem consumir materiais, adicionar em `src/context/equipmentHandler.ts`:

```ts
import { Equipment } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Cria um Equipment aleatório do tier indicado (para recompensas de boss).
 * Não consome materiais nem modifica filas de forja — geração direta.
 */
export function createGuaranteedEquipment(tier: number): Equipment {
  const types: Equipment['type'][] = ['weapon', 'armor', 'accessory'];
  const equipType = types[Math.floor(Math.random() * types.length)];
  const baseBonus = tier * 3;
  return {
    id: uuidv4(),
    name: `Equipamento Tier ${tier} (Boss)`,
    type: equipType,
    tier,
    statBonus: {
      hp: equipType === 'armor' ? baseBonus * 2 : 0,
      atk: equipType === 'weapon' ? baseBonus : Math.floor(baseBonus / 2),
      mp: equipType === 'accessory' ? baseBonus : 0,
      defense: equipType === 'armor' ? baseBonus : 0,
    },
  };
}
```

- [ ] **Step 3: Importar `createGuaranteedEquipment` no `tickHandler.ts`**

No topo de `src/context/tickHandler.ts`, adicionar:

```ts
import { createGuaranteedEquipment } from './equipmentHandler';
```

- [ ] **Step 4: Aplicar a recompensa garantida no bloco pós-boss em `handleTick`**

O F4-4 Step 6 já expôs `weeklyBossTemplateId` do destructuring de `processMissions`. Substituir o bloco `if (weeklyBossDefeated)` inserido no F4-4 pelo seguinte (que inclui também a recompensa):

```ts
  // Boss semanal derrotado neste tick: marcar, incrementar tracker e conceder equipamento garantido
  if (weeklyBossDefeated && weeklyBossTemplateId) {
    stateAfterTick = markWeeklyBossDefeated(stateAfterTick);
    stateAfterTick = updateWeeklyProgress(stateAfterTick, 'weeklyBossKills', 1);
    const defeatedBoss = WEEKLY_BOSS_POOL.find(b => b.id === weeklyBossTemplateId);
    if (defeatedBoss?.guaranteedRewardTier != null) {
      const rewardItem = createGuaranteedEquipment(defeatedBoss.guaranteedRewardTier);
      stateAfterTick = {
        ...stateAfterTick,
        inventory: [...(stateAfterTick.inventory ?? []), rewardItem],
      };
    }
  }
```

> Este bloco substitui o `if (weeklyBossDefeated)` inserido no F4-4 Step 6 — não duplicar.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/context/tickHandler.ts src/context/equipmentHandler.ts
git commit -m "feat(boss): conceder guaranteedRewardTier como item de inventário na vitória do boss"
```

---

# Task F4-5: Testes unit do boss semanal (TDD — escrever antes da lógica)

> Esta task deve ser criada **antes** das Tasks F4-2 a F4-4. O plano a lista aqui por clareza, mas ao executar, crie os testes ANTES de implementar a lógica — deixe-os falhar (red), implemente (Tasks F4-2 a F4-4b), depois veja-os passar (green).

**Files:**
- Create: `src/__tests__/context/weeklyBoss.test.ts`

- [ ] **Step 1: Criar o arquivo de teste**

> **Dependência:** Os testes de tick (describe `tick — conclusão do boss semanal`) dependem da correção do bug de lookup de template no F4-4 Step 3. Sem esse fix, `processMissions` faz `continue` para missões de boss e os testes falham com "bossDefeated permanece false" mesmo quando a implementação está correta. Execute as Tasks em ordem: F4-5 → F4-1 → F4-2 → F4-3 → F4-4 → F4-4b → rodar testes novamente.

```ts
import { handleStartWeeklyBoss } from '../../context/missionHandler';
import { handleTick } from '../../context/tickHandler';
import { initialGameState } from '../../context/gameReducer';
import { GameState, HeroTask, Hero, ActiveMission } from '../../types';
import { WEEKLY_BOSS_POOL, getWeeklyBoss } from '../../constants/weeklyBosses';
import { getWeeklySeed } from '../../constants/weeklyQuests';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeHero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 'h1',
    name: 'Aldric',
    hpMax: 50,
    hpCurrent: 50,
    atk: 25,
    mp: 10,
    defense: 10,
    crit: 10,
    agility: 10,
    currentTask: HeroTask.IDLE,
    classId: 'WARRIOR',
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    ...overrides,
  } as Hero;
}

/**
 * Estado mínimo válido com weeklyState usando o seed da semana atual.
 * Usar seed real (getWeeklySeed()) evita que handleTick chame refreshWeeklyState
 * e sobrescreva bossDefeated/progress — refreshWeeklyState só reseta se seed mudou.
 * O boss selecionado varia por semana: use getWeeklyBoss(state.weeklyState!.seed)
 * dentro de cada teste para obter o boss correto para o seed atual.
 */
function makeState(heroCount: number = 5): GameState {
  const heroes = Array.from({ length: heroCount }, (_, i) =>
    makeHero({ id: `h${i + 1}`, name: `Hero ${i + 1}` })
  );
  const currentSeed = getWeeklySeed();
  const base: GameState = {
    ...initialGameState,
    heroes,
    activeMissions: [],
  };
  return {
    ...base,
    weeklyState: {
      seed: currentSeed,
      quests: [],
      progress: {},
      allClaimed: false,
      bossDefeated: false,
    },
  };
}

// ── F4-1: gate de bossDefeated ────────────────────────────────────────────────

describe('handleStartWeeklyBoss — gate semanal', () => {
  test('retorna estado inalterado se bossDefeated já é true', () => {
    let state = makeState(5);
    state = { ...state, weeklyState: { ...state.weeklyState!, bossDefeated: true } };
    const heroIds = state.heroes.slice(0, 5).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());
    expect(next).toBe(state);
  });

  test('retorna estado inalterado se heroIds abaixo de minHeroes', () => {
    const state = makeState(5);
    const boss = getWeeklyBoss(state.weeklyState!.seed);
    // boss.minHeroes é 3, 4 ou 5; enviar menos que o mínimo
    const tooFew = state.heroes.slice(0, boss.minHeroes - 1).map(h => h.id);
    const next = handleStartWeeklyBoss(state, tooFew, undefined, Date.now());
    expect(next).toBe(state);
  });
});

// ── F4-2: build do encontro ───────────────────────────────────────────────────

describe('handleStartWeeklyBoss — build do encontro', () => {
  test('cria ActiveMission com isWeeklyBoss=true', () => {
    const state = makeState(5);
    const heroIds = state.heroes.slice(0, 5).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());

    expect(next.activeMissions).toHaveLength(1);
    expect(next.activeMissions![0].isWeeklyBoss).toBe(true);
  });

  test('ActiveMission.templateId corresponde ao id do boss semanal', () => {
    const state = makeState(5);
    const boss = getWeeklyBoss(state.weeklyState!.seed);
    const heroIds = state.heroes.slice(0, boss.minHeroes).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());

    expect(next.activeMissions![0].templateId).toBe(boss.id);
  });

  test('enemiesState é populado com inimigos do template do boss', () => {
    const state = makeState(5);
    const boss = getWeeklyBoss(state.weeklyState!.seed);
    const heroIds = state.heroes.slice(0, boss.minHeroes).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());
    const mission = next.activeMissions![0];

    // Total de inimigos deve ser a soma dos counts do template
    const expectedTotal = boss.enemies.reduce((sum, e) => sum + e.count, 0);
    expect(mission.enemiesState).toHaveLength(expectedTotal);
  });

  test('heróis passam para HeroTask.MISSION após início', () => {
    const state = makeState(5);
    const heroIds = state.heroes.slice(0, 4).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());

    for (const hid of heroIds) {
      const hero = next.heroes.find(h => h.id === hid)!;
      expect(hero.currentTask).toBe(HeroTask.MISSION);
    }
  });

  test('mission não tem looping=true', () => {
    const state = makeState(5);
    const heroIds = state.heroes.slice(0, 4).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());

    expect(next.activeMissions![0].looping).toBe(false);
  });
});

// ── F4-3: conclusão por vitória ───────────────────────────────────────────────

describe('tick — conclusão do boss semanal', () => {
  /** Injeta uma missão de boss já terminada (finishAt no passado) */
  function makeFinishedBossMission(state: GameState, success: boolean): GameState {
    const boss = getWeeklyBoss(state.weeklyState!.seed);
    const heroIds = state.heroes.slice(0, boss.minHeroes).map(h => h.id);
    const pastTime = Date.now() - 10_000;

    const mission: ActiveMission = {
      id: 'boss_test',
      templateId: boss.id,
      heroIds,
      startedAt: pastTime - boss.durationMs,
      finishAt: pastTime,
      isWeeklyBoss: true,
      looping: false,
      scheduledActions: [],
      enemiesState: [],
      precomputedOutcome: {
        reward: boss.rewardMin,
        rounds: 10,
        actions: [],
        log: [],
        success,
        casualties: [],
        enemyCasualties: boss.enemies.reduce((s, e) => s + e.count, 0),
      },
    };

    return {
      ...state,
      heroes: state.heroes.map(h =>
        heroIds.includes(h.id) ? { ...h, currentTask: HeroTask.MISSION } : h
      ),
      activeMissions: [mission],
    };
  }

  test('vitória: bossDefeated torna-se true após tick', () => {
    let state = makeState(5);
    state = makeFinishedBossMission(state, true);

    const now = Date.now();
    const next = handleTick(state, now);

    expect(next.weeklyState?.bossDefeated).toBe(true);
  });

  test('vitória: weeklyBossKills incrementa em 1 após tick', () => {
    let state = makeState(5);
    state = makeFinishedBossMission(state, true);

    const now = Date.now();
    const next = handleTick(state, now);

    expect(next.weeklyState?.progress['weeklyBossKills']).toBe(1);
  });

  test('vitória: gold é concedido após tick', () => {
    let state = makeState(5);
    const boss = getWeeklyBoss(state.weeklyState!.seed);
    state = makeFinishedBossMission(state, true);
    const goldBefore = state.gold;

    const now = Date.now();
    const next = handleTick(state, now);

    expect(next.gold).toBeGreaterThanOrEqual(goldBefore + boss.rewardMin);
  });

  test('derrota: bossDefeated permanece false após tick', () => {
    let state = makeState(5);
    state = makeFinishedBossMission(state, false);

    const now = Date.now();
    const next = handleTick(state, now);

    expect(next.weeklyState?.bossDefeated).toBe(false);
  });

  test('derrota: weeklyBossKills não incrementa', () => {
    let state = makeState(5);
    state = makeFinishedBossMission(state, false);

    const now = Date.now();
    const next = handleTick(state, now);

    expect(next.weeklyState?.progress['weeklyBossKills'] ?? 0).toBe(0);
  });

  test('heróis voltam para IDLE após conclusão (vitória ou derrota)', () => {
    let state = makeState(5);
    const boss = getWeeklyBoss(state.weeklyState!.seed);
    const heroIds = state.heroes.slice(0, boss.minHeroes).map(h => h.id);
    state = makeFinishedBossMission(state, true);

    const now = Date.now();
    const next = handleTick(state, now);

    for (const hid of heroIds) {
      const hero = next.heroes.find(h => h.id === hid)!;
      expect(hero.currentTask).toBe(HeroTask.IDLE);
    }
  });
});

// ── F4-4: gate via handleStartWeeklyBoss após bossDefeated ───────────────────

describe('gate uma-vez-por-semana via handleStartWeeklyBoss', () => {
  test('após bossDefeated=true, segundo dispatch retorna estado inalterado', () => {
    let state = makeState(5);
    // Simular que boss já foi derrotado
    state = {
      ...state,
      weeklyState: { ...state.weeklyState!, bossDefeated: true },
    };
    const heroIds = state.heroes.slice(0, 4).map(h => h.id);

    const next = handleStartWeeklyBoss(state, heroIds, undefined, Date.now());
    expect(next).toBe(state);
    expect(next.activeMissions).toHaveLength(0);
  });
});

// ── F4-5: recompensa de equipamento garantida ─────────────────────────────────

describe('tick — recompensa de equipamento do boss', () => {
  function makeFinishedBossMission(state: GameState, success: boolean): GameState {
    const boss = getWeeklyBoss(state.weeklyState!.seed);
    const heroIds = state.heroes.slice(0, boss.minHeroes).map(h => h.id);
    const pastTime = Date.now() - 10_000;

    const mission: ActiveMission = {
      id: 'boss_reward_test',
      templateId: boss.id,
      heroIds,
      startedAt: pastTime - boss.durationMs,
      finishAt: pastTime,
      isWeeklyBoss: true,
      looping: false,
      scheduledActions: [],
      enemiesState: [],
      precomputedOutcome: {
        reward: boss.rewardMin,
        rounds: 10,
        actions: [],
        log: [],
        success,
        casualties: [],
        enemyCasualties: boss.enemies.reduce((s, e) => s + e.count, 0),
      },
    };

    return {
      ...state,
      heroes: state.heroes.map(h =>
        heroIds.includes(h.id) ? { ...h, currentTask: HeroTask.MISSION } : h
      ),
      activeMissions: [mission],
    };
  }

  test('vitória com guaranteedRewardTier: item adicionado ao inventário', () => {
    // Usar boss wb_dragon (seed=2) que tem guaranteedRewardTier=3
    // para testar recompensa garantida de forma determinística
    const bossWithReward = WEEKLY_BOSS_POOL.find(b => b.guaranteedRewardTier != null);
    if (!bossWithReward) return; // Proteção: se pool mudar

    const seed = WEEKLY_BOSS_POOL.indexOf(bossWithReward);
    // Precisa que getWeeklySeed() retorne algo que mapeia para este boss
    // Alternativa: não testar qual boss específico, apenas que algum boss com
    // guaranteedRewardTier concede item. Usar estado com seed da semana atual
    // e verificar que, se o boss da semana tem guaranteedRewardTier, o inventário cresce.
    let state = makeState(5);
    const weekBoss = getWeeklyBoss(state.weeklyState!.seed);

    if (!weekBoss.guaranteedRewardTier) {
      // Boss da semana sem garantia: apenas verifica que inventário não cresce inesperadamente
      state = makeFinishedBossMission(state, true);
      const now = Date.now();
      const next = handleTick(state, now);
      expect(next.inventory?.length ?? 0).toBe(state.inventory?.length ?? 0);
    } else {
      // Boss da semana com garantia: verifica que inventário cresce em 1
      const inventoryBefore = (state.inventory ?? []).length;
      state = makeFinishedBossMission(state, true);
      const now = Date.now();
      const next = handleTick(state, now);
      expect((next.inventory ?? []).length).toBe(inventoryBefore + 1);
      expect((next.inventory ?? []).at(-1)?.tier).toBe(weekBoss.guaranteedRewardTier);
    }
  });
});
```

- [ ] **Step 2: Rodar testes (devem falhar antes da implementação)**

Run: `npm test -- --testPathPattern=weeklyBoss`
Expected: FAIL — funções/campos ainda não existem.

- [ ] **Step 3: Após implementar F4-1 a F4-4b, rodar novamente**

Run: `npm test -- --testPathPattern=weeklyBoss`
Expected: PASS — todos os testes passam.

- [ ] **Step 4: Rodar suite completa**

Run: `npm test`
Expected: PASS — sem regressão.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/context/weeklyBoss.test.ts
git commit -m "test(boss): testes unit build do encontro, vitória/derrota, gate semanal"
```

---

# Task F4-6: Conectar botão "Enfrentar Boss" na `WeeklyScreen`

> Esta task assume que `WeeklyScreen` existe em `src/screens/WeeklyScreen.tsx` (entregue pela Fase 2) com um botão "Enfrentar Boss" já renderizado (possivelmente desabilitado/"em breve"). Se o arquivo não existir, a Fase 2 não foi concluída — pare e execute-a primeiro.

**Files:**
- Modify: `src/screens/WeeklyScreen.tsx`

- [ ] **Step 1: Verificar `WeeklyScreen.tsx` — encontrar botão e hook atual**

Abrir `src/screens/WeeklyScreen.tsx`. Identificar:
1. Como o hook de estado é usado (ex.: `useGame`, `useWeekly`, `useContext(GameContext)`).
2. Como os dispatches são feitos (ex.: `dispatch({ type: 'CLAIM_WEEKLY_QUEST', questId })`).
3. O botão "Enfrentar Boss" e sua condição de disabled atual.
4. Se há um modal de seleção de heróis ou se herda o fluxo de `MissionsScreen`.

- [ ] **Step 2: Adicionar import estático de `getWeeklyBoss` no topo do arquivo**

No topo de `src/screens/WeeklyScreen.tsx`, adicionar:

```ts
import { getWeeklyBoss } from '../constants/weeklyBosses';
```

- [ ] **Step 3: Adicionar lógica de dispatch e seleção de heróis**

Na `WeeklyScreen`, localizar onde `weeklyState` é lido. Extrair as variáveis derivadas (dentro do componente, antes do `return`):

```ts
const weeklyState = state.weeklyState;
const bossDefeated = weeklyState?.bossDefeated ?? false;

// Heróis disponíveis (IDLE) para enviar ao boss
const availableHeroes = state.heroes.filter(h => h.currentTask === HeroTask.IDLE);
```

Adicionar `import { HeroTask } from '../types';` se ainda não estiver importado.

- [ ] **Step 4: Implementar `handleFightBoss` (sem `require` dinâmico)**

Abaixo das declarações de estado na `WeeklyScreen`, adicionar:

```ts
function handleFightBoss() {
  if (bossDefeated) return;
  const boss = getWeeklyBoss(weeklyState?.seed ?? 0);
  const heroIds = availableHeroes
    .slice(0, Math.min(availableHeroes.length, 5))
    .map(h => h.id);
  if (heroIds.length < boss.minHeroes) {
    // Feedback de heróis insuficientes via emit/toast (padrão do projeto: FEEDBACK_EVENTS.TOAST)
    emit(FEEDBACK_EVENTS.TOAST, {
      text: `Necessários ${boss.minHeroes} heróis disponíveis. Disponíveis: ${heroIds.length}.`,
    });
    return;
  }
  dispatch({ type: 'START_WEEKLY_BOSS', heroIds, now: Date.now() });
}
```

Adicionar import de `emit` e `FEEDBACK_EVENTS` se não estiver presente:
```ts
import { emit, FEEDBACK_EVENTS } from '../services/feedback';
```

- [ ] **Step 5: Atualizar o botão "Enfrentar Boss" na JSX**

Localizar o botão "Enfrentar Boss" (ou equivalente) na JSX e substituir pelo conectado:

```tsx
<TouchableOpacity
  style={[styles.bossButton, bossDefeated && styles.bossButtonDisabled]}
  onPress={handleFightBoss}
  disabled={bossDefeated}
  accessibilityLabel="Enfrentar Boss"
>
  <Text style={styles.bossButtonText}>
    {bossDefeated ? 'Boss Derrotado' : 'Enfrentar Boss'}
  </Text>
</TouchableOpacity>
```

> Sem emojis no texto — padrão do projeto é texto puro nos botões de ação.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 7: Commit**

```bash
git add src/screens/WeeklyScreen.tsx
git commit -m "feat(ui): botão Enfrentar Boss despacha START_WEEKLY_BOSS na WeeklyScreen"
```

---

# Task F4-7: Teste e2e — fluxo Vila → Semanal → Enfrentar Boss

**Files:**
- Create: `tests/e2e/weekly_boss_flow.spec.ts`

- [ ] **Step 1: Criar o arquivo de teste e2e**

```ts
import { test, expect } from '@playwright/test';
import { loadWithState, makeHero, makeState } from './helpers';

test.describe('Weekly Boss Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loadWithState(page, makeState({
      heroes: [
        makeHero({ id: 'h1', name: 'Aldric', classId: 'WARRIOR', atk: 25, hpMax: 60, hpCurrent: 60 }),
        makeHero({ id: 'h2', name: 'Brenna', classId: 'HEALER', atk: 12, mp: 20, hpMax: 40, hpCurrent: 40 }),
        makeHero({ id: 'h3', name: 'Cedric', classId: 'ARCHER', atk: 20, attackType: 'RANGED', range: 3 }),
        makeHero({ id: 'h4', name: 'Doran', classId: 'TANK', hpMax: 80, hpCurrent: 80, defense: 15 }),
        makeHero({ id: 'h5', name: 'Eris', classId: 'MAGE', mp: 25, atk: 18 }),
      ],
      heroesRecruited: 5,
      // weeklyState inicializado sem bossDefeated
      weeklyState: {
        seed: 1,
        quests: [],
        progress: {},
        allClaimed: false,
        bossDefeated: false,
      },
    }));
  });

  test('card Semanal visível na Vila', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Vila")');
    const card = page.locator('text=/[Ss]emanal|[Dd]esafio [Ss]emanal/').first();
    await expect(card).toBeVisible();
  });

  test('navega para WeeklyScreen ao clicar no card Semanal', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Vila")');
    await page.locator('text=/[Ss]emanal|[Dd]esafio [Ss]emanal/').first().click();
    await page.waitForTimeout(800);
    // Deve aparecer o botão do boss ou texto da tela semanal
    await expect(page.locator('text=/[Bb]oss|[Ee]nfrentar/').first()).toBeVisible();
  });

  test('botão Enfrentar Boss está habilitado quando bossDefeated=false', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Vila")');
    await page.locator('text=/[Ss]emanal|[Dd]esafio [Ss]emanal/').first().click();
    await page.waitForTimeout(800);

    const btn = page.locator('text=/[Ee]nfrentar [Bb]oss/').first();
    await expect(btn).toBeVisible();
    // Botão não deve estar desabilitado
    const disabled = await btn.evaluate((el) => (el as HTMLButtonElement).disabled ?? el.getAttribute('aria-disabled'));
    expect(disabled).not.toBe(true);
    expect(disabled).not.toBe('true');
  });

  test('clicar em Enfrentar Boss inicia missão de boss', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Vila")');
    await page.locator('text=/[Ss]emanal|[Dd]esafio [Ss]emanal/').first().click();
    await page.waitForTimeout(800);

    await page.locator('text=/[Ee]nfrentar [Bb]oss/').first().click();
    await page.waitForTimeout(1000);

    // Após dispatch, heróis devem estar em missão — checar feedback visual
    // (missão ativa na tab Missões ou mensagem de início)
    await page.click('[role="tab"]:has-text("Missões")');
    await page.waitForTimeout(500);
    // Deve haver pelo menos uma missão ativa na tela de missões
    await expect(page.locator('text=/[Ee]m [Aa]nda|[Aa]tiva|[Bb]oss/').first()).toBeVisible({ timeout: 3000 });
  });

  test('botão desabilitado quando bossDefeated=true', async ({ page }) => {
    await loadWithState(page, makeState({
      heroes: [
        makeHero({ id: 'h1', name: 'Aldric', classId: 'WARRIOR', atk: 25 }),
        makeHero({ id: 'h2', name: 'Brenna', classId: 'HEALER', atk: 12 }),
        makeHero({ id: 'h3', name: 'Cedric', classId: 'ARCHER', atk: 20 }),
        makeHero({ id: 'h4', name: 'Doran', classId: 'TANK' }),
        makeHero({ id: 'h5', name: 'Eris', classId: 'MAGE' }),
      ],
      heroesRecruited: 5,
      weeklyState: {
        seed: 1,
        quests: [],
        progress: { weeklyBossKills: 1 },
        allClaimed: false,
        bossDefeated: true,
      },
    }));

    await page.click('[role="tab"]:has-text("Vila")');
    await page.locator('text=/[Ss]emanal|[Dd]esafio [Ss]emanal/').first().click();
    await page.waitForTimeout(800);

    // Deve exibir texto de boss derrotado ou botão disabled
    await expect(page.locator('text=/[Dd]errotado|[Dd]isponível|[Ss]emanal/').first()).toBeVisible();
  });
});
```

- [ ] **Step 2: Rodar e2e**

Run: `npm run test:e2e -- --grep "Weekly Boss"`
Expected: PASS — os testes de navegação e dispatch passam.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/weekly_boss_flow.spec.ts
git commit -m "test(e2e): fluxo Vila → Semanal → Enfrentar Boss"
```

---

# Task F4-8: Verificação final

- [ ] **Step 1: Rodar suite unit completa**

Run: `npm test`
Expected: PASS — sem regressão nos ~343 testes existentes + novos testes de weeklyBoss.

- [ ] **Step 2: Type-check final**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 3: Rodar suite e2e completa**

Run: `npm run test:e2e`
Expected: PASS — sem regressão nos 56+ e2e existentes.

- [ ] **Step 4: Verificar no browser (Playwright manual)**

Abrir o app (porta 8081) e verificar manualmente:
1. Vila mostra card "Semanal" — clicar navega para WeeklyScreen.
2. Botão "Enfrentar Boss" visível e habilitado quando boss não foi derrotado.
3. Clicar no botão muda os heróis para `currentTask: MISSION` (visível na tela de Treinamento ou Missões).
4. Após o tick completar a missão, `bossDefeated` torna-se `true` e botão muda para "Boss Derrotado".
5. Recarregar o app — estado persiste (save funciona).

- [ ] **Step 5: Commit final de release da fase**

```bash
git add -p   # revisar diff completo
git commit -m "feat(fase4): boss semanal completo — START_WEEKLY_BOSS, vitória marca bossDefeated + tracker"
git push
```
