# Sinergias Qualitativas — Design

**Data**: 2026-04-10
**Status**: Aprovado pelo usuário, aguardando revisão final do spec
**Autor**: brainstorming session
**Escopo**: Substituir o sistema atual de sinergias por efeitos mecânicos qualitativos, dirigidos por hooks dentro do `BattleEngine`. Sem mutação de stats permanentes do herói.

---

## 1. Contexto e problema

O `BALANCE_REPORT.md` (2026-04-10, 2000 iterações por cenário) mostra que **0 das 6 sinergias atualmente definidas têm impacto significativo** (todas com Δ winrate <2pp; "Linha de Frente" marca **−26pp**, claramente ruído).

Diagnóstico no código:

- `src/constants/synergies.ts` define `getSynergyMultipliers(classIds)` retornando `{atk, defense, heal}`.
- O motor de combate em produção é `src/utils/battleEngine.ts`. Ele **nunca importa** `getSynergyMultipliers`. Verificado via grep.
- Apenas o legado `src/utils/battleSim.ts` (não usado pelo `simulationRunner` nem pelo `tickHandler`) consome os multiplicadores.
- `src/context/tickHandler.ts` e `src/context/missionHandler.ts` usam apenas `getActiveSynergies(...).map(s => s.name)` para exibir nomes na UI.

**Conclusão**: as sinergias hoje são puramente cosméticas. Os deltas observados no relatório são ruído estatístico, não efeito de bônus.

## 2. Objetivos

1. Cada uma das 6 sinergias passa a ter um **efeito mecânico distintivo** (não apenas multiplicador numérico).
2. Cada sinergia deve atingir **Δ winrate ≥ +5pp** em testes pareados (comp com sinergia vs. comp equivalente sem) no `balance_analysis.ts`.
3. Stats permanentes do `Hero` **nunca são mutados** pela missão. Bônus vivem em estado transiente do `BattleState`.
4. Sistema extensível: a infraestrutura de buffs/hooks deve servir, no futuro, para equipamentos condicionais e habilidades de classe.

## 3. Não-objetivos

- Rebalancear classes individuais (ex.: subir Tanque diretamente). O Tanque deve melhorar **de carona** via Muralha e Bastião — se ainda ficar fraco depois, é tema de outra task.
- Rebalancear equipamentos (Problema B do menu original).
- UI rica de buffs ativos durante o playback. A UI continua mostrando o **nome** da sinergia ativa; tooltip detalhado é polish posterior.
- Refatorar `processHeroTurn` para um módulo separado. O arquivo `battleEngine.ts` vai crescer ~80 linhas; extrair fica para uma passada futura de limpeza.

## 4. Arquitetura

### 4.1 Princípio

**Stats permanentes do herói nunca são tocados pela missão.** Todo efeito é consultado *no momento do cálculo* a partir de estado transiente em `BattleState`.

### 4.2 Extensão do `BattleState`

Em `src/types/index.ts` (ou onde `BattleState` está exportado em `src/utils/battleEngine.ts`):

```ts
type SynergyId =
  | 'LINHA_DE_FRENTE'
  | 'MURALHA_E_FLECHA'
  | 'BASTIAO'
  | 'CAOS_ARCANO'
  | 'EMBOSCADA'
  | 'ARTILHARIA';

type BuffType =
  | 'atkMul'        // multiplicador de ATK do atacante
  | 'critFlat'      // soma flat ao crit
  | 'rangeFlat'     // soma flat ao range
  | 'defDebuffMul'  // multiplicador <1 aplicado à defesa do alvo
  | 'taunt';        // soma flat ao score de seleção quando este ator é alvo

interface Buff {
  source: SynergyId;
  type: BuffType;
  value: number;
  expiresAfterRound: number; // -1 = persistente até source desativar
}

interface BattleState {
  // ...campos existentes
  activeSynergies: SynergyId[];
  buffs: Record<string, Buff[]>; // chave = heroId | enemyId
  flags: Record<string, boolean | number>; // ex.: bastion_armed_<healerId>
  handlers: SynergyHandlers;
}
```

### 4.3 Sistema de hooks

Novo módulo `src/utils/synergyEffects.ts`:

```ts
interface SynergyHandlers {
  onBattleStart(state: BattleState): void;
  onHealApplied(state: BattleState, healer: Hero, target: Hero, amount: number): void;
  onHeroDamaged(state: BattleState, hero: Hero, hpAfter: number): void;
  onAttackResolved(
    state: BattleState,
    attacker: Hero | BattleEnemy,
    target: Hero | BattleEnemy,
    dmg: number,
    distance: number
  ): void;
  shouldIgnoreDefense(state: BattleState, attacker: Hero | BattleEnemy): boolean;
  modifyTargetScore(
    state: BattleState,
    enemy: BattleEnemy,
    candidate: Hero,
    baseScore: number
  ): number;
}

export function createSynergyHandlers(active: SynergyId[]): SynergyHandlers;
```

`createSynergyHandlers` retorna um objeto consolidado: para cada hook, executa em ordem todos os handlers das sinergias ativas. Sinergias inativas são no-op (sem custo).

### 4.4 Pontos de integração no `BattleEngine`

- **Construção do `BattleState`** (no `simulationRunner.ts` e no `missionHandler.ts` que cria batalha):
  - Computa `activeSynergies` a partir das classes do time via `getActiveSynergies` (renomeada para retornar `SynergyId[]`).
  - Inicializa `buffs = {}`, `flags = {}`.
  - Cria `handlers = createSynergyHandlers(activeSynergies)`.
  - Chama `handlers.onBattleStart(state)` antes do loop principal.
- **`calculateAttack`**:
  - Antes de calcular crit, lê `state.buffs[attacker.id]` e soma `critFlat` de buffs não-expirados.
  - Antes de calcular dano, lê `atkMul` do atacante e `defDebuffMul` do alvo. Se `handlers.shouldIgnoreDefense(state, attacker)` retornar `true`, passa `defense=0` para `calcDamage`.
- **`processHeroTurn`**:
  - Antes de calcular distância de movimento e de ataque, lê `rangeFlat` em `state.buffs[hero.id]` e soma ao `hero.range`.
- **Após aplicar dano em herói** (em `processEnemyTurn`):
  - Chama `handlers.onHeroDamaged(state, finalTarget, finalTarget.hpCurrent)`.
- **Após aplicar cura** (em `executeClassAbility`):
  - Chama `handlers.onHealApplied(state, hero, mostInjured, actualHeal)`.
- **Após `calculateAttack` retornar hit com `dmg > 0`** (em ambos os turnos):
  - Chama `handlers.onAttackResolved(state, attacker, target, dmg, distance)`.
- **`selectTarget`** (apenas inimigos atacando heróis):
  - Após calcular `score` de cada candidato, chama `handlers.modifyTargetScore(state, enemy, candidate, score)` e usa o valor retornado. Implementação do hook olha `state.buffs[candidate.id]` em busca de `taunt`.
- **Início de cada round**:
  - Limpa buffs com `expiresAfterRound < state.rounds`.

### 4.5 Localização do código

| Arquivo | Mudança |
|---|---|
| `src/types/index.ts` | Adiciona `SynergyId`, `BuffType`, `Buff`, `SynergyHandlers`. Estende `BattleState`. |
| `src/constants/synergies.ts` | Cada `SynergyDef` ganha `id: SynergyId`. Mantém `name`, `description`, `classes`. Remove `bonus` (multiplicadores antigos). |
| `src/utils/synergyEffects.ts` | **Novo.** Implementação de cada handler por sinergia + `createSynergyHandlers`. |
| `src/utils/battleEngine.ts` | Recebe `state.handlers`, dispara hooks nos pontos listados em 4.4. Lê buffs em `calculateAttack` e em movimentação. Limpa buffs no início do round. |
| `scripts/utils/simulationRunner.ts` | Inicializa `activeSynergies`, `buffs`, `flags`, `handlers` ao montar `BattleState`. |
| `src/context/missionHandler.ts` | Mesma inicialização do `BattleState` no caminho de produção. |
| `scripts/simulations/balance_analysis.ts` | Mantém o teste pareado existente; agora ele deve passar (Δ ≥ +5pp por sinergia). |
| `src/__tests__/utils/synergies.test.ts` | Reescreve para testar comportamento mecânico de cada sinergia (ver §6.2). |

## 5. Especificação das 6 sinergias

### 5.1 Linha de Frente — Guerreiro + Curandeiro — *Furor*

- **Trigger**: `onHealApplied` quando `target.classId === 'WARRIOR'` e `amount > 0`.
- **Efeito**: aplica `{ source: 'LINHA_DE_FRENTE', type: 'atkMul', value: 1.30, expiresAfterRound: state.rounds + 1 }` em `state.buffs[target.id]`.
- **Stacking**: se já houver buff Furor ativo, refresh do `expiresAfterRound` (não acumula valor).
- **Sentimento**: cura é combustível ofensivo.

### 5.2 Muralha e Flecha — Tanque + Arqueiro — *Posição Fortificada*

- **Trigger**: `onBattleStart` (e re-aplicação após `onHeroDamaged` se condição mudar).
- **Efeito enquanto qualquer Tanque do time estiver vivo**:
  - Para cada Arqueiro vivo: `{ type: 'rangeFlat', value: +1, expiresAfterRound: -1 }` e `{ type: 'critFlat', value: +20, expiresAfterRound: -1 }`.
  - Para cada Tanque vivo: `{ type: 'taunt', value: +60, expiresAfterRound: -1 }`.
- **Quando todos os Tanques morrem** (detectado em `onHeroDamaged` quando o último Tanque vai a 0 HP): remover todos os buffs com `source: 'MURALHA_E_FLECHA'` de todos os atores.
- **`modifyTargetScore`**: se candidato tem buff `taunt` com `source: 'MURALHA_E_FLECHA'`, retorna `baseScore + buff.value`.

### 5.3 Bastião — Tanque + Curandeiro — *Sopro de Esperança*

- **Trigger**: `onHeroDamaged` quando `hero.classId === 'TANK'` e `hpAfter / hero.hpMax < 0.5` e a flag ainda não está armada.
- **Efeito**: seta `state.flags['bastion_armed'] = true`.
- **Consumo**: `executeClassAbility` do Healer verifica `state.flags['bastion_armed']`. Se ativo:
  1. Cura o `mostInjured` normalmente (lógica existente).
  2. Adicionalmente, cura todos os aliados (incluindo o próprio Healer) em distância ≤2 hex do `mostInjured` pelo mesmo `healAmount`.
  3. Limpa a flag.
- **Restrição**: a flag só rearma após ser consumida — não dispara cura AoE a cada tick.

### 5.4 Caos Arcano — Ladino + Mago — *Disjunção*

- **Trigger**: `onAttackResolved` quando `attacker.classId === 'MAGE'` e `dmg > 0`.
- **Efeito**: aplica em `state.buffs[target.id]` o buff `{ source: 'CAOS_ARCANO', type: 'defDebuffMul', value: 0.5, expiresAfterRound: state.rounds + 1 }`.
- **Consumo**: `calculateAttack` calcula `effectiveDefense = (target.defense ?? 0) * defDebuffMulProduct(buffs)`. Aplicado a qualquer atacante (Ladino é o beneficiário óbvio mas não é hardcoded — qualquer follow-up colhe).
- **Stacking**: refresh, não acumula.

### 5.5 Emboscada — Guerreiro + Ladino — *Surpresa*

- **Trigger**: dentro de `calculateAttack`, **antes** de chamar `calcDamage`.
- **Efeito**: `calculateAttack` consulta `handlers.shouldIgnoreDefense(state, attacker)`. Se a sinergia Emboscada está ativa, `state.rounds <= 2`, e `attacker.classId in ('WARRIOR','ROGUE')`, o handler retorna `true`. `calcDamage` é então chamado com `defense=0`.
- **Hook adicional**: o `SynergyHandlers` ganha `shouldIgnoreDefense(state, attacker): boolean`. Default retorna `false`. Apenas Emboscada implementa.
- **Não persiste**: terminado o round 2, o handler retorna `false` automaticamente — não há buff a limpar.

### 5.6 Artilharia — Arqueiro + Mago — *Bombardeio*

- **Trigger**: `onAttackResolved` quando `attacker.classId in ('ARCHER','MAGE')` e `distance >= 2` e `dmg > 0`.
- **Efeito**: com 50% de chance (`rng() < 0.5`):
  1. Encontra inimigos vivos em distância ≤2 hex do alvo principal, exceto o próprio alvo.
  2. Se houver pelo menos um, seleciona aleatoriamente 1 e aplica `Math.max(1, Math.floor(dmg * 0.5))` de dano nele. Pula `calculateAttack` (não erra, não crita).
  3. Empurra um `MissionAction` `actionType: 'hit'` com `text` indicando "explosão" para o playback exibir.
- **Não encadeia**: o dano secundário **não** dispara `onAttackResolved` (evita loop). Implementação: passar uma flag `secondary: true` ou simplesmente mutar HP direto sem reentrar no hook.

## 6. Plano de testes

### 6.1 Critérios de aceitação

- `npm run test` continua verde (não pode regredir suíte unitária).
- `npx ts-node ... balance_analysis.ts` gera novo `BALANCE_REPORT.md` em que **cada uma das 6 sinergias** mostra Δ winrate ≥ +5pp.
- Nenhuma sinergia produz Δ negativo (sintoma de bug).

### 6.2 Testes unitários (`src/__tests__/utils/synergies.test.ts`)

Reescreve para testar comportamento mecânico, não strings:

1. **Linha de Frente**: monta `BattleState` com Guerreiro + Healer. Chama `handlers.onHealApplied(...)` direto. Assert: buff `atkMul=1.30` no Guerreiro, expira no round correto.
2. **Muralha e Flecha**: `onBattleStart` aplica buffs nos Arqueiros e Tanques. Mata o Tanque (`onHeroDamaged` com hp=0). Assert: buffs com `source: 'MURALHA_E_FLECHA'` foram removidos.
3. **Bastião**: dano coloca Tanque em 40% HP → flag armada. Healer roda `executeClassAbility` → flag consumida, aliados em ≤2 hex curados. Segunda execução sem trigger → não cura AoE.
4. **Caos Arcano**: Mago ataca → buff `defDebuffMul=0.5` no inimigo. Outro herói ataca o mesmo inimigo → defesa efetiva é metade. Round seguinte: buff expira.
5. **Emboscada**: Guerreiro ataca em round 1 → defesa do alvo ignorada. Mesma cena em round 3 → defesa normal aplica.
6. **Artilharia**: forçar `rng=0.4` (sub-50%) → dano secundário aplicado em vizinho. `rng=0.6` → não dispara. Verificar que `onAttackResolved` não reentra (sem loop).

### 6.3 Validação por simulação

`balance_analysis.ts` já tem o teste pareado na seção 6 do relatório. Após mudanças, rodar e anexar o `BALANCE_REPORT.md` atualizado ao PR final.

## 7. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| `battleEngine.ts` cresce demais (~80 linhas extras) | Hooks ficam num módulo separado (`synergyEffects.ts`). Engine só dispara — não conhece detalhes de cada sinergia. |
| Performance: buffs consultados a cada ataque | Lista de buffs por ator é pequena (≤5 entradas típicas). Custo desprezível em sim de 2000×N rounds. Validar com timing antes/depois se houver suspeita. |
| Caos Arcano + ordem de turno: Mago pode agir depois do Ladino e o debuff só ajudar no próximo round | Aceitável — é o trade-off do combo de 2 turnos. Se balance_analysis mostrar Δ <5pp, ajustar magnitude (0.5 → 0.4). |
| Bastião: AoE pode ficar absurdo se vários aliados estão agrupados | Cura usa `healAmount` único (não escala com nº de alvos). Se ainda dominar, reduzir alcance para ≤1 hex. |
| Muralha: Tanque pode morrer round 1 e nunca beneficiar Arqueiro | Aceitável — taunt protege o Tanque, então isso só acontece com comps muito mal-pareadas. Confirma que sinergia recompensa proteger o Tanque. |
| Emboscada: dano em round 1-2 já é alto, pode ficar OP em missões curtas | Aceitável e intencional. Se Δ > 25pp em M1, reduzir para "ignora 50% da defesa" em vez de 100%. |

## 8. Critério de "pronto"

1. Código implementado conforme §4.5.
2. Suíte unitária verde (`npm run test`).
3. Suíte E2E verde (`npm run test:e2e`).
4. `BALANCE_REPORT.md` regenerado mostrando Δ ≥ +5pp para cada sinergia.
5. Spec self-review e revisão do usuário aprovados.
