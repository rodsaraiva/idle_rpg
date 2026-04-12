# Roadmap 5 Melhorias — Design Consolidado

**Data**: 2026-04-12
**Status**: Aprovado
**Autor**: brainstorming session
**Escopo**: 5 features implementadas na ordem bottom-up — sinergias qualitativas, habilidades ativas, personalidades na batalha, panteão com fusão, ciclo semanal.

---

## 1. Ordem de implementação

Abordagem bottom-up por infraestrutura:

1. **Sinergias qualitativas** — cria sistema de hooks/buffs no `BattleEngine` (spec existente)
2. **Habilidades ativas por classe** — reutiliza hooks/buffs para skills automáticas
3. **Personalidades na batalha** — aprofunda targeting + efeitos mecânicos via buffs
4. **Panteão + fusão de heróis** — mecânica de estado, reducer, UI
5. **Ciclo semanal** — boss rotativo + quests semanais

Cada passo amplia infraestrutura que o próximo consome. Sinergias → habilidades → personalidades compartilham o mesmo sistema de hooks/buffs.

---

## 2. Sinergias Qualitativas

**Spec completa em**: `docs/superpowers/specs/2026-04-10-sinergias-qualitativas-design.md`

Resumo: sistema de hooks (`SynergyHandlers`) e buffs transientes no `BattleState`. 6 sinergias com efeitos mecânicos (Furor, Posição Fortificada, Sopro de Esperança, Disjunção, Surpresa, Bombardeio). Critério de aceitação: Δ winrate >= +5pp por sinergia.

---

## 3. Habilidades Ativas por Classe

### Conceito

Cada classe tem 2-3 skills desbloqueáveis via `trainingCount`. Todas as skills desbloqueadas ficam disponíveis simultaneamente em combate — a IA do herói dispara automaticamente conforme condições de trigger. Reutiliza a infraestrutura de hooks/buffs criada nas sinergias.

### Desbloqueio

Via `trainingCount` acumulado no stat-chave da classe:

| Classe | Stat-chave | Skill 1 (threshold 20) | Skill 2 (threshold 50) | Skill 3 (threshold 100) |
|--------|-----------|------------------------|------------------------|-------------------------|
| Guerreiro | ATK | Golpe Pesado | Grito de Guerra | Furia |
| Tanque | HP | Provocar | Muralha | Ultimo Suspiro |
| Ladino | ATK | Golpe Furtivo | Veneno | Execucao |
| Arqueiro | ATK | Tiro Certeiro | Chuva de Flechas | Tiro Perfurante |
| Mago | MP | Bola de Fogo | Escudo Arcano | Meteoro |
| Curandeiro | MP | Cura Maior | Purificacao | Ressurreicao |

### Mecanica das skills

- **Golpe Pesado** (Guerreiro): trigger a cada 3 rounds. Dano = ATK x 1.5, ignora 30% da defesa.
- **Grito de Guerra** (Guerreiro): trigger quando aliado cai abaixo de 40% HP. Aliados em <=2 hex ganham buff `atkMul: 1.20` por 2 rounds.
- **Furia** (Guerreiro): trigger quando este heroi cai abaixo de 30% HP. ATK x 1.5 permanente ate o fim da batalha, mas perde 20% DEF.
- **Provocar** (Tanque): trigger no inicio do combate. Aplica `taunt: +80` em si mesmo por 3 rounds.
- **Muralha** (Tanque): trigger quando adjacente a 2+ aliados. Reduz dano recebido em 25% por 2 rounds.
- **Ultimo Suspiro** (Tanque): trigger ao morrer. Aplica buff `defMul: 1.30` em todos os aliados por 2 rounds.
- **Golpe Furtivo** (Ladino): trigger no primeiro ataque de cada combate. Dano x 2.0, crit garantido.
- **Veneno** (Ladino): trigger em hit bem-sucedido com 30% de chance. DoT no alvo por 2 rounds.
- **Execucao** (Ladino): trigger quando alvo tem < 20% HP. Dano x 2.5, ignora defesa.
- **Tiro Certeiro** (Arqueiro): trigger a cada 3 rounds. Ignora evasao, +30% crit chance.
- **Chuva de Flechas** (Arqueiro): trigger a cada 5 rounds. Dano de 50% ATK em todos os inimigos em area 2 hex.
- **Tiro Perfurante** (Arqueiro): trigger contra alvo com DEF > 20. Ignora 60% da defesa.
- **Bola de Fogo** (Mago): trigger a cada 3 rounds. Dano de 80% ATK em alvo + 40% em adjacentes.
- **Escudo Arcano** (Mago): trigger quando recebe dano. Reduz 50% do proximo dano. Cooldown de 4 rounds.
- **Meteoro** (Mago): trigger uma vez por batalha quando >= 3 inimigos vivos. Dano de 100% ATK em area 3 hex.
- **Cura Maior** (Curandeiro): trigger quando aliado < 40% HP. Cura 50% do HP max do alvo (vs cura normal menor).
- **Purificacao** (Curandeiro): trigger quando aliado tem debuff ativo. Remove debuffs e cura 20% HP.
- **Ressurreicao** (Curandeiro): trigger quando aliado morre. Revive com 30% HP. Uma vez por batalha.

### Implementacao tecnica

- **Novo arquivo** `src/constants/skills.ts` com tipo `SkillDef`:
  ```ts
  interface SkillDef {
    id: string;
    classId: ClassId;
    name: string;
    description: string;
    icon: string;
    triggerHook: string;        // qual hook dispara a checagem
    cooldownRounds: number;     // 0 = sem cooldown, -1 = uma vez por batalha
    unlockThreshold: { stat: 'hp' | 'atk' | 'mp'; value: number };
  }
  ```
- **Novo hook** `onSkillCheck(state, hero, context)` no sistema de handlers. O `SynergyHandlers` da spec de sinergias sera estendido para `BattleHandlers` nesta etapa, consolidando hooks de sinergias e skills num unico dispatcher.
- **Estado de cooldown** em `BattleState.skillCooldowns: Record<string, number>` (chave = `heroId_skillId` -> round em que fica disponivel).
- **Funcao** `getUnlockedSkills(hero): SkillDef[]` consulta `trainingCount` vs thresholds.
- **Novos `BuffType`s**: `dot`, `shield`, `revive`, `defMul`.

### UI

- `HeroDetailsModal`: lista de skills com status (desbloqueada/bloqueada + barra de progresso).
- `MissionPlaybackModal`: acoes de skill no log com icone distinto.
- Sem input do jogador — tudo automatico.

---

## 4. Personalidades na Batalha

### Conceito

Aprofundar o impacto mecanico das 5 personalidades alem do targeting, usando o sistema de buffs/hooks.

### Efeitos mecanicos

| Personalidade | Targeting (ja existe) | Novo efeito mecanico |
|---|---|---|
| Sanguinario | +40 score se alvo < 30% HP | Buff `atkMul: 1.15` ao atacar alvo com < 30% HP |
| Guardiao | +100 score em inimigo que ameaca aliado | Ao lado de aliado com < 50% HP, aplica `shield` que absorve 20% do proximo dano no aliado |
| Prudente | +30 score se alvo esta no range | Buff `critFlat: +10` ao atacar sem se mover no turno |
| Vingativo | +50 score em quem atacou este heroi | Buff `atkMul: 1.25` contra o inimigo especifico que o atacou no round anterior |
| Oportunista | +15 se alvo nao e Tank, +10 se < 50% HP | 25% chance de atacar duas vezes se o alvo morrer no primeiro golpe |

### Implementacao tecnica

- **Novo modulo** `src/utils/personalityEffects.ts` — similar ao `synergyEffects.ts`.
- **Novo hook** `onPersonalityTrigger(state, hero, context)` chamado durante `processHeroTurn`.
- **Buffs de personalidade** usam `source: 'PERSONALITY_<id>'` para distinguir de sinergias/skills.
- **Duracao**: buffs de personalidade sao transientes (1 round ou instantaneos), nunca persistentes.

### Interacao com sinergias e skills

Todos coexistem sem conflito — mesmo sistema de buffs, `source` diferente. Mesmo `source` faz refresh, `sources` diferentes acumulam.

### Balanceamento

**Etapa dedicada pos-implementacao**: rodar simulation runner com testes pareados (heroi com personalidade vs mesmo heroi sem efeito mecanico). Target: cada personalidade deve ter Δ winrate entre +3pp e +10pp. Ajustar magnitudes conforme resultado.

### UI

- `HeroCard`/`HeroDetailsModal`: tooltip com efeito mecanico da personalidade.
- `MissionPlaybackModal`: acoes de personalidade no log (ex: "Sanguinario — Furia ativada!").

---

## 5. Panteao — Fusao de Herois

### Conceito

O Panteao e o templo onde o jogador sacrifica 3 herois para criar 1 heroi novo, mais forte. Herois fusionados ganham estrelas e geram bonus passivos para a guilda.

### Mecanica de fusao

1. **Entrada**: jogador seleciona 3 herois IDLE (nao pode estar em missao/treino/enfermaria)
2. **Classe do resultado**: sorteada com probabilidade igual entre as classes dos 3 herois (1/3 cada; classes repetidas aumentam a chance)
3. **Stats base**: heroi novo nasce com stats base da classe sorteada (via `CLASS_DEFS`), como recem-recrutado
4. **Bonus de fusao**: soma os `trainingCount` dos 3 herois, aplica 10% como stats extras permanentes. Ex: 3 herois com total de 100 pontos ATK treinados -> fusionado ganha +10 ATK base
5. **Estrelas**: heroi resultante recebe `max(estrelas dos 3) + 1`
6. **Bonus por estrela**: +5% em todos os stats base por estrela
7. **Personalidade**: sorteada aleatoriamente
8. **Equipamentos**: devolvidos ao inventario antes da fusao
9. **Training counts**: zerados — heroi comeca fresco mas com stats base superiores

### Bonus de guilda do Panteao

| Condicao | Bonus |
|---|---|
| 1 heroi com 1+ estrela | +3% gold em missoes |
| 3 herois com 1+ estrela | +5% gold em missoes |
| 1 heroi com 3+ estrelas | +3% ATK global |
| 5 herois com 1+ estrela | +5% HP global |

Bonus se acumulam em `GameState.pantheonBonuses`.

### Estado no GameState

```ts
// Extensao de GameState
pantheonFusions?: number;           // total de fusoes realizadas
pantheonBonuses?: { goldPercent: number; atkPercent: number; hpPercent: number };

// Extensao de Hero
stars?: number;                     // 0 = normal, 1+ = fusionado
fusionBonus?: { hp: number; atk: number; mp: number };
```

### Storage migration

Versao atual -> proxima: adiciona `stars`, `fusionBonus` nos herois existentes (default 0/undefined), `pantheonFusions` e `pantheonBonuses` no state.

### Acoes do reducer

```ts
| { type: 'FUSE_HEROES'; heroIds: [string, string, string] }
| { type: 'CONFIRM_FUSION'; hero: Hero }
```

### UI

- **PantheonScreen**: substitui o placeholder.
  - Area de fusao: 3 slots para selecionar herois + botao "Fundir"
  - Animacao de revelacao do heroi resultante (similar ao `ChestRevealModal`)
  - Lista de bonus de guilda ativos
  - Contador de fusoes realizadas
- **HeroCard**: indicador visual de estrelas ao lado do nome
- **HeroDetailsModal**: secao mostrando bonus de fusao e estrelas

---

## 6. Ciclo Semanal — Boss Rotativo + Quests Semanais

### Seed semanal

```ts
function getWeeklySeed(): number {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7
  );
  return d.getFullYear() * 100 + weekNumber;
}
```

### Boss semanal rotativo

Pool de 5 bosses especiais. Seed semanal determina qual aparece.

| Boss | Herois | Duracao | Dificuldade | Recompensa |
|---|---|---|---|---|
| Hydra das Profundezas | 4 | 180s | 6 | 300 gold + equip T2 garantido |
| Golem Ancestral | 3 | 150s | 6 | 250 gold + equip T2 garantido |
| Dragao Sombrio | 4 | 240s | 7 | 500 gold + equip T3 garantido |
| Lorde Lich | 3 | 180s | 7 | 400 gold + chance de T3 |
| Tita do Caos | 5 | 300s | 8 | 600 gold + equip T3 garantido |

**Regras**:
- 1 vitoria por semana (pode retentar em caso de derrota)
- Requer pelo menos 1 heroi com estrela para desbloquear (incentiva fusao)
- Inimigos do boss tem stats escalados e habilidades especiais

### Quests semanais

Pool de 6 quests, 3 selecionadas por seed semanal:

```ts
const WEEKLY_QUEST_POOL = [
  { id: 'wq_missions_20', name: 'Completar 20 missoes', targetValue: 20, reward: 200, tracker: 'missionsCompleted' },
  { id: 'wq_train_100', name: 'Treinar 100 pontos', targetValue: 100, reward: 150, tracker: 'pointsTrained' },
  { id: 'wq_forge_5', name: 'Forjar 5 equipamentos', targetValue: 5, reward: 200, tracker: 'itemsForged' },
  { id: 'wq_gold_1000', name: 'Ganhar 1000 de ouro', targetValue: 1000, reward: 250, tracker: 'goldEarned' },
  { id: 'wq_boss_1', name: 'Derrotar o boss semanal', targetValue: 1, reward: 300, tracker: 'weeklyBossKills' },
  { id: 'wq_fuse_1', name: 'Realizar 1 fusao', targetValue: 1, reward: 250, tracker: 'fusionsCompleted' },
];

const WEEKLY_BONUS_REWARD = 500;
```

### Estado no GameState

```ts
weeklyState?: {
  seed: number;
  quests: { id: string; claimed: boolean }[];
  progress: Record<string, number>;
  allClaimed: boolean;
  bossDefeated: boolean;
};
```

### Reset semanal

Funcao `refreshWeeklyState(state)` — mesma estrutura de `refreshDailyQuests`. Compara seed, reseta se diferente. Chamada no tick handler.

### Storage migration

Parte da mesma migration que adiciona campos do Panteao. Adiciona `weeklyState` ao GameState.

### UI

- **VillageScreen**: novo card "Desafio Semanal" com timer de reset
- **WeeklyScreen** (nova tela): boss da semana + quests semanais + progresso + timer
- Reutiliza componentes existentes (`MissionListItem`, `HPBar`, `StatBar`)

### Tracker de progresso

Trackers semanais sao independentes dos diarios — completar uma missao incrementa ambos. Infraestrutura de tracking no `tickHandler` e estendida para despachar para `weeklyState.progress`.

---

## 7. Criterios de aceitacao globais

1. `npm run test` verde apos cada feature
2. `npm run test:e2e` verde apos cada feature
3. Sinergias: Δ winrate >= +5pp por sinergia no `balance_analysis.ts`
4. Personalidades: Δ winrate entre +3pp e +10pp em testes pareados (etapa de balanceamento dedicada)
5. Habilidades: cada skill deve ter impacto mensuravel em simulacao
6. Storage migration sem perda de dados de saves existentes
7. Nenhuma mutacao de stats permanentes do Hero durante batalha (principio da spec de sinergias)

## 8. Riscos e mitigacoes

| Risco | Mitigacao |
|---|---|
| Complexidade acumulada dos hooks (sinergias + skills + personalidades) | Cada sistema usa `source` distinto nos buffs. Handlers sao modulos separados. |
| Skills desbalanceadas (Ressurreicao muito forte) | Etapa de simulacao dedicada por feature. Ajuste iterativo com simulation runner. |
| Fusao pode inflar stats rapidamente | Training counts zerados no fusionado. Bonus de 10% e estrelas (+5%) sao moderados. |
| Boss semanal muito dificil/facil | Stats dos bosses calibrados via simulacao. Requisito de heroi com estrela garante progressao minima. |
| Migration de storage quebra saves antigos | Testes de migration v->v+1 com fixtures de saves reais. |
| `battleEngine.ts` fica muito grande | Logica de skills e personalidades em modulos separados (`skillEffects.ts`, `personalityEffects.ts`). Engine so dispara hooks. |
