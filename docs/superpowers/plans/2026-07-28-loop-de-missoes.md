# Loop de Missões — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao jogador controle sobre o loop de missões — quantos ciclos (X vezes, X tempo, indefinido), um botão para recolher os heróis ao fim do ciclo atual, e um resumo acumulado no lugar de um modal de resultado por ciclo.

**Architecture:** O plano do loop (`LoopPlan`) e o acumulado (`LoopTally`) moram na própria `ActiveMission`, que o motor já recria a cada ciclo — basta carregá-los adiante. As decisões de continuar/parar viram funções puras em `src/utils/missionLoop.ts`; `processMissions` só orquestra. Nenhuma regra de combate, recompensa ou economia muda, e o ouro segue sendo creditado ciclo a ciclo.

**Tech Stack:** TypeScript, React Native (Expo), Jest + @testing-library/react-native, AsyncStorage.

**Spec:** `docs/superpowers/specs/2026-07-28-loop-de-missoes-design.md`

## Global Constraints

- Idioma de código, comentários e mensagens de commit: **pt-BR**.
- `npx tsc --noEmit` tem que passar com **0 erros** ao fim de cada task (o tsconfig tem `noUnusedLocals`/`noUnusedParameters` — import ou variável órfã quebra o build).
- Suíte: `./node_modules/.bin/jest --config jest.unit.config.js --runInBand`. Nenhuma task pode deixar a suíte vermelha.
- Proibido `any` em código de produção — usar `unknown` + narrowing (regra de `.claude/rules/typescript.md`). Em fixture de teste, seguir o padrão que já existe no repo (`state: {...} as any` no `GameContext.Provider`, ver `HeroCard.test.tsx:32`).
- Comentário só para o *porquê* não-trivial. Nada de comentário óbvio.
- Cada task termina em **um commit** com mensagem explicando o porquê.
- Ao fim de cada task que mexe em UI, validar no browser: `npx expo start --web --port 8081` (rodar em background pelo runner da sessão; `nohup ... & disown` morre com exit 144).

---

### Task 1: Tipos do loop e helpers puros

Nada consome ainda — é a fundação. `looping?: boolean` continua existindo e funcionando; a troca vem na Task 3.

**Files:**
- Modify: `src/types/index.ts` (perto de `ActiveMission`, linha ~201, e `MissionResult`, ~249)
- Create: `src/utils/missionLoop.ts`
- Test: `src/__tests__/utils/missionLoop.test.ts`

**Interfaces:**
- Produces: `LoopPlan`, `LoopTally`, `LoopSummary`, `CompletedCycle`, `planAllowsAnotherCycle(plan, now)`, `advanceLoopPlan(plan)`, `accumulateTally(prev, cycle)`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/utils/missionLoop.test.ts`:

```ts
import { planAllowsAnotherCycle, advanceLoopPlan, accumulateTally } from '../../utils/missionLoop';
import { LoopPlan, MissionResult } from '../../types';

const AGORA = 1_000_000;

function resultado(over: Partial<MissionResult> = {}): MissionResult {
  return {
    missionId: 'm1', templateId: 'mission_1', success: true, reward: 100,
    rounds: 3, actions: [], log: [], casualties: [], enemyCasualties: 2, ...over,
  } as MissionResult;
}

describe('planAllowsAnotherCycle', () => {
  test('endless sempre permite', () => {
    expect(planAllowsAnotherCycle({ mode: 'endless' }, AGORA)).toBe(true);
  });

  test('times permite enquanto restar ciclo', () => {
    expect(planAllowsAnotherCycle({ mode: 'times', remaining: 1, total: 3 }, AGORA)).toBe(true);
    expect(planAllowsAnotherCycle({ mode: 'times', remaining: 0, total: 3 }, AGORA)).toBe(false);
  });

  test('until barra quando o prazo já passou', () => {
    expect(planAllowsAnotherCycle({ mode: 'until', endsAt: AGORA + 1 }, AGORA)).toBe(true);
    expect(planAllowsAnotherCycle({ mode: 'until', endsAt: AGORA }, AGORA)).toBe(false);
  });
});

describe('advanceLoopPlan', () => {
  test('times decrementa remaining e preserva total', () => {
    expect(advanceLoopPlan({ mode: 'times', remaining: 3, total: 3 }))
      .toEqual({ mode: 'times', remaining: 2, total: 3 });
  });

  test('times não desce abaixo de zero', () => {
    expect(advanceLoopPlan({ mode: 'times', remaining: 0, total: 3 }))
      .toEqual({ mode: 'times', remaining: 0, total: 3 });
  });

  test('until e endless passam intactos', () => {
    const until: LoopPlan = { mode: 'until', endsAt: AGORA };
    expect(advanceLoopPlan(until)).toEqual(until);
    expect(advanceLoopPlan({ mode: 'endless' })).toEqual({ mode: 'endless' });
  });
});

describe('accumulateTally', () => {
  test('parte do zero quando não há acumulado anterior', () => {
    const t = accumulateTally(undefined, {
      gold: 120, materials: { couro: 2 },
      casualties: [{ heroId: 'h1', hpAfter: 5 }], result: resultado(),
    });
    expect(t.cycles).toBe(1);
    expect(t.gold).toBe(120);
    expect(t.materials).toEqual({ couro: 2 });
    expect(t.casualties).toEqual([{ heroId: 'h1', hpAfter: 5 }]);
    expect(t.lastResult?.missionId).toBe('m1');
  });

  test('soma ouro, funde materiais e substitui o último resultado', () => {
    const primeiro = accumulateTally(undefined, {
      gold: 100, materials: { couro: 2, ferro: 1 }, casualties: [], result: resultado(),
    });
    const segundo = accumulateTally(primeiro, {
      gold: 50, materials: { couro: 3 }, casualties: [{ heroId: 'h2', hpAfter: 0 }],
      result: resultado({ missionId: 'm2' }),
    });
    expect(segundo.cycles).toBe(2);
    expect(segundo.gold).toBe(150);
    expect(segundo.materials).toEqual({ couro: 5, ferro: 1 });
    expect(segundo.casualties).toEqual([{ heroId: 'h2', hpAfter: 0 }]);
    expect(segundo.lastResult?.missionId).toBe('m2');
  });

  test('não muta o acumulado anterior', () => {
    const primeiro = accumulateTally(undefined, { gold: 10, materials: { couro: 1 }, casualties: [], result: resultado() });
    accumulateTally(primeiro, { gold: 10, materials: { couro: 1 }, casualties: [], result: resultado() });
    expect(primeiro.gold).toBe(10);
    expect(primeiro.materials).toEqual({ couro: 1 });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/missionLoop.test.ts
```

Esperado: falha na compilação — `Cannot find module '../../utils/missionLoop'`.

- [ ] **Step 3: Adicionar os tipos**

Em `src/types/index.ts`, antes de `export interface ActiveMission`:

```ts
/** Quantos ciclos um loop de missão ainda deve rodar. */
export type LoopPlan =
  | { mode: 'times'; remaining: number; total: number }
  | { mode: 'until'; endsAt: number }
  | { mode: 'endless' };

/** Acumulado de um loop, carregado de ciclo em ciclo. */
export interface LoopTally {
  cycles: number;
  gold: number;
  materials: Record<string, number>;
  casualties: { heroId: string; hpAfter: number }[];
  lastResult?: MissionResult;
}

export type LoopStopReason = 'completed' | 'recalled' | 'casualties' | 'failed' | 'error';

/** Resumo pronto para a UI, emitido quando o loop termina. */
export interface LoopSummary {
  missionId: string;
  templateId: string;
  heroIds: string[];
  tally: LoopTally;
  plannedCycles?: number;
  reason: LoopStopReason;
}
```

Dentro de `ActiveMission`, ao lado de `looping?: boolean`:

```ts
  loop?: LoopPlan;
  loopRecalled?: boolean;
  loopTally?: LoopTally;
```

Em `MissionResult`, adicionar:

```ts
  /** Ciclo de loop: não deve abrir o modal de resultado individual. */
  fromLoop?: boolean;
```

Em `GameState`, ao lado de `recentMissionResults`:

```ts
  /** Loops encerrados aguardando ciente do jogador. */
  completedLoops?: LoopSummary[];
```

- [ ] **Step 4: Implementar os helpers**

Criar `src/utils/missionLoop.ts`:

```ts
import { LoopPlan, LoopTally, MissionResult } from '../types';

/** Um ciclo já concluído, na forma que o acumulador consome. */
export interface CompletedCycle {
  gold: number;
  materials: Record<string, number>;
  casualties: { heroId: string; hpAfter: number }[];
  result: MissionResult;
}

/**
 * O plano é avaliado DEPOIS do ciclo terminar — por isso `remaining: 0` barra.
 * Um plano criado com `remaining: 3` roda exatamente 3 ciclos.
 */
export function planAllowsAnotherCycle(plan: LoopPlan, now: number): boolean {
  switch (plan.mode) {
    case 'times': return plan.remaining > 0;
    case 'until': return now < plan.endsAt;
    case 'endless': return true;
  }
}

export function advanceLoopPlan(plan: LoopPlan): LoopPlan {
  if (plan.mode !== 'times') return plan;
  return { ...plan, remaining: Math.max(0, plan.remaining - 1) };
}

export function accumulateTally(prev: LoopTally | undefined, cycle: CompletedCycle): LoopTally {
  const materials = { ...(prev?.materials ?? {}) };
  for (const [mat, qty] of Object.entries(cycle.materials)) {
    materials[mat] = (materials[mat] ?? 0) + qty;
  }
  return {
    cycles: (prev?.cycles ?? 0) + 1,
    gold: (prev?.gold ?? 0) + cycle.gold,
    materials,
    casualties: cycle.casualties,
    lastResult: cycle.result,
  };
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

```bash
./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/missionLoop.test.ts
npx tsc --noEmit
```

Esperado: 11 testes passando, tsc 0 erros.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/utils/missionLoop.ts src/__tests__/utils/missionLoop.test.ts
git commit -m "feat(loop): tipos de plano/acumulado e regras puras de continuidade

Isola a decisão de continuar ou parar um loop em funções puras, fora do
processMissions, que já é o maior ponto de regressão do projeto."
```

---

### Task 2: Migração de save v13 → v14

**Files:**
- Modify: `src/services/storage.ts:6` (`CURRENT_VERSION`) e o objeto `migrations` (~linha 117)
- Test: `src/__tests__/services/storage.loop-migration.test.ts` (criar)

**Interfaces:**
- Consumes: `LoopPlan` (Task 1)
- Produces: saves v14 com `activeMissions[].loop` no lugar de `looping`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/services/storage.loop-migration.test.ts`:

```ts
import { migrateState, CURRENT_VERSION } from '../../services/storage';

test('save v13 com missão em loop vira plano endless na v14', () => {
  const antigo: any = {
    _version: 13, gold: 10, heroes: [], legacy: { level: 0, totalExp: 0, sealsEarned: [] },
    activeEvent: null, legacyUpgrades: {}, consent: { analytics: false, decided: false, decidedAt: 0 },
    activeMissions: [
      { id: 'm1', templateId: 'mission_1', heroIds: ['h1'], startedAt: 0, looping: true },
      { id: 'm2', templateId: 'mission_1', heroIds: ['h2'], startedAt: 0, looping: false },
    ],
  };

  const novo: any = migrateState(antigo);

  expect(novo._version).toBe(CURRENT_VERSION);
  expect(novo.activeMissions[0].loop).toEqual({ mode: 'endless' });
  expect(novo.activeMissions[0].looping).toBeUndefined();
  expect(novo.activeMissions[1].loop).toBeUndefined();
  expect(novo.activeMissions[1].looping).toBeUndefined();
});

test('save sem activeMissions migra sem quebrar', () => {
  const novo: any = migrateState({ _version: 13, gold: 0, heroes: [] });
  expect(novo._version).toBe(CURRENT_VERSION);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/services/storage.loop-migration.test.ts
```

Esperado: FAIL — `expect(received).toBe(14)` recebendo 13, e `loop` undefined.

- [ ] **Step 3: Implementar a migração**

Em `src/services/storage.ts`, trocar a linha 6:

```ts
export const CURRENT_VERSION = 14; // Incremented for migrations
```

E adicionar ao objeto `migrations`, logo depois da entrada `13`:

```ts
  14: (data) => {
    // Version 14: loop de missão vira plano (times/until/endless). O booleano
    // antigo só sabia "repetir para sempre" — é essa a leitura honesta do save.
    for (const m of data.activeMissions ?? []) {
      if (m.looping) m.loop = { mode: 'endless' };
      delete m.looping;
    }
    return data;
  },
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/services/storage
npx tsc --noEmit
```

Esperado: todos os testes de storage passando (inclusive os de migração antigos).

- [ ] **Step 5: Commit**

```bash
git add src/services/storage.ts src/__tests__/services/storage.loop-migration.test.ts
git commit -m "feat(loop): migração v14 converte looping booleano em plano endless

Saves com missão em voo precisam continuar repetindo depois do deploy."
```

---

### Task 3: Trocar `looping` por `loop` de ponta a ponta

Paridade de comportamento: só o modo `endless` é produzido. Nada muda para o jogador — é a troca do trilho.

**Files:**
- Modify: `src/types/index.ts` (remover `looping?: boolean` de `ActiveMission`; trocar na action `START_MISSION`)
- Modify: `src/context/missionHandler.ts:62,69,90,135,166`
- Modify: `src/context/gameReducer.ts:65`
- Modify: `src/context/missionTickHandler.ts:173,212`
- Modify: `src/hooks/useMissions.ts:36,50`
- Modify: `src/components/MissionHeroSelectionModal.tsx:47,61,141,387-408`
- Test: `src/__tests__/context/missionLoop.integration.test.ts` (criar)

**Interfaces:**
- Consumes: `LoopPlan` (Task 1)
- Produces: `START_MISSION { loop?: LoopPlan }`; `handleStartMission(state, templateId, heroIds, heroPositions?, now?, loop?)`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/context/missionLoop.integration.test.ts`:

```ts
import { processMissions } from '../../context/missionTickHandler';
import { MISSIONS } from '../../constants/missions';
import { GameState, Hero, HeroTask, ActiveMission, LoopPlan } from '../../types';

const TPL = MISSIONS[0];

function heroi(id: string): Hero {
  return {
    id, name: `Herói ${id}`, hpMax: 500, hpCurrent: 500, atk: 999, mp: 10,
    defense: 50, crit: 10, agility: 10, currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  } as Hero;
}

/** Missão já vencida: finishAt no passado e desfecho pré-computado de vitória. */
function missaoConcluida(loop?: LoopPlan, over: Partial<ActiveMission> = {}): ActiveMission {
  const agora = Date.now();
  return {
    id: 'm1', templateId: TPL.id, heroIds: ['h1'],
    startedAt: agora - TPL.durationMs - 1000, finishAt: agora - 1000,
    scheduledActions: [], enemiesState: [],
    precomputedOutcome: {
      reward: 100, rounds: 1, actions: [], log: [], success: true,
      casualties: [], enemyCasualties: 1,
    },
    loop, ...over,
  } as ActiveMission;
}

function estado(missoes: ActiveMission[]): GameState {
  return {
    gold: 0, heroes: [heroi('h1')], heroesRecruited: 1, lastSavedAt: 0,
    activeMissions: missoes,
  } as GameState;
}

test('missão com loop endless recria o ciclo e mantém os heróis em missão', () => {
  const st = estado([missaoConcluida({ mode: 'endless' })]);
  const r = processMissions(st, st.heroes, Date.now());

  expect(r.activeMissions).toHaveLength(1);
  expect(r.activeMissions[0].loop).toEqual({ mode: 'endless' });
  expect(r.activeMissions[0].id).not.toBe('m1');
  expect(r.newHeroes[0].currentTask).toBe(HeroTask.MISSION);
});

test('missão sem loop encerra e libera o herói', () => {
  const st = estado([missaoConcluida(undefined)]);
  const r = processMissions(st, st.heroes, Date.now());

  expect(r.activeMissions).toHaveLength(0);
  expect(r.newHeroes[0].currentTask).toBe(HeroTask.IDLE);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/missionLoop.integration.test.ts
```

Esperado: FAIL — `activeMissions` vem vazio no 1º teste, porque `processMissions` ainda lê `m.looping`.

- [ ] **Step 3: Trocar o tipo e o caminho de início**

`src/types/index.ts` — em `ActiveMission`, apagar `looping?: boolean;` (os campos novos da Task 1 ficam). Na action:

```ts
  | { type: 'START_MISSION'; templateId: string; heroIds: string[]; heroPositions?: Record<string, number>; now: number; loop?: LoopPlan }
```

`src/context/missionHandler.ts` — na interface de parâmetros (linha ~62) trocar `looping: boolean;` por `loop?: LoopPlan;`; na desestruturação (~69) trocar `looping` por `loop`; no objeto da missão (~90) trocar `looping,` por `loop,`. Na assinatura (~135):

```ts
export function handleStartMission(state: GameState, templateId: string, heroIds: string[], heroPositions?: Record<string, number>, now?: number, loop?: LoopPlan): GameState {
```

E na construção (~166) trocar `looping: looping ?? false, isWeeklyBoss: false,` por `loop, isWeeklyBoss: false,`. Na do boss (~213) apagar `looping: false,` (boss nunca entra em loop).

`src/context/gameReducer.ts:65`:

```ts
      return handleStartMission(state, action.templateId, action.heroIds, action.heroPositions, action.now, action.loop);
```

- [ ] **Step 4: Trocar o caminho de conclusão**

`src/context/missionTickHandler.ts` — trocar a condição da linha 173:

```ts
    if (c.mission.loop && c.outcome.success) {
```

E, no objeto empurrado (linha ~212), trocar `looping: true,` por:

```ts
              loop: c.mission.loop,
```

- [ ] **Step 5: Trocar a UI e o hook**

`src/hooks/useMissions.ts` (linhas 36 e 50):

```ts
  const handleConfirmMission = (templateId: string, heroIds: string[], heroPositions?: Record<string, number>, loop?: LoopPlan) => {
```

```ts
    dispatch({ type: 'START_MISSION', templateId, heroIds: valid, heroPositions, now: Date.now(), loop });
```

Importar `LoopPlan` de `../types`.

`src/components/MissionHeroSelectionModal.tsx` — a prop (linha 47):

```ts
  onConfirm: (templateId: string, heroIds: string[], heroPositions: Record<string, number>, loop?: LoopPlan) => void;
```

O estado (linha 61) continua `const [looping, setLooping] = useState(false);` — o checkbox segue igual nesta task. Só a chamada (linha 141) muda:

```ts
    onConfirm(templateId, heroIds, heroPositions, looping ? { mode: 'endless' } : undefined);
```

- [ ] **Step 6: Rodar tudo**

```bash
./node_modules/.bin/jest --config jest.unit.config.js --runInBand
npx tsc --noEmit
```

Esperado: suíte inteira verde. Testes antigos que montavam `looping: true` em fixtures precisam virar `loop: { mode: 'endless' }` — procurar com `grep -rn "looping" src/__tests__`.

- [ ] **Step 7: Commit**

```bash
git add -A src/types/index.ts src/context src/hooks/useMissions.ts src/components/MissionHeroSelectionModal.tsx src/__tests__
git commit -m "refactor(loop): looping booleano vira LoopPlan de ponta a ponta

Troca de trilho sem mudança de comportamento: o booleano só sabia repetir
para sempre, e os modos por vezes/tempo entram na próxima task."
```

---

### Task 4: Modos "X vezes" e "por tempo"

**Files:**
- Modify: `src/context/missionTickHandler.ts` (bloco do loop, ~173-238)
- Modify: `src/components/MissionHeroSelectionModal.tsx` (checkbox vira seletor de modo)
- Test: `src/__tests__/context/missionLoop.integration.test.ts` (estender)

**Interfaces:**
- Consumes: `planAllowsAnotherCycle`, `advanceLoopPlan` (Task 1)
- Produces: missões cujo `loop` avança a cada ciclo

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `src/__tests__/context/missionLoop.integration.test.ts`:

```ts
test('plano de 3 vezes roda 3 ciclos e para — sem off-by-one', () => {
  let missoes: ActiveMission[] = [missaoConcluida({ mode: 'times', remaining: 3, total: 3 })];
  let herois = [heroi('h1')];
  const restantes: number[] = [];

  for (let i = 0; i < 4 && missoes.length > 0; i++) {
    const st = { ...estado(missoes), heroes: herois };
    const r = processMissions(st, herois, Date.now());
    herois = r.newHeroes;
    missoes = r.activeMissions.map((m) => ({
      ...missaoConcluida(m.loop), id: m.id, loopTally: m.loopTally,
    }));
    const plano = missoes[0]?.loop;
    if (plano?.mode === 'times') restantes.push(plano.remaining);
  }

  // ciclo 1 deixa remaining 2, ciclo 2 deixa 1, ciclo 3 encerra
  expect(restantes).toEqual([2, 1]);
  expect(missoes).toHaveLength(0);
  expect(herois[0].currentTask).toBe(HeroTask.IDLE);
});

test('modo por tempo não inicia novo ciclo depois do prazo', () => {
  const agora = Date.now();
  const st = estado([missaoConcluida({ mode: 'until', endsAt: agora - 1 })]);
  const r = processMissions(st, st.heroes, agora);

  expect(r.activeMissions).toHaveLength(0);
  expect(r.newHeroes[0].currentTask).toBe(HeroTask.IDLE);
});

test('modo por tempo continua enquanto o prazo não chegou', () => {
  const agora = Date.now();
  const st = estado([missaoConcluida({ mode: 'until', endsAt: agora + 60_000 })]);
  const r = processMissions(st, st.heroes, agora);

  expect(r.activeMissions).toHaveLength(1);
  expect(r.activeMissions[0].loop).toEqual({ mode: 'until', endsAt: agora + 60_000 });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/missionLoop.integration.test.ts
```

Esperado: FAIL — hoje qualquer `loop` presente repete para sempre.

- [ ] **Step 3: Aplicar o plano no motor**

Em `src/context/missionTickHandler.ts`, importar no topo:

```ts
import { planAllowsAnotherCycle, advanceLoopPlan } from '../utils/missionLoop';
```

Trocar a condição da linha ~173 por:

```ts
    const planoAvancado = c.mission.loop ? advanceLoopPlan(c.mission.loop) : undefined;
    const podeRepetir =
      !!planoAvancado && c.outcome.success && planAllowsAnotherCycle(planoAvancado, now);

    if (podeRepetir) {
```

E no objeto empurrado (~212), trocar `loop: c.mission.loop,` por:

```ts
              loop: planoAvancado,
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
./node_modules/.bin/jest --config jest.unit.config.js --runInBand
npx tsc --noEmit
```

- [ ] **Step 5: Trocar o checkbox pelo seletor de modo**

Em `src/components/MissionHeroSelectionModal.tsx`, trocar o estado da linha 61:

```ts
  const [loopMode, setLoopMode] = useState<'once' | 'times' | 'until' | 'endless'>('once');
  const [timesChip, setTimesChip] = useState(3);
  const [untilChip, setUntilChip] = useState(15 * 60 * 1000);
```

Constantes acima do componente:

```ts
const CHIPS_VEZES = [3, 5, 10, 25];
const CHIPS_TEMPO: { label: string; ms: number }[] = [
  { label: '15m', ms: 15 * 60 * 1000 },
  { label: '1h', ms: 60 * 60 * 1000 },
  { label: '4h', ms: 4 * 60 * 60 * 1000 },
  { label: '8h', ms: 8 * 60 * 60 * 1000 },
];
```

Helper no componente:

```ts
  const planoEscolhido = (): LoopPlan | undefined => {
    switch (loopMode) {
      case 'once': return undefined;
      case 'times': return { mode: 'times', remaining: timesChip, total: timesChip };
      case 'until': return { mode: 'until', endsAt: Date.now() + untilChip };
      case 'endless': return { mode: 'endless' };
    }
  };
```

Trocar a chamada da linha 141 por `onConfirm(templateId, heroIds, heroPositions, planoEscolhido());` e substituir o bloco do `loopToggle` (linhas ~382-394) por:

```tsx
            <Text style={styles.loopLabel}>Modo do loop</Text>

            {([
              { modo: 'once', rotulo: 'Uma vez' },
              { modo: 'times', rotulo: 'Repetir' },
              { modo: 'until', rotulo: 'Por tempo' },
              { modo: 'endless', rotulo: 'Indefinido' },
            ] as const).map(({ modo, rotulo }) => (
              <View key={modo} style={styles.loopRow}>
                <TouchableOpacity
                  style={styles.loopToggle}
                  onPress={() => setLoopMode(modo)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: loopMode === modo }}
                  accessibilityLabel={`Modo de loop: ${rotulo}`}
                >
                  <View style={[styles.loopCheckbox, loopMode === modo && styles.loopCheckboxActive]} />
                  <Text style={styles.loopLabel}>{rotulo}</Text>
                </TouchableOpacity>

                {modo === 'times' ? (
                  <View style={styles.chipRow}>
                    {CHIPS_VEZES.map((n) => (
                      <TouchableOpacity
                        key={n}
                        disabled={loopMode !== 'times'}
                        onPress={() => setTimesChip(n)}
                        accessibilityLabel={`Repetir ${n} vezes`}
                        style={[
                          styles.chip,
                          loopMode !== 'times' && styles.chipDisabled,
                          loopMode === 'times' && timesChip === n && styles.chipActive,
                        ]}
                      >
                        <Text style={styles.chipText}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                {modo === 'until' ? (
                  <View style={styles.chipRow}>
                    {CHIPS_TEMPO.map((c) => (
                      <TouchableOpacity
                        key={c.label}
                        disabled={loopMode !== 'until'}
                        onPress={() => setUntilChip(c.ms)}
                        accessibilityLabel={`Rodar por ${c.label}`}
                        style={[
                          styles.chip,
                          loopMode !== 'until' && styles.chipDisabled,
                          loopMode === 'until' && untilChip === c.ms && styles.chipActive,
                        ]}
                      >
                        <Text style={styles.chipText}>{c.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
```

Estilos novos, ao lado dos `loop*` que já existem:

```ts
  loopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chipRow: { flexDirection: 'row', gap: theme.spacing.xs },
  chip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: { borderColor: theme.colors.goldBright, backgroundColor: theme.colors.surfaceRaised },
  chipDisabled: { opacity: 0.4 },
  chipText: { ...theme.type.label, color: theme.colors.textPrimary },
```

O título do botão de confirmar passa a ser `loopMode === 'once' ? 'Iniciar missão' : 'Iniciar em loop'`, e o `accessibilityLabel` acompanha.

- [ ] **Step 6: Validar no browser**

Subir o Expo, abrir Missões → Enviar, e confirmar: os 4 modos alternam, os chips só respondem no modo ativo, e iniciar com "Repetir 3" cria a missão. Conferir no console que não há erro novo.

- [ ] **Step 7: Commit**

```bash
git add src/context/missionTickHandler.ts src/components/MissionHeroSelectionModal.tsx src/__tests__/context/missionLoop.integration.test.ts
git commit -m "feat(loop): modos por vezes e por tempo

O plano é avaliado depois do ciclo terminar, então 'repetir 3' roda 3 ciclos
exatos; o prazo do modo por tempo só impede um novo ciclo começar, nunca
interrompe o que está em andamento."
```

---

### Task 5: Recolher heróis do loop

**Files:**
- Modify: `src/types/index.ts` (action nova)
- Modify: `src/context/gameReducer.ts` (case novo)
- Create: `src/context/missionLoopHandler.ts`
- Modify: `src/context/missionTickHandler.ts` (condição `podeRepetir`)
- Modify: `src/components/MissionActiveItem.tsx:39-50`
- Test: `src/__tests__/context/missionLoopHandler.test.ts` (criar), estender a integração

**Interfaces:**
- Produces: `RECALL_MISSION_LOOP { missionId }`, `handleRecallMissionLoop(state, missionId)`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/__tests__/context/missionLoopHandler.test.ts`:

```ts
import { handleRecallMissionLoop } from '../../context/missionLoopHandler';
import { GameState } from '../../types';

function estado(): GameState {
  return {
    gold: 0, heroes: [], heroesRecruited: 0, lastSavedAt: 0,
    activeMissions: [
      { id: 'm1', templateId: 'mission_1', heroIds: ['h1'], startedAt: 0, loop: { mode: 'endless' } },
      { id: 'm2', templateId: 'mission_1', heroIds: ['h2'], startedAt: 0 },
    ],
  } as GameState;
}

test('marca só a missão pedida como recolhida', () => {
  const s = handleRecallMissionLoop(estado(), 'm1');
  expect(s.activeMissions?.[0].loopRecalled).toBe(true);
  expect(s.activeMissions?.[1].loopRecalled).toBeUndefined();
});

test('recolher missão sem loop é no-op de referência', () => {
  const antes = estado();
  expect(handleRecallMissionLoop(antes, 'm2')).toBe(antes);
});

test('missão inexistente é no-op de referência', () => {
  const antes = estado();
  expect(handleRecallMissionLoop(antes, 'inexistente')).toBe(antes);
});
```

E em `missionLoop.integration.test.ts`:

```ts
test('loop recolhido termina o ciclo atual e não reinicia', () => {
  const st = estado([missaoConcluida({ mode: 'endless' }, { loopRecalled: true })]);
  const r = processMissions(st, st.heroes, Date.now());

  expect(r.activeMissions).toHaveLength(0);
  expect(r.newHeroes[0].currentTask).toBe(HeroTask.IDLE);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/missionLoopHandler.test.ts
```

Esperado: `Cannot find module '../../context/missionLoopHandler'`.

- [ ] **Step 3: Implementar o handler**

Criar `src/context/missionLoopHandler.ts`:

```ts
import { GameState } from '../types';

/**
 * Marca um loop para parar ao fim do ciclo atual. Não interrompe nada em voo —
 * herói não volta no meio da missão.
 */
export function handleRecallMissionLoop(state: GameState, missionId: string): GameState {
  const missoes = state.activeMissions ?? [];
  const alvo = missoes.find((m) => m.id === missionId);
  if (!alvo?.loop || alvo.loopRecalled) return state;

  return {
    ...state,
    activeMissions: missoes.map((m) => (m.id === missionId ? { ...m, loopRecalled: true } : m)),
  };
}
```

Em `src/types/index.ts`, na união de actions:

```ts
  | { type: 'RECALL_MISSION_LOOP'; missionId: string }
```

Em `src/context/gameReducer.ts`, importar `handleRecallMissionLoop` e adicionar o case ao lado de `DISMISS_MISSION_RESULT`:

```ts
    case 'RECALL_MISSION_LOOP':
      return handleRecallMissionLoop(state, action.missionId);
```

- [ ] **Step 4: Respeitar o recolher no motor**

Em `src/context/missionTickHandler.ts`, na condição `podeRepetir` da Task 4:

```ts
    const podeRepetir =
      !!planoAvancado &&
      c.outcome.success &&
      !c.mission.loopRecalled &&
      planAllowsAnotherCycle(planoAvancado, now);
```

- [ ] **Step 5: Rodar e confirmar que passa**

```bash
./node_modules/.bin/jest --config jest.unit.config.js --runInBand
npx tsc --noEmit
```

- [ ] **Step 6: Botão na UI**

Em `src/components/MissionActiveItem.tsx`, pegar `dispatch` do `useGame()` (linha 18) e, no header (linhas 41-50), ao lado do botão Assistir:

```tsx
        {mission.loop && !mission.loopRecalled ? (
          <TouchableOpacity
            style={styles.watchButton}
            onPress={() => dispatch({ type: 'RECALL_MISSION_LOOP', missionId: mission.id })}
            accessibilityLabel="Recolher heróis ao fim do ciclo"
          >
            <Icon name="shield" size={14} color={theme.colors.goldBright} />
            <Text style={styles.watchButtonText}> Recolher</Text>
          </TouchableOpacity>
        ) : null}
```

E abaixo do título, o estado do loop:

```tsx
        {mission.loop ? (
          <Text style={styles.loopStatus}>
            {mission.loopRecalled
              ? 'voltando ao fim do ciclo'
              : mission.loop.mode === 'times'
              ? `×${mission.loop.remaining} restantes`
              : mission.loop.mode === 'until'
              ? `até ${new Date(mission.loop.endsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : '∞'}
          </Text>
        ) : null}
```

Estilo novo, seguindo os tokens do DS:

```ts
  loopStatus: {
    ...theme.type.caption,
    color: theme.colors.textMuted,
  },
```

- [ ] **Step 7: Validar no browser**

Iniciar um loop, conferir que o item mostra o estado, clicar em Recolher, e confirmar que o texto vira "voltando ao fim do ciclo" e que os heróis voltam a Ocioso quando o ciclo termina.

- [ ] **Step 8: Commit**

```bash
git add src/types/index.ts src/context/missionLoopHandler.ts src/context/gameReducer.ts src/context/missionTickHandler.ts src/components/MissionActiveItem.tsx src/__tests__/context
git commit -m "feat(loop): recolher heróis ao fim do ciclo atual

Sem abortar missão no meio — foi decisão explícita do dono. O recolher só
impede o próximo ciclo de começar."
```

---

### Task 6: Acumulado e resumo de fim de loop

**Files:**
- Modify: `src/context/missionTickHandler.ts` (acumular tally, emitir summary, novo campo no retorno)
- Modify: `src/context/tickHandler.ts:157-180` (levar `completedLoops` ao estado)
- Modify: `src/context/missionLoopHandler.ts` (dispensa)
- Modify: `src/types/index.ts` (action de dispensa)
- Modify: `src/context/gameReducer.ts`
- Modify: `src/components/MissionResultModal.tsx:15-25` (prop opcional `result`)
- Create: `src/components/LoopSummaryModal.tsx`
- Modify: `App.tsx` (montar na raiz, junto do `OfflineSummaryGate`)
- Test: estender integração; `src/__tests__/components/LoopSummaryModal.test.tsx` (criar)

**Interfaces:**
- Consumes: `accumulateTally` (Task 1), `LoopSummary` (Task 1)
- Produces: `ProcessMissionsResult.completedLoops: LoopSummary[]`, `DISMISS_LOOP_SUMMARY { missionId }`

- [ ] **Step 1: Escrever os testes que falham**

Em `missionLoop.integration.test.ts`:

```ts
test('loop encerrado emite resumo com ciclos, ouro e motivo', () => {
  const st = estado([missaoConcluida({ mode: 'times', remaining: 1, total: 3 }, {
    loopTally: { cycles: 2, gold: 200, materials: { couro: 1 }, casualties: [] },
  })]);
  const r = processMissions(st, st.heroes, Date.now());

  expect(r.completedLoops).toHaveLength(1);
  const resumo = r.completedLoops[0];
  expect(resumo.reason).toBe('completed');
  expect(resumo.plannedCycles).toBe(3);
  expect(resumo.tally.cycles).toBe(3);
  expect(resumo.tally.gold).toBeGreaterThan(200);
  expect(resumo.tally.lastResult).toBeDefined();
});

test('loop que continua não emite resumo e carrega o acumulado adiante', () => {
  const st = estado([missaoConcluida({ mode: 'times', remaining: 3, total: 3 })]);
  const r = processMissions(st, st.heroes, Date.now());

  expect(r.completedLoops).toHaveLength(0);
  expect(r.activeMissions[0].loopTally?.cycles).toBe(1);
});

test('recolher gera resumo com motivo recalled', () => {
  const st = estado([missaoConcluida({ mode: 'endless' }, { loopRecalled: true })]);
  const r = processMissions(st, st.heroes, Date.now());

  expect(r.completedLoops[0].reason).toBe('recalled');
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/missionLoop.integration.test.ts
```

Esperado: FAIL — `completedLoops` não existe em `ProcessMissionsResult`.

- [ ] **Step 3: Acumular e emitir no motor**

Em `src/context/missionTickHandler.ts`: adicionar `completedLoops: LoopSummary[];` à interface `ProcessMissionsResult` (~linha 25), declarar `const completedLoops: LoopSummary[] = [];` junto de `materialDrops` (~145), e importar `accumulateTally` de `../utils/missionLoop`.

Dentro do `completed.forEach`, no ramo do loop, montar o acumulado antes de decidir:

```ts
    const ouroDoCiclo = c.mission.loop ? computeFinalGold(c.reward, state) : 0;
    const tally = c.mission.loop
      ? accumulateTally(c.mission.loopTally, {
          gold: ouroDoCiclo,
          materials: c.outcome.materialDrops ?? {},
          casualties: c.outcome.casualties.map((x) => ({ heroId: x.heroId, hpAfter: x.hpAfter })),
          result: {
            ...c.outcome,
            missionId: c.mission.id,
            templateId: c.mission.templateId,
            activeSynergies: c.mission.activeSynergies,
          } as MissionResult,
        })
      : undefined;
```

No ramo `podeRepetir`, incluir `loopTally: tally,` no objeto empurrado. No ramo de encerramento, quando `c.mission.loop` existir, empurrar o resumo antes de liberar os heróis:

```ts
      if (c.mission.loop && tally) {
        completedLoops.push({
          missionId: c.mission.id,
          templateId: c.mission.templateId,
          heroIds: c.mission.heroIds,
          tally,
          plannedCycles: c.mission.loop.mode === 'times' ? c.mission.loop.total : undefined,
          reason: !c.outcome.success
            ? 'failed'
            : c.mission.loopRecalled
            ? 'recalled'
            : sobreviventesInsuficientes
            ? 'casualties'
            : 'completed',
        });
      }
```

Onde `sobreviventesInsuficientes` é a condição já existente de `heroesForNext.length < tpl.minHeroes`, extraída para uma variável. O ramo `catch` do cálculo de combate empurra o mesmo resumo com `reason: 'error'`.

Devolver `completedLoops` no `return` (~272).

- [ ] **Step 4: Levar ao estado e permitir dispensa**

Em `src/context/tickHandler.ts`, desestruturar `completedLoops` do `processMissions` (~157) e acrescentar ao `stateAfterTick`:

```ts
    completedLoops: [...completedLoops, ...(currentState.completedLoops ?? [])].slice(0, 5),
```

Em `src/context/missionLoopHandler.ts`:

```ts
export function handleDismissLoopSummary(state: GameState, missionId: string): GameState {
  const atuais = state.completedLoops ?? [];
  if (!atuais.some((s) => s.missionId === missionId)) return state;
  return { ...state, completedLoops: atuais.filter((s) => s.missionId !== missionId) };
}
```

Action em `types/index.ts` (`| { type: 'DISMISS_LOOP_SUMMARY'; missionId: string }`) e case no `gameReducer.ts`.

- [ ] **Step 5: Rodar e confirmar que passa**

```bash
./node_modules/.bin/jest --config jest.unit.config.js --runInBand
npx tsc --noEmit
```

- [ ] **Step 6: Modal do resumo**

Em `src/components/MissionResultModal.tsx`, trocar a leitura da linha 17/25 por uma prop opcional com precedência:

```tsx
interface Props {
  result?: MissionResult;
  onDismiss?: () => void;
}

export function MissionResultModal({ result: resultProp, onDismiss }: Props = {}) {
  const { state, dispatch } = useGame();
  const results = state.recentMissionResults ?? [];
  const result = resultProp ?? results[0] ?? null;
```

Onde hoje despacha `DISMISS_MISSION_RESULT`, usar `onDismiss ?? (() => dispatch({ type: 'DISMISS_MISSION_RESULT', missionId: result.missionId }))`. Sem props, nada muda.

Criar `src/components/LoopSummaryModal.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { useGame } from '../hooks/useGame';
import { theme } from '../theme';
import { MISSIONS } from '../constants/missions';
import { MissionResultModal } from './MissionResultModal';

const MOTIVO: Record<string, string> = {
  completed: 'loop concluído',
  recalled: 'heróis recolhidos',
  casualties: 'parou por baixas',
  failed: 'parou após derrota',
  error: 'parou por erro no cálculo do combate',
};

/** Montado na raiz: um loop pode terminar com o jogador em qualquer tela. */
export function LoopSummaryGate(): React.ReactElement | null {
  const { state, dispatch } = useGame();
  const [vendoCombate, setVendoCombate] = useState(false);
  const resumo = state.completedLoops?.[0];
  if (!resumo) return null;

  const template = MISSIONS.find((m) => m.id === resumo.templateId);
  const { tally } = resumo;
  const materiais = Object.entries(tally.materials);
  const baixas = tally.casualties;

  if (vendoCombate && tally.lastResult) {
    return <MissionResultModal result={tally.lastResult} onDismiss={() => setVendoCombate(false)} />;
  }

  return (
    <Modal transparent visible animationType="fade">
      <View style={styles.scrim}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {template?.name ?? resumo.templateId} ×{tally.cycles}
          </Text>
          <Text style={styles.subtitle}>
            {resumo.plannedCycles
              ? `${tally.cycles} de ${resumo.plannedCycles} ciclos · ${MOTIVO[resumo.reason]}`
              : `${tally.cycles} ciclos · ${MOTIVO[resumo.reason]}`}
          </Text>

          <Text style={styles.linha}>Ouro ▸ {tally.gold}</Text>
          {materiais.length > 0 ? (
            <Text style={styles.linha}>
              Materiais ▸ {materiais.map(([m, q]) => `${m} ×${q}`).join(', ')}
            </Text>
          ) : null}
          {baixas.map((c) => {
            const hero = state.heroes.find((h) => h.id === c.heroId);
            const pct = hero?.hpMax ? Math.round((c.hpAfter / hero.hpMax) * 100) : 0;
            return (
              <Text key={c.heroId} style={styles.linha}>
                Baixas ▸ {hero?.name ?? c.heroId} ({pct}% HP)
              </Text>
            );
          })}

          {tally.lastResult ? (
            <TouchableOpacity onPress={() => setVendoCombate(true)} accessibilityLabel="Ver último combate">
              <Text style={styles.acao}>Ver último combate</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => dispatch({ type: 'DISMISS_LOOP_SUMMARY', missionId: resumo.missionId })}
            accessibilityLabel="Fechar resumo do loop"
          >
            <Text style={styles.acao}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: theme.spacing.lg },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.elevation.e3,
  },
  title: { ...theme.type.h1, color: theme.colors.goldBright },
  subtitle: { ...theme.type.caption, color: theme.colors.textMuted },
  linha: { ...theme.type.body, color: theme.colors.textPrimary },
  acao: { ...theme.type.label, color: theme.colors.goldBright, marginTop: theme.spacing.sm },
});
```

Montar em `App.tsx`, logo abaixo do `OfflineSummaryGate`:

```tsx
        <LoopSummaryGate />
```

- [ ] **Step 7: Teste do modal**

Criar `src/__tests__/components/LoopSummaryModal.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('../../components/MissionResultModal', () => ({
  MissionResultModal: () => null,
}));

import { LoopSummaryGate } from '../../components/LoopSummaryModal';
import { GameContext } from '../../context/GameContext';
import { initialGameState } from '../../context/gameReducer';
import { LoopSummary } from '../../types';

function resumo(over: Partial<LoopSummary> = {}): LoopSummary {
  return {
    missionId: 'm1', templateId: 'mission_1', heroIds: ['h1'],
    tally: { cycles: 2, gold: 240, materials: { couro: 3 }, casualties: [] },
    plannedCycles: 3, reason: 'completed', ...over,
  };
}

function wrap(summary: LoopSummary | null) {
  return (
    <GameContext.Provider value={{
      state: { ...initialGameState, completedLoops: summary ? [summary] : [] } as any,
      dispatch: jest.fn(), isLoaded: true, setHeroTask: jest.fn(), recruitHero: jest.fn(),
      offlineSummary: null, clearOfflineSummary: jest.fn(), applyOfflineSummary: jest.fn(),
      advanceOnboarding: jest.fn(), skipOnboarding: jest.fn(),
      markHintSeen: jest.fn(), resetOnboarding: jest.fn(),
    } as any}>
      <LoopSummaryGate />
    </GameContext.Provider>
  );
}

test('sem resumo pendente não renderiza nada', () => {
  const { toJSON } = render(wrap(null));
  expect(toJSON()).toBeNull();
});

test('modo times mostra "N de M ciclos"', () => {
  const { getByText } = render(wrap(resumo()));
  expect(getByText(/2 de 3 ciclos/)).toBeTruthy();
});

test('modo sem planejamento mostra só a contagem', () => {
  const { getByText, queryByText } = render(wrap(resumo({ plannedCycles: undefined })));
  expect(getByText(/2 ciclos/)).toBeTruthy();
  expect(queryByText(/de 3/)).toBeNull();
});

test('mostra o ouro e os materiais acumulados', () => {
  const { getByText } = render(wrap(resumo()));
  expect(getByText(/240/)).toBeTruthy();
  expect(getByText(/couro ×3/)).toBeTruthy();
});
```

- [ ] **Step 8: Validar no browser**

Iniciar um loop de 3 ciclos numa missão curta, esperar terminar e confirmar que o resumo abre uma única vez, com os totais certos, e que "Fechar" o remove.

- [ ] **Step 9: Commit**

```bash
git add -A src/context src/components src/types/index.ts App.tsx src/__tests__
git commit -m "feat(loop): acumulado do loop e resumo no fim

Montado na raiz, não na tela de Missões: um loop pode terminar com o jogador
em qualquer tela — foi esse erro que manteve o resumo offline invisível."
```

---

### Task 7: Silenciar o resultado por ciclo

**Files:**
- Modify: `src/context/missionTickHandler.ts` (marcar `fromLoop` em `newResults`, ~257-271)
- Modify: `src/context/tickHandler.ts:161-162` (filtrar)
- Test: `src/__tests__/context/tickHandler.loop.test.ts` (criar)

**Interfaces:**
- Consumes: `MissionResult.fromLoop` (Task 1)

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/context/tickHandler.loop.test.ts`, montando um estado com uma missão de loop concluída e chamando `handleTick`:

```ts
test('ciclo de loop não entra em recentMissionResults mas conta para conquistas', () => {
  const agora = Date.now();
  const next = handleTick(estadoComLoopConcluido(agora), agora);

  expect(next.recentMissionResults ?? []).toHaveLength(0);
  expect(next.completedMissionCount).toBe(1);
});

test('missão avulsa continua abrindo o resultado', () => {
  const agora = Date.now();
  const next = handleTick(estadoComMissaoAvulsaConcluida(agora), agora);

  expect(next.recentMissionResults).toHaveLength(1);
});
```

Com os helpers no topo do arquivo — `now` fixo em junho/2026 porque `handleTick` injeta o evento sazonal do mês corrente e o multiplicador de recompensa entraria na conta (mesma armadilha corrigida em `de60e73`):

```ts
import { handleTick } from '../../context/tickHandler';
import { initialGameState } from '../../context/gameReducer';
import { MISSIONS } from '../../constants/missions';
import { GameState, Hero, HeroTask, LoopPlan } from '../../types';

const AGORA = new Date(2026, 5, 15).getTime();
const TPL = MISSIONS[0];

function heroi(): Hero {
  return {
    id: 'h1', name: 'Herói', hpMax: 500, hpCurrent: 500, atk: 999, mp: 10,
    defense: 50, crit: 10, agility: 10, currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  } as Hero;
}

function estadoCom(loop?: LoopPlan): GameState {
  return {
    ...initialGameState,
    gold: 0,
    heroes: [heroi()],
    recentMissionResults: [],
    completedMissionCount: 0,
    // conquistas pré-creditadas: o tick não pode somar ouro por marco nesse teste
    unlockedAchievements: [
      'recruit_1', 'recruit_5', 'recruit_10', 'gold_100', 'gold_1000',
      'mission_first', 'mission_10', 'mission_50', 'forge_1', 'forge_5', 'boss_slayer',
    ],
    activeMissions: [{
      id: 'm1', templateId: TPL.id, heroIds: ['h1'],
      startedAt: AGORA - TPL.durationMs - 1000, finishAt: AGORA - 1000,
      scheduledActions: [], enemiesState: [],
      precomputedOutcome: {
        reward: 100, rounds: 1, actions: [], log: [], success: true,
        casualties: [], enemyCasualties: 1,
      },
      loop,
    }],
  } as GameState;
}

const estadoComLoopConcluido = () => estadoCom({ mode: 'times', remaining: 1, total: 1 });
const estadoComMissaoAvulsaConcluida = () => estadoCom(undefined);
```

Os dois testes acima passam a chamar `handleTick(estadoComLoopConcluido(), AGORA)` e `handleTick(estadoComMissaoAvulsaConcluida(), AGORA)`.

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/context/tickHandler.loop.test.ts
```

Esperado: FAIL — hoje o ciclo de loop entra em `recentMissionResults`.

- [ ] **Step 3: Marcar e filtrar**

Em `src/context/missionTickHandler.ts`, no `completed.map` que monta `newResults` (~257), acrescentar ao objeto devolvido:

```ts
      fromLoop: !!c.mission.loop,
```

Em `src/context/tickHandler.ts`, trocar a linha 162:

```ts
  const updatedResults = [...newResults.filter((r) => !r.fromLoop), ...existingResults].slice(0, 10);
```

`completedMissionCount`, `completedMissionIds`, conquistas, quests e `trackMissionCompletions` continuam consumindo `newResults` inteiro — não mexer nessas linhas.

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
./node_modules/.bin/jest --config jest.unit.config.js --runInBand
npx tsc --noEmit
```

- [ ] **Step 5: Validar no browser**

Rodar um loop de 3 ciclos e confirmar que nenhum modal de combate abre no meio — só o resumo no fim.

- [ ] **Step 6: Commit**

```bash
git add src/context/missionTickHandler.ts src/context/tickHandler.ts src/__tests__/context/tickHandler.loop.test.ts
git commit -m "feat(loop): ciclo de loop não abre mais o modal de resultado

Só a apresentação muda: contagem de missões, conquistas, quests diárias e
analytics seguem consumindo todos os resultados."
```

---

### Task 8: Offline respeita o plano

**Files:**
- Modify: `src/utils/offlineProgress.ts:189-198`
- Test: `src/__tests__/utils/offlineProgress.loop.test.ts` (criar)

**Interfaces:**
- Consumes: `LoopPlan` (Task 1)

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/utils/offlineProgress.loop.test.ts`, com os helpers no topo:

```ts
import { calculateOfflineProgress } from '../../utils/offlineProgress';
import { MISSIONS } from '../../constants/missions';
import { GameState, Hero, HeroTask, LoopPlan, ActiveMission } from '../../types';

const MISSIONS_0 = MISSIONS[0];

/** Recompensa fixada no precomputedOutcome — o estado de teste não tem panteão/legado. */
const REWARD_POR_CICLO = 100;

function heroi(): Hero {
  return {
    id: 'h1', name: 'Herói', hpMax: 500, hpCurrent: 500, atk: 999, mp: 10,
    defense: 50, crit: 10, agility: 10, currentTask: HeroTask.MISSION,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 }, trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  } as Hero;
}

function estadoComLoop(loop: LoopPlan, decorridoMs: number, over: Partial<ActiveMission> = {}): GameState {
  const agora = Date.now();
  return {
    gold: 0, heroes: [heroi()], heroesRecruited: 1,
    lastSavedAt: agora - decorridoMs,
    activeMissions: [{
      id: 'm1', templateId: MISSIONS_0.id, heroIds: ['h1'],
      startedAt: agora - decorridoMs, scheduledActions: [], enemiesState: [],
      precomputedOutcome: {
        reward: REWARD_POR_CICLO, rounds: 1, actions: [], log: [],
        success: true, casualties: [], enemyCasualties: 1,
      },
      loop, ...over,
    }],
  } as GameState;
}
```

O que importa nos asserts é a proporção entre ciclos, não o valor absoluto.

```ts
test('loop de 2 vezes credita no máximo 2 ciclos e libera os heróis', () => {
  const template = MISSIONS[0];
  const decorrido = template.durationMs * 10;
  const estado = estadoComLoop({ mode: 'times', remaining: 2, total: 5 }, decorrido);

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.newState.activeMissions).toHaveLength(0);
  expect(resumo.newState.heroes[0].currentTask).toBe(HeroTask.IDLE);
  expect(resumo.goldGained).toBe(REWARD_POR_CICLO * 2);
});

test('loop recolhido credita 1 ciclo e encerra', () => {
  const template = MISSIONS[0];
  const estado = estadoComLoop({ mode: 'endless' }, template.durationMs * 5, { loopRecalled: true });

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.newState.activeMissions).toHaveLength(0);
  expect(resumo.goldGained).toBe(REWARD_POR_CICLO);
});

test('loop endless continua armado', () => {
  const template = MISSIONS[0];
  const estado = estadoComLoop({ mode: 'endless' }, template.durationMs * 3);

  const resumo = calculateOfflineProgress(estado)!;

  expect(resumo.newState.activeMissions).toHaveLength(1);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
./node_modules/.bin/jest --config jest.unit.config.js --runInBand src/__tests__/utils/offlineProgress.loop.test.ts
```

Esperado: FAIL — hoje credita os 10 ciclos e re-arma sempre.

- [ ] **Step 3: Limitar os ciclos pelo plano**

Em `src/utils/offlineProgress.ts`, trocar o bloco `if (m.looping)` (~189) por `if (m.loop)`, calculando o teto:

```ts
        const totalElapsed = nowOffline - startedAt;
        const possiveis = Math.floor(totalElapsed / template.durationMs);
        const teto =
          m.loopRecalled ? 1
          : m.loop.mode === 'times' ? m.loop.remaining
          // `ceil` com piso 1: o motor online conta os ciclos que COMEÇAM antes do prazo,
          // e o ciclo em voo sempre completa. `floor` subcreditava — e zerava quando o
          // último ciclo era mais curto que a duração da missão.
          : m.loop.mode === 'until' ? Math.max(1, Math.ceil((m.loop.endsAt - startedAt) / template.durationMs))
          : possiveis;
        const cycles = Math.min(possiveis, teto);
```

E o resto do bloco:

```ts
        const total = reward * cycles;
        creditPerHero(total);
        additionalGold += total;

        // `cycles >= teto`, e não `cycles < possiveis`: o plano pode se esgotar exatamente
        // na janela offline, sobrando um resto menor que um ciclo.
        const planoEsgotou = m.loopRecalled || (m.loop.mode !== 'endless' && cycles >= teto);
        if (planoEsgotou) {
          // plano acabou antes do tempo disponível: heróis voltam, como missão avulsa
          m.heroIds.forEach((hid: string) => {
            const idx = newHeroes.findIndex((hh) => hh.id === hid);
            if (idx >= 0) newHeroes[idx] = { ...newHeroes[idx], currentTask: HeroTask.IDLE };
          });
        } else {
          const leftover = totalElapsed % template.durationMs;
          const loopRestante: LoopPlan =
            m.loop.mode === 'times'
              ? { ...m.loop, remaining: Math.max(0, m.loop.remaining - cycles) }
              : m.loop;
          newActiveMissions.push({ ...m, startedAt: nowOffline - leftover, loop: loopRestante });
        }
```

Importar `LoopPlan` de `../types` no topo do arquivo.

Nenhum `LoopSummary` é emitido aqui — decisão 5 da spec: o ouro entra no resumo de progresso offline que já existe.

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
./node_modules/.bin/jest --config jest.unit.config.js --runInBand
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/offlineProgress.ts src/__tests__/utils/offlineProgress.loop.test.ts
git commit -m "feat(loop): progresso offline respeita o plano do loop

Sem isso um loop de 3 ciclos viraria 200 ciclos depois de uma noite fechado."
```

---

## Fechamento

Depois da Task 8:

```bash
npx tsc --noEmit
./node_modules/.bin/jest --config jest.unit.config.js --runInBand
git push
```

E uma passada no browser cobrindo o caminho inteiro: iniciar "Repetir 3" numa missão curta, ver os ciclos correrem sem modal, recolher no meio de outro loop, e conferir os dois resumos.
