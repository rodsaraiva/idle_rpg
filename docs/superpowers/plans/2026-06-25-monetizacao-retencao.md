# SPEC 8 — Monetização Ética & Retenção — Plano de Implementação (slices codáveis)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar os slices **codáveis e éticos** de retenção: daily login streak (recompensas **não-gold**), chaves de baú, catálogo de cosméticos (sem stats) + equipar + render no `HeroCard`, preferências de notificação (lógica + Settings, **opt-out por default**), e extensão do **contrato** de analytics. Push real e IAP ficam como **débito device-bound** (não rodam no sandbox).

**Architecture:** Reducer puro + handlers por domínio. Campos novos opcionais em `GameState` com migração v12 idempotente. Cosméticos reusam os componentes do DS "Reino" (`OrnateFrame`, `Seal`) e tokens de raridade do SPEC 2. Nenhum caminho novo credita gold passivo; nenhum cosmético altera stats.

**Tech Stack:** TypeScript, Expo, Jest. Seeds de dia via `getDailySeed()`.

## Global Constraints

- **SEM gold passivo (inegociável):** login streak, chaves e cosméticos **nunca** creditam `state.gold`. Recompensas de retenção = materiais / chaves / cosméticos. Gold continua exclusivo de missão concluída. (memória `feedback_no_free_gold`)
- **Anti-pay-to-win:** cosméticos **não têm campos de stat**; nenhum item dá poder. Teste-guarda: `cosmetics.ts` tem 0 campos de stat.
- **Notificação opt-OUT por default:** `notificationPrefs.optedIn = false` ao migrar/criar; inscrição só por ação explícita do jogador. Rejeitar mantém o jogo 100% funcional.
- **DEF/CRIT/AGI intocados** por qualquer sistema deste SPEC.
- **Device-bound = débito (fora deste plano):** agendamento real de push (`expo-notifications`), IAP/billing (RevenueCat/StoreKit/Play). Este plano só faz prefs (lógica) + UI; a emissão real de analytics é do SPEC 9.
- **Gates:** `npx tsc --noEmit` → 0; `./node_modules/.bin/jest --config jest.unit.config.js --runInBand` → verde a cada task.
- **Rodapé de commit:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Extensões de tipo + migração v12 + actions

**Files:**
- Modify: `src/types/index.ts` (GameState ~86-132; `GameAction` union ~135-158)
- Modify: `src/services/storage.ts` (`CURRENT_VERSION`, `migrations`)
- Test: `src/__tests__/services/storage.spec8-migration.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  // GameState — após `materials`
  loginStreak?: { count: number; lastClaimedSeed: number; lastSeenSeed: number };
  keys?: Record<'bronze' | 'silver' | 'gold', number>;
  cosmetics?: { owned: string[]; equipped: { frame?: string; seal?: string; theme?: string } };
  notificationPrefs?: NotificationPrefs;
  // novo tipo
  export interface NotificationPrefs {
    optedIn: boolean;
    categories: { missionReady: boolean; bossReady: boolean; dailyReset: boolean; idle: boolean };
    quietHours: { start: number; end: number };
  }
  // GameAction — novas variantes
  | { type: 'CLAIM_LOGIN_REWARD' }
  | { type: 'OPEN_KEY_CHEST'; chestType: 'bronze' | 'silver' | 'gold' }
  | { type: 'EQUIP_COSMETIC'; slot: 'frame' | 'seal' | 'theme'; cosmeticId: string }
  | { type: 'SET_NOTIFICATION_PREFS'; prefs: Partial<NotificationPrefs> }
  ```

- [ ] **Step 1: Teste falhando**

```typescript
// src/__tests__/services/storage.spec8-migration.test.ts
import { migrateState, CURRENT_VERSION } from '../../services/storage';

test('CURRENT_VERSION = 12', () => expect(CURRENT_VERSION).toBe(12));

test('save v11 migra com defaults seguros e push opt-OUT', () => {
  const old: any = { __version: 11, gold: 7, heroes: [], legacy: { level: 0, totalExp: 0, sealsEarned: [] }, activeEvent: null, legacyUpgrades: {} };
  const m = migrateState(old);
  expect(m.loginStreak).toEqual({ count: 0, lastClaimedSeed: 0, lastSeenSeed: 0 });
  expect(m.keys).toEqual({ bronze: 0, silver: 0, gold: 0 });
  expect(m.cosmetics).toEqual({ owned: [], equipped: {} });
  expect(m.notificationPrefs!.optedIn).toBe(false); // ético: opt-out default
  expect(m.gold).toBe(7);
});
```

- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** os campos em `GameState`, `NotificationPrefs`, as 4 variantes de `GameAction`, `CURRENT_VERSION = 12` e a migration 12:
```typescript
12: (data) => {
  if (data.loginStreak === undefined) data.loginStreak = { count: 0, lastClaimedSeed: 0, lastSeenSeed: 0 };
  if (data.keys === undefined) data.keys = { bronze: 0, silver: 0, gold: 0 };
  if (data.cosmetics === undefined) data.cosmetics = { owned: [], equipped: {} };
  if (data.notificationPrefs === undefined) data.notificationPrefs = {
    optedIn: false,
    categories: { missionReady: false, bossReady: false, dailyReset: false, idle: false },
    quietHours: { start: 22, end: 9 },
  };
  return data;
},
```
- [ ] **Step 4: Ver passar** + `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/services/storage.ts src/__tests__/services/storage.spec8-migration.test.ts
git commit -m "feat(spec8): tipos de retenção (login/keys/cosmetics/notif) + migração save v12 (push opt-out)"
```

---

### Task 2: Daily login streak (recompensas NÃO-gold)

**Files:**
- Create: `src/constants/loginRewards.ts`
- Create: `src/context/loginStreakHandler.ts`
- Modify: `src/context/tickHandler.ts` (chamar `refreshLoginStreak` junto de `refreshDailyQuests`)
- Modify: `src/context/gameReducer.ts` (`CLAIM_LOGIN_REWARD`)
- Test: `src/__tests__/context/loginStreak.test.ts`

**Interfaces:**
- Consumes: `getDailySeed()`, `state.loginStreak`, `state.materials`, `state.keys`, `state.cosmetics`.
- Produces:
  ```typescript
  // loginRewards.ts — pool de 7 dias, SEM gold
  export type LoginReward =
    | { kind: 'material'; id: string; qty: number }
    | { kind: 'key'; tier: 'bronze' | 'silver' | 'gold'; qty: number }
    | { kind: 'cosmetic'; id: string };
  export const LOGIN_REWARDS: LoginReward[]; // length 7
  export function rewardForStreakDay(count: number): LoginReward; // ciclo de 7
  // loginStreakHandler.ts
  export function refreshLoginStreak(state: GameState): GameState; // idempotente por dia
  export function claimLoginReward(state: GameState): GameState;
  ```

**Invariante:** nenhum elemento de `LOGIN_REWARDS` é `gold`; `claimLoginReward` **não** altera `state.gold`.

- [ ] **Step 1: Teste falhando**

```typescript
// src/__tests__/context/loginStreak.test.ts
import { refreshLoginStreak, claimLoginReward } from '../../context/loginStreakHandler';
import { LOGIN_REWARDS } from '../../constants/loginRewards';
import { getDailySeed } from '../../constants/dailyQuests';

test('pool de login nunca contém gold', () => {
  for (const r of LOGIN_REWARDS) expect((r as any).kind).not.toBe('gold');
});

test('refresh marca dia visto idempotentemente', () => {
  const s1 = refreshLoginStreak({ gold: 5, heroes: [], loginStreak: { count: 0, lastClaimedSeed: 0, lastSeenSeed: 0 } } as any);
  expect(s1.loginStreak!.lastSeenSeed).toBe(getDailySeed());
  const s2 = refreshLoginStreak(s1);
  expect(s2).toBe(s1); // no-op no mesmo dia
});

test('claim concede recompensa não-gold e NÃO mexe em gold', () => {
  const seed = getDailySeed();
  const base: any = { gold: 100, heroes: [], materials: {}, keys: { bronze: 0, silver: 0, gold: 0 }, cosmetics: { owned: [], equipped: {} }, loginStreak: { count: 1, lastClaimedSeed: 0, lastSeenSeed: seed } };
  const s = claimLoginReward(base);
  expect(s.gold).toBe(100); // invariante sem gold passivo
  expect(s.loginStreak!.lastClaimedSeed).toBe(seed);
});

test('streak reseta ao pular um dia', () => {
  // lastSeenSeed de 2 dias atrás → count volta a 1
  // (montar com seed anterior e checar count)
});
```

- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** `LOGIN_REWARDS` (7 itens: materiais comuns/raros, chaves bronze/prata/ouro, 1-2 cosméticos), `rewardForStreakDay` (ciclo mod 7), `refreshLoginStreak` (idempotente por `getDailySeed`; incrementa `count` se o dia anterior foi visto, reseta para 1 se pulou), `claimLoginReward` (aplica a recompensa do dia ao slot correto — materials/keys/cosmetics.owned — **nunca gold**, marca `lastClaimedSeed`). Plugue `refreshLoginStreak` no tick.
- [ ] **Step 4: Ver passar** + `npx tsc --noEmit`. Rode o teste-invariante de gold existente (`noPassiveGold.tick.test.ts`) — deve continuar verde.
- [ ] **Step 5: Commit**

```bash
git add src/constants/loginRewards.ts src/context/loginStreakHandler.ts src/context/tickHandler.ts src/context/gameReducer.ts src/__tests__/context/loginStreak.test.ts
git commit -m "feat(spec8): daily login streak com recompensas não-gold (materiais/chaves/cosméticos)"
```

---

### Task 3: Chaves + baús de chave

**Files:**
- Create: `src/constants/keyChests.ts` (`KEY_CHEST_REWARDS`)
- Modify: `src/context/heroHandler.ts` (`handleOpenKeyChest`)
- Modify: `src/context/gameReducer.ts` (`OPEN_KEY_CHEST`)
- Test: `src/__tests__/context/keyChest.test.ts`

**Interfaces:**
- Consumes: `state.keys`, `state.materials`, `state.inventory` (gerar equipamento via `generateEquipment` existente).
- Produces: `handleOpenKeyChest(state, tier)` consome 1 chave do tier e concede recompensa **não-gold** (materiais e/ou equipamento), no-op sem chave.

**Invariante:** baú de chave **não** credita gold (a chave já foi ganha por atividade; manter consistência da regra).

- [ ] **Step 1: Teste falhando**

```typescript
// src/__tests__/context/keyChest.test.ts
import { handleOpenKeyChest } from '../../context/heroHandler';

const withKeys = (k: any): any => ({ gold: 50, heroes: [], materials: {}, inventory: [], keys: k });

test('abre baú consome 1 chave e não mexe em gold', () => {
  const s = handleOpenKeyChest(withKeys({ bronze: 1, silver: 0, gold: 0 }), 'bronze');
  expect(s.keys!.bronze).toBe(0);
  expect(s.gold).toBe(50);
});

test('no-op sem chave', () => {
  const base = withKeys({ bronze: 0, silver: 0, gold: 0 });
  expect(handleOpenKeyChest(base, 'bronze')).toBe(base);
});
```

- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** `KEY_CHEST_REWARDS` (por tier: materiais + chance de equipamento via `generateEquipment`, determinístico ou com rng injetável seguindo `equipmentHandler`), e `handleOpenKeyChest` (guarda de chave, decrementa, concede recompensa, **sem gold**).
- [ ] **Step 4: Ver passar** + `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git add src/constants/keyChests.ts src/context/heroHandler.ts src/context/gameReducer.ts src/__tests__/context/keyChest.test.ts
git commit -m "feat(spec8): chaves + baús de chave (recompensa não-gold: materiais/equipamento)"
```

---

### Task 4: Catálogo de cosméticos + equipar (sem stats)

**Files:**
- Create: `src/constants/cosmetics.ts`
- Create: `src/context/cosmeticHandler.ts` (`handleEquipCosmetic`)
- Modify: `src/context/gameReducer.ts` (`EQUIP_COSMETIC`)
- Test: `src/__tests__/constants/cosmetics.noStats.test.ts`, `src/__tests__/context/cosmetic.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  // cosmetics.ts — ZERO campos de stat
  export interface Cosmetic { id: string; name: string; slot: 'frame' | 'seal' | 'theme'; rarity: Rarity; corner?: 'gold' | 'wood' | 'silver' | 'obsidian'; }
  export const COSMETICS: Cosmetic[];
  // cosmeticHandler.ts
  export function handleEquipCosmetic(state: GameState, slot: 'frame'|'seal'|'theme', cosmeticId: string): GameState;
  ```

**Invariante:** `Cosmetic` não tem `hp/atk/mp/defense/crit/agility/statBonus`. Equipar item **não-possuído** é no-op.

- [ ] **Step 1: Teste falhando**

```typescript
// src/__tests__/constants/cosmetics.noStats.test.ts
import { COSMETICS } from '../../constants/cosmetics';
test('nenhum cosmético tem campo de stat', () => {
  const banned = ['hp','atk','mp','defense','crit','agility','statBonus'];
  for (const c of COSMETICS) for (const k of banned) expect((c as any)[k]).toBeUndefined();
});

// src/__tests__/context/cosmetic.test.ts
import { handleEquipCosmetic } from '../../context/cosmeticHandler';
test('equipa cosmético possuído', () => {
  const s = handleEquipCosmetic({ heroes: [], cosmetics: { owned: ['frame_gold'], equipped: {} } } as any, 'frame', 'frame_gold');
  expect(s.cosmetics!.equipped.frame).toBe('frame_gold');
});
test('não equipa cosmético não-possuído', () => {
  const base: any = { heroes: [], cosmetics: { owned: [], equipped: {} } };
  expect(handleEquipCosmetic(base, 'frame', 'frame_gold')).toBe(base);
});
```

- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** `COSMETICS` (molduras/selos/temas com `rarity` dos tokens do DS) e `handleEquipCosmetic` (guarda de posse, seta `equipped[slot]`).
- [ ] **Step 4: Ver passar** + `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git add src/constants/cosmetics.ts src/context/cosmeticHandler.ts src/context/gameReducer.ts src/__tests__/constants/cosmetics.noStats.test.ts src/__tests__/context/cosmetic.test.ts
git commit -m "feat(spec8): catálogo de cosméticos (sem stats) + equipar"
```

---

### Task 5: Render de cosmético equipado no HeroCard

**Files:**
- Modify: `src/components/HeroCard.tsx`
- Create: `src/utils/cosmeticUtils.ts` (lógica pura `resolveCosmetic`)
- Test: `src/__tests__/utils/cosmeticUtils.test.ts`

**Interfaces:**
- Consumes: `state.cosmetics.equipped`, `COSMETICS`, `OrnateFrame`/`Seal` do DS.
- Produces: `resolveCosmetic(id): Cosmetic | undefined`; `HeroCard` envolve o conteúdo num `OrnateFrame` com `corner` do cosmético quando `equipped.frame` existe.

> Validação visual **manual-pending**.

- [ ] **Step 1: Teste de lógica falhando** — `resolveCosmetic('frame_gold')` retorna o cosmético; `cornerForFrame(id)` retorna o `corner` certo; id inexistente → undefined.
- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** `cosmeticUtils.ts` + uso no `HeroCard` (prop `equippedCosmetics`, render condicional com `OrnateFrame`/`Seal`, tokens — sem cor hardcoded).
- [ ] **Step 4: Ver passar** (lógica) + `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git add src/components/HeroCard.tsx src/utils/cosmeticUtils.ts src/__tests__/utils/cosmeticUtils.test.ts
git commit -m "feat(spec8): render de moldura/selo cosmético no HeroCard — visual manual-pending"
```

---

### Task 6: Preferências de notificação + SettingsScreen

**Files:**
- Modify: `src/context/gameReducer.ts` (`SET_NOTIFICATION_PREFS`)
- Create: `src/screens/SettingsScreen.tsx`
- Modify: navegação (registrar rota Settings)
- Test: `src/__tests__/context/notificationPrefs.test.ts`

**Interfaces:**
- Consumes: `NotificationPrefs` (Task 1).
- Produces: reducer faz merge raso de prefs; `SettingsScreen` com toggles (opt-in mestre + categorias). **Nenhuma chamada a `expo-notifications`** — o agendamento real é débito do SPEC 9/device.

- [ ] **Step 1: Teste falhando**

```typescript
// src/__tests__/context/notificationPrefs.test.ts
import { gameReducer } from '../../context/gameReducer';
test('SET_NOTIFICATION_PREFS faz merge e default é opt-out', () => {
  const base: any = { heroes: [], notificationPrefs: { optedIn: false, categories: { missionReady: false, bossReady: false, dailyReset: false, idle: false }, quietHours: { start: 22, end: 9 } } };
  const s = gameReducer(base, { type: 'SET_NOTIFICATION_PREFS', prefs: { optedIn: true } } as any);
  expect(s.notificationPrefs!.optedIn).toBe(true);
  expect(s.notificationPrefs!.quietHours.start).toBe(22); // merge preserva resto
});
```

- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** o case no reducer (merge raso) + `SettingsScreen` (toggles via componentes do DS; opt-in mestre desabilita categorias quando off). Comente no topo da tela que o agendamento real de push é débito device-bound.
- [ ] **Step 4: Ver passar** + `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git add src/context/gameReducer.ts src/screens/SettingsScreen.tsx src/__tests__/context/notificationPrefs.test.ts
git commit -m "feat(spec8): prefs de notificação (opt-out default) + SettingsScreen — push real é débito"
```

---

### Task 7: Tela de Coleção/Cosméticos (loja premium = placeholder)

**Files:**
- Create: `src/screens/CollectionScreen.tsx`
- Modify: navegação
- Test: `src/__tests__/screens/collection.logic.test.ts`

**Interfaces:**
- Consumes: `COSMETICS`, `state.cosmetics`, `handleEquipCosmetic`.
- Produces: função pura `collectionView(state)` → `{ owned: Cosmetic[]; locked: Cosmetic[] }`; tela mostra possuídos (equipáveis) e os demais como **"Em breve"** (a compra via IAP é débito device-bound — não há billing no sandbox).

> Validação visual **manual-pending**. **Não** há compra com dinheiro real aqui; cosméticos são ganhos (login/marcos). A superfície premium IAP fica explicitamente como débito.

- [ ] **Step 1: Teste de lógica falhando** — `collectionView` separa owned/locked corretamente.
- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** a função pura + a tela (DS tokens, seção "Em breve" para itens premium).
- [ ] **Step 4: Ver passar** (lógica) + `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git add src/screens/CollectionScreen.tsx src/__tests__/screens/collection.logic.test.ts
git commit -m "feat(spec8): tela de Coleção (cosméticos ganhos); loja IAP premium como débito"
```

---

### Task 8: Extensão do contrato de analytics (sem emissão)

**Files:**
- Modify: `src/services/analytics.ts` (só o union `AnalyticsEvent`)
- Test: `src/__tests__/services/analytics.contract.test.ts`

**Interfaces:**
- Produces: `AnalyticsEvent` ganha `'daily_login_claimed' | 'key_chest_opened' | 'cosmetic_equipped' | 'notification_prefs_updated'`. **Sem** sink novo (emissão real = SPEC 9).

- [ ] **Step 1: Teste falhando** — `analytics.track('cosmetic_equipped', { cosmeticId: 'x' })` compila e não lança; lista de eventos contém os 4 novos.
- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar** a extensão do union (mantendo `track` no-op em prod).
- [ ] **Step 4: Ver passar** + `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git add src/services/analytics.ts src/__tests__/services/analytics.contract.test.ts
git commit -m "feat(spec8): contrato de analytics de retenção (emissão real fica no SPEC 9)"
```

---

### Task 9: Verificação final + registro de débito

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Modify: `docs/superpowers/DEBITO-2026-H2.md`

- [ ] **Step 1:** `npx tsc --noEmit` → 0; `./node_modules/.bin/jest --config jest.unit.config.js --runInBand` → verde; 3 snapshots intactos.
- [ ] **Step 2:** Rodar `npm run balance:check` — cosméticos/retenção não devem afetar o balanço (são não-stat); confirmar gate verde.
- [ ] **Step 3:** Atualizar `progress.md` (SPEC8 Task 1..8 com hashes) e a seção do débito com: **push real (`expo-notifications` + agendamento/quiet-hours/cap)**, **IAP/billing (RevenueCat/StoreKit/Play) + restore purchases + loja premium real**, **validação visual de SettingsScreen/CollectionScreen/HeroCard cosmético**.
- [ ] **Step 4: Commit**

```bash
git add .superpowers/sdd/progress.md docs/superpowers/DEBITO-2026-H2.md
git commit -m "chore(spec8): verificação estática + registro de débito (push real, IAP, visual)"
```

---

## Self-Review (cobertura)

- Daily login streak (não-gold) → Task 2 ✅ (invariante de gold em teste)
- Recompensas material/chave → Tasks 2–3 ✅
- Catálogo de cosméticos (sem stats) + equipar → Task 4 ✅ (invariante de stat em teste)
- Cosmético no render → Task 5 ✅ (visual manual-pending)
- Prefs de notificação (opt-out default) → Tasks 1, 6 ✅
- Loja separada / coleção → Task 7 ✅ (IAP premium = débito)
- Contrato de analytics → Task 8 ✅
- Migração de save → Task 1 ✅

**Débito device-bound (fora do plano, registrado na Task 9):** push real (`expo-notifications`, agendamento, quiet hours, cap ≤2/dia, cancelamento), IAP/billing + restore purchases + loja premium com dinheiro real, validação visual em emulador.

**Decisões de produto fixadas:** login **não** dá gold; cosméticos **ganhos** (não vendidos por dinheiro real neste slice); push **opt-out** por default. Ads: nenhum (recomendação do spec).
