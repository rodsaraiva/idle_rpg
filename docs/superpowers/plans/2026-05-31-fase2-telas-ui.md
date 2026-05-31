# Fase 2 — Telas / UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar acessíveis 3 sistemas de backend prontos (ciclo semanal, panteão/fusão, guilda) e tornar materiais visíveis no Ferreiro. Vila passa de 6 para 8 cards navegáveis. Nenhuma lógica de jogo nova — apenas wiring de UI e hooks.

**Architecture:** Cada task é independente. Hooks novos (`useWeekly`, `usePantheon`) espelham o padrão de `useGame`/`useGuild`: acessam `GameContext` e retornam estado + dispatch pré-wired. Novas telas espelham `DailyQuestsScreen` (estrutura, estilos, `ScreenHeader`). Rotas ocultas no `Tab.Navigator` seguem o padrão de `Ferreiro`/`Panteao`/`Conquistas`. Nenhuma migration de estado necessária — todos os campos (`weeklyState`, `pantheonBonuses`, `pantheonFusions`, `materials`) já existem no `GameState` (migrations v6–v8).

**Tech Stack:** TypeScript, React Native (Expo), Jest (unit), Playwright (e2e). Sem novas dependências.

**Spec:** [`docs/superpowers/specs/2026-05-31-gaps-resolution-design.md`](../specs/2026-05-31-gaps-resolution-design.md)

**Pré-requisito:** Nenhum. Esta fase é executável independentemente da Fase 1 (backend wiring). Os bônus do panteão e permanentes serão exibidos quando existirem no estado, mas a UI não depende deles para funcionar.

---

## File Structure

### Task B1 — WeeklyScreen + useWeekly

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/hooks/useWeekly.ts` | Criar | Expõe `weeklyState`, `questStates`, `boss`, `timeUntilReset`, `handleClaim` |
| `src/screens/WeeklyScreen.tsx` | Criar | Lista de quests com progresso + card do boss (botão desabilitado) |
| `src/__tests__/hooks/useWeekly.test.ts` | Criar | Testa derivação de questStates, progresso e claim |

### Task B2 — Rota Semanal + Card na Vila

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/navigation/AppNavigator.tsx` | Modificar | Adicionar rota oculta `Semanal` |
| `src/screens/VillageScreen.tsx` | Modificar | Adicionar `VillageCard` "Semanal" e "Guilda" |

### Task B3 — PantheonScreen + usePantheon

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/hooks/usePantheon.ts` | Criar | Expõe heróis elegíveis, `pantheonBonuses`, `pantheonFusions`, `fuseHeroes` |
| `src/screens/PantheonScreen.tsx` | Substituir | Tela de fusão com seleção de 3 heróis → confirmação → resultado |
| `src/__tests__/hooks/usePantheon.test.ts` | Criar | Testa elegibilidade, bonuses e fluxo de fusão |

### Task B4 — GuildScreen: rota + card

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/navigation/AppNavigator.tsx` | Modificar | Adicionar import + rota oculta `Guilda` (GuildScreen não está importada ainda) |
| `src/screens/VillageScreen.tsx` | Modificar | Card "Guilda" (complementa B2, commit separado se necessário) |

### Task B5 — Inventário de materiais no Ferreiro

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/screens/BlacksmithScreen.tsx` | Modificar | Seção "Materiais" com lista + destaque do que falta para a receita selecionada |
| `src/__tests__/screens/BlacksmithMaterials.test.ts` | Criar | Testa derivação de `missingMaterials` dado estado e tier/tipo selecionado |

### Task B6 — Testes e2e

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `tests/e2e/weekly_flow.spec.ts` | Criar | Navegação Vila→Semanal, quests visíveis, card do boss |
| `tests/e2e/pantheon_flow.spec.ts` | Criar | Navegação Vila→Panteão, fluxo de fusão, resultado visível |
| `tests/e2e/guild_flow.spec.ts` | Criar | Navegação Vila→Guilda, heróis visíveis |
| `tests/e2e/blacksmith_materials.spec.ts` | Criar | Ferreiro mostra materiais; materiais faltantes destacados |

---

# Task B1: useWeekly + WeeklyScreen

**Files:**
- Create: `src/hooks/useWeekly.ts`
- Create: `src/screens/WeeklyScreen.tsx`
- Create: `src/__tests__/hooks/useWeekly.test.ts`

---

- [ ] **Step 1: Criar teste `src/__tests__/hooks/useWeekly.test.ts` (TDD — escrever antes)**

```ts
import { renderHook, act } from '@testing-library/react-hooks';
import React from 'react';
import { GameContext } from '../../context/GameContext';
import { GameState } from '../../types';
import { getWeeklySeed, pickWeeklyQuests } from '../../constants/weeklyQuests';
import { getWeeklyBoss } from '../../constants/weeklyBosses';

// Stub do hook — vai falhar até o Step 3
jest.mock('../../hooks/useWeekly', () => ({ useWeekly: jest.fn() }), { virtual: true });

const seed = getWeeklySeed();
const quests = pickWeeklyQuests(seed);

function makeWeeklyState(overrides: Partial<GameState['weeklyState']> = {}): NonNullable<GameState['weeklyState']> {
  return {
    seed,
    quests: quests.map(q => ({ id: q.id, claimed: false })),
    progress: {},
    allClaimed: false,
    bossDefeated: false,
    ...overrides,
  };
}

function makeGameState(weeklyOverrides: Partial<GameState['weeklyState']> = {}): GameState {
  return {
    gold: 100,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: Date.now(),
    weeklyState: makeWeeklyState(weeklyOverrides),
  };
}

// Teste das funções puras que useWeekly expõe (derivação de questStates)
describe('useWeekly derivations', () => {
  test('questStates: completed=true when progress >= targetValue', () => {
    const def = quests[0];
    const progress = { [def.tracker]: def.targetValue };
    const state = makeGameState({ progress });
    const ws = state.weeklyState!;
    const questStates = quests.map(q => {
      const entry = ws.quests.find(e => e.id === q.id)!;
      const current = ws.progress[q.tracker] ?? 0;
      return { def: q, current, completed: current >= q.targetValue, claimed: entry.claimed };
    });
    expect(questStates[0].completed).toBe(true);
    expect(questStates[0].claimed).toBe(false);
  });

  test('questStates: claimed=true when quest was claimed', () => {
    const def = quests[0];
    const state = makeGameState({
      progress: { [def.tracker]: def.targetValue },
      quests: quests.map((q, i) => ({ id: q.id, claimed: i === 0 })),
    });
    const ws = state.weeklyState!;
    const questStates = quests.map(q => {
      const entry = ws.quests.find(e => e.id === q.id)!;
      const current = ws.progress[q.tracker] ?? 0;
      return { def: q, current, completed: current >= q.targetValue, claimed: entry.claimed };
    });
    expect(questStates[0].claimed).toBe(true);
  });

  test('getWeeklyBoss returns boss for seed', () => {
    const boss = getWeeklyBoss(seed);
    expect(boss).toBeDefined();
    expect(boss.bossName).toBeTruthy();
    expect(Array.isArray(boss.enemies)).toBe(true);
  });

  test('timeUntilReset is positive and < 7 days', () => {
    const now = new Date();
    const msInWeek = 7 * 24 * 60 * 60 * 1000;
    // Next monday 00:00
    const dayOfWeek = now.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday);
    const msUntilReset = nextMonday.getTime() - now.getTime();
    expect(msUntilReset).toBeGreaterThan(0);
    expect(msUntilReset).toBeLessThanOrEqual(msInWeek);
  });
});
```

Run: `npm test -- --testPathPattern=useWeekly.test`
Expected: FAIL (hook não existe ainda — validamos que o teste é bem formado)

---

- [ ] **Step 2: Criar `src/hooks/useWeekly.ts`**

```ts
import { useContext, useMemo } from 'react';
import { GameContext } from '../context/GameContext';
import { pickWeeklyQuests, WeeklyQuestDef } from '../constants/weeklyQuests';
import { getWeeklyBoss, WeeklyBossTemplate } from '../constants/weeklyBosses';
import { GameState } from '../types';

export type WeeklyStateType = NonNullable<GameState['weeklyState']>;

export interface WeeklyQuestState {
  def: WeeklyQuestDef;
  current: number;
  completed: boolean;
  claimed: boolean;
}

export interface UseWeeklyResult {
  weeklyState: WeeklyStateType | null;
  questStates: WeeklyQuestState[];
  boss: WeeklyBossTemplate | null;
  allClaimed: boolean;
  bossDefeated: boolean;
  daysLeft: number;
  hoursLeft: number;
  minutesLeft: number;
  handleClaim: (questId: string) => void;
}

export function useWeekly(): UseWeeklyResult {
  const { state, dispatch } = useContext(GameContext);
  const weeklyState = state.weeklyState ?? null;

  const questDefs = useMemo(() => {
    if (!weeklyState) return [];
    return pickWeeklyQuests(weeklyState.seed);
  }, [weeklyState?.seed]);

  const questStates: WeeklyQuestState[] = useMemo(() => {
    if (!weeklyState) return [];
    return questDefs.map(def => {
      const entry = weeklyState.quests.find(q => q.id === def.id);
      const current = weeklyState.progress[def.tracker] ?? 0;
      const completed = current >= def.targetValue;
      const claimed = entry?.claimed ?? false;
      return { def, current, completed, claimed };
    });
  }, [weeklyState, questDefs]);

  const boss = useMemo((): WeeklyBossTemplate | null => {
    if (!weeklyState) return null;
    return getWeeklyBoss(weeklyState.seed);
  }, [weeklyState?.seed]);

  // Time until next Monday 00:00
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun ... 6=Sat
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday);
  const msUntilReset = nextMonday.getTime() - now.getTime();
  const daysLeft = Math.floor(msUntilReset / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((msUntilReset % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutesLeft = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));

  function handleClaim(questId: string) {
    dispatch({ type: 'CLAIM_WEEKLY_QUEST', questId });
  }

  return {
    weeklyState,
    questStates,
    boss,
    allClaimed: weeklyState?.allClaimed ?? false,
    bossDefeated: weeklyState?.bossDefeated ?? false,
    daysLeft,
    hoursLeft,
    minutesLeft,
    handleClaim,
  };
}
```

---

- [ ] **Step 3: Atualizar o teste para importar o hook real (remover mock virtual)**

Abra `src/__tests__/hooks/useWeekly.test.ts` e **remova** a linha do `jest.mock` virtual, deixando apenas os testes de derivação pura que não precisam de renderização de hook.

O bloco final do arquivo deve ficar:

```ts
import { getWeeklySeed, pickWeeklyQuests } from '../../constants/weeklyQuests';
import { getWeeklyBoss } from '../../constants/weeklyBosses';

const seed = getWeeklySeed();
const quests = pickWeeklyQuests(seed);

function makeWeeklyState(overrides: Partial<NonNullable<import('../../types').GameState['weeklyState']>> = {}): NonNullable<import('../../types').GameState['weeklyState']> {
  return {
    seed,
    quests: quests.map(q => ({ id: q.id, claimed: false })),
    progress: {},
    allClaimed: false,
    bossDefeated: false,
    ...overrides,
  };
}

function makeGameState(weeklyOverrides?: Partial<NonNullable<import('../../types').GameState['weeklyState']>>): import('../../types').GameState {
  return {
    gold: 100,
    heroes: [],
    heroesRecruited: 0,
    lastSavedAt: Date.now(),
    weeklyState: makeWeeklyState(weeklyOverrides),
  };
}

describe('useWeekly derivations', () => {
  test('questStates: completed=true when progress >= targetValue', () => {
    const def = quests[0];
    const progress = { [def.tracker]: def.targetValue };
    const state = makeGameState({ progress });
    const ws = state.weeklyState!;
    const questStates = quests.map(q => {
      const entry = ws.quests.find(e => e.id === q.id)!;
      const current = ws.progress[q.tracker] ?? 0;
      return { def: q, current, completed: current >= q.targetValue, claimed: entry.claimed };
    });
    expect(questStates[0].completed).toBe(true);
    expect(questStates[0].claimed).toBe(false);
  });

  test('questStates: claimed=true when quest was claimed', () => {
    const def = quests[0];
    const state = makeGameState({
      progress: { [def.tracker]: def.targetValue },
      quests: quests.map((q, i) => ({ id: q.id, claimed: i === 0 })),
    });
    const ws = state.weeklyState!;
    const questStates = quests.map(q => {
      const entry = ws.quests.find(e => e.id === q.id)!;
      const current = ws.progress[q.tracker] ?? 0;
      return { def: q, current, completed: current >= q.targetValue, claimed: entry.claimed };
    });
    expect(questStates[0].claimed).toBe(true);
  });

  test('getWeeklyBoss returns boss for seed', () => {
    const boss = getWeeklyBoss(seed);
    expect(boss).toBeDefined();
    expect(boss.bossName).toBeTruthy();
    expect(Array.isArray(boss.enemies)).toBe(true);
  });

  test('timeUntilReset: next Monday is within 7 days', () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday);
    const msUntilReset = nextMonday.getTime() - now.getTime();
    expect(msUntilReset).toBeGreaterThan(0);
    expect(msUntilReset).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });
});
```

Run: `npm test -- --testPathPattern=useWeekly.test`
Expected: PASS (4 testes)

---

- [ ] **Step 4: Criar `src/screens/WeeklyScreen.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWeekly, WeeklyQuestState } from '../hooks/useWeekly';
import { WeeklyBossTemplate } from '../constants/weeklyBosses';
import { theme } from '../theme';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { WEEKLY_BONUS_REWARD } from '../constants/weeklyQuests';

export function WeeklyScreen() {
  const insets = useSafeAreaInsets();
  const {
    weeklyState,
    questStates,
    boss,
    allClaimed,
    bossDefeated,
    daysLeft,
    hoursLeft,
    minutesLeft,
    handleClaim,
  } = useWeekly();

  const allCompleted = questStates.every(q => q.completed);
  const allQuestsClaimed = questStates.every(q => q.claimed);

  const resetLabel = daysLeft > 0
    ? `Renova em ${daysLeft}d ${hoursLeft}h`
    : `Renova em ${hoursLeft}h ${minutesLeft}m`;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <View style={styles.headerWrapper}>
        <ScreenHeader
          title="Desafio Semanal"
          subtitle={resetLabel}
          showGold={false}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {questStates.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Carregando desafio semanal...</Text>
          </View>
        ) : (
          <>
            {/* Boss card */}
            {boss && (
              <BossCard boss={boss} bossDefeated={bossDefeated} />
            )}

            {/* Quest cards */}
            {questStates.map(({ def, current, completed, claimed }) => (
              <WeeklyQuestCard
                key={def.id}
                def={def}
                current={current}
                completed={completed}
                claimed={claimed}
                onClaim={() => handleClaim(def.id)}
              />
            ))}

            {/* Bonus card */}
            <View style={[styles.bonusCard, allClaimed && styles.bonusCardClaimed]}>
              <View style={styles.bonusHeader}>
                <Text style={styles.bonusIcon}>{'🏆'}</Text>
                <View style={styles.bonusTextContainer}>
                  <Text style={styles.bonusTitle}>Bônus Semanal</Text>
                  <Text style={styles.bonusSubtitle}>
                    Complete todas as {questStates.length} missões semanais
                  </Text>
                </View>
                <View style={styles.bonusRewardBadge}>
                  <Text style={styles.bonusRewardText}>+{WEEKLY_BONUS_REWARD}</Text>
                  <Text style={styles.bonusRewardGoldIcon}>{'🪙'}</Text>
                </View>
              </View>

              <View style={styles.bonusProgressRow}>
                {questStates.map((q, i) => (
                  <View
                    key={i}
                    style={[
                      styles.bonusDot,
                      q.claimed ? styles.bonusDotFilled : styles.bonusDotEmpty,
                    ]}
                  />
                ))}
              </View>

              {allClaimed ? (
                <Text style={styles.bonusClaimedText}>Bônus coletado!</Text>
              ) : allCompleted && allQuestsClaimed ? (
                <Text style={styles.bonusPendingText}>Colete todas as recompensas acima</Text>
              ) : (
                <Text style={styles.bonusPendingText}>
                  {questStates.filter(q => q.claimed).length}/{questStates.length} missões completas
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function BossCard({ boss, bossDefeated }: { boss: WeeklyBossTemplate; bossDefeated: boolean }) {
  return (
    <View style={[styles.bossCard, bossDefeated && styles.bossCardDefeated]}>
      <View style={styles.bossHeader}>
        <Text style={styles.bossIcon}>{'🐉'}</Text>
        <View style={styles.bossInfo}>
          <Text style={styles.bossTitle}>{boss.bossName}</Text>
          <Text style={styles.bossSubtitle}>
            {boss.minHeroes}+ heróis • Dificuldade {boss.difficulty}
          </Text>
        </View>
        <View style={styles.bossRewardBadge}>
          <Text style={styles.bossRewardText}>+{boss.baseReward}</Text>
          <Text style={styles.bossRewardGoldIcon}>{'🪙'}</Text>
        </View>
      </View>

      {bossDefeated ? (
        <View style={styles.bossDefeatedBanner}>
          <Text style={styles.bossDefeatedText}>{'✓'} Derrotado esta semana</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.bossButtonDisabled}
          disabled
          activeOpacity={1}
        >
          <Text style={styles.bossButtonText}>Enfrentar Boss — Em breve</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function WeeklyQuestCard({
  def,
  current,
  completed,
  claimed,
  onClaim,
}: WeeklyQuestState & { onClaim: () => void }) {
  const progress = Math.min(current / def.targetValue, 1);

  return (
    <View style={[styles.questCard, claimed && styles.questCardClaimed]}>
      <View style={styles.questRow}>
        <View style={styles.questIconContainer}>
          <Text style={styles.questIcon}>{def.icon}</Text>
        </View>
        <View style={styles.questInfo}>
          <Text style={[styles.questName, claimed && styles.questNameClaimed]}>{def.name}</Text>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progress * 100}%` },
                  completed ? styles.progressBarComplete : null,
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {Math.min(current, def.targetValue)}/{def.targetValue}
            </Text>
          </View>
        </View>

        {claimed ? (
          <View style={styles.claimedBadge}>
            <Text style={styles.claimedBadgeText}>{'✓'}</Text>
          </View>
        ) : completed ? (
          <TouchableOpacity style={styles.claimButton} onPress={onClaim} activeOpacity={0.7}>
            <Text style={styles.claimButtonText}>+{def.reward}</Text>
            <Text style={styles.claimButtonGold}>{'🪙'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.rewardPreview}>
            <Text style={styles.rewardPreviewText}>{def.reward}</Text>
            <Text style={styles.rewardPreviewGold}>{'🪙'}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerWrapper: {
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceLight,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    gap: 12,
  },
  emptyContainer: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: theme.colors.textSecondary, fontSize: 14 },

  // Boss card
  bossCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.danger ?? '#ef4444',
    gap: 12,
  },
  bossCardDefeated: {
    borderColor: theme.colors.success,
    opacity: 0.75,
  },
  bossHeader: { flexDirection: 'row', alignItems: 'center' },
  bossIcon: { fontSize: 28, marginRight: theme.spacing.md },
  bossInfo: { flex: 1 },
  bossTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  bossSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  bossRewardBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bossRewardText: { color: theme.colors.gold, fontSize: 16, fontWeight: '800' },
  bossRewardGoldIcon: { fontSize: 16 },
  bossButtonDisabled: {
    backgroundColor: theme.colors.surfaceLight,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  bossButtonText: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    fontSize: 14,
  },
  bossDefeatedBanner: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  bossDefeatedText: {
    color: theme.colors.success,
    fontWeight: '700',
    fontSize: 14,
  },

  // Quest card (espelha DailyQuestsScreen)
  questCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
  },
  questCardClaimed: { opacity: 0.6 },
  questRow: { flexDirection: 'row', alignItems: 'center' },
  questIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  questIcon: { fontSize: 22 },
  questInfo: { flex: 1, marginRight: theme.spacing.sm },
  questName: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  questNameClaimed: {
    textDecorationLine: 'line-through',
    color: theme.colors.textSecondary,
  },
  progressBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  progressBarComplete: { backgroundColor: theme.colors.success },
  progressText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    gap: 4,
  },
  claimButtonText: { color: '#1a1a1a', fontSize: 14, fontWeight: '800' },
  claimButtonGold: { fontSize: 14 },
  claimedBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  claimedBadgeText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  rewardPreview: { flexDirection: 'row', alignItems: 'center', gap: 2, opacity: 0.5 },
  rewardPreviewText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' },
  rewardPreviewGold: { fontSize: 12 },

  // Bonus card (espelha DailyQuestsScreen)
  bonusCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.gold,
    marginTop: 4,
  },
  bonusCardClaimed: { borderColor: theme.colors.success, opacity: 0.7 },
  bonusHeader: { flexDirection: 'row', alignItems: 'center' },
  bonusIcon: { fontSize: 28, marginRight: theme.spacing.md },
  bonusTextContainer: { flex: 1 },
  bonusTitle: { color: theme.colors.gold, fontSize: 16, fontWeight: '800' },
  bonusSubtitle: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  bonusRewardBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bonusRewardText: { color: theme.colors.gold, fontSize: 16, fontWeight: '800' },
  bonusRewardGoldIcon: { fontSize: 16 },
  bonusProgressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  bonusDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  bonusDotFilled: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  bonusDotEmpty: { backgroundColor: 'transparent', borderColor: theme.colors.textMuted },
  bonusClaimedText: { color: theme.colors.success, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  bonusPendingText: { color: theme.colors.textSecondary, fontSize: 12, textAlign: 'center' },
});
```

---

- [ ] **Step 5: Rodar testes e type-check**

Run: `npm test -- --testPathPattern=useWeekly.test`
Expected: PASS (4 testes)

Run: `npx tsc --noEmit`
Expected: 0 erros

---

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useWeekly.ts src/screens/WeeklyScreen.tsx src/__tests__/hooks/useWeekly.test.ts
git commit -m "feat(weekly): hook useWeekly + WeeklyScreen com quests e card de boss"
```

---

# Task B2: Rota Semanal + Card na Vila (+ Guilda)

**Files:**
- Modify: `src/navigation/AppNavigator.tsx`
- Modify: `src/screens/VillageScreen.tsx`

---

- [ ] **Step 1: Adicionar imports e rotas ocultas em `src/navigation/AppNavigator.tsx`**

No início do arquivo, após os imports existentes, adicione:

```ts
import { WeeklyScreen } from '../screens/WeeklyScreen';
import { GuildScreen } from '../screens/GuildScreen';
```

Dentro do `Tab.Navigator`, após o bloco de `MissoesDiarias` (linha ~104-110), adicione:

```tsx
<Tab.Screen
  name="Semanal"
  component={WeeklyScreen}
  options={{
    tabBarButton: () => null,
    tabBarItemStyle: { display: 'none' },
  }}
/>
<Tab.Screen
  name="Guilda"
  component={GuildScreen}
  options={{
    tabBarButton: () => null,
    tabBarItemStyle: { display: 'none' },
  }}
/>
```

---

- [ ] **Step 2: Adicionar cards "Semanal" e "Guilda" em `src/screens/VillageScreen.tsx`**

Dentro do `<View style={styles.grid}>`, após o card "Panteão" (última linha antes de `</View>`), adicione:

```tsx
<VillageCard
  title="Desafio Semanal"
  icon="📅"
  description="Quests semanais e boss especial"
  screen="Semanal"
/>
<VillageCard
  title="Guilda"
  icon="⚔️"
  description="Gerencie e recrute seus heróis"
  screen="Guilda"
/>
```

Também atualize a descrição do Panteão para remover "(Em breve)":

Localize:
```tsx
description="Honre seus heróis lendários (Em breve)"
```
Substitua por:
```tsx
description="Fusão de heróis e bônus permanentes"
```

---

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 erros

---

- [ ] **Step 4: Validação visual no browser (Playwright)**

```bash
# Inicie o app em background se não estiver rodando
npx expo start --web --port 8081 &
# Aguarde 5s e abra o browser em http://localhost:8081
```

Verificar manualmente no browser:
- Vila exibe 8 cards (Treinamento, Enfermaria, Ferreiro, Missões Diárias, Conquistas, Panteão, Desafio Semanal, Guilda)
- Clicar em "Desafio Semanal" navega para WeeklyScreen (quests visíveis, card do boss com botão cinza desabilitado)
- Clicar em "Guilda" navega para GuildScreen (tela existente funcional)
- Botão voltar retorna à Vila

---

- [ ] **Step 5: Commit**

```bash
git add src/navigation/AppNavigator.tsx src/screens/VillageScreen.tsx
git commit -m "feat(navigation): rotas Semanal+Guilda + cards na Vila (8 cards total)"
```

---

# Task B3: usePantheon + PantheonScreen

**Files:**
- Create: `src/hooks/usePantheon.ts`
- Modify: `src/screens/PantheonScreen.tsx`
- Create: `src/__tests__/hooks/usePantheon.test.ts`

---

- [ ] **Step 1: Criar teste `src/__tests__/hooks/usePantheon.test.ts` (TDD)**

```ts
import { GameState, Hero, HeroTask } from '../../types';
import { calculatePantheonBonuses } from '../../context/pantheonHandler';

function makeHero(overrides: Partial<Hero> & { id: string }): Hero {
  return {
    id: overrides.id,
    name: overrides.name ?? 'Herói',
    hpMax: 50,
    hpCurrent: 50,
    atk: 10,
    mp: 5,
    defense: 5,
    crit: 10,
    agility: 5,
    currentTask: overrides.currentTask ?? HeroTask.IDLE,
    classId: overrides.classId ?? 'WARRIOR',
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
    stars: overrides.stars ?? 0,
    ...overrides,
  } as Hero;
}

// Testa a lógica pura de eligibilidade que usePantheon vai encapsular
describe('usePantheon derivations', () => {
  test('hero elegível: IDLE e hpCurrent > 0', () => {
    const hero = makeHero({ id: 'h1', currentTask: HeroTask.IDLE });
    const eligible = hero.currentTask === HeroTask.IDLE && hero.hpCurrent > 0;
    expect(eligible).toBe(true);
  });

  test('hero não elegível se estiver em missão', () => {
    const hero = makeHero({ id: 'h1', currentTask: HeroTask.MISSION });
    const eligible = hero.currentTask === HeroTask.IDLE && hero.hpCurrent > 0;
    expect(eligible).toBe(false);
  });

  test('hero não elegível se HP = 0', () => {
    const hero = makeHero({ id: 'h1', hpCurrent: 0 });
    const eligible = hero.currentTask === HeroTask.IDLE && hero.hpCurrent > 0;
    expect(eligible).toBe(false);
  });

  test('precisa de pelo menos 3 heróis elegíveis para fundir', () => {
    const heroes = [
      makeHero({ id: 'a' }),
      makeHero({ id: 'b' }),
    ];
    const eligible = heroes.filter(h => h.currentTask === HeroTask.IDLE && h.hpCurrent > 0);
    expect(eligible.length >= 3).toBe(false);

    const heroes3 = [...heroes, makeHero({ id: 'c' })];
    const eligible3 = heroes3.filter(h => h.currentTask === HeroTask.IDLE && h.hpCurrent > 0);
    expect(eligible3.length >= 3).toBe(true);
  });

  test('calculatePantheonBonuses reflete heróis com estrelas', () => {
    const heroes = [
      makeHero({ id: 'a', stars: 1 }),
      makeHero({ id: 'b', stars: 1 }),
      makeHero({ id: 'c', stars: 1 }),
    ];
    const bonuses = calculatePantheonBonuses(heroes);
    expect(bonuses.goldPercent).toBe(8); // 3 + 5 para 3 starred
  });

  test('pantheonFusions conta corretamente', () => {
    const state: GameState = {
      gold: 100,
      heroes: [],
      heroesRecruited: 0,
      lastSavedAt: Date.now(),
      pantheonFusions: 5,
    };
    expect(state.pantheonFusions).toBe(5);
  });
});
```

Run: `npm test -- --testPathPattern=usePantheon.test`
Expected: PASS (6 testes)

---

- [ ] **Step 2: Criar `src/hooks/usePantheon.ts`**

```ts
import { useContext, useMemo, useState } from 'react';
import { GameContext } from '../context/GameContext';
import { Hero, HeroTask } from '../types';

export interface UsePantheonResult {
  eligibleHeroes: Hero[];
  pantheonBonuses: { goldPercent: number; atkPercent: number; hpPercent: number };
  pantheonFusions: number;
  selectedIds: string[];
  canFuse: boolean;
  toggleHero: (heroId: string) => void;
  confirmFusion: () => void;
  clearSelection: () => void;
}

export function usePantheon(): UsePantheonResult {
  const { state, dispatch } = useContext(GameContext);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const eligibleHeroes = useMemo(
    () => state.heroes.filter(h => h.currentTask === HeroTask.IDLE && h.hpCurrent > 0),
    [state.heroes]
  );

  const pantheonBonuses = state.pantheonBonuses ?? { goldPercent: 0, atkPercent: 0, hpPercent: 0 };
  const pantheonFusions = state.pantheonFusions ?? 0;

  const canFuse = selectedIds.length === 3;

  function toggleHero(heroId: string) {
    setSelectedIds(prev => {
      if (prev.includes(heroId)) {
        return prev.filter(id => id !== heroId);
      }
      if (prev.length >= 3) return prev; // máximo 3
      return [...prev, heroId];
    });
  }

  function confirmFusion() {
    if (!canFuse) return;
    dispatch({ type: 'FUSE_HEROES', heroIds: selectedIds as [string, string, string] });
    setSelectedIds([]);
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  return {
    eligibleHeroes,
    pantheonBonuses,
    pantheonFusions,
    selectedIds,
    canFuse,
    toggleHero,
    confirmFusion,
    clearSelection,
  };
}
```

---

- [ ] **Step 3: Substituir `src/screens/PantheonScreen.tsx` pela tela de fusão**

```tsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePantheon } from '../hooks/usePantheon';
import { Hero } from '../types';
import { theme } from '../theme';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { CLASS_DEFS } from '../constants/classes';

const CLASS_EMOJI: Record<string, string> = {
  WARRIOR: '⚔️', TANK: '🛡️', ROGUE: '🗡️',
  ARCHER: '🏹', MAGE: '🔮', HEALER: '💚',
};

function StarBadge({ stars }: { stars: number }) {
  if (!stars) return null;
  return (
    <Text style={styles.starBadge}>{'★'.repeat(stars)}</Text>
  );
}

export function PantheonScreen() {
  const insets = useSafeAreaInsets();
  const {
    eligibleHeroes,
    pantheonBonuses,
    pantheonFusions,
    selectedIds,
    canFuse,
    toggleHero,
    confirmFusion,
    clearSelection,
  } = usePantheon();

  const [confirmVisible, setConfirmVisible] = useState(false);

  const selectedHeroes = selectedIds
    .map(id => eligibleHeroes.find(h => h.id === id))
    .filter(Boolean) as Hero[];

  const hasBonuses = pantheonBonuses.goldPercent > 0
    || pantheonBonuses.atkPercent > 0
    || pantheonBonuses.hpPercent > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <View style={styles.headerWrapper}>
        <ScreenHeader
          title="Panteão dos Heróis"
          subtitle={`${pantheonFusions} fusão${pantheonFusions !== 1 ? 'ões' : ''} realizadas`}
          showGold={false}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Bônus do Panteão */}
        {hasBonuses && (
          <View style={styles.bonusSection}>
            <Text style={styles.sectionTitle}>Bônus Ativos</Text>
            <View style={styles.bonusRow}>
              {pantheonBonuses.goldPercent > 0 && (
                <View style={styles.bonusPill}>
                  <Text style={styles.bonusPillText}>{'🪙'} +{pantheonBonuses.goldPercent}% Gold</Text>
                </View>
              )}
              {pantheonBonuses.atkPercent > 0 && (
                <View style={styles.bonusPill}>
                  <Text style={styles.bonusPillText}>{'⚔️'} +{pantheonBonuses.atkPercent}% ATK</Text>
                </View>
              )}
              {pantheonBonuses.hpPercent > 0 && (
                <View style={styles.bonusPill}>
                  <Text style={styles.bonusPillText}>{'❤️'} +{pantheonBonuses.hpPercent}% HP</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Instrução de fusão */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionTitle}>{'🏛️'} Fusão de Heróis</Text>
          <Text style={styles.instructionText}>
            Selecione 3 heróis ociosos para fundir em um herói mais poderoso com estrelas.
            O herói fundido herda 10% do treinamento total.
          </Text>
        </View>

        {/* Heróis selecionados */}
        {selectedIds.length > 0 && (
          <View style={styles.selectionSection}>
            <Text style={styles.sectionTitle}>
              Selecionados ({selectedIds.length}/3)
            </Text>
            <View style={styles.selectedRow}>
              {selectedHeroes.map(hero => (
                <View key={hero.id} style={styles.selectedPill}>
                  <Text style={styles.selectedEmoji}>
                    {CLASS_EMOJI[hero.classId ?? ''] ?? '❓'}
                  </Text>
                  <Text style={styles.selectedName}>{hero.name}</Text>
                  <TouchableOpacity onPress={() => toggleHero(hero.id)}>
                    <Text style={styles.removeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearSelection}
              >
                <Text style={styles.clearButtonText}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fuseButton, !canFuse && styles.fuseButtonDisabled]}
                onPress={() => canFuse && setConfirmVisible(true)}
                disabled={!canFuse}
              >
                <Text style={styles.fuseButtonText}>
                  {canFuse ? 'Fundir Heróis' : `Selecione ${3 - selectedIds.length} mais`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Lista de heróis elegíveis */}
        <Text style={styles.sectionTitle}>
          Heróis Elegíveis ({eligibleHeroes.length})
        </Text>

        {eligibleHeroes.length < 3 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>{'⚠️'}</Text>
            <Text style={styles.emptyText}>
              Você precisa de pelo menos 3 heróis ociosos para fundir.
            </Text>
            <Text style={styles.emptySubtext}>
              Heróis em missão, treinamento ou enfermaria não podem ser fundidos.
            </Text>
          </View>
        ) : (
          eligibleHeroes.map(hero => {
            const isSelected = selectedIds.includes(hero.id);
            const isDisabled = !isSelected && selectedIds.length >= 3;
            const classLabel = hero.classId ? CLASS_DEFS[hero.classId]?.displayName ?? '' : '';
            return (
              <TouchableOpacity
                key={hero.id}
                style={[
                  styles.heroCard,
                  isSelected && styles.heroCardSelected,
                  isDisabled && styles.heroCardDisabled,
                ]}
                onPress={() => !isDisabled && toggleHero(hero.id)}
                disabled={isDisabled}
                activeOpacity={0.7}
              >
                <View style={styles.heroCardLeft}>
                  <Text style={styles.heroEmoji}>
                    {CLASS_EMOJI[hero.classId ?? ''] ?? '❓'}
                  </Text>
                </View>
                <View style={styles.heroCardInfo}>
                  <View style={styles.heroNameRow}>
                    <Text style={styles.heroName}>{hero.name}</Text>
                    {(hero.stars ?? 0) > 0 && <StarBadge stars={hero.stars!} />}
                  </View>
                  <Text style={styles.heroClass}>{classLabel}</Text>
                  <Text style={styles.heroStats}>
                    HP {Math.floor(hero.hpMax)} • ATK {Math.floor(hero.atk)} • MP {Math.floor(hero.mp)}
                  </Text>
                </View>
                {isSelected && (
                  <View style={styles.checkMark}>
                    <Text style={styles.checkMarkText}>{'✓'}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Modal de confirmação */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmar Fusão</Text>
            <Text style={styles.modalSubtitle}>
              Os 3 heróis serão consumidos e um novo herói mais poderoso será criado.
            </Text>

            <View style={styles.modalHeroList}>
              {selectedHeroes.map(hero => (
                <View key={hero.id} style={styles.modalHeroRow}>
                  <Text style={styles.modalHeroEmoji}>
                    {CLASS_EMOJI[hero.classId ?? ''] ?? '❓'}
                  </Text>
                  <Text style={styles.modalHeroName}>{hero.name}</Text>
                  {(hero.stars ?? 0) > 0 && <StarBadge stars={hero.stars!} />}
                </View>
              ))}
            </View>

            <Text style={styles.modalArrow}>{'↓'}</Text>
            <View style={styles.modalResultPreview}>
              <Text style={styles.modalResultText}>
                {'✨'} Novo herói fusionado com estrelas
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setConfirmVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  setConfirmVisible(false);
                  confirmFusion();
                }}
              >
                <Text style={styles.modalConfirmText}>Fundir!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  headerWrapper: {
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceLight,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 4,
  },
  // Bônus
  bonusSection: { gap: 8 },
  bonusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bonusPill: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  bonusPillText: { color: theme.colors.primaryLight, fontWeight: '700', fontSize: 13 },
  // Instrução
  instructionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
    gap: 6,
  },
  instructionTitle: { color: theme.colors.gold, fontSize: 15, fontWeight: '800' },
  instructionText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 },
  // Selecionados
  selectionSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    gap: 8,
  },
  selectedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  selectedEmoji: { fontSize: 16 },
  selectedName: { color: theme.colors.textPrimary, fontWeight: '700', fontSize: 13 },
  removeBtn: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  clearButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  clearButtonText: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 14 },
  fuseButton: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  fuseButtonDisabled: { backgroundColor: theme.colors.surfaceLight },
  fuseButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  // Hero cards
  heroCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
    alignItems: 'center',
  },
  heroCardSelected: { borderColor: theme.colors.primary, borderWidth: 2 },
  heroCardDisabled: { opacity: 0.35 },
  heroCardLeft: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  heroEmoji: { fontSize: 22 },
  heroCardInfo: { flex: 1 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroName: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '700' },
  starBadge: { color: theme.colors.gold, fontSize: 12, fontWeight: '800' },
  heroClass: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 1 },
  heroStats: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  checkMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMarkText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  // Empty state
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
  },
  emptyIcon: { fontSize: 32 },
  emptyText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtext: { color: theme.colors.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 16 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    width: '100%',
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  modalHeroList: { gap: 6 },
  modalHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    gap: 8,
  },
  modalHeroEmoji: { fontSize: 20 },
  modalHeroName: { flex: 1, color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14 },
  modalArrow: { fontSize: 24, textAlign: 'center', color: theme.colors.textSecondary },
  modalResultPreview: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  modalResultText: { color: theme.colors.primaryLight, fontWeight: '700', fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  modalCancelText: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 14 },
  modalConfirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
```

---

- [ ] **Step 4: Rodar testes e type-check**

Run: `npm test -- --testPathPattern=usePantheon.test`
Expected: PASS (6 testes)

Run: `npm test`
Expected: suite completa green

Run: `npx tsc --noEmit`
Expected: 0 erros

---

- [ ] **Step 5: Validação visual no browser (Playwright)**

Verificar manualmente em http://localhost:8081:
- Vila → Panteão: tela de fusão exibe "Panteão dos Heróis" (não mais ComingSoon)
- Com heróis disponíveis: lista de heróis elegíveis, seleção de 3, botão "Fundir Heróis" ativo
- Modal de confirmação abre, mostra os 3 heróis e preview do resultado
- Após confirmar: heróis removidos, novo herói com estrelas aparece na lista
- Seção "Bônus Ativos" aparece após primeira fusão bem-sucedida

---

- [ ] **Step 6: Commit**

```bash
git add src/hooks/usePantheon.ts src/screens/PantheonScreen.tsx src/__tests__/hooks/usePantheon.test.ts
git commit -m "feat(pantheon): usePantheon + tela de fusão substitui ComingSoon"
```

---

# Task B4: GuildScreen — rota já adicionada na Task B2

**Nota:** A rota `Guilda` e o card na Vila foram adicionados na Task B2 (Step 1 e 2). Esta task verifica a ausência de duplicação com o Shop e confirma que a tela já está funcional.

---

- [ ] **Step 1: Confirmar ausência de conflito entre Guilda e Shop (grep)**

```bash
grep -n "RECRUIT_HERO\|BUY_CHEST\|recruitHero\|buyChest\|RecruitButton\|ChestCard" \
  /root/rodrigo/idle_rpg/src/screens/GuildScreen.tsx \
  /root/rodrigo/idle_rpg/src/screens/ShopScreen.tsx \
  /root/rodrigo/idle_rpg/src/context/heroHandler.ts
```

Expected: `GuildScreen` usa `RecruitButton` → dispatch `RECRUIT_HERO` (gold direto). `ShopScreen` usa `BUY_CHEST` → baús com heróis aleatórios. Mecânicas distintas, sem conflito.

---

- [ ] **Step 2: Validação visual no browser**

Verificar em http://localhost:8081:
- Vila → Guilda: tela existente funcional (heróis, botão recrutar, status)
- Vila → Loja: tela de baús funcional, distinta da Guilda

---

- [ ] **Step 3: Commit de confirmação (se houve mudanças de B2 não commitadas)**

Se B2 foi commitado por inteiro (incluindo card Guilda), este step é no-op. Caso contrário:

```bash
git status  # verificar
git add src/navigation/AppNavigator.tsx src/screens/VillageScreen.tsx
git commit -m "chore(guild): confirmar rota Guilda sem conflito com Shop"
```

---

# Task B5: Inventário de materiais no Ferreiro

**Files:**
- Modify: `src/screens/BlacksmithScreen.tsx`
- Create: `src/__tests__/screens/BlacksmithMaterials.test.ts`

---

- [ ] **Step 1: Criar teste `src/__tests__/screens/BlacksmithMaterials.test.ts` (TDD)**

```ts
import { MATERIALS, FORGE_RECIPES, hasEnoughMaterials, ForgeRecipe, MaterialId } from '../../constants/materials';

function getMissingMaterials(
  playerMaterials: Partial<Record<MaterialId, number>>,
  recipe: ForgeRecipe
): Array<{ name: string; icon: string; have: number; need: number }> {
  return MATERIALS
    .filter(m => (recipe.materials[m.id] ?? 0) > 0)
    .map(m => ({
      name: m.name,
      icon: m.icon,
      have: playerMaterials[m.id] ?? 0,
      need: recipe.materials[m.id] ?? 0,
    }))
    .filter(r => r.have < r.need);
}

describe('BlacksmithScreen materials derivations', () => {
  test('MATERIALS lista os 4 tipos', () => {
    expect(MATERIALS).toHaveLength(4);
    expect(MATERIALS.map(m => m.id)).toEqual(
      expect.arrayContaining(['iron', 'crystal', 'essence', 'starstone'])
    );
  });

  test('FORGE_RECIPES tier 1 weapon requer 3 iron', () => {
    const recipe = FORGE_RECIPES[1].weapon;
    expect(recipe.materials.iron).toBe(3);
  });

  test('getMissingMaterials: sem materiais → lista completa de faltantes', () => {
    const recipe = FORGE_RECIPES[1].weapon; // requer iron: 3
    const missing = getMissingMaterials({}, recipe);
    expect(missing).toHaveLength(1);
    expect(missing[0].name).toBe('Fragmento de Ferro');
    expect(missing[0].have).toBe(0);
    expect(missing[0].need).toBe(3);
  });

  test('getMissingMaterials: com materiais suficientes → lista vazia', () => {
    const recipe = FORGE_RECIPES[1].weapon; // iron: 3
    const missing = getMissingMaterials({ iron: 5 }, recipe);
    expect(missing).toHaveLength(0);
  });

  test('getMissingMaterials: com materiais parciais → lista parcial', () => {
    const recipe = FORGE_RECIPES[2].weapon; // iron: 8, essence: 2
    const missing = getMissingMaterials({ iron: 5 }, recipe);
    expect(missing).toHaveLength(2); // iron faltando 3, essence faltando 2
    const ironEntry = missing.find(m => m.name === 'Fragmento de Ferro');
    expect(ironEntry?.have).toBe(5);
    expect(ironEntry?.need).toBe(8);
  });

  test('hasEnoughMaterials: true quando tem o suficiente', () => {
    const recipe = FORGE_RECIPES[1].weapon;
    expect(hasEnoughMaterials({ iron: 3 }, recipe)).toBe(true);
  });

  test('hasEnoughMaterials: false quando falta material', () => {
    const recipe = FORGE_RECIPES[1].weapon;
    expect(hasEnoughMaterials({ iron: 2 }, recipe)).toBe(false);
  });
});
```

Run: `npm test -- --testPathPattern=BlacksmithMaterials.test`
Expected: PASS (7 testes)

---

- [ ] **Step 2: Adicionar seção de materiais em `src/screens/BlacksmithScreen.tsx`**

No topo do arquivo, adicione o import:

```ts
import { MATERIALS, FORGE_RECIPES, MaterialId, ForgeRecipe, EquipmentType } from '../constants/materials';
```

Após as constantes existentes (`STAT_LABELS`, `TYPE_ICONS`), adicione a função helper:

```ts
function getMissingMaterials(
  playerMaterials: Partial<Record<MaterialId, number>>,
  recipe: ForgeRecipe
): Array<{ name: string; icon: string; have: number; need: number }> {
  return MATERIALS
    .filter(m => (recipe.materials[m.id] ?? 0) > 0)
    .map(m => ({
      name: m.name,
      icon: m.icon,
      have: playerMaterials[m.id] ?? 0,
      need: recipe.materials[m.id] ?? 0,
    }))
    .filter(r => r.have < r.need);
}
```

No estado do componente `BlacksmithScreen`, após as linhas `useState` existentes (linhas 48-49), adicione:

```ts
const [selectedTier, setSelectedTier] = useState<number>(1);
const [selectedEquipmentType, setSelectedEquipmentType] = useState<EquipmentType>('weapon');
```

**Nota:** `renderForgeTier` é uma função interna que fecha sobre o estado do componente — ela já enxerga `selectedEquipmentType` e `setSelectedTier` por closure. Não é necessário alterar sua assinatura.

Modifique `renderForgeTier` para atualizar o estado e passar o tipo correto. Localize o `onPress` atual (linha ~91):
```tsx
onPress={() => handleForge(tierDef.tier)}
```
Substitua por:
```tsx
onPress={() => {
  setSelectedTier(tierDef.tier);
  handleForge(tierDef.tier, selectedEquipmentType);
}}
```

Adicione seletor de tipo antes da seção de tiers. Após `<Text style={styles.sectionTitle}>Forjar Equipamento</Text>`, insira:

```tsx
{/* Seletor de tipo de equipamento */}
<View style={styles.typeRow}>
  {(['weapon', 'armor', 'accessory'] as const).map(t => (
    <TouchableOpacity
      key={t}
      style={[styles.typeBtn, selectedEquipmentType === t && styles.typeBtnActive]}
      onPress={() => setSelectedEquipmentType(t)}
    >
      <Text style={styles.typeBtnText}>{TYPE_ICONS[t]} {t}</Text>
    </TouchableOpacity>
  ))}
</View>
```

Após a seção "Inventário" (antes do fechamento do `ScrollView`), adicione a seção de materiais:

```tsx
{/* Materiais */}
<Text style={styles.sectionTitle}>Materiais</Text>
{(() => {
  const playerMaterials = state.materials ?? {};
  const recipe = FORGE_RECIPES[selectedTier]?.[selectedEquipmentType];
  const missing = recipe ? getMissingMaterials(playerMaterials, recipe) : [];
  return (
    <View style={styles.materialsGrid}>
      {MATERIALS.map(m => {
        const owned = playerMaterials[m.id] ?? 0;
        const needed = recipe?.materials[m.id] ?? 0;
        const isMissing = needed > 0 && owned < needed;
        return (
          <View
            key={m.id}
            style={[styles.materialCard, isMissing && styles.materialCardMissing]}
          >
            <Text style={styles.materialIcon}>{m.icon}</Text>
            <Text style={[styles.materialName, isMissing && styles.materialNameMissing]}>
              {m.name}
            </Text>
            <Text style={[styles.materialCount, isMissing && styles.materialCountMissing]}>
              {owned}{needed > 0 ? `/${needed}` : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
})()}
```

Adicione os novos estilos ao `StyleSheet.create({...})`:

```ts
typeRow: {
  flexDirection: 'row',
  gap: 8,
  marginBottom: 8,
},
typeBtn: {
  flex: 1,
  paddingVertical: 8,
  paddingHorizontal: 4,
  borderRadius: theme.borderRadius.sm,
  backgroundColor: theme.colors.surfaceLight,
  alignItems: 'center',
},
typeBtnActive: {
  backgroundColor: theme.colors.primary,
},
typeBtnText: {
  color: theme.colors.textPrimary,
  fontSize: 12,
  fontWeight: '600',
},
materialsGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
},
materialCard: {
  flex: 1,
  minWidth: '45%',
  backgroundColor: theme.colors.surface,
  borderRadius: theme.borderRadius.md,
  padding: 10,
  alignItems: 'center',
  gap: 4,
  borderWidth: 1,
  borderColor: theme.colors.surfaceLight,
},
materialCardMissing: {
  borderColor: '#ef4444',
  backgroundColor: 'rgba(239,68,68,0.08)',
},
materialIcon: {
  fontSize: 22,
},
materialName: {
  fontSize: 11,
  color: theme.colors.textSecondary,
  textAlign: 'center',
},
materialNameMissing: {
  color: '#ef4444',
  fontWeight: '700',
},
materialCount: {
  fontSize: 16,
  fontWeight: '800',
  color: theme.colors.textPrimary,
},
materialCountMissing: {
  color: '#ef4444',
},
// Adicionar estas entradas dentro do StyleSheet.create({...}) existente, antes do fechamento `})`
```

---

- [ ] **Step 3: Rodar testes e type-check**

Run: `npm test -- --testPathPattern=BlacksmithMaterials.test`
Expected: PASS (7 testes)

Run: `npm test`
Expected: suite completa green

Run: `npx tsc --noEmit`
Expected: 0 erros

---

- [ ] **Step 4: Validação visual no browser (Playwright)**

Verificar em http://localhost:8081 → Vila → Ferreiro:
- Seção "Materiais" exibida abaixo do inventário com os 4 materiais (Ferro, Cristal, Essência, Pedra Estelar)
- Sem materiais: todos mostram "0" e os requeridos pela receita selecionada ficam em vermelho
- Após selecionar tier 2 e tipo "weapon": a receita iron:8 + essence:2 é refletida (materiais faltantes em destaque)
- Seletor de tipo (weapon/armor/accessory) muda os materiais destacados

---

- [ ] **Step 5: Commit**

```bash
git add src/screens/BlacksmithScreen.tsx src/__tests__/screens/BlacksmithMaterials.test.ts
git commit -m "feat(blacksmith): inventário de materiais com destaque de faltantes por receita"
```

---

# Task B6: Testes e2e

**Files:**
- Create: `tests/e2e/weekly_flow.spec.ts`
- Create: `tests/e2e/pantheon_flow.spec.ts`
- Create: `tests/e2e/guild_flow.spec.ts`
- Create: `tests/e2e/blacksmith_materials.spec.ts`

---

- [ ] **Step 1: Criar `tests/e2e/weekly_flow.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { loadClean, loadWithState, makeHero, makeState } from './helpers';
import { getWeeklySeed, pickWeeklyQuests } from '../../src/constants/weeklyQuests';
import { getWeeklyBoss } from '../../src/constants/weeklyBosses';

const seed = getWeeklySeed();
const quests = pickWeeklyQuests(seed);
const boss = getWeeklyBoss(seed);

test.describe('Weekly Flow', () => {
  test('Semanal card visível na Vila e navegável', async ({ page }) => {
    await loadClean(page);
    const card = page.locator('text=/[Dd]esafio [Ss]emanal/').first();
    await expect(card).toBeVisible();
    await card.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=/[Dd]esafio [Ss]emanal/').first()).toBeVisible();
  });

  test('WeeklyScreen exibe lista de quests', async ({ page }) => {
    await loadWithState(page, makeState({
      weeklyState: {
        seed,
        quests: quests.map(q => ({ id: q.id, claimed: false })),
        progress: {},
        allClaimed: false,
        bossDefeated: false,
      },
    }));
    await page.click('text=/[Dd]esafio [Ss]emanal/');
    await page.waitForTimeout(1000);
    // Verifica que pelo menos uma quest aparece (nome varia por seed)
    await expect(page.locator('text=/[Cc]ompletar|[Tt]reinar|[Ff]orjar|[Gg]anhar|[Dd]errotar|[Rr]ealizar/')).toBeVisible();
  });

  test('WeeklyScreen exibe card do boss com botão desabilitado', async ({ page }) => {
    await loadWithState(page, makeState({
      weeklyState: {
        seed,
        quests: quests.map(q => ({ id: q.id, claimed: false })),
        progress: {},
        allClaimed: false,
        bossDefeated: false,
      },
    }));
    await page.click('text=/[Dd]esafio [Ss]emanal/');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=/[Ee]m breve/').first()).toBeVisible();
  });

  test('WeeklyScreen botão Resgatar aparece quando quest completa', async ({ page }) => {
    const firstQuest = quests[0];
    await loadWithState(page, makeState({
      gold: 100,
      weeklyState: {
        seed,
        quests: quests.map(q => ({ id: q.id, claimed: false })),
        progress: { [firstQuest.tracker]: firstQuest.targetValue },
        allClaimed: false,
        bossDefeated: false,
      },
    }));
    await page.click('text=/[Dd]esafio [Ss]emanal/');
    await page.waitForTimeout(1000);
    // Resgatar button (gold icon with amount) should appear
    await expect(page.locator('text=🪙').first()).toBeVisible();
  });
});
```

---

- [ ] **Step 2: Criar `tests/e2e/pantheon_flow.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { loadWithState, makeHero, makeState } from './helpers';

test.describe('Pantheon Flow', () => {
  test('Panteão card visível na Vila', async ({ page }) => {
    await loadWithState(page, makeState({
      heroes: [makeHero({ id: 'h1' }), makeHero({ id: 'h2', name: 'Hero #2' }), makeHero({ id: 'h3', name: 'Hero #3' })],
      heroesRecruited: 3,
    }));
    const card = page.locator('text=Panteão').first();
    await expect(card).toBeVisible();
  });

  test('PantheonScreen não é mais ComingSoon', async ({ page }) => {
    await loadWithState(page, makeState({
      heroes: [makeHero({ id: 'h1' }), makeHero({ id: 'h2', name: 'Hero #2' }), makeHero({ id: 'h3', name: 'Hero #3' })],
      heroesRecruited: 3,
    }));
    await page.click('text=Panteão');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=/Panteão dos Heróis/').first()).toBeVisible();
    // Deve NÃO mostrar o placeholder ComingSoon ("EM DESENVOLVIMENTO")
    await expect(page.locator('text=/EM DESENVOLVIMENTO/')).not.toBeVisible();
  });

  test('PantheonScreen exibe heróis elegíveis', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 200,
      heroes: [
        makeHero({ id: 'h1', name: 'Aldric' }),
        makeHero({ id: 'h2', name: 'Bruna' }),
        makeHero({ id: 'h3', name: 'Carlos' }),
      ],
      heroesRecruited: 3,
    }));
    await page.click('text=Panteão');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Aldric').first()).toBeVisible();
    await expect(page.locator('text=Bruna').first()).toBeVisible();
    await expect(page.locator('text=Carlos').first()).toBeVisible();
  });

  test('Fusão de 3 heróis: seleção, confirmação, resultado', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 200,
      heroes: [
        makeHero({ id: 'h1', name: 'Aldric' }),
        makeHero({ id: 'h2', name: 'Bruna' }),
        makeHero({ id: 'h3', name: 'Carlos' }),
      ],
      heroesRecruited: 3,
    }));
    await page.click('text=Panteão');
    await page.waitForTimeout(1000);

    // Selecionar 3 heróis
    await page.click('text=Aldric');
    await page.waitForTimeout(300);
    await page.click('text=Bruna');
    await page.waitForTimeout(300);
    await page.click('text=Carlos');
    await page.waitForTimeout(300);

    // Botão de fusão deve estar ativo
    await expect(page.locator('text=Fundir Heróis').first()).toBeVisible();
    await page.click('text=Fundir Heróis');
    await page.waitForTimeout(500);

    // Modal de confirmação
    await expect(page.locator('text=Confirmar Fusão').first()).toBeVisible();
    await page.click('text=Fundir!');
    await page.waitForTimeout(1000);

    // Heróis originais devem ter sumido, novo herói com nome de fusão aparece
    await expect(page.locator('text=Aldric')).not.toBeVisible();
    await expect(page.locator('text=Bruna')).not.toBeVisible();
    await expect(page.locator('text=Carlos')).not.toBeVisible();
  });
});
```

---

- [ ] **Step 3: Criar `tests/e2e/guild_flow.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { loadWithState, makeHero, makeState } from './helpers';

test.describe('Guild Flow', () => {
  test('Guilda card visível na Vila', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 100,
      heroes: [makeHero({ id: 'h1' })],
      heroesRecruited: 1,
    }));
    const card = page.locator('text=Guilda').first();
    await expect(card).toBeVisible();
  });

  test('GuildScreen acessível a partir da Vila', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 100,
      heroes: [makeHero({ id: 'h1', name: 'Aldric' })],
      heroesRecruited: 1,
    }));
    await page.click('text=Guilda');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Guilda').first()).toBeVisible();
  });

  test('GuildScreen exibe heróis cadastrados', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 200,
      heroes: [
        makeHero({ id: 'h1', name: 'Aldric' }),
        makeHero({ id: 'h2', name: 'Bruna' }),
      ],
      heroesRecruited: 2,
    }));
    await page.click('text=Guilda');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Aldric').first()).toBeVisible();
    await expect(page.locator('text=Bruna').first()).toBeVisible();
  });

  test('Guilda não duplica mecânica do Shop', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 500,
      heroes: [makeHero({ id: 'h1', name: 'Aldric' })],
      heroesRecruited: 1,
    }));
    // Guilda usa recrutamento por gold direto
    await page.click('text=Guilda');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=/[Rr]ecrutar/').first()).toBeVisible();

    // Shop usa baús — navega de volta e verifica Loja
    await page.click('text=Vila');
    await page.waitForTimeout(500);
    await page.click('text=Loja');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=/[Bb]aú|[Cc]hest/i').first()).toBeVisible();
  });
});
```

---

- [ ] **Step 4: Criar `tests/e2e/blacksmith_materials.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { loadWithState, makeHero, makeState } from './helpers';

test.describe('Blacksmith Materials', () => {
  test('Ferreiro exibe seção de materiais', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 500,
      heroes: [makeHero({ id: 'h1' })],
      heroesRecruited: 1,
      materials: { iron: 2, crystal: 0, essence: 1, starstone: 0 },
    }));
    await page.click('text=Ferreiro');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Materiais').first()).toBeVisible();
  });

  test('Materiais mostram quantidades do estado', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 500,
      heroes: [makeHero({ id: 'h1' })],
      heroesRecruited: 1,
      materials: { iron: 5, crystal: 2, essence: 0, starstone: 0 },
    }));
    await page.click('text=Ferreiro');
    await page.waitForTimeout(1000);
    // iron = 5 deve aparecer
    await expect(page.locator('text=/Fragmento de Ferro/').first()).toBeVisible();
  });

  test('Material faltante fica destacado (tier 1 weapon requer iron:3)', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 500,
      heroes: [makeHero({ id: 'h1' })],
      heroesRecruited: 1,
      materials: { iron: 1 },  // falta 2 iron para a receita tier 1 weapon
    }));
    await page.click('text=Ferreiro');
    await page.waitForTimeout(1000);
    // A contagem deve mostrar "1/3" para iron
    await expect(page.locator('text=/1\\/3/').first()).toBeVisible();
  });

  test('Sem materiais, todos os campos mostram 0', async ({ page }) => {
    await loadWithState(page, makeState({
      gold: 500,
      heroes: [makeHero({ id: 'h1' })],
      heroesRecruited: 1,
    }));
    await page.click('text=Ferreiro');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Materiais').first()).toBeVisible();
    // iron 0/3
    await expect(page.locator('text=/0\\/3/').first()).toBeVisible();
  });
});
```

---

- [ ] **Step 5: Rodar testes e2e**

Run: `npm run test:e2e -- --grep "Weekly Flow|Pantheon Flow|Guild Flow|Blacksmith Materials"`
Expected: todos os testes passam (ou identificar quais falham para ajuste)

---

- [ ] **Step 6: Rodar suíte completa**

Run: `npm test`
Expected: suite unit completa green

Run: `npx tsc --noEmit`
Expected: 0 erros

Run: `npm run test:e2e`
Expected: todos os e2e existentes + novos verdes

---

- [ ] **Step 7: Commit final de e2e**

```bash
git add tests/e2e/weekly_flow.spec.ts tests/e2e/pantheon_flow.spec.ts tests/e2e/guild_flow.spec.ts tests/e2e/blacksmith_materials.spec.ts
git commit -m "test(e2e): cobertura Semanal, Panteão, Guilda e materiais do Ferreiro"
```

---

## Resumo de validação por tela

| Tela | Unit tests | e2e | Browser validado |
|---|---|---|---|
| WeeklyScreen | `useWeekly.test.ts` (4 testes) | `weekly_flow.spec.ts` (4 testes) | Step B1-Step 5 |
| PantheonScreen | `usePantheon.test.ts` (6 testes) | `pantheon_flow.spec.ts` (4 testes) | Step B3-Step 5 |
| GuildScreen | — (tela já testada) | `guild_flow.spec.ts` (4 testes) | Step B4-Step 2 |
| BlacksmithScreen | `BlacksmithMaterials.test.ts` (7 testes) | `blacksmith_materials.spec.ts` (4 testes) | Step B5-Step 4 |

## Critérios de aceitação

- Vila exibe 8 cards: Treinamento, Enfermaria, Ferreiro, Missões Diárias, Conquistas, Panteão, Desafio Semanal, Guilda.
- WeeklyScreen: quests com progresso real, botão Resgatar funcional, card do boss com botão desabilitado/"em breve".
- PantheonScreen: tela de fusão real (não ComingSoon), fluxo selecionar→confirmar→resultado funciona, bônus do panteão visíveis após fusão.
- GuildScreen: acessível da Vila, distinta do Shop.
- BlacksmithScreen: seção Materiais exibe state.materials; material faltante para receita selecionada destacado em vermelho.
- `npm test` verde, `npx tsc --noEmit` zero erros, `npm run test:e2e` verde.
