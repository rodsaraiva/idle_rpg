# Roadmap Features 2-5 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar habilidades ativas por classe, personalidades na batalha, panteão com fusão de heróis, e ciclo semanal — nesta ordem — sobre a infraestrutura de hooks/buffs criada pelas sinergias qualitativas.

**Architecture:** Cada feature adiciona handlers/efeitos em módulos separados que se plugam no sistema de buffs do `BattleState`. O Panteão e o ciclo semanal são features de estado/UI que não dependem do combate. Storage migrations incrementais (v6, v7) garantem compatibilidade com saves existentes.

**Tech Stack:** TypeScript, React Native (Expo), Jest. Sem novas dependências.

**Prerequisito:** O plano de sinergias qualitativas (`docs/superpowers/plans/2026-04-10-sinergias-qualitativas.md`) DEVE estar completo antes de iniciar este plano. As sinergias criam os tipos `SynergyId`, `BuffType`, `Buff`, `SynergyHandlers`, e os campos `activeSynergies`, `buffs`, `flags`, `handlers` no `BattleState`.

**Spec:** [`docs/superpowers/specs/2026-04-12-roadmap-5-melhorias-design.md`](../specs/2026-04-12-roadmap-5-melhorias-design.md)

---

## File Structure

### Phase A: Habilidades Ativas por Classe

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/constants/skills.ts` | Create | `SkillDef` type + 18 skill definitions + `getUnlockedSkills()` |
| `src/utils/skillEffects.ts` | Create | Lógica de execução de cada skill, integração com sistema de buffs |
| `src/utils/battleEngine.ts` | Modify | Estender `BuffType` com `dot`/`shield`/`revive`/`defMul`. Adicionar `skillCooldowns` ao `BattleState`. Chamar skill hooks em `processHeroTurn`/`processEnemyTurn`. |
| `src/components/HeroDetailsModal.tsx` | Modify | Seção de skills desbloqueadas/bloqueadas |
| `src/__tests__/utils/skillEffects.test.ts` | Create | Testes mecânicos de cada skill |
| `src/__tests__/constants/skills.test.ts` | Create | Testes de `getUnlockedSkills` |

### Phase B: Personalidades na Batalha

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/utils/personalityEffects.ts` | Create | Handlers de efeitos mecânicos por personalidade |
| `src/utils/battleEngine.ts` | Modify | Chamar personality hooks em `processHeroTurn` |
| `src/components/HeroDetailsModal.tsx` | Modify | Tooltip com efeito mecânico |
| `src/__tests__/utils/personalityEffects.test.ts` | Create | Testes mecânicos de cada personalidade |

### Phase C: Panteão + Fusão de Heróis

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/types/index.ts` | Modify | `Hero.stars`, `Hero.fusionBonus`, `GameState.pantheonFusions`, `GameState.pantheonBonuses`, `GameAction` FUSE/CONFIRM |
| `src/services/storage.ts` | Modify | Migration v6: campos de fusão |
| `src/context/pantheonHandler.ts` | Create | `handleFuseHeroes()`, `handleConfirmFusion()`, `calculatePantheonBonuses()` |
| `src/context/gameReducer.ts` | Modify | Despachar FUSE_HEROES e CONFIRM_FUSION |
| `src/utils/heroFactory.ts` | Modify | `createFusedHero()` com bônus de fusão |
| `src/components/HeroCard.tsx` | Modify | Indicador de estrelas |
| `src/screens/PantheonScreen.tsx` | Modify | Substituir placeholder por tela de fusão |
| `src/__tests__/context/pantheonHandler.test.ts` | Create | Testes de fusão, bônus, validação |
| `src/__tests__/services/storage.migration.test.ts` | Modify | Teste de migration v6 |

### Phase D: Ciclo Semanal

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/constants/weeklyQuests.ts` | Create | `WeeklyQuestDef`, pool de quests, `getWeeklySeed()`, `pickWeeklyQuests()` |
| `src/constants/weeklyBosses.ts` | Create | Pool de 5 boss templates |
| `src/types/index.ts` | Modify | `GameState.weeklyState`, `GameAction` CLAIM_WEEKLY_QUEST |
| `src/services/storage.ts` | Modify | Migration v7: `weeklyState` |
| `src/context/weeklyHandler.ts` | Create | `refreshWeeklyState()`, `updateWeeklyProgress()`, `claimWeeklyQuest()` |
| `src/context/tickHandler.ts` | Modify | Chamar `refreshWeeklyState` e `updateWeeklyProgress` |
| `src/context/gameReducer.ts` | Modify | Despachar CLAIM_WEEKLY_QUEST |
| `src/screens/WeeklyScreen.tsx` | Create | Tela de boss semanal + quests |
| `src/screens/VillageScreen.tsx` | Modify | Card "Desafio Semanal" |
| `src/__tests__/context/weeklyHandler.test.ts` | Create | Testes de reset, progresso, claim |

---

# Phase A: Habilidades Ativas por Classe

## Task A1: Estender tipos do BattleState para skills

**Files:**
- Modify: `src/utils/battleEngine.ts` (tipos `BuffType`, `BattleState`)

- [ ] **Step 1: Estender `BuffType` com novos tipos para skills**

Em `src/utils/battleEngine.ts`, localize o `BuffType` existente (adicionado pelas sinergias) e adicione os novos tipos:

```ts
export type BuffType =
  | 'atkMul'
  | 'critFlat'
  | 'rangeFlat'
  | 'defDebuffMul'
  | 'taunt'
  // Novos tipos para skills e personalidades:
  | 'dot'           // dano por turno (value = dano por round)
  | 'shield'        // absorve dano (value = % de redução no próximo hit)
  | 'defMul'        // multiplicador de DEF do alvo (value > 1 = buff, < 1 = debuff)
  | 'revive';       // marca herói para reviver (value = % HP ao reviver)
```

- [ ] **Step 2: Estender `Buff.source` para aceitar skills e personalidades**

Localize a interface `Buff` e mude o tipo de `source`:

```ts
export interface Buff {
  source: string;  // SynergyId | SkillId | PersonalitySource — string para extensibilidade
  type: BuffType;
  value: number;
  expiresAfterRound: number;
}
```

- [ ] **Step 3: Adicionar `skillCooldowns` ao `BattleState`**

Localize a interface `BattleState` e adicione:

```ts
export interface BattleState {
  // ... campos existentes (heroes, enemies, positions, buffs, flags, handlers, etc.)
  skillCooldowns: Record<string, number>; // "heroId_skillId" -> round em que fica disponível
  skillOnceUsed: Record<string, boolean>; // "heroId_skillId" -> true se já usada (skills "once per battle")
}
```

- [ ] **Step 4: Rodar testes para verificar que nada quebrou**

Run: `npm test`
Expected: Pode falhar em testes que constroem `BattleState` sem os novos campos. Se falhar, adicione `skillCooldowns: {}` e `skillOnceUsed: {}` nos `BattleState` construídos nos testes existentes.

- [ ] **Step 5: Commit**

```bash
git add src/utils/battleEngine.ts
git commit -m "feat(combat): estender BuffType e BattleState para skills"
```

---

## Task A2: Criar definições de skills em `src/constants/skills.ts`

**Files:**
- Create: `src/constants/skills.ts`
- Create: `src/__tests__/constants/skills.test.ts`

- [ ] **Step 1: Criar `src/constants/skills.ts` com tipo e 18 skills**

```ts
import { ClassId, Hero } from '../types';

export interface SkillDef {
  id: string;
  classId: ClassId;
  name: string;
  description: string;
  icon: string;
  cooldownRounds: number;    // 0 = sem cooldown fixo (trigger condicional), -1 = uma vez por batalha
  unlockThreshold: { stat: 'hp' | 'atk' | 'mp'; value: number };
}

export const SKILL_DEFS: SkillDef[] = [
  // === WARRIOR (stat-chave: atk) ===
  {
    id: 'WARRIOR_GOLPE_PESADO',
    classId: 'WARRIOR',
    name: 'Golpe Pesado',
    description: 'A cada 3 rounds, desfere um golpe com 150% de ATK que ignora 30% da defesa.',
    icon: '⚔️',
    cooldownRounds: 3,
    unlockThreshold: { stat: 'atk', value: 20 },
  },
  {
    id: 'WARRIOR_GRITO_DE_GUERRA',
    classId: 'WARRIOR',
    name: 'Grito de Guerra',
    description: 'Quando aliado cai abaixo de 40% HP, aliados em 2 hex ganham +20% ATK por 2 rounds.',
    icon: '📯',
    cooldownRounds: 0,
    unlockThreshold: { stat: 'atk', value: 50 },
  },
  {
    id: 'WARRIOR_FURIA',
    classId: 'WARRIOR',
    name: 'Fúria',
    description: 'Abaixo de 30% HP, ganha +50% ATK permanente mas perde 20% DEF.',
    icon: '🔥',
    cooldownRounds: -1,
    unlockThreshold: { stat: 'atk', value: 100 },
  },

  // === TANK (stat-chave: hp) ===
  {
    id: 'TANK_PROVOCAR',
    classId: 'TANK',
    name: 'Provocar',
    description: 'No início do combate, atrai inimigos com taunt +80 por 3 rounds.',
    icon: '🛡️',
    cooldownRounds: -1,
    unlockThreshold: { stat: 'hp', value: 20 },
  },
  {
    id: 'TANK_MURALHA',
    classId: 'TANK',
    name: 'Muralha',
    description: 'Adjacente a 2+ aliados, reduz dano recebido em 25% por 2 rounds.',
    icon: '🧱',
    cooldownRounds: 0,
    unlockThreshold: { stat: 'hp', value: 50 },
  },
  {
    id: 'TANK_ULTIMO_SUSPIRO',
    classId: 'TANK',
    name: 'Último Suspiro',
    description: 'Ao morrer, aliados ganham +30% DEF por 2 rounds.',
    icon: '💀',
    cooldownRounds: -1,
    unlockThreshold: { stat: 'hp', value: 100 },
  },

  // === ROGUE (stat-chave: atk) ===
  {
    id: 'ROGUE_GOLPE_FURTIVO',
    classId: 'ROGUE',
    name: 'Golpe Furtivo',
    description: 'Primeiro ataque do combate causa dano dobrado com crítico garantido.',
    icon: '🗡️',
    cooldownRounds: -1,
    unlockThreshold: { stat: 'atk', value: 20 },
  },
  {
    id: 'ROGUE_VENENO',
    classId: 'ROGUE',
    name: 'Veneno',
    description: '30% de chance de aplicar veneno (DoT) no alvo por 2 rounds.',
    icon: '🧪',
    cooldownRounds: 0,
    unlockThreshold: { stat: 'atk', value: 50 },
  },
  {
    id: 'ROGUE_EXECUCAO',
    classId: 'ROGUE',
    name: 'Execução',
    description: 'Contra alvo com <20% HP, dano x2.5 ignorando defesa.',
    icon: '💀',
    cooldownRounds: 0,
    unlockThreshold: { stat: 'atk', value: 100 },
  },

  // === ARCHER (stat-chave: atk) ===
  {
    id: 'ARCHER_TIRO_CERTEIRO',
    classId: 'ARCHER',
    name: 'Tiro Certeiro',
    description: 'A cada 3 rounds, ignora evasão e ganha +30% chance de crítico.',
    icon: '🎯',
    cooldownRounds: 3,
    unlockThreshold: { stat: 'atk', value: 20 },
  },
  {
    id: 'ARCHER_CHUVA_DE_FLECHAS',
    classId: 'ARCHER',
    name: 'Chuva de Flechas',
    description: 'A cada 5 rounds, 50% do ATK em todos os inimigos em área de 2 hex.',
    icon: '🌧️',
    cooldownRounds: 5,
    unlockThreshold: { stat: 'atk', value: 50 },
  },
  {
    id: 'ARCHER_TIRO_PERFURANTE',
    classId: 'ARCHER',
    name: 'Tiro Perfurante',
    description: 'Contra alvo com DEF > 20, ignora 60% da defesa.',
    icon: '🏹',
    cooldownRounds: 0,
    unlockThreshold: { stat: 'atk', value: 100 },
  },

  // === MAGE (stat-chave: mp) ===
  {
    id: 'MAGE_BOLA_DE_FOGO',
    classId: 'MAGE',
    name: 'Bola de Fogo',
    description: 'A cada 3 rounds, 80% do ATK no alvo + 40% em adjacentes.',
    icon: '🔥',
    cooldownRounds: 3,
    unlockThreshold: { stat: 'mp', value: 20 },
  },
  {
    id: 'MAGE_ESCUDO_ARCANO',
    classId: 'MAGE',
    name: 'Escudo Arcano',
    description: 'Ao receber dano, reduz 50% do próximo dano. Cooldown de 4 rounds.',
    icon: '🔮',
    cooldownRounds: 4,
    unlockThreshold: { stat: 'mp', value: 50 },
  },
  {
    id: 'MAGE_METEORO',
    classId: 'MAGE',
    name: 'Meteoro',
    description: 'Uma vez por batalha com 3+ inimigos vivos, 100% ATK em área de 3 hex.',
    icon: '☄️',
    cooldownRounds: -1,
    unlockThreshold: { stat: 'mp', value: 100 },
  },

  // === HEALER (stat-chave: mp) ===
  {
    id: 'HEALER_CURA_MAIOR',
    classId: 'HEALER',
    name: 'Cura Maior',
    description: 'Aliado abaixo de 40% HP recebe cura de 50% do HP máximo.',
    icon: '💚',
    cooldownRounds: 0,
    unlockThreshold: { stat: 'mp', value: 20 },
  },
  {
    id: 'HEALER_PURIFICACAO',
    classId: 'HEALER',
    name: 'Purificação',
    description: 'Remove debuffs de aliado e cura 20% HP.',
    icon: '✨',
    cooldownRounds: 0,
    unlockThreshold: { stat: 'mp', value: 50 },
  },
  {
    id: 'HEALER_RESSURREICAO',
    classId: 'HEALER',
    name: 'Ressurreição',
    description: 'Uma vez por batalha, revive aliado caído com 30% HP.',
    icon: '🕊️',
    cooldownRounds: -1,
    unlockThreshold: { stat: 'mp', value: 100 },
  },
];

/** Returns skills for a given class */
export function getClassSkills(classId: ClassId): SkillDef[] {
  return SKILL_DEFS.filter(s => s.classId === classId);
}

/** Returns unlocked skills for a hero based on trainingCount */
export function getUnlockedSkills(hero: Hero): SkillDef[] {
  if (!hero.classId || !hero.trainingCount) return [];
  const classSkills = getClassSkills(hero.classId);

  return classSkills.filter(skill => {
    const statKey = skill.unlockThreshold.stat;
    const trained = hero.trainingCount?.[statKey] ?? 0;
    return trained >= skill.unlockThreshold.value;
  });
}

/** Returns all skills for a hero with unlock status */
export function getSkillsWithStatus(hero: Hero): { skill: SkillDef; unlocked: boolean; progress: number }[] {
  if (!hero.classId) return [];
  const classSkills = getClassSkills(hero.classId);

  return classSkills.map(skill => {
    const statKey = skill.unlockThreshold.stat;
    const trained = hero.trainingCount?.[statKey] ?? 0;
    const threshold = skill.unlockThreshold.value;
    return {
      skill,
      unlocked: trained >= threshold,
      progress: Math.min(1, trained / threshold),
    };
  });
}
```

- [ ] **Step 2: Criar teste `src/__tests__/constants/skills.test.ts`**

```ts
import { getClassSkills, getUnlockedSkills, getSkillsWithStatus, SKILL_DEFS } from '../../constants/skills';
import { Hero, HeroTask } from '../../types';

const makeHero = (classId: string, trainingCount: { hp: number; atk: number; mp: number }): Hero => ({
  id: 'h1',
  name: 'Test',
  hpMax: 50,
  hpCurrent: 50,
  atk: 10,
  mp: 5,
  defense: 5,
  crit: 10,
  agility: 5,
  currentTask: HeroTask.IDLE,
  classId: classId as any,
  trainingCount,
  trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
});

describe('skills', () => {
  test('each class has exactly 3 skills', () => {
    const classes = ['WARRIOR', 'TANK', 'ROGUE', 'ARCHER', 'MAGE', 'HEALER'] as const;
    for (const c of classes) {
      expect(getClassSkills(c)).toHaveLength(3);
    }
  });

  test('total skills is 18', () => {
    expect(SKILL_DEFS).toHaveLength(18);
  });

  test('getUnlockedSkills returns empty for untrained hero', () => {
    const hero = makeHero('WARRIOR', { hp: 0, atk: 0, mp: 0 });
    expect(getUnlockedSkills(hero)).toHaveLength(0);
  });

  test('getUnlockedSkills returns skill 1 at threshold 20', () => {
    const hero = makeHero('WARRIOR', { hp: 0, atk: 20, mp: 0 });
    const skills = getUnlockedSkills(hero);
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe('WARRIOR_GOLPE_PESADO');
  });

  test('getUnlockedSkills returns all 3 at threshold 100', () => {
    const hero = makeHero('WARRIOR', { hp: 0, atk: 100, mp: 0 });
    expect(getUnlockedSkills(hero)).toHaveLength(3);
  });

  test('getUnlockedSkills uses correct stat per class', () => {
    const mage = makeHero('MAGE', { hp: 0, atk: 100, mp: 0 });
    expect(getUnlockedSkills(mage)).toHaveLength(0); // mage uses mp, not atk

    const mage2 = makeHero('MAGE', { hp: 0, atk: 0, mp: 20 });
    expect(getUnlockedSkills(mage2)).toHaveLength(1);
  });

  test('getSkillsWithStatus returns progress fraction', () => {
    const hero = makeHero('WARRIOR', { hp: 0, atk: 10, mp: 0 });
    const statuses = getSkillsWithStatus(hero);
    expect(statuses).toHaveLength(3);
    expect(statuses[0].unlocked).toBe(false);
    expect(statuses[0].progress).toBe(0.5); // 10/20
  });

  test('getUnlockedSkills returns empty for hero without classId', () => {
    const hero = makeHero('WARRIOR', { hp: 0, atk: 100, mp: 0 });
    hero.classId = undefined;
    expect(getUnlockedSkills(hero)).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Rodar teste**

Run: `npm test -- --testPathPattern=skills.test`
Expected: PASS (7 testes)

- [ ] **Step 4: Commit**

```bash
git add src/constants/skills.ts src/__tests__/constants/skills.test.ts
git commit -m "feat(skills): definições de 18 skills e getUnlockedSkills"
```

---

## Task A3: Criar lógica de execução de skills em `src/utils/skillEffects.ts`

**Files:**
- Create: `src/utils/skillEffects.ts`
- Create: `src/__tests__/utils/skillEffects.test.ts`

- [ ] **Step 1: Criar `src/utils/skillEffects.ts`**

```ts
import { Hero, MissionAction } from '../types';
import { BattleState, BattleEnemy, Buff } from './battleEngine';
import { getUnlockedSkills, SkillDef } from '../constants/skills';
import { GameMath } from './gameMath';

/** Check if a skill is off cooldown and available */
function isSkillReady(state: BattleState, heroId: string, skill: SkillDef): boolean {
  const key = `${heroId}_${skill.id}`;

  // Once-per-battle skills
  if (skill.cooldownRounds === -1) {
    return !state.skillOnceUsed[key];
  }

  // No fixed cooldown (conditional triggers)
  if (skill.cooldownRounds === 0) return true;

  // Cooldown-based
  const readyAt = state.skillCooldowns[key] ?? 0;
  return state.rounds >= readyAt;
}

/** Mark a skill as used (sets cooldown or once-used flag) */
function markSkillUsed(state: BattleState, heroId: string, skill: SkillDef): void {
  const key = `${heroId}_${skill.id}`;
  if (skill.cooldownRounds === -1) {
    state.skillOnceUsed[key] = true;
  } else if (skill.cooldownRounds > 0) {
    state.skillCooldowns[key] = state.rounds + skill.cooldownRounds;
  }
}

/** Add a buff to an actor */
function addBuff(state: BattleState, actorId: string, buff: Buff): void {
  if (!state.buffs[actorId]) state.buffs[actorId] = [];
  // Refresh if same source+type exists
  const existing = state.buffs[actorId].findIndex(b => b.source === buff.source && b.type === buff.type);
  if (existing >= 0) {
    state.buffs[actorId][existing] = buff;
  } else {
    state.buffs[actorId].push(buff);
  }
}

/** Push a skill action to the battle log */
function logSkill(state: BattleState, hero: Hero, skillName: string, text: string): void {
  state.actions.push({
    round: state.rounds,
    actorType: 'hero',
    actorId: hero.id,
    actorName: hero.name,
    actionType: 'hit',
    text: `✦ ${hero.name} — ${skillName}: ${text}`,
  });
  state.log.push(`✦ ${hero.name} — ${skillName}: ${text}`);
}

// ─── Skill implementations ───

function tryGolpePesado(hero: Hero, target: BattleEnemy, state: BattleState, rng: () => number): boolean {
  const skill = { id: 'WARRIOR_GOLPE_PESADO', cooldownRounds: 3 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  const dmg = Math.max(1, Math.floor(hero.atk * 1.5 * (1 - (target.defense ?? 0) * 0.7 / ((target.defense ?? 0) * 0.7 + 50))));
  target.hp = Math.max(0, target.hp - dmg);
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Golpe Pesado', `${dmg} de dano (ignora 30% DEF)`);

  if (target.hp <= 0) {
    target.alive = false;
    delete state.enemyPositions[target.id];
    state.actions.push({
      round: state.rounds, actorType: 'hero', actorId: hero.id,
      actorName: hero.name, actionType: 'defeat', targetId: target.id,
      text: `${target.id} foi derrotado!`,
    });
  }
  return true;
}

function tryGritoDeGuerra(hero: Hero, state: BattleState): boolean {
  // Trigger: aliado abaixo de 40% HP
  const injured = state.heroes.find(h => h.id !== hero.id && h.hpCurrent > 0 && h.hpCurrent / h.hpMax < 0.4);
  if (!injured) return false;

  // Check if already active (avoid spam)
  const existing = state.buffs[hero.id]?.find(b => b.source === 'WARRIOR_GRITO_DE_GUERRA' && b.type === 'atkMul');
  if (existing && existing.expiresAfterRound >= state.rounds) return false;

  const heroPos = state.heroPositions[hero.id] ?? 0;
  for (const ally of state.heroes.filter(h => h.hpCurrent > 0)) {
    const allyPos = state.heroPositions[ally.id] ?? 0;
    if (GameMath.getHexDistance(heroPos, allyPos) <= 2) {
      addBuff(state, ally.id, {
        source: 'WARRIOR_GRITO_DE_GUERRA', type: 'atkMul',
        value: 1.20, expiresAfterRound: state.rounds + 2,
      });
    }
  }
  logSkill(state, hero, 'Grito de Guerra', 'aliados próximos +20% ATK');
  return false; // Doesn't consume turn
}

function tryFuria(hero: Hero, state: BattleState): boolean {
  if (hero.hpCurrent / hero.hpMax >= 0.3) return false;
  const skill = { id: 'WARRIOR_FURIA', cooldownRounds: -1 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  addBuff(state, hero.id, {
    source: 'WARRIOR_FURIA', type: 'atkMul',
    value: 1.50, expiresAfterRound: -1,
  });
  addBuff(state, hero.id, {
    source: 'WARRIOR_FURIA', type: 'defMul',
    value: 0.80, expiresAfterRound: -1,
  });
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Fúria', '+50% ATK, -20% DEF permanente');
  return false;
}

function tryProvocar(hero: Hero, state: BattleState): boolean {
  // Only triggers on round 1
  if (state.rounds !== 1) return false;
  const skill = { id: 'TANK_PROVOCAR', cooldownRounds: -1 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  addBuff(state, hero.id, {
    source: 'TANK_PROVOCAR', type: 'taunt',
    value: 80, expiresAfterRound: state.rounds + 3,
  });
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Provocar', 'taunt +80 por 3 rounds');
  return false;
}

function tryMuralha(hero: Hero, state: BattleState): boolean {
  const heroPos = state.heroPositions[hero.id] ?? 0;
  const adjacentAllies = state.heroes.filter(h =>
    h.id !== hero.id && h.hpCurrent > 0 &&
    GameMath.getHexDistance(heroPos, state.heroPositions[h.id] ?? 99) <= 1
  );
  if (adjacentAllies.length < 2) return false;

  // Avoid spam
  const existing = state.buffs[hero.id]?.find(b => b.source === 'TANK_MURALHA' && b.type === 'shield');
  if (existing && existing.expiresAfterRound >= state.rounds) return false;

  addBuff(state, hero.id, {
    source: 'TANK_MURALHA', type: 'shield',
    value: 0.25, expiresAfterRound: state.rounds + 2,
  });
  logSkill(state, hero, 'Muralha', '-25% dano recebido por 2 rounds');
  return false;
}

function tryUltimoSuspiro(hero: Hero, state: BattleState): void {
  // Called when hero dies — not during normal turn
  for (const ally of state.heroes.filter(h => h.id !== hero.id && h.hpCurrent > 0)) {
    addBuff(state, ally.id, {
      source: 'TANK_ULTIMO_SUSPIRO', type: 'defMul',
      value: 1.30, expiresAfterRound: state.rounds + 2,
    });
  }
  logSkill(state, hero, 'Último Suspiro', 'aliados +30% DEF por 2 rounds');
}

function tryGolpeFurtivo(hero: Hero, target: BattleEnemy, state: BattleState, rng: () => number): boolean {
  if (state.rounds !== 1) return false;
  const skill = { id: 'ROGUE_GOLPE_FURTIVO', cooldownRounds: -1 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  const dmg = Math.max(1, Math.floor(hero.atk * 2.0));
  target.hp = Math.max(0, target.hp - dmg);
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Golpe Furtivo', `${dmg} de dano (crítico garantido)`);

  if (target.hp <= 0) {
    target.alive = false;
    delete state.enemyPositions[target.id];
    state.actions.push({
      round: state.rounds, actorType: 'hero', actorId: hero.id,
      actorName: hero.name, actionType: 'defeat', targetId: target.id,
      text: `${target.id} foi derrotado!`,
    });
  }
  return true; // Consumes turn
}

function tryVeneno(target: BattleEnemy, state: BattleState, hero: Hero, rng: () => number): void {
  if (rng() >= 0.3) return;
  addBuff(state, target.id, {
    source: 'ROGUE_VENENO', type: 'dot',
    value: Math.max(1, Math.floor(hero.atk * 0.3)),
    expiresAfterRound: state.rounds + 2,
  });
  logSkill(state, hero, 'Veneno', `aplicou veneno em ${target.id}`);
}

function tryExecucao(hero: Hero, target: BattleEnemy, state: BattleState): boolean {
  const targetHpPct = target.hp / target.maxHp;
  if (targetHpPct >= 0.2) return false;

  const dmg = Math.max(1, Math.floor(hero.atk * 2.5));
  target.hp = Math.max(0, target.hp - dmg);
  logSkill(state, hero, 'Execução', `${dmg} de dano (ignora defesa)`);

  if (target.hp <= 0) {
    target.alive = false;
    delete state.enemyPositions[target.id];
    state.actions.push({
      round: state.rounds, actorType: 'hero', actorId: hero.id,
      actorName: hero.name, actionType: 'defeat', targetId: target.id,
      text: `${target.id} foi derrotado!`,
    });
  }
  return true;
}

function tryTiroCerteiro(hero: Hero, target: BattleEnemy, state: BattleState, rng: () => number): boolean {
  const skill = { id: 'ARCHER_TIRO_CERTEIRO', cooldownRounds: 3 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  // Ignores evasion, +30% crit
  const critChance = GameMath.calcCritChance(hero.classId, hero.crit) + 0.30;
  const isCrit = rng() < critChance;
  const dmg = GameMath.calcDamage(hero.atk, target.defense, isCrit);
  target.hp = Math.max(0, target.hp - dmg);
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Tiro Certeiro', `${dmg} de dano${isCrit ? ' (CRIT)' : ''}`);

  if (target.hp <= 0) {
    target.alive = false;
    delete state.enemyPositions[target.id];
    state.actions.push({
      round: state.rounds, actorType: 'hero', actorId: hero.id,
      actorName: hero.name, actionType: 'defeat', targetId: target.id,
      text: `${target.id} foi derrotado!`,
    });
  }
  return true;
}

function tryChuvaFlechas(hero: Hero, state: BattleState): boolean {
  const skill = { id: 'ARCHER_CHUVA_DE_FLECHAS', cooldownRounds: 5 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  const heroPos = state.heroPositions[hero.id] ?? 0;
  const aliveEnemies = state.enemies.filter(e => e.alive);
  // Pick first alive enemy as center, hit all within 2 hex
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

function tryTiroPerfurante(hero: Hero, target: BattleEnemy, state: BattleState): boolean {
  if ((target.defense ?? 0) <= 20) return false;

  const effectiveDef = (target.defense ?? 0) * 0.4; // ignora 60%
  const dmg = GameMath.calcDamage(hero.atk, effectiveDef, false);
  target.hp = Math.max(0, target.hp - dmg);
  logSkill(state, hero, 'Tiro Perfurante', `${dmg} de dano (ignora 60% DEF)`);

  if (target.hp <= 0) {
    target.alive = false;
    delete state.enemyPositions[target.id];
    state.actions.push({
      round: state.rounds, actorType: 'hero', actorId: hero.id,
      actorName: hero.name, actionType: 'defeat', targetId: target.id,
      text: `${target.id} foi derrotado!`,
    });
  }
  return true;
}

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

  if (target.hp <= 0) {
    target.alive = false;
    delete state.enemyPositions[target.id];
  }

  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Bola de Fogo', `${mainDmg} no alvo + ${splashCount} adjacentes`);
  return true;
}

function tryEscudoArcano(hero: Hero, state: BattleState): void {
  // Called when hero takes damage — not during normal turn
  const skill = { id: 'MAGE_ESCUDO_ARCANO', cooldownRounds: 4 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return;

  addBuff(state, hero.id, {
    source: 'MAGE_ESCUDO_ARCANO', type: 'shield',
    value: 0.50, expiresAfterRound: state.rounds + 1,
  });
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Escudo Arcano', '-50% dano no próximo hit');
}

function tryMeteoro(hero: Hero, state: BattleState): boolean {
  const aliveEnemies = state.enemies.filter(e => e.alive);
  if (aliveEnemies.length < 3) return false;

  const skill = { id: 'MAGE_METEORO', cooldownRounds: -1 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  // Hit all enemies in 3 hex radius from center
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

function tryCuraMaior(hero: Hero, state: BattleState): boolean {
  const injured = state.heroes
    .filter(h => h.id !== hero.id && h.hpCurrent > 0 && h.hpCurrent / h.hpMax < 0.4)
    .sort((a, b) => a.hpCurrent / a.hpMax - b.hpCurrent / b.hpMax)[0];
  if (!injured) return false;

  const healAmount = Math.floor(injured.hpMax * 0.5);
  const prevHp = injured.hpCurrent;
  injured.hpCurrent = Math.min(injured.hpMax, injured.hpCurrent + healAmount);
  const actual = injured.hpCurrent - prevHp;

  state.actions.push({
    round: state.rounds, actorType: 'hero', actorId: hero.id,
    actorName: hero.name, actionType: 'heal', targetId: injured.id,
    amount: actual, text: `✦ ${hero.name} — Cura Maior: ${actual} HP em ${injured.name}`,
  });
  state.log.push(`✦ ${hero.name} — Cura Maior: ${actual} HP em ${injured.name}`);
  return true; // Consumes turn (replaces normal heal)
}

function tryPurificacao(hero: Hero, state: BattleState): boolean {
  // Find ally with debuffs
  const allyWithDebuff = state.heroes.find(h =>
    h.id !== hero.id && h.hpCurrent > 0 &&
    state.buffs[h.id]?.some(b => b.type === 'dot' || b.type === 'defDebuffMul' || (b.type === 'defMul' && b.value < 1))
  );
  if (!allyWithDebuff) return false;

  // Remove debuffs
  state.buffs[allyWithDebuff.id] = (state.buffs[allyWithDebuff.id] ?? []).filter(
    b => b.type !== 'dot' && b.type !== 'defDebuffMul' && !(b.type === 'defMul' && b.value < 1)
  );

  // Heal 20%
  const healAmount = Math.floor(allyWithDebuff.hpMax * 0.2);
  allyWithDebuff.hpCurrent = Math.min(allyWithDebuff.hpMax, allyWithDebuff.hpCurrent + healAmount);

  logSkill(state, hero, 'Purificação', `limpou debuffs de ${allyWithDebuff.name} e curou ${healAmount} HP`);
  return true;
}

function tryRessurreicao(hero: Hero, state: BattleState): boolean {
  const deadAlly = state.heroes.find(h => h.id !== hero.id && h.hpCurrent <= 0);
  if (!deadAlly) return false;

  const skill = { id: 'HEALER_RESSURREICAO', cooldownRounds: -1 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  deadAlly.hpCurrent = Math.max(1, Math.floor(deadAlly.hpMax * 0.3));
  // Restore position
  const heroPos = state.heroPositions[hero.id] ?? 45;
  state.heroPositions[deadAlly.id] = heroPos; // Next to healer

  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Ressurreição', `reviveu ${deadAlly.name} com ${deadAlly.hpCurrent} HP`);
  return true;
}

// ─── Public API ───

/**
 * Execute pre-attack skills for a hero (called before normal attack in processHeroTurn).
 * Returns true if the skill consumed the hero's turn.
 */
export function executePreAttackSkills(
  hero: Hero,
  target: BattleEnemy | undefined,
  state: BattleState,
  rng: () => number
): boolean {
  const skills = getUnlockedSkills(hero);
  if (skills.length === 0) return false;
  const skillIds = new Set(skills.map(s => s.id));

  // Healer skills (priority: Ressurreição > Purificação > Cura Maior)
  if (hero.classId === 'HEALER') {
    if (skillIds.has('HEALER_RESSURREICAO') && tryRessurreicao(hero, state)) return true;
    if (skillIds.has('HEALER_PURIFICACAO') && tryPurificacao(hero, state)) return true;
    if (skillIds.has('HEALER_CURA_MAIOR') && tryCuraMaior(hero, state)) return true;
  }

  if (!target) return false;

  // Warrior passive skills (don't consume turn)
  if (hero.classId === 'WARRIOR') {
    if (skillIds.has('WARRIOR_FURIA')) tryFuria(hero, state);
    if (skillIds.has('WARRIOR_GRITO_DE_GUERRA')) tryGritoDeGuerra(hero, state);
    if (skillIds.has('WARRIOR_GOLPE_PESADO') && tryGolpePesado(hero, target, state, rng)) return true;
  }

  // Tank passive skills
  if (hero.classId === 'TANK') {
    if (skillIds.has('TANK_PROVOCAR')) tryProvocar(hero, state);
    if (skillIds.has('TANK_MURALHA')) tryMuralha(hero, state);
  }

  // Rogue skills
  if (hero.classId === 'ROGUE') {
    if (skillIds.has('ROGUE_GOLPE_FURTIVO') && tryGolpeFurtivo(hero, target, state, rng)) return true;
    if (skillIds.has('ROGUE_EXECUCAO') && tryExecucao(hero, target, state)) return true;
  }

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

  return false;
}

/**
 * Called after a hero takes damage. Triggers reactive skills.
 */
export function onHeroDamagedSkills(hero: Hero, state: BattleState): void {
  const skills = getUnlockedSkills(hero);
  if (skills.length === 0) return;
  const skillIds = new Set(skills.map(s => s.id));

  if (hero.classId === 'MAGE' && skillIds.has('MAGE_ESCUDO_ARCANO')) {
    tryEscudoArcano(hero, state);
  }
}

/**
 * Called when a hero dies. Triggers death skills.
 */
export function onHeroDeathSkills(hero: Hero, state: BattleState): void {
  const skills = getUnlockedSkills(hero);
  if (skills.length === 0) return;
  const skillIds = new Set(skills.map(s => s.id));

  if (hero.classId === 'TANK' && skillIds.has('TANK_ULTIMO_SUSPIRO')) {
    tryUltimoSuspiro(hero, state);
  }
}

/**
 * Called after a successful hit by a Rogue. Triggers post-hit skills.
 */
export function onRogueHitSkills(hero: Hero, target: BattleEnemy, state: BattleState, rng: () => number): void {
  const skills = getUnlockedSkills(hero);
  if (skills.length === 0) return;
  const skillIds = new Set(skills.map(s => s.id));

  if (skillIds.has('ROGUE_VENENO')) {
    tryVeneno(target, state, hero, rng);
  }
}

/**
 * Process DoT (damage over time) buffs at the start of each round.
 */
export function processDoTBuffs(state: BattleState): void {
  for (const enemy of state.enemies.filter(e => e.alive)) {
    const dots = state.buffs[enemy.id]?.filter(b => b.type === 'dot' && b.expiresAfterRound >= state.rounds) ?? [];
    for (const dot of dots) {
      enemy.hp = Math.max(0, enemy.hp - dot.value);
      state.log.push(`${enemy.id} sofreu ${dot.value} de veneno`);
      state.actions.push({
        round: state.rounds, actorType: 'enemy', actorId: enemy.id,
        actionType: 'hit', text: `${enemy.id} sofreu ${dot.value} de veneno`,
        amount: dot.value,
      });
      if (enemy.hp <= 0) {
        enemy.alive = false;
        delete state.enemyPositions[enemy.id];
      }
    }
  }
}

/**
 * Get effective defense considering shield buffs.
 */
export function getShieldReduction(state: BattleState, targetId: string): number {
  const shields = state.buffs[targetId]?.filter(b => b.type === 'shield' && b.expiresAfterRound >= state.rounds) ?? [];
  if (shields.length === 0) return 0;
  // Use highest shield value, then consume it
  const best = shields.reduce((max, b) => b.value > max.value ? b : max);
  // Remove the shield after use
  state.buffs[targetId] = state.buffs[targetId].filter(b => b !== best);
  return best.value;
}

/**
 * Get effective defense multiplier from defMul buffs.
 */
export function getDefMulProduct(state: BattleState, targetId: string): number {
  const muls = state.buffs[targetId]?.filter(b => b.type === 'defMul' && b.expiresAfterRound >= state.rounds) ?? [];
  return muls.reduce((acc, b) => acc * b.value, 1);
}
```

- [ ] **Step 2: Criar teste `src/__tests__/utils/skillEffects.test.ts`**

```ts
import { executePreAttackSkills, onHeroDamagedSkills, onHeroDeathSkills, onRogueHitSkills, processDoTBuffs, getShieldReduction } from '../../utils/skillEffects';
import { BattleState, BattleEnemy } from '../../utils/battleEngine';
import { Hero, HeroTask } from '../../types';

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

const fixedRng = (val: number) => () => val;

describe('skillEffects', () => {
  describe('Warrior skills', () => {
    test('Golpe Pesado triggers every 3 rounds and consumes turn', () => {
      const hero = makeHero({ classId: 'WARRIOR', trainingCount: { hp: 0, atk: 20, mp: 0 } });
      const enemy = makeEnemy();
      const state = makeState([hero], [enemy], 1);

      const consumed = executePreAttackSkills(hero, enemy, state, fixedRng(0.5));
      expect(consumed).toBe(true);
      expect(enemy.hp).toBeLessThan(50);
      expect(state.skillCooldowns['h1_WARRIOR_GOLPE_PESADO']).toBe(4); // round 1 + 3
    });

    test('Fúria triggers below 30% HP once per battle', () => {
      const hero = makeHero({ classId: 'WARRIOR', hpCurrent: 20, trainingCount: { hp: 0, atk: 100, mp: 0 } });
      const enemy = makeEnemy();
      const state = makeState([hero], [enemy]);

      executePreAttackSkills(hero, enemy, state, fixedRng(0.5));
      expect(state.buffs['h1']).toBeDefined();
      const atkBuff = state.buffs['h1'].find(b => b.source === 'WARRIOR_FURIA' && b.type === 'atkMul');
      expect(atkBuff?.value).toBe(1.50);
      expect(state.skillOnceUsed['h1_WARRIOR_FURIA']).toBe(true);
    });
  });

  describe('Rogue skills', () => {
    test('Golpe Furtivo only on round 1, double damage', () => {
      const hero = makeHero({ id: 'r1', classId: 'ROGUE', atk: 20, trainingCount: { hp: 0, atk: 20, mp: 0 } });
      const enemy = makeEnemy({ hp: 100, maxHp: 100 });
      const state = makeState([hero], [enemy], 1);

      const consumed = executePreAttackSkills(hero, enemy, state, fixedRng(0.5));
      expect(consumed).toBe(true);
      expect(enemy.hp).toBe(60); // 100 - 20*2.0
    });

    test('Veneno applies DoT with 30% chance', () => {
      const hero = makeHero({ classId: 'ROGUE', trainingCount: { hp: 0, atk: 50, mp: 0 } });
      const enemy = makeEnemy();
      const state = makeState([hero], [enemy]);

      onRogueHitSkills(hero, enemy, state, fixedRng(0.1)); // rng < 0.3 → triggers
      const dot = state.buffs['e1']?.find(b => b.type === 'dot');
      expect(dot).toBeDefined();
      expect(dot?.value).toBeGreaterThan(0);
    });
  });

  describe('Tank skills', () => {
    test('Último Suspiro buffs allies on death', () => {
      const tank = makeHero({ id: 'tank1', classId: 'TANK', hpCurrent: 0, trainingCount: { hp: 100, atk: 0, mp: 0 } });
      const ally = makeHero({ id: 'ally1', classId: 'WARRIOR' });
      const state = makeState([tank, ally], [makeEnemy()]);

      onHeroDeathSkills(tank, state);
      const defBuff = state.buffs['ally1']?.find(b => b.source === 'TANK_ULTIMO_SUSPIRO');
      expect(defBuff?.type).toBe('defMul');
      expect(defBuff?.value).toBe(1.30);
    });
  });

  describe('Healer skills', () => {
    test('Ressurreição revives dead ally once per battle', () => {
      const healer = makeHero({ id: 'healer1', classId: 'HEALER', trainingCount: { hp: 0, atk: 0, mp: 100 } });
      const dead = makeHero({ id: 'dead1', classId: 'WARRIOR', hpCurrent: 0 });
      const state = makeState([healer, dead], [makeEnemy()]);

      const consumed = executePreAttackSkills(healer, undefined, state, fixedRng(0.5));
      expect(consumed).toBe(true);
      expect(dead.hpCurrent).toBe(30); // 30% of 100
      expect(state.skillOnceUsed['healer1_HEALER_RESSURREICAO']).toBe(true);

      // Second time should not trigger
      dead.hpCurrent = 0;
      const consumed2 = executePreAttackSkills(healer, undefined, state, fixedRng(0.5));
      expect(dead.hpCurrent).toBe(0); // Not revived again
    });
  });

  describe('Mage skills', () => {
    test('Escudo Arcano triggers on damage and provides shield', () => {
      const mage = makeHero({ classId: 'MAGE', trainingCount: { hp: 0, atk: 0, mp: 50 } });
      const state = makeState([mage], [makeEnemy()]);

      onHeroDamagedSkills(mage, state);
      const shield = state.buffs['h1']?.find(b => b.type === 'shield');
      expect(shield?.value).toBe(0.50);
    });
  });

  describe('DoT processing', () => {
    test('processDoTBuffs applies damage and kills', () => {
      const enemy = makeEnemy({ hp: 5, maxHp: 50 });
      const state = makeState([makeHero({ classId: 'WARRIOR' })], [enemy]);
      state.buffs['e1'] = [{ source: 'ROGUE_VENENO', type: 'dot', value: 10, expiresAfterRound: 3 }];

      processDoTBuffs(state);
      expect(enemy.hp).toBe(0);
      expect(enemy.alive).toBe(false);
    });
  });

  describe('Shield reduction', () => {
    test('getShieldReduction returns value and consumes shield', () => {
      const state = makeState([makeHero({ classId: 'WARRIOR' })], []);
      state.buffs['h1'] = [{ source: 'MAGE_ESCUDO_ARCANO', type: 'shield', value: 0.50, expiresAfterRound: 5 }];

      const reduction = getShieldReduction(state, 'h1');
      expect(reduction).toBe(0.50);
      expect(state.buffs['h1'].find(b => b.type === 'shield')).toBeUndefined();
    });
  });
});
```

- [ ] **Step 3: Rodar testes**

Run: `npm test -- --testPathPattern=skillEffects`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/utils/skillEffects.ts src/__tests__/utils/skillEffects.test.ts
git commit -m "feat(skills): lógica de execução de 18 skills com testes"
```

---

## Task A4: Integrar skills no BattleEngine

**Files:**
- Modify: `src/utils/battleEngine.ts` (processHeroTurn, processEnemyTurn, calculateAttack)

- [ ] **Step 1: Importar skillEffects no battleEngine**

No topo de `src/utils/battleEngine.ts`, adicione:

```ts
import { executePreAttackSkills, onHeroDamagedSkills, onHeroDeathSkills, onRogueHitSkills, processDoTBuffs, getShieldReduction, getDefMulProduct } from './skillEffects';
```

- [ ] **Step 2: Integrar skills em `processHeroTurn`**

Em `processHeroTurn`, após a chamada a `executeClassAbility` (linha ~329), adicione a checagem de skills:

```ts
// 1. Verificar habilidades de classe (Healer) - EXISTENTE
if (this.executeClassAbility(hero, state)) return;

// 1b. Verificar skills ativas desbloqueadas (pré-ataque)
const aliveEnemiesForSkill = state.enemies.filter(e => e.alive);
const skillTarget = aliveEnemiesForSkill.length > 0 ? aliveEnemiesForSkill[0] : undefined;
if (executePreAttackSkills(hero, skillTarget, state, rng)) return;
```

- [ ] **Step 3: Integrar onRogueHitSkills após hit bem-sucedido**

Em `processHeroTurn`, após `finalTarget.hp = Math.max(0, finalTarget.hp - result.dmg);` (linha ~390), adicione:

```ts
if (result.dmg > 0 && hero.classId === 'ROGUE') {
  onRogueHitSkills(hero, finalTarget, state, rng);
}
```

- [ ] **Step 4: Integrar onHeroDeathSkills e onHeroDamagedSkills em `processEnemyTurn`**

Em `processEnemyTurn`, após `finalTarget.hpCurrent = Math.max(0, finalTarget.hpCurrent - finalDmg);` (linha ~488), adicione:

```ts
if (finalDmg > 0) {
  onHeroDamagedSkills(finalTarget, state);
}

if (finalTarget.hpCurrent <= 0) {
  onHeroDeathSkills(finalTarget, state);
  // ... resto do código existente de defeat
}
```

- [ ] **Step 5: Aplicar shield no cálculo de dano em `processEnemyTurn`**

Em `processEnemyTurn`, após calcular `finalDmg` e antes de aplicar ao herói, adicione:

```ts
// Aplicar shield (skill Escudo Arcano / Muralha)
const shieldReduction = getShieldReduction(state, finalTarget.id);
if (shieldReduction > 0) {
  finalDmg = Math.max(1, Math.floor(finalDmg * (1 - shieldReduction)));
  result.action.amount = finalDmg;
}
```

- [ ] **Step 6: Aplicar defMul no cálculo de dano em `calculateAttack`**

Em `calculateAttack`, antes de chamar `GameMath.calcDamage`, adicione leitura de `defMul`:

Nota: `calculateAttack` não tem acesso ao `state`. As chamadas a `getDefMulProduct` devem ser feitas no `processHeroTurn`/`processEnemyTurn` antes de chamar `calculateAttack`, ajustando o `target.defense` temporariamente. Padrão:

```ts
// Em processHeroTurn, antes de chamar calculateAttack:
const originalDef = finalTarget.defense ?? 0;
const defMul = getDefMulProduct(state, finalTarget.id);
if (defMul !== 1) {
  (finalTarget as any).defense = Math.floor(originalDef * defMul);
}
// ... call calculateAttack ...
// Restaurar
(finalTarget as any).defense = originalDef;
```

- [ ] **Step 7: Chamar processDoTBuffs no início de cada round**

No loop principal do combate (em `battleSim.ts` e/ou `simulationRunner.ts`), no início de cada round, adicione:

```ts
processDoTBuffs(state);
```

- [ ] **Step 8: Rodar suíte completa**

Run: `npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/utils/battleEngine.ts
git commit -m "feat(combat): integrar skills no BattleEngine"
```

---

## Task A5: UI — Skills no HeroDetailsModal

**Files:**
- Modify: `src/components/HeroDetailsModal.tsx`

- [ ] **Step 1: Importar `getSkillsWithStatus` e adicionar seção de skills**

Em `src/components/HeroDetailsModal.tsx`, importe:

```ts
import { getSkillsWithStatus } from '../constants/skills';
```

Adicione uma nova seção após a seção de equipamentos (por volta da linha 143). A seção mostra cada skill da classe do herói com status desbloqueada/bloqueada e barra de progresso:

```tsx
{/* Skills */}
{hero.classId && (
  <View style={{ marginTop: 16 }}>
    <Text style={{ fontSize: 14, fontWeight: '700', color: '#E0E0E0', marginBottom: 8 }}>
      Habilidades
    </Text>
    {getSkillsWithStatus(hero).map(({ skill, unlocked, progress }) => (
      <View key={skill.id} style={{
        flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
        opacity: unlocked ? 1 : 0.5,
      }}>
        <Text style={{ fontSize: 18, marginRight: 8 }}>{skill.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: unlocked ? '#FFD700' : '#888' }}>
            {skill.name}
          </Text>
          <Text style={{ fontSize: 11, color: '#AAA' }}>{skill.description}</Text>
          {!unlocked && (
            <View style={{ height: 4, backgroundColor: '#333', borderRadius: 2, marginTop: 4 }}>
              <View style={{
                height: 4, backgroundColor: '#FFD700', borderRadius: 2,
                width: `${Math.round(progress * 100)}%`,
              }} />
            </View>
          )}
        </View>
      </View>
    ))}
  </View>
)}
```

- [ ] **Step 2: Verificar visualmente (se dev server rodando)**

Abrir HeroDetailsModal de um herói e confirmar que as skills aparecem.

- [ ] **Step 3: Commit**

```bash
git add src/components/HeroDetailsModal.tsx
git commit -m "feat(ui): exibir skills desbloqueadas no HeroDetailsModal"
```

---

# Phase B: Personalidades na Batalha

## Task B1: Criar `src/utils/personalityEffects.ts`

**Files:**
- Create: `src/utils/personalityEffects.ts`
- Create: `src/__tests__/utils/personalityEffects.test.ts`

- [ ] **Step 1: Criar `src/utils/personalityEffects.ts`**

```ts
import { Hero } from '../types';
import { BattleState, BattleEnemy, Buff } from './battleEngine';
import { GameMath } from './gameMath';

function addBuff(state: BattleState, actorId: string, buff: Buff): void {
  if (!state.buffs[actorId]) state.buffs[actorId] = [];
  const existing = state.buffs[actorId].findIndex(b => b.source === buff.source && b.type === buff.type);
  if (existing >= 0) {
    state.buffs[actorId][existing] = buff;
  } else {
    state.buffs[actorId].push(buff);
  }
}

/**
 * Apply personality-based buffs after a hero attacks.
 * Called in processHeroTurn after a successful hit.
 */
export function applyPersonalityOnHit(
  hero: Hero,
  target: BattleEnemy,
  state: BattleState,
  dmg: number,
  rng: () => number,
  didMove: boolean,
): boolean {
  if (!hero.personality) return false;

  switch (hero.personality) {
    case 'AGGRESSIVE': {
      // Buff ATK when attacking target below 30% HP
      const targetHpPct = target.hp / target.maxHp;
      if (targetHpPct < 0.3) {
        addBuff(state, hero.id, {
          source: 'PERSONALITY_AGGRESSIVE', type: 'atkMul',
          value: 1.15, expiresAfterRound: state.rounds + 1,
        });
        state.log.push(`${hero.name} (Sanguinário) — fúria ativada!`);
      }
      break;
    }

    case 'CAUTIOUS': {
      // Buff crit when attacking without moving
      if (!didMove) {
        addBuff(state, hero.id, {
          source: 'PERSONALITY_CAUTIOUS', type: 'critFlat',
          value: 10, expiresAfterRound: state.rounds + 1,
        });
      }
      break;
    }

    case 'VENGEFUL': {
      // Buff ATK against the specific enemy that attacked this hero last round
      if (state.lastAttacker[hero.id] === target.id) {
        addBuff(state, hero.id, {
          source: 'PERSONALITY_VENGEFUL', type: 'atkMul',
          value: 1.25, expiresAfterRound: state.rounds + 1,
        });
        state.log.push(`${hero.name} (Vingativo) — vingança!`);
      }
      break;
    }

    case 'OPPORTUNIST': {
      // 25% chance of double attack if target dies
      if (target.hp <= 0 && rng() < 0.25) {
        // Return true to signal "try another attack"
        state.log.push(`${hero.name} (Oportunista) — ataque extra!`);
        return true;
      }
      break;
    }

    // PROTECTOR is handled separately (defensive trigger)
  }

  return false;
}

/**
 * Apply Protector personality's defensive shield.
 * Called at the start of each hero's turn.
 */
export function applyProtectorShield(hero: Hero, state: BattleState): void {
  if (hero.personality !== 'PROTECTOR' || hero.hpCurrent <= 0) return;

  const heroPos = state.heroPositions[hero.id] ?? 0;

  for (const ally of state.heroes.filter(h => h.id !== hero.id && h.hpCurrent > 0)) {
    if (ally.hpCurrent / ally.hpMax >= 0.5) continue;

    const allyPos = state.heroPositions[ally.id] ?? 0;
    if (GameMath.getHexDistance(heroPos, allyPos) <= 1) {
      // Apply shield to the injured ally
      addBuff(state, ally.id, {
        source: 'PERSONALITY_PROTECTOR', type: 'shield',
        value: 0.20, expiresAfterRound: state.rounds + 1,
      });
      state.log.push(`${hero.name} (Guardião) — protege ${ally.name}!`);
      break; // Only one ally per turn
    }
  }
}
```

- [ ] **Step 2: Criar teste `src/__tests__/utils/personalityEffects.test.ts`**

```ts
import { applyPersonalityOnHit, applyProtectorShield } from '../../utils/personalityEffects';
import { BattleState, BattleEnemy } from '../../utils/battleEngine';
import { Hero, HeroTask } from '../../types';

function makeHero(overrides: Partial<Hero>): Hero {
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
    attackType: 'MELEE', range: 1, movement: 2, position: 2,
    ...overrides,
  };
}

function makeState(heroes: Hero[], enemies: BattleEnemy[]): BattleState {
  const heroPositions: Record<string, number> = {};
  heroes.forEach((h, i) => { heroPositions[h.id] = 40 + i; });
  const enemyPositions: Record<string, number> = {};
  enemies.forEach(e => { enemyPositions[e.id] = e.position ?? 2; });

  return {
    heroes, enemies, heroPositions, enemyPositions,
    lastAttacker: {}, threats: {},
    log: [], actions: [], rounds: 1,
    activeSynergies: [], buffs: {}, flags: {},
    handlers: {} as any,
    skillCooldowns: {}, skillOnceUsed: {},
  };
}

describe('personalityEffects', () => {
  test('AGGRESSIVE: buff atkMul when target < 30% HP', () => {
    const hero = makeHero({ personality: 'AGGRESSIVE' });
    const enemy = makeEnemy({ hp: 10, maxHp: 50 }); // 20% HP
    const state = makeState([hero], [enemy]);

    applyPersonalityOnHit(hero, enemy, state, 5, () => 0.5, false);
    const buff = state.buffs['h1']?.find(b => b.source === 'PERSONALITY_AGGRESSIVE');
    expect(buff?.type).toBe('atkMul');
    expect(buff?.value).toBe(1.15);
  });

  test('AGGRESSIVE: no buff when target >= 30% HP', () => {
    const hero = makeHero({ personality: 'AGGRESSIVE' });
    const enemy = makeEnemy({ hp: 40, maxHp: 50 }); // 80%
    const state = makeState([hero], [enemy]);

    applyPersonalityOnHit(hero, enemy, state, 5, () => 0.5, false);
    expect(state.buffs['h1']).toBeUndefined();
  });

  test('CAUTIOUS: buff crit when no move', () => {
    const hero = makeHero({ personality: 'CAUTIOUS' });
    const enemy = makeEnemy();
    const state = makeState([hero], [enemy]);

    applyPersonalityOnHit(hero, enemy, state, 5, () => 0.5, false);
    const buff = state.buffs['h1']?.find(b => b.source === 'PERSONALITY_CAUTIOUS');
    expect(buff?.type).toBe('critFlat');
  });

  test('CAUTIOUS: no buff when moved', () => {
    const hero = makeHero({ personality: 'CAUTIOUS' });
    const enemy = makeEnemy();
    const state = makeState([hero], [enemy]);

    applyPersonalityOnHit(hero, enemy, state, 5, () => 0.5, true);
    expect(state.buffs['h1']).toBeUndefined();
  });

  test('VENGEFUL: buff against last attacker', () => {
    const hero = makeHero({ personality: 'VENGEFUL' });
    const enemy = makeEnemy();
    const state = makeState([hero], [enemy]);
    state.lastAttacker['h1'] = 'e1';

    applyPersonalityOnHit(hero, enemy, state, 5, () => 0.5, false);
    const buff = state.buffs['h1']?.find(b => b.source === 'PERSONALITY_VENGEFUL');
    expect(buff?.value).toBe(1.25);
  });

  test('OPPORTUNIST: extra attack chance on kill', () => {
    const hero = makeHero({ personality: 'OPPORTUNIST' });
    const enemy = makeEnemy({ hp: 0 }); // dead
    const state = makeState([hero], [enemy]);

    const extra = applyPersonalityOnHit(hero, enemy, state, 5, () => 0.1, false); // rng < 0.25
    expect(extra).toBe(true);
  });

  test('OPPORTUNIST: no extra attack when rng >= 0.25', () => {
    const hero = makeHero({ personality: 'OPPORTUNIST' });
    const enemy = makeEnemy({ hp: 0 });
    const state = makeState([hero], [enemy]);

    const extra = applyPersonalityOnHit(hero, enemy, state, 5, () => 0.5, false);
    expect(extra).toBe(false);
  });

  test('PROTECTOR: shield on adjacent injured ally', () => {
    const hero = makeHero({ id: 'prot', personality: 'PROTECTOR' });
    const ally = makeHero({ id: 'ally', hpCurrent: 30, hpMax: 100 }); // 30% HP
    const state = makeState([hero, ally], [makeEnemy()]);
    state.heroPositions['prot'] = 40;
    state.heroPositions['ally'] = 41; // adjacent

    applyProtectorShield(hero, state);
    const shield = state.buffs['ally']?.find(b => b.source === 'PERSONALITY_PROTECTOR');
    expect(shield?.type).toBe('shield');
    expect(shield?.value).toBe(0.20);
  });
});
```

- [ ] **Step 3: Rodar testes**

Run: `npm test -- --testPathPattern=personalityEffects`
Expected: PASS (8 testes)

- [ ] **Step 4: Commit**

```bash
git add src/utils/personalityEffects.ts src/__tests__/utils/personalityEffects.test.ts
git commit -m "feat(personality): efeitos mecânicos das 5 personalidades com testes"
```

---

## Task B2: Integrar personalidades no BattleEngine

**Files:**
- Modify: `src/utils/battleEngine.ts` (processHeroTurn)

- [ ] **Step 1: Importar personalityEffects**

```ts
import { applyPersonalityOnHit, applyProtectorShield } from './personalityEffects';
```

- [ ] **Step 2: Chamar `applyProtectorShield` no início do turno do herói**

Em `processHeroTurn`, logo após o check de `hero.hpCurrent <= 0`, adicione:

```ts
applyProtectorShield(hero, state);
```

- [ ] **Step 3: Chamar `applyPersonalityOnHit` após hit bem-sucedido**

Em `processHeroTurn`, após `finalTarget.hp = Math.max(0, finalTarget.hp - result.dmg);`, adicione:

```ts
if (result.dmg > 0) {
  const didMove = updatedPos !== currentPos;
  const extraAttack = applyPersonalityOnHit(hero, finalTarget, state, result.dmg, rng, didMove);
  // Opportunist extra attack
  if (extraAttack && finalTarget.hp <= 0) {
    const nextAlive = state.enemies.find(e => e.alive && e.id !== finalTarget.id);
    if (nextAlive) {
      const nextDist = GameMath.getHexDistance(updatedPos, state.enemyPositions[nextAlive.id]);
      const nextRange = hero.range ?? 1;
      if (nextDist <= nextRange) {
        const extraResult = this.calculateAttack(hero, nextAlive, 0.8, 'hero', state.rounds, rng, nextDist);
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
}
```

- [ ] **Step 4: Aplicar atkMul e critFlat de personalidade no cálculo de ataque**

Em `processHeroTurn`, antes de chamar `calculateAttack`, ler buffs de personalidade para ajustar temporariamente atk e crit do herói:

```ts
// Antes de calculateAttack
const originalAtk = hero.atk;
const originalCrit = hero.crit;
const atkMulBuffs = state.buffs[hero.id]?.filter(b => b.type === 'atkMul' && b.expiresAfterRound >= state.rounds) ?? [];
const critFlatBuffs = state.buffs[hero.id]?.filter(b => b.type === 'critFlat' && b.expiresAfterRound >= state.rounds) ?? [];
if (atkMulBuffs.length > 0) {
  const mul = atkMulBuffs.reduce((acc, b) => acc * b.value, 1);
  (hero as any).atk = Math.floor(hero.atk * mul);
}
if (critFlatBuffs.length > 0) {
  const flat = critFlatBuffs.reduce((acc, b) => acc + b.value, 0);
  (hero as any).crit = (hero.crit ?? 0) + flat;
}

// ... calculateAttack call ...

// Restaurar
(hero as any).atk = originalAtk;
(hero as any).crit = originalCrit;
```

- [ ] **Step 5: Rodar suíte completa**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/utils/battleEngine.ts
git commit -m "feat(combat): integrar personalidades mecânicas no BattleEngine"
```

---

## Task B3: UI — Tooltip de personalidade no HeroDetailsModal

**Files:**
- Modify: `src/components/HeroDetailsModal.tsx`

- [ ] **Step 1: Adicionar descrição do efeito mecânico à seção de personalidade**

Na seção de personalidade existente (por volta da linha 83-95), adicione uma linha extra com o efeito mecânico:

```tsx
const PERSONALITY_EFFECTS: Record<string, string> = {
  AGGRESSIVE: '+15% ATK ao atacar alvos com menos de 30% HP',
  PROTECTOR: 'Protege aliados adjacentes com <50% HP (escudo de 20%)',
  CAUTIOUS: '+10 crit ao atacar sem se mover',
  VENGEFUL: '+25% ATK contra quem atacou este herói',
  OPPORTUNIST: '25% chance de ataque extra ao matar um inimigo',
};

// Na seção de personalidade, após description:
{hero.personality && (
  <Text style={{ fontSize: 11, color: '#FFD700', fontStyle: 'italic', marginTop: 2 }}>
    Efeito: {PERSONALITY_EFFECTS[hero.personality] ?? ''}
  </Text>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/HeroDetailsModal.tsx
git commit -m "feat(ui): tooltip de efeito mecânico na personalidade"
```

---

## Task B4: Balanceamento de personalidades (etapa dedicada)

**Files:**
- Modify: `scripts/simulations/balance_analysis.ts` (se necessário)

- [ ] **Step 1: Rodar simulação pareada**

Usar o simulation runner existente para comparar desempenho com/sem efeitos de personalidade. Target: Δ winrate entre +3pp e +10pp por personalidade.

Run: `npm run simulate`

- [ ] **Step 2: Ajustar magnitudes se necessário**

Se alguma personalidade está fora do range, ajustar valores em `personalityEffects.ts` (ex: VENGEFUL 1.25 → 1.20).

- [ ] **Step 3: Commit ajustes**

```bash
git add src/utils/personalityEffects.ts
git commit -m "balance(personality): ajustar magnitudes após simulação"
```

---

# Phase C: Panteão + Fusão de Heróis

## Task C1: Estender tipos para fusão

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Estender `Hero` com campos de fusão**

Em `src/types/index.ts`, na interface `Hero` (por volta da linha 43), adicione:

```ts
  stars?: number;                     // 0 = normal, 1+ = fusionado
  fusionBonus?: { hp: number; atk: number; mp: number };
```

- [ ] **Step 2: Estender `GameState` com campos do Panteão**

Na interface `GameState` (por volta da linha 91), adicione:

```ts
  pantheonFusions?: number;
  pantheonBonuses?: { goldPercent: number; atkPercent: number; hpPercent: number };
```

- [ ] **Step 3: Estender `GameAction` com novas ações**

Na type `GameAction` (por volta da linha 112), adicione:

```ts
  | { type: 'FUSE_HEROES'; heroIds: [string, string, string] }
  | { type: 'CONFIRM_FUSION'; hero: Hero }
```

- [ ] **Step 4: Rodar testes**

Run: `npm test`
Expected: PASS (novos campos são opcionais)

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): Hero.stars/fusionBonus e GameState.pantheonBonuses"
```

---

## Task C2: Storage migration v6

**Files:**
- Modify: `src/services/storage.ts`

- [ ] **Step 1: Adicionar migration v6**

Em `src/services/storage.ts`, na constante `CURRENT_VERSION`, mude de `5` para `6`. No objeto `migrations`, adicione:

```ts
6: (state: any) => {
  // Adicionar campos de fusão em cada herói
  if (state.heroes) {
    for (const hero of state.heroes) {
      if (hero.stars === undefined) hero.stars = 0;
    }
  }
  // Adicionar campos do Panteão no state
  if (state.pantheonFusions === undefined) state.pantheonFusions = 0;
  return state;
},
```

- [ ] **Step 2: Rodar testes**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/services/storage.ts
git commit -m "feat(storage): migration v6 para campos de fusão"
```

---

## Task C3: Lógica de fusão em `src/context/pantheonHandler.ts`

**Files:**
- Create: `src/context/pantheonHandler.ts`
- Create: `src/__tests__/context/pantheonHandler.test.ts`

- [ ] **Step 1: Criar `src/context/pantheonHandler.ts`**

```ts
import { GameState, Hero, HeroTask } from '../types';
import { CLASS_DEFS } from '../constants/classes';
import { PERSONALITY_LIST } from '../constants/personalities';
import { ClassId } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Calculate pantheon bonuses based on heroes with stars.
 */
export function calculatePantheonBonuses(heroes: Hero[]): { goldPercent: number; atkPercent: number; hpPercent: number } {
  const starredHeroes = heroes.filter(h => (h.stars ?? 0) > 0);
  const starredCount = starredHeroes.length;
  const has3Stars = starredHeroes.some(h => (h.stars ?? 0) >= 3);

  let goldPercent = 0;
  let atkPercent = 0;
  let hpPercent = 0;

  if (starredCount >= 1) goldPercent += 3;
  if (starredCount >= 3) goldPercent += 5;
  if (has3Stars) atkPercent += 3;
  if (starredCount >= 5) hpPercent += 5;

  return { goldPercent, atkPercent, hpPercent };
}

/**
 * Create a fused hero from 3 source heroes.
 */
export function createFusedHero(sourceHeroes: [Hero, Hero, Hero]): Hero {
  // 1. Determine class by probability (equal chance per class present)
  const classIds = sourceHeroes.map(h => h.classId).filter(Boolean) as ClassId[];
  const randomIdx = Math.floor(Math.random() * classIds.length);
  const resultClassId = classIds[randomIdx] ?? 'WARRIOR';

  // 2. Base stats from class
  const classDef = CLASS_DEFS[resultClassId];
  const baseHp = 50 + (classDef.baseStatDelta?.hp ?? 0);
  const baseAtk = 10 + (classDef.baseStatDelta?.atk ?? 0);
  const baseMp = 5 + (classDef.baseStatDelta?.mp ?? 0);
  const baseDef = 5 + (classDef.baseStatDelta?.defense ?? 0);
  const baseCrit = 10 + (classDef.baseStatDelta?.crit ?? 0);
  const baseAgi = 5 + (classDef.baseStatDelta?.agility ?? 0);

  // 3. Fusion bonus: 10% of total training counts
  const totalTraining = sourceHeroes.reduce(
    (acc, h) => ({
      hp: acc.hp + (h.trainingCount?.hp ?? 0),
      atk: acc.atk + (h.trainingCount?.atk ?? 0),
      mp: acc.mp + (h.trainingCount?.mp ?? 0),
    }),
    { hp: 0, atk: 0, mp: 0 }
  );
  const fusionBonus = {
    hp: Math.floor(totalTraining.hp * 0.1),
    atk: Math.floor(totalTraining.atk * 0.1),
    mp: Math.floor(totalTraining.mp * 0.1),
  };

  // 4. Stars: max(stars of sources) + 1
  const maxStars = Math.max(...sourceHeroes.map(h => h.stars ?? 0));
  const stars = maxStars + 1;

  // 5. Star bonus: +5% per star on all base stats
  const starMul = 1 + stars * 0.05;

  // 6. Final stats
  const hp = Math.floor((baseHp + fusionBonus.hp) * starMul);
  const atk = Math.floor((baseAtk + fusionBonus.atk) * starMul);
  const mp = Math.floor((baseMp + fusionBonus.mp) * starMul);
  const defense = Math.floor(baseDef * starMul);
  const crit = Math.floor(baseCrit * starMul);
  const agility = Math.floor(baseAgi * starMul);

  // 7. Random personality
  const personality = PERSONALITY_LIST[Math.floor(Math.random() * PERSONALITY_LIST.length)].id;

  // 8. Random name
  const names = ['Fenix', 'Ascendido', 'Renascido', 'Forjado', 'Primordial', 'Eterno', 'Lendário'];
  const suffixes = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const name = `${names[Math.floor(Math.random() * names.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;

  return {
    id: uuidv4(),
    name,
    hpMax: hp,
    hpCurrent: hp,
    atk,
    mp,
    defense,
    crit,
    agility,
    currentTask: HeroTask.IDLE,
    classId: resultClassId,
    personality,
    attackType: classDef.attackType,
    range: classDef.range,
    movement: 2,
    stars,
    fusionBonus,
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
  };
}

/**
 * Handle FUSE_HEROES action. Validates and prepares the fusion.
 * Returns state with pendingFusion set (hero not yet confirmed).
 */
export function handleFuseHeroes(state: GameState, heroIds: [string, string, string]): GameState {
  const sourceHeroes = heroIds.map(id => state.heroes.find(h => h.id === id)).filter(Boolean) as Hero[];
  if (sourceHeroes.length !== 3) return state;

  // Validate all heroes are IDLE
  if (sourceHeroes.some(h => h.currentTask !== HeroTask.IDLE)) return state;

  // Return equipment to inventory
  let inventory = [...(state.inventory ?? [])];
  for (const hero of sourceHeroes) {
    if (hero.equippedItems && hero.equippedItems.length > 0) {
      const equipped = inventory.filter(eq => hero.equippedItems!.includes(eq.id));
      // Items stay in inventory, just unequip
    }
  }

  const fusedHero = createFusedHero(sourceHeroes as [Hero, Hero, Hero]);

  // Remove source heroes, add fused hero
  const remainingHeroes = state.heroes.filter(h => !heroIds.includes(h.id));

  const newState = {
    ...state,
    heroes: [...remainingHeroes, fusedHero],
    pantheonFusions: (state.pantheonFusions ?? 0) + 1,
  };

  // Recalculate pantheon bonuses
  newState.pantheonBonuses = calculatePantheonBonuses(newState.heroes);

  return newState;
}
```

- [ ] **Step 2: Criar teste `src/__tests__/context/pantheonHandler.test.ts`**

```ts
import { calculatePantheonBonuses, createFusedHero, handleFuseHeroes } from '../../context/pantheonHandler';
import { Hero, HeroTask, GameState } from '../../types';

function makeHero(overrides: Partial<Hero>): Hero {
  return {
    id: 'h1', name: 'Test', hpMax: 50, hpCurrent: 50,
    atk: 10, mp: 5, defense: 5, crit: 10, agility: 5,
    currentTask: HeroTask.IDLE,
    classId: 'WARRIOR',
    personality: 'AGGRESSIVE',
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
    stars: 0,
    ...overrides,
  } as Hero;
}

describe('pantheonHandler', () => {
  describe('calculatePantheonBonuses', () => {
    test('no starred heroes = no bonuses', () => {
      const bonuses = calculatePantheonBonuses([makeHero({})]);
      expect(bonuses).toEqual({ goldPercent: 0, atkPercent: 0, hpPercent: 0 });
    });

    test('1 starred hero = +3% gold', () => {
      const bonuses = calculatePantheonBonuses([makeHero({ stars: 1 })]);
      expect(bonuses.goldPercent).toBe(3);
    });

    test('3 starred heroes = +8% gold', () => {
      const heroes = [
        makeHero({ id: 'a', stars: 1 }),
        makeHero({ id: 'b', stars: 1 }),
        makeHero({ id: 'c', stars: 1 }),
      ];
      expect(calculatePantheonBonuses(heroes).goldPercent).toBe(8);
    });

    test('1 hero with 3 stars = +3% ATK', () => {
      const bonuses = calculatePantheonBonuses([makeHero({ stars: 3 })]);
      expect(bonuses.atkPercent).toBe(3);
    });

    test('5 starred heroes = +5% HP', () => {
      const heroes = Array.from({ length: 5 }, (_, i) => makeHero({ id: `h${i}`, stars: 1 }));
      expect(calculatePantheonBonuses(heroes).hpPercent).toBe(5);
    });
  });

  describe('createFusedHero', () => {
    test('creates hero with stars = max(sources) + 1', () => {
      const sources: [Hero, Hero, Hero] = [
        makeHero({ id: 'a', stars: 0 }),
        makeHero({ id: 'b', stars: 2 }),
        makeHero({ id: 'c', stars: 1 }),
      ];
      const fused = createFusedHero(sources);
      expect(fused.stars).toBe(3); // max(0,2,1) + 1
    });

    test('fusion bonus is 10% of total training', () => {
      const sources: [Hero, Hero, Hero] = [
        makeHero({ id: 'a', trainingCount: { hp: 30, atk: 20, mp: 10 } }),
        makeHero({ id: 'b', trainingCount: { hp: 20, atk: 30, mp: 20 } }),
        makeHero({ id: 'c', trainingCount: { hp: 50, atk: 50, mp: 70 } }),
      ];
      const fused = createFusedHero(sources);
      expect(fused.fusionBonus).toEqual({ hp: 10, atk: 10, mp: 10 }); // 10% of 100, 100, 100
    });

    test('training counts are zeroed', () => {
      const sources: [Hero, Hero, Hero] = [
        makeHero({ id: 'a', trainingCount: { hp: 100, atk: 100, mp: 100 } }),
        makeHero({ id: 'b' }),
        makeHero({ id: 'c' }),
      ];
      const fused = createFusedHero(sources);
      expect(fused.trainingCount).toEqual({ hp: 0, atk: 0, mp: 0 });
    });

    test('class is one of the source classes', () => {
      const sources: [Hero, Hero, Hero] = [
        makeHero({ id: 'a', classId: 'MAGE' }),
        makeHero({ id: 'b', classId: 'ARCHER' }),
        makeHero({ id: 'c', classId: 'HEALER' }),
      ];
      const fused = createFusedHero(sources);
      expect(['MAGE', 'ARCHER', 'HEALER']).toContain(fused.classId);
    });
  });

  describe('handleFuseHeroes', () => {
    test('removes 3 heroes and adds 1 fused hero', () => {
      const state: GameState = {
        gold: 100, heroes: [
          makeHero({ id: 'a' }),
          makeHero({ id: 'b' }),
          makeHero({ id: 'c' }),
          makeHero({ id: 'd' }),
        ],
        heroesRecruited: 4, lastSavedAt: Date.now(),
      };
      const newState = handleFuseHeroes(state, ['a', 'b', 'c']);
      expect(newState.heroes).toHaveLength(2); // d + fused
      expect(newState.pantheonFusions).toBe(1);
    });

    test('rejects if hero not IDLE', () => {
      const state: GameState = {
        gold: 100, heroes: [
          makeHero({ id: 'a', currentTask: HeroTask.MISSION }),
          makeHero({ id: 'b' }),
          makeHero({ id: 'c' }),
        ],
        heroesRecruited: 3, lastSavedAt: Date.now(),
      };
      const newState = handleFuseHeroes(state, ['a', 'b', 'c']);
      expect(newState.heroes).toHaveLength(3); // unchanged
    });

    test('pantheonBonuses updated after fusion', () => {
      const state: GameState = {
        gold: 100, heroes: [
          makeHero({ id: 'a' }),
          makeHero({ id: 'b' }),
          makeHero({ id: 'c' }),
        ],
        heroesRecruited: 3, lastSavedAt: Date.now(),
      };
      const newState = handleFuseHeroes(state, ['a', 'b', 'c']);
      expect(newState.pantheonBonuses?.goldPercent).toBe(3); // 1 starred hero
    });
  });
});
```

- [ ] **Step 3: Rodar testes**

Run: `npm test -- --testPathPattern=pantheonHandler`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/context/pantheonHandler.ts src/__tests__/context/pantheonHandler.test.ts
git commit -m "feat(pantheon): lógica de fusão com bônus e testes"
```

---

## Task C4: Integrar fusão no reducer

**Files:**
- Modify: `src/context/gameReducer.ts`

- [ ] **Step 1: Importar handler e adicionar cases**

Em `src/context/gameReducer.ts`, adicione o import:

```ts
import { handleFuseHeroes } from './pantheonHandler';
```

No `switch` do `gameReducer`, adicione:

```ts
case 'FUSE_HEROES':
  return handleFuseHeroes(state, action.heroIds);
case 'CONFIRM_FUSION':
  // Fusion is immediate in handleFuseHeroes — CONFIRM_FUSION is a no-op
  // (kept for future reveal animation flow if needed)
  return state;
```

- [ ] **Step 2: Rodar testes**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/context/gameReducer.ts
git commit -m "feat(reducer): despachar FUSE_HEROES no gameReducer"
```

---

## Task C5: UI — PantheonScreen com fusão

**Files:**
- Modify: `src/screens/PantheonScreen.tsx`

- [ ] **Step 1: Substituir placeholder pela tela de fusão**

Reescrever `src/screens/PantheonScreen.tsx` com:
- Grid de 3 slots para seleção de heróis (filtrando apenas IDLE)
- Botão "Fundir" habilitado quando 3 heróis selecionados
- Lista de bônus de guilda ativos
- Contador de fusões realizadas

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useGame } from '../context/GameContext';
import { HeroTask } from '../types';

export function PantheonScreen() {
  const { state, dispatch } = useGame();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const idleHeroes = state.heroes.filter(h => h.currentTask === HeroTask.IDLE);
  const bonuses = state.pantheonBonuses ?? { goldPercent: 0, atkPercent: 0, hpPercent: 0 };
  const canFuse = selectedIds.length === 3;

  const toggleHero = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const handleFuse = () => {
    if (!canFuse) return;
    Alert.alert(
      'Confirmar Fusão',
      'Os 3 heróis serão consumidos para criar 1 herói mais forte. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Fundir',
          style: 'destructive',
          onPress: () => {
            dispatch({ type: 'FUSE_HEROES', heroIds: selectedIds as [string, string, string] });
            setSelectedIds([]);
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🏛️ Panteão dos Heróis</Text>
      <Text style={styles.subtitle}>Funda 3 heróis para criar um mais forte</Text>

      {/* Fusion slots */}
      <View style={styles.slotsRow}>
        {[0, 1, 2].map(i => {
          const heroId = selectedIds[i];
          const hero = heroId ? state.heroes.find(h => h.id === heroId) : undefined;
          return (
            <View key={i} style={styles.slot}>
              {hero ? (
                <View>
                  <Text style={styles.slotName}>{hero.name}</Text>
                  <Text style={styles.slotClass}>{hero.classId}</Text>
                  <Text style={styles.slotStars}>{'★'.repeat(hero.stars ?? 0) || '—'}</Text>
                </View>
              ) : (
                <Text style={styles.slotEmpty}>Vazio</Text>
              )}
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.fuseButton, !canFuse && styles.fuseButtonDisabled]}
        onPress={handleFuse}
        disabled={!canFuse}
      >
        <Text style={styles.fuseButtonText}>⚡ Fundir</Text>
      </TouchableOpacity>

      {/* Available heroes */}
      <Text style={styles.sectionTitle}>Heróis Disponíveis ({idleHeroes.length})</Text>
      {idleHeroes.map(hero => (
        <TouchableOpacity
          key={hero.id}
          style={[styles.heroRow, selectedIds.includes(hero.id) && styles.heroRowSelected]}
          onPress={() => toggleHero(hero.id)}
        >
          <Text style={styles.heroName}>
            {'★'.repeat(hero.stars ?? 0)} {hero.name}
          </Text>
          <Text style={styles.heroStats}>
            {hero.classId} | HP:{hero.hpMax} ATK:{hero.atk} MP:{hero.mp}
          </Text>
        </TouchableOpacity>
      ))}

      {/* Guild bonuses */}
      <Text style={styles.sectionTitle}>Bônus de Guilda</Text>
      <View style={styles.bonusCard}>
        <Text style={styles.bonusText}>💰 Gold em missões: +{bonuses.goldPercent}%</Text>
        <Text style={styles.bonusText}>⚔️ ATK global: +{bonuses.atkPercent}%</Text>
        <Text style={styles.bonusText}>❤️ HP global: +{bonuses.hpPercent}%</Text>
      </View>

      <Text style={styles.fusionCount}>Fusões realizadas: {state.pantheonFusions ?? 0}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#FFD700', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#AAA', textAlign: 'center', marginBottom: 16 },
  slotsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  slot: {
    width: 100, height: 80, borderRadius: 8, borderWidth: 1, borderColor: '#FFD700',
    backgroundColor: '#2A2A3E', justifyContent: 'center', alignItems: 'center',
  },
  slotName: { fontSize: 12, fontWeight: '600', color: '#E0E0E0', textAlign: 'center' },
  slotClass: { fontSize: 10, color: '#AAA', textAlign: 'center' },
  slotStars: { fontSize: 14, color: '#FFD700', textAlign: 'center' },
  slotEmpty: { fontSize: 12, color: '#666' },
  fuseButton: {
    backgroundColor: '#FFD700', borderRadius: 8, padding: 12,
    alignItems: 'center', marginBottom: 20,
  },
  fuseButtonDisabled: { backgroundColor: '#444' },
  fuseButtonText: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#E0E0E0', marginTop: 16, marginBottom: 8 },
  heroRow: {
    flexDirection: 'column', padding: 10, borderRadius: 6,
    backgroundColor: '#2A2A3E', marginBottom: 6, borderWidth: 1, borderColor: '#333',
  },
  heroRowSelected: { borderColor: '#FFD700', backgroundColor: '#3A3A4E' },
  heroName: { fontSize: 14, fontWeight: '600', color: '#E0E0E0' },
  heroStats: { fontSize: 11, color: '#AAA', marginTop: 2 },
  bonusCard: { backgroundColor: '#2A2A3E', borderRadius: 8, padding: 12, marginBottom: 12 },
  bonusText: { fontSize: 13, color: '#E0E0E0', marginBottom: 4 },
  fusionCount: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 2: Rodar testes**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/screens/PantheonScreen.tsx
git commit -m "feat(ui): PantheonScreen com fusão de heróis"
```

---

## Task C6: UI — Estrelas no HeroCard

**Files:**
- Modify: `src/components/HeroCard.tsx`

- [ ] **Step 1: Adicionar indicador de estrelas ao lado do nome**

Em `src/components/HeroCard.tsx`, localize onde o nome do herói é renderizado (tanto no variant `compact` quanto `detailed`). Antes do nome, adicione:

```tsx
{(hero.stars ?? 0) > 0 && (
  <Text style={{ color: '#FFD700', fontSize: 12, marginRight: 4 }}>
    {'★'.repeat(hero.stars!)}
  </Text>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/HeroCard.tsx
git commit -m "feat(ui): indicador de estrelas no HeroCard"
```

---

# Phase D: Ciclo Semanal

## Task D1: Constantes de quests semanais e seed

**Files:**
- Create: `src/constants/weeklyQuests.ts`

- [ ] **Step 1: Criar `src/constants/weeklyQuests.ts`**

```ts
export interface WeeklyQuestDef {
  id: string;
  name: string;
  icon: string;
  targetValue: number;
  reward: number;
  tracker: string;
}

export const WEEKLY_QUEST_POOL: WeeklyQuestDef[] = [
  { id: 'wq_missions_20', name: 'Completar 20 missões', icon: '⚔️', targetValue: 20, reward: 200, tracker: 'missionsCompleted' },
  { id: 'wq_train_100', name: 'Treinar 100 pontos', icon: '💪', targetValue: 100, reward: 150, tracker: 'pointsTrained' },
  { id: 'wq_forge_5', name: 'Forjar 5 equipamentos', icon: '🔨', targetValue: 5, reward: 200, tracker: 'itemsForged' },
  { id: 'wq_gold_1000', name: 'Ganhar 1000 de ouro', icon: '💰', targetValue: 1000, reward: 250, tracker: 'goldEarned' },
  { id: 'wq_boss_1', name: 'Derrotar o boss semanal', icon: '🐉', targetValue: 1, reward: 300, tracker: 'weeklyBossKills' },
  { id: 'wq_fuse_1', name: 'Realizar 1 fusão', icon: '🏛️', targetValue: 1, reward: 250, tracker: 'fusionsCompleted' },
];

export const WEEKLY_QUEST_COUNT = 3;
export const WEEKLY_BONUS_REWARD = 500;

export function getWeeklySeed(): number {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7
  );
  return d.getFullYear() * 100 + weekNumber;
}

export function pickWeeklyQuests(seed: number, count: number = WEEKLY_QUEST_COUNT): WeeklyQuestDef[] {
  const shuffled = [...WEEKLY_QUEST_POOL].sort((a, b) => {
    const hashA = (seed * 37 + a.id.length) % 991;
    const hashB = (seed * 37 + b.id.length) % 991;
    return hashA - hashB;
  });
  const picked: WeeklyQuestDef[] = [];
  const usedTrackers = new Set<string>();
  for (const q of shuffled) {
    if (picked.length >= count) break;
    if (!usedTrackers.has(q.tracker)) {
      picked.push(q);
      usedTrackers.add(q.tracker);
    }
  }
  return picked;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/constants/weeklyQuests.ts
git commit -m "feat(weekly): constantes de quests semanais e getWeeklySeed"
```

---

## Task D2: Boss templates semanais

**Files:**
- Create: `src/constants/weeklyBosses.ts`

- [ ] **Step 1: Criar `src/constants/weeklyBosses.ts`**

```ts
import { MissionTemplate } from './missions';

export interface WeeklyBossTemplate extends MissionTemplate {
  bossName: string;
  guaranteedRewardTier?: number; // equipment tier guaranteed on win
}

export const WEEKLY_BOSS_POOL: WeeklyBossTemplate[] = [
  {
    id: 'wb_hydra',
    bossName: 'Hydra das Profundezas',
    name: 'Hydra das Profundezas',
    minHeroes: 4,
    durationMs: 180_000,
    difficulty: 6,
    baseReward: 300,
    enemies: [
      { hp: 200, atk: 25, mp: 10, defense: 15, crit: 10, agility: 8, count: 1, attackType: 'MELEE', range: 2, movement: 1 },
      { hp: 60, atk: 12, mp: 5, defense: 8, crit: 5, agility: 10, count: 3, attackType: 'RANGED', range: 3, movement: 2 },
    ],
    rewardCurve: { scale: 1, ref: 30, exponent: 1.3, synergyK: 0.15 },
    statWeights: { hp: 0.3, atk: 0.4, mp: 0.3 },
    guaranteedRewardTier: 2,
  },
  {
    id: 'wb_golem',
    bossName: 'Golem Ancestral',
    name: 'Golem Ancestral',
    minHeroes: 3,
    durationMs: 150_000,
    difficulty: 6,
    baseReward: 250,
    enemies: [
      { hp: 300, atk: 18, mp: 0, defense: 30, crit: 0, agility: 2, count: 1, attackType: 'MELEE', range: 1, movement: 1 },
      { hp: 40, atk: 10, mp: 5, defense: 5, crit: 5, agility: 15, count: 2, attackType: 'MELEE', range: 1, movement: 3 },
    ],
    rewardCurve: { scale: 1, ref: 30, exponent: 1.3, synergyK: 0.15 },
    statWeights: { hp: 0.4, atk: 0.3, mp: 0.3 },
    guaranteedRewardTier: 2,
  },
  {
    id: 'wb_dragon',
    bossName: 'Dragão Sombrio',
    name: 'Dragão Sombrio',
    minHeroes: 4,
    durationMs: 240_000,
    difficulty: 7,
    baseReward: 500,
    enemies: [
      { hp: 350, atk: 35, mp: 15, defense: 20, crit: 15, agility: 12, count: 1, attackType: 'RANGED', range: 4, movement: 1 },
      { hp: 80, atk: 15, mp: 5, defense: 10, crit: 10, agility: 8, count: 2, attackType: 'MELEE', range: 1, movement: 2 },
    ],
    rewardCurve: { scale: 1.2, ref: 40, exponent: 1.4, synergyK: 0.2 },
    statWeights: { hp: 0.3, atk: 0.4, mp: 0.3 },
    guaranteedRewardTier: 3,
  },
  {
    id: 'wb_lich',
    bossName: 'Lorde Lich',
    name: 'Lorde Lich',
    minHeroes: 3,
    durationMs: 180_000,
    difficulty: 7,
    baseReward: 400,
    enemies: [
      { hp: 180, atk: 30, mp: 20, defense: 12, crit: 20, agility: 15, count: 1, attackType: 'RANGED', range: 4, movement: 1 },
      { hp: 50, atk: 12, mp: 8, defense: 5, crit: 5, agility: 5, count: 3, attackType: 'MELEE', range: 1, movement: 2 },
    ],
    rewardCurve: { scale: 1.1, ref: 35, exponent: 1.3, synergyK: 0.15 },
    statWeights: { hp: 0.3, atk: 0.3, mp: 0.4 },
  },
  {
    id: 'wb_titan',
    bossName: 'Titã do Caos',
    name: 'Titã do Caos',
    minHeroes: 5,
    durationMs: 300_000,
    difficulty: 8,
    baseReward: 600,
    enemies: [
      { hp: 500, atk: 40, mp: 20, defense: 25, crit: 10, agility: 5, count: 1, attackType: 'MELEE', range: 2, movement: 1 },
      { hp: 100, atk: 20, mp: 10, defense: 15, crit: 10, agility: 10, count: 2, attackType: 'RANGED', range: 3, movement: 2 },
      { hp: 60, atk: 15, mp: 5, defense: 8, crit: 15, agility: 20, count: 2, attackType: 'MELEE', range: 1, movement: 3 },
    ],
    rewardCurve: { scale: 1.5, ref: 50, exponent: 1.5, synergyK: 0.25 },
    statWeights: { hp: 0.3, atk: 0.4, mp: 0.3 },
    guaranteedRewardTier: 3,
  },
];

/** Get the weekly boss template based on weekly seed */
export function getWeeklyBoss(seed: number): WeeklyBossTemplate {
  const index = seed % WEEKLY_BOSS_POOL.length;
  return WEEKLY_BOSS_POOL[index];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/constants/weeklyBosses.ts
git commit -m "feat(weekly): pool de 5 bosses semanais rotativos"
```

---

## Task D3: Estender tipos e storage para estado semanal

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/services/storage.ts`

- [ ] **Step 1: Adicionar `weeklyState` ao `GameState`**

Em `src/types/index.ts`, na interface `GameState`:

```ts
  weeklyState?: {
    seed: number;
    quests: { id: string; claimed: boolean }[];
    progress: Record<string, number>;
    allClaimed: boolean;
    bossDefeated: boolean;
  };
```

- [ ] **Step 2: Adicionar `CLAIM_WEEKLY_QUEST` ao `GameAction`**

```ts
  | { type: 'CLAIM_WEEKLY_QUEST'; questId: string }
```

- [ ] **Step 3: Migration v7**

Em `src/services/storage.ts`, mude `CURRENT_VERSION` de `6` para `7`. Adicione:

```ts
7: (state: any) => {
  // weeklyState é inicializado em runtime pelo refreshWeeklyState
  return state;
},
```

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/services/storage.ts
git commit -m "feat(weekly): tipos weeklyState e migration v7"
```

---

## Task D4: Handler semanal

**Files:**
- Create: `src/context/weeklyHandler.ts`
- Create: `src/__tests__/context/weeklyHandler.test.ts`

- [ ] **Step 1: Criar `src/context/weeklyHandler.ts`**

```ts
import { GameState } from '../types';
import { getWeeklySeed, pickWeeklyQuests, WEEKLY_QUEST_POOL, WEEKLY_BONUS_REWARD } from '../constants/weeklyQuests';

export function refreshWeeklyState(state: GameState): GameState {
  const currentSeed = getWeeklySeed();
  if (state.weeklyState?.seed === currentSeed) return state;

  const quests = pickWeeklyQuests(currentSeed);
  return {
    ...state,
    weeklyState: {
      seed: currentSeed,
      quests: quests.map(q => ({ id: q.id, claimed: false })),
      progress: {},
      allClaimed: false,
      bossDefeated: false,
    },
  };
}

export function updateWeeklyProgress(state: GameState, tracker: string, amount: number): GameState {
  if (!state.weeklyState || amount <= 0) return state;

  const progress = { ...state.weeklyState.progress };
  progress[tracker] = (progress[tracker] ?? 0) + amount;

  return {
    ...state,
    weeklyState: { ...state.weeklyState, progress },
  };
}

export function claimWeeklyQuest(state: GameState, questId: string): GameState {
  if (!state.weeklyState) return state;

  const questIdx = state.weeklyState.quests.findIndex(q => q.id === questId);
  if (questIdx < 0) return state;

  const quest = state.weeklyState.quests[questIdx];
  if (quest.claimed) return state;

  const def = WEEKLY_QUEST_POOL.find(q => q.id === questId);
  if (!def) return state;

  const current = state.weeklyState.progress[def.tracker] ?? 0;
  if (current < def.targetValue) return state;

  const quests = [...state.weeklyState.quests];
  quests[questIdx] = { ...quest, claimed: true };

  let bonusGold = def.reward;

  // Check if all claimed
  const allClaimed = quests.every(q => q.claimed);
  if (allClaimed && !state.weeklyState.allClaimed) {
    bonusGold += WEEKLY_BONUS_REWARD;
  }

  return {
    ...state,
    gold: state.gold + bonusGold,
    weeklyState: {
      ...state.weeklyState,
      quests,
      allClaimed,
    },
  };
}

export function markWeeklyBossDefeated(state: GameState): GameState {
  if (!state.weeklyState) return state;
  return {
    ...state,
    weeklyState: { ...state.weeklyState, bossDefeated: true },
  };
}
```

- [ ] **Step 2: Criar teste `src/__tests__/context/weeklyHandler.test.ts`**

```ts
import { refreshWeeklyState, updateWeeklyProgress, claimWeeklyQuest } from '../../context/weeklyHandler';
import { GameState } from '../../types';

const baseState: GameState = {
  gold: 100,
  heroes: [],
  heroesRecruited: 0,
  lastSavedAt: Date.now(),
};

describe('weeklyHandler', () => {
  test('refreshWeeklyState initializes weekly state', () => {
    const state = refreshWeeklyState(baseState);
    expect(state.weeklyState).toBeDefined();
    expect(state.weeklyState!.quests).toHaveLength(3);
    expect(state.weeklyState!.bossDefeated).toBe(false);
  });

  test('refreshWeeklyState is idempotent within same week', () => {
    const state1 = refreshWeeklyState(baseState);
    const state2 = refreshWeeklyState(state1);
    expect(state2).toBe(state1); // same reference
  });

  test('updateWeeklyProgress increments tracker', () => {
    let state = refreshWeeklyState(baseState);
    state = updateWeeklyProgress(state, 'missionsCompleted', 5);
    expect(state.weeklyState!.progress['missionsCompleted']).toBe(5);
    state = updateWeeklyProgress(state, 'missionsCompleted', 3);
    expect(state.weeklyState!.progress['missionsCompleted']).toBe(8);
  });

  test('claimWeeklyQuest awards gold when target met', () => {
    let state = refreshWeeklyState(baseState);
    const questId = state.weeklyState!.quests[0].id;

    // Find the quest def to know the tracker
    const { WEEKLY_QUEST_POOL } = require('../../constants/weeklyQuests');
    const def = WEEKLY_QUEST_POOL.find((q: any) => q.id === questId);

    // Set progress to target
    state = updateWeeklyProgress(state, def.tracker, def.targetValue);
    const goldBefore = state.gold;
    state = claimWeeklyQuest(state, questId);

    expect(state.gold).toBe(goldBefore + def.reward);
    expect(state.weeklyState!.quests.find(q => q.id === questId)!.claimed).toBe(true);
  });

  test('claimWeeklyQuest rejects if target not met', () => {
    let state = refreshWeeklyState(baseState);
    const questId = state.weeklyState!.quests[0].id;
    state = claimWeeklyQuest(state, questId);
    expect(state.weeklyState!.quests.find(q => q.id === questId)!.claimed).toBe(false);
  });

  test('bonus reward when all 3 quests claimed', () => {
    let state = refreshWeeklyState(baseState);
    const { WEEKLY_QUEST_POOL, WEEKLY_BONUS_REWARD } = require('../../constants/weeklyQuests');

    // Complete and claim all 3
    for (const quest of state.weeklyState!.quests) {
      const def = WEEKLY_QUEST_POOL.find((q: any) => q.id === quest.id);
      state = updateWeeklyProgress(state, def.tracker, def.targetValue);
      state = claimWeeklyQuest(state, quest.id);
    }

    expect(state.weeklyState!.allClaimed).toBe(true);
    // Gold should include all rewards + bonus
  });
});
```

- [ ] **Step 3: Rodar testes**

Run: `npm test -- --testPathPattern=weeklyHandler`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/context/weeklyHandler.ts src/__tests__/context/weeklyHandler.test.ts
git commit -m "feat(weekly): handler de reset, progresso e claim semanal"
```

---

## Task D5: Integrar ciclo semanal no tickHandler e reducer

**Files:**
- Modify: `src/context/tickHandler.ts`
- Modify: `src/context/gameReducer.ts`

- [ ] **Step 1: Importar e chamar `refreshWeeklyState` e `updateWeeklyProgress`**

Em `src/context/tickHandler.ts`, adicione import:

```ts
import { refreshWeeklyState, updateWeeklyProgress } from './weeklyHandler';
```

Na função `handleTick`, logo após a chamada a `refreshDailyQuests(state)` (linha ~359):

```ts
stateAfterTick = refreshWeeklyState(stateAfterTick);
```

Após as chamadas a `updateDailyProgress` (linhas ~397-406), adicione as mesmas chamadas para weekly:

```ts
// Weekly progress (same trackers, independent counts)
if (missionsCompletedCount > 0) {
  stateAfterTick = updateWeeklyProgress(stateAfterTick, 'missionsCompleted', missionsCompletedCount);
}
if (totalPointsTrained > 0) {
  stateAfterTick = updateWeeklyProgress(stateAfterTick, 'pointsTrained', totalPointsTrained);
}
if (goldGained > 0) {
  stateAfterTick = updateWeeklyProgress(stateAfterTick, 'goldEarned', goldGained);
}
```

- [ ] **Step 2: Adicionar CLAIM_WEEKLY_QUEST ao reducer**

Em `src/context/gameReducer.ts`, import:

```ts
import { claimWeeklyQuest } from './weeklyHandler';
```

No switch, adicione:

```ts
case 'CLAIM_WEEKLY_QUEST':
  return claimWeeklyQuest(state, action.questId);
```

- [ ] **Step 3: Rodar suíte completa**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/context/tickHandler.ts src/context/gameReducer.ts
git commit -m "feat(weekly): integrar ciclo semanal no tick e reducer"
```

---

## Task D6: UI — WeeklyScreen e card na Village

**Files:**
- Create: `src/screens/WeeklyScreen.tsx`
- Modify: `src/screens/VillageScreen.tsx`

- [ ] **Step 1: Criar `src/screens/WeeklyScreen.tsx`**

```tsx
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useGame } from '../context/GameContext';
import { WEEKLY_QUEST_POOL, getWeeklySeed, WEEKLY_BONUS_REWARD } from '../constants/weeklyQuests';
import { getWeeklyBoss } from '../constants/weeklyBosses';

export function WeeklyScreen() {
  const { state, dispatch } = useGame();
  const weekly = state.weeklyState;
  const seed = getWeeklySeed();
  const boss = getWeeklyBoss(seed);

  // Timer until next Monday 00:00
  const now = new Date();
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  nextMonday.setHours(0, 0, 0, 0);
  const hoursLeft = Math.max(0, Math.ceil((nextMonday.getTime() - now.getTime()) / 3600000));

  const hasStarredHero = state.heroes.some(h => (h.stars ?? 0) > 0);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Desafio Semanal</Text>
      <Text style={styles.timer}>Reseta em {hoursLeft}h</Text>

      {/* Weekly Boss */}
      <View style={styles.bossCard}>
        <Text style={styles.bossName}>🐉 {boss.bossName}</Text>
        <Text style={styles.bossInfo}>
          {boss.minHeroes} heróis | Dificuldade {boss.difficulty} | {boss.baseReward} gold
        </Text>
        {!hasStarredHero ? (
          <Text style={styles.locked}>🔒 Requer 1 herói com estrela</Text>
        ) : weekly?.bossDefeated ? (
          <Text style={styles.completed}>✅ Derrotado esta semana</Text>
        ) : (
          <Text style={styles.available}>Disponível para desafio</Text>
        )}
      </View>

      {/* Weekly Quests */}
      <Text style={styles.sectionTitle}>Missões Semanais</Text>
      {weekly?.quests.map(quest => {
        const def = WEEKLY_QUEST_POOL.find(q => q.id === quest.id);
        if (!def) return null;
        const progress = weekly.progress[def.tracker] ?? 0;
        const pct = Math.min(1, progress / def.targetValue);
        const canClaim = progress >= def.targetValue && !quest.claimed;

        return (
          <View key={quest.id} style={styles.questRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.questName, quest.claimed && styles.questClaimed]}>
                {def.icon} {def.name}
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>{progress}/{def.targetValue} — {def.reward} gold</Text>
            </View>
            {canClaim && (
              <TouchableOpacity
                style={styles.claimBtn}
                onPress={() => dispatch({ type: 'CLAIM_WEEKLY_QUEST', questId: quest.id })}
              >
                <Text style={styles.claimText}>Coletar</Text>
              </TouchableOpacity>
            )}
            {quest.claimed && <Text style={styles.checkmark}>✅</Text>}
          </View>
        );
      })}

      {weekly?.allClaimed && (
        <Text style={styles.bonusText}>🎉 Bônus semanal: +{WEEKLY_BONUS_REWARD} gold!</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#FFD700', textAlign: 'center' },
  timer: { fontSize: 12, color: '#AAA', textAlign: 'center', marginBottom: 16 },
  bossCard: { backgroundColor: '#2A2A3E', borderRadius: 8, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#FFD700' },
  bossName: { fontSize: 18, fontWeight: '700', color: '#FF6B6B', marginBottom: 4 },
  bossInfo: { fontSize: 12, color: '#AAA', marginBottom: 8 },
  locked: { fontSize: 12, color: '#888' },
  completed: { fontSize: 12, color: '#4CAF50' },
  available: { fontSize: 12, color: '#FFD700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#E0E0E0', marginBottom: 12 },
  questRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A2A3E', borderRadius: 6, padding: 12, marginBottom: 8 },
  questName: { fontSize: 13, fontWeight: '600', color: '#E0E0E0' },
  questClaimed: { color: '#888', textDecorationLine: 'line-through' },
  progressBar: { height: 4, backgroundColor: '#333', borderRadius: 2, marginTop: 4 },
  progressFill: { height: 4, backgroundColor: '#FFD700', borderRadius: 2 },
  progressText: { fontSize: 10, color: '#AAA', marginTop: 2 },
  claimBtn: { backgroundColor: '#FFD700', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 8 },
  claimText: { fontSize: 12, fontWeight: '700', color: '#1A1A2E' },
  checkmark: { fontSize: 18, marginLeft: 8 },
  bonusText: { fontSize: 14, fontWeight: '700', color: '#FFD700', textAlign: 'center', marginTop: 12 },
});
```

- [ ] **Step 2: Adicionar card "Desafio Semanal" na VillageScreen**

Em `src/screens/VillageScreen.tsx`, na lista de cards de navegação (por volta da linha 103), adicione um novo card:

```tsx
<VillageCard
  icon="📅"
  title="Desafio Semanal"
  description="Boss rotativo e missões semanais"
  screen="Weekly"
/>
```

- [ ] **Step 3: Registrar a rota `Weekly` na navegação**

Verifique onde as rotas são registradas (provavelmente em `App.tsx` ou um navegador) e adicione a rota para `WeeklyScreen`.

- [ ] **Step 4: Rodar testes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/WeeklyScreen.tsx src/screens/VillageScreen.tsx
git commit -m "feat(ui): WeeklyScreen e card na VillageScreen"
```

---

## Task D7: Testes E2E e validação final

**Files:**
- Nenhum arquivo novo — rodar suítes existentes

- [ ] **Step 1: Rodar suíte unitária completa**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Rodar suíte E2E**

Run: `npm run test:e2e`
Expected: PASS

- [ ] **Step 3: Verificar que nenhuma regressão foi introduzida**

Confirmar que:
- Testes existentes de sinergias, missões, treino, daily quests continuam verdes
- Nenhum tipo TypeScript está quebrado: `npx tsc --noEmit`

- [ ] **Step 4: Commit final se houver ajustes**

```bash
git add -A
git commit -m "test: validação final do roadmap features 2-5"
```
