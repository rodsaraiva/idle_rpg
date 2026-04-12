# Crafting com Materiais + Skills de Inimigo + Notificações de Marco — Design

**Data**: 2026-04-12
**Status**: Aprovado
**Autor**: brainstorming session
**Escopo**: 3 features independentes implementadas na ordem: materiais/crafting, skills de inimigo, notificações de marco.

---

## 1. Ordem de implementação

1. **Crafting com Materiais** — novo sistema de drops e receitas de forja
2. **Skills de Inimigo** — pool de 8 skills atribuídas por dificuldade
3. **Notificações de Marco** — toasts dourados para 7 eventos de progressão

Features são independentes entre si. A ordem é por prioridade de impacto no gameplay.

---

## 2. Crafting com Materiais

### 2.1 Materiais

4 tipos de materiais:

| Material | Id | Drop de | Uso principal |
|----------|----|---------|---------------|
| Fragmento de Ferro | `iron` | Inimigos MELEE | Armas |
| Cristal Arcano | `crystal` | Inimigos RANGED | Acessórios |
| Essência Vital | `essence` | Qualquer (raro) | Armaduras |
| Pedra Estelar | `starstone` | Bosses / missões diff 4+ (muito raro) | Tier Épico |

### 2.2 Drop por inimigo derrotado

Cada inimigo morto rola um drop. Chance e qualidade escalam com stats do inimigo:

- **Chance base**: `min(0.8, (enemy.hp + enemy.atk) / 100)` — orcs fracos ~10-15%, boss ~80%
- **Quantidade por drop**: 1-3, baseado na `difficulty` da missão (`1 + floor(difficulty / 3)`)
- **Tipo de material**:
  - MELEE → Ferro (80%), Essência (10%), Cristal (10%)
  - RANGED → Cristal (80%), Essência (10%), Ferro (10%)
  - Pedra Estelar: 2% chance adicional apenas em missões com `difficulty >= 4`

Drops são acumulados durante a batalha e somados ao `GameState.materials` quando a missão completa com sucesso. Em caso de derrota, jogador recebe 25% dos drops (floor).

### 2.3 Receitas de forja

Gold vira taxa fixa pequena. Materiais são o custo principal:

| Tier | Arma | Armadura | Acessório | Taxa gold |
|------|------|----------|-----------|-----------|
| Comum (1) | 3 Ferro | 3 Essência | 3 Cristal | 10 |
| Raro (2) | 8 Ferro + 2 Essência | 8 Essência + 2 Cristal | 8 Cristal + 2 Ferro | 30 |
| Épico (3) | 15 Ferro + 5 Cristal + 2 Pedra Estelar | 15 Essência + 5 Ferro + 2 Pedra Estelar | 15 Cristal + 5 Essência + 2 Pedra Estelar | 80 |

### 2.4 Mudanças na forja

- `handleForgeEquipment` passa a receber `equipmentType: 'weapon' | 'armor' | 'accessory'` além de `tier`
- Valida materiais + gold antes de iniciar forja
- Deduz materiais do `GameState.materials`
- O equipamento gerado mantém a aleatoriedade de stats dentro do tipo/tier

### 2.5 Estado no GameState

```ts
materials?: Record<string, number>;  // "iron" | "crystal" | "essence" | "starstone" → quantidade
```

### 2.6 Storage migration

Migration v8: inicializa `materials` como `{}` se não existir.

### 2.7 GameAction

```ts
| { type: 'FORGE_EQUIPMENT'; tier: number; equipmentType: 'weapon' | 'armor' | 'accessory'; now: number }
```

Nota: `FORGE_EQUIPMENT` já existe — o campo `equipmentType` é adicionado. Chamadas existentes que não passam `equipmentType` devem ser atualizadas na UI.

### 2.8 Constantes

Novo arquivo `src/constants/materials.ts`:
- `MaterialId` type
- `MATERIALS` array com id, name, icon
- `FORGE_RECIPES` record de receitas por tier+tipo
- `getDropsForEnemy(enemy, missionDifficulty, rng)` função de drop

### 2.9 Integração no fluxo de missão

Em `missionHandler.ts` / `tickHandler.ts`, após completar missão:
1. Calcular drops a partir da lista de inimigos derrotados
2. Se vitória: adicionar 100% dos drops ao `state.materials`
3. Se derrota: adicionar 25% (floor) dos drops

### 2.10 MissionOutcome

Estender para incluir:
```ts
materialDrops?: Record<string, number>;  // materiais obtidos nesta missão
```

---

## 3. Skills de Inimigo

### 3.1 Pool de skills

8 skills com `minDifficulty` para controlar progressão:

| Id | Nome | Trigger | Efeito | minDifficulty |
|----|------|---------|--------|---------------|
| `CHARGE` | Investida | Round 1 | +30% ATK no primeiro ataque | 1 |
| `CARAPACE` | Couraça | Passivo | +20% DEF enquanto HP > 50% | 2 |
| `INTIMIDATE` | Grito Intimidante | Round 1 | -10% ATK em heróis adj. por 2 rounds | 3 |
| `REGEN` | Regeneração | A cada 3 rounds | Recupera 10% HP máximo | 3 |
| `POISON` | Veneno | 20% chance no hit | DoT de 5% ATK por 2 rounds | 4 |
| `AOE_ATTACK` | Ataque em Área | A cada 4 rounds | 50% ATK em 2 heróis mais próximos | 5 |
| `MAGIC_SHIELD` | Escudo Mágico | Ao receber dano | Absorve 30% do próximo hit. Cooldown 4 rounds | 5 |
| `BOSS_FURY` | Fúria do Boss | HP < 25% | +50% ATK permanente (once) | 6 |

### 3.2 Atribuição de skills

Na criação do inimigo (`BattleEngine.createEnemies`), baseado na `difficulty` da missão:

| Dificuldade | Skills por inimigo | Pool |
|-------------|-------------------|------|
| 1-2 | 0-1 | minDifficulty 1-2 |
| 3-4 | 1-2 | minDifficulty 1-4 |
| 5+ | 2-3 | minDifficulty 1-5+ |
| Weekly bosses | 2-3 + BOSS_FURY garantida | Todas |

Seleção: filtrar pool por minDifficulty <= mission difficulty, shuffle, pegar N skills.

### 3.3 Tipo `EnemySkillDef`

```ts
interface EnemySkillDef {
  id: string;
  name: string;
  cooldownRounds: number;  // 0 = condicional, -1 = once, N = a cada N rounds
  minDifficulty: number;
}
```

### 3.4 Extensão de BattleEnemy

```ts
export interface BattleEnemy {
  // ... campos existentes
  skills?: EnemySkillDef[];
  skillCooldowns?: Record<string, number>;
  skillOnceUsed?: Record<string, boolean>;
}
```

### 3.5 Módulo `src/utils/enemySkillEffects.ts`

Espelha `skillEffects.ts`:
- `executeEnemyPreAttackSkills(enemy, target, state, rng)` → chamado antes do ataque em `processEnemyTurn`
- `onEnemyDamagedSkills(enemy, state)` → chamado após herói causar dano
- `applyEnemyPassiveSkills(enemy, state)` → chamado no início do turno (Couraça)
- Reutiliza sistema de buffs com `source: 'ENEMY_<skillId>'`
- `processEnemyRegenBuffs(state)` → chamado no início de cada round (similar ao processDoTBuffs)

### 3.6 Integração no BattleEngine

- `processEnemyTurn`: chamar `applyEnemyPassiveSkills` + `executeEnemyPreAttackSkills` antes do ataque
- `processHeroTurn`: após dano em inimigo, chamar `onEnemyDamagedSkills`
- Início de cada round (em `battleSim.ts`): chamar `processEnemyRegenBuffs`

### 3.7 UI

No `MissionPlaybackModal`, ações de skills de inimigo aparecem no log com prefixo `"⚡ {enemyId} — {skillName}:"`.

---

## 4. Notificações de Marco

### 4.1 Mecanismo

Reutilizar `FeedbackService.emit('TOAST', ...)` com novo tipo `milestone`:
- Estilo visual: dourado
- Duração: 4s (vs padrão 2-3s)

```ts
FeedbackService.emit('TOAST', {
  message: '⚔️ Golpe Pesado desbloqueado!',
  type: 'milestone',
});
```

### 4.2 Os 7 marcos

| # | Marco | Onde detectar | Mensagem template |
|---|-------|---------------|-------------------|
| 1 | Skill desbloqueada | `tickHandler` — comparar `getUnlockedSkills` antes/depois do treino | `"{icon} {hero} desbloqueou {skillName}!"` |
| 2 | Primeira fusão | `handleFuseHeroes` — `pantheonFusions` 0→1 | `"🏛️ Primeira fusão realizada!"` |
| 3 | Herói com estrela | `handleFuseHeroes` — sempre (resultado) | `"⭐ {heroName} nasceu com {n} estrela(s)!"` |
| 4 | Quest semanal completa | `claimWeeklyQuest` — ao marcar claimed | `"📅 Quest semanal concluída!"` |
| 5 | Boss semanal derrotado | `markWeeklyBossDefeated` | `"🐉 Boss semanal derrotado!"` |
| 6 | Primeiro equip de tier | `handleForgeEquipment` — checar se é o 1o do tier | `"🔨 Primeiro equipamento {tierName} forjado!"` |
| 7 | Material raro dropado | Processamento de drops — quando dropa Pedra Estelar | `"💎 Pedra Estelar obtida!"` |

### 4.3 Implementação

Novo helper `src/services/milestones.ts`:
- Funções específicas por contexto (`emitSkillUnlocked`, `emitFirstFusion`, etc.)
- Cada função chama `FeedbackService.emit` internamente
- Sem estado persistente — detecção por diff (antes/depois) no momento da ação

### 4.4 Integração

Chamadas inseridas nos handlers existentes:
- `tickHandler.ts`: detecção de skill unlock após treino
- `pantheonHandler.ts`: fusão e estrela
- `weeklyHandler.ts`: quest e boss
- `equipmentHandler.ts`: primeiro tier
- `missionHandler.ts` / `tickHandler.ts`: drop de material raro

---

## 5. Critérios de aceitação

1. `npm test` verde após cada feature
2. `npm run test:e2e` verde após cada feature
3. Materiais: drop funcional em simulação, receitas cobram materiais corretamente
4. Skills de inimigo: cada skill tem teste mecânico unitário
5. Milestones: cada um dos 7 marcos emite toast no cenário correto
6. Storage migration sem perda de dados de saves existentes
7. Nenhuma mutação de stats permanentes do Hero/Enemy fora do BattleState

## 6. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Drops inflacionam materiais rápido demais | Chances conservadoras (10-15% para inimigos fracos). Ajustar pós-simulação. |
| Skills de inimigo tornam missões impossíveis | minDifficulty garante progressão gradual. Simulação para calibrar. |
| Muitas notificações spam | Apenas 7 marcos distintos, tipo milestone com duração maior para dar destaque sem irritar. |
| Forja com tipo + tier aumenta complexidade da UI | UI de forja ganha selector de tipo antes do tier. Simples. |
| `battleEngine.ts` cresce demais | Skills de inimigo ficam em módulo separado (`enemySkillEffects.ts`). Engine só dispara hooks. |
