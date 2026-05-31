# Resolução de Gaps — Design Consolidado

> **Origem:** auditoria multi-agente de 2026-05-31 (`docs/auditoria-gaps-2026-05-31.md`) — 46 gaps confirmados em 6 temas.
> **Objetivo:** fechar todos os gaps de integração/apresentação que tornam sistemas prontos (backend + testes) invisíveis ou inertes para o jogador, e quitar a dívida de teste/limpeza.
> **Não-objetivo:** redesenhar mecânicas existentes. Quase nada de lógica nova de jogo — o esforço é **fiação** (wiring), não design de sistema.

## Contexto

O projeto tem backend sólido: reducer completo com migrations (v8), motor de combate integrado, economia fechada, 343 testes unit + 56 e2e verdes, `tsc` limpo. A auditoria revelou que o buraco está na **camada de apresentação/integração**:

- Três sistemas completos (Panteão/fusão, ciclo Semanal, Guilda) têm handler + testes mas **nenhuma UI alcançável**.
- Três bônus calculados (`permanentBonuses`, `pantheonBonuses`, e `materials` que gateiam a forja) são **dados mortos** — escritos no estado, nunca lidos/aplicados.
- Três trackers de quest semanal **nunca incrementam** → quests impossíveis de completar.
- Quatro caminhos de combate (AoE de skill, AOE de inimigo, ataque-extra do Oportunista, curas de skill) **ignoram escudos/reações/sinergias**.
- Dívida de teste (testes em pasta que o runner ignora) e dead code.

## Restrições de projeto (invioláveis)

Do `CLAUDE.md` e memórias do projeto:

1. **Sem gold passivo** — gold só de missões completadas. (Não introduzir nenhuma fonte de gold por tick fora de missão.)
2. **DEF/CRIT/AGI não treináveis diretamente** — crescem só via equipamentos/passivos/bônus, nunca treino direto.
3. **Integração > mock** em testes — preferir comportamento real; nada de mock de estado crítico.
4. **UI validada no browser** (Playwright) antes de declarar pronta — type-check e teste não garantem UX.
5. `npm test` + `npx tsc --noEmit` verdes antes de cada commit. Commits pequenos por unidade coerente.

## Decisões de design (confirmadas com o usuário)

- **Estrutura:** 1 spec consolidado (este) + 5 plans por **fase de execução**.
- **GuildScreen:** manter e tornar acessível (rota + card na Vila). É o roster de heróis + recrutar por gold direto, complementar ao Shop (recruta por baús).
- **Boss semanal:** encontro como **missão especial** reusando `battleEngine` + `WEEKLY_BOSS_POOL`. Sem fluxo de combate novo.

## Arquitetura da solução por fase

As fases seguem a ordem de ataque do relatório: maior ROI / menor risco primeiro. Cada fase é independentemente entregável e testável.

---

### Fase 1 — Backend wiring (Temas A + C)

**Gaps:** `permanentBonuses` e `pantheonBonuses` nunca aplicados; trackers `itemsForged`/`fusionsCompleted`/`weeklyBossKills` nunca incrementam.

**Problema-raiz (Tema A):** os bônus de equipamento são aplicados **inline e duplicados** (`missionHandler.ts:88-110` para combate; `tickHandler.ts:262-268`), e não há ponto único onde somar os outros dois bônus.

**Design — helper central de stats efetivos:**

Criar `getEffectiveStats` em `src/utils/heroUtils.ts`:

```ts
export interface EffectiveStats {
  hpMax: number; atk: number; mp: number;
  defense: number; crit: number; agility: number;
}

/**
 * Stats de combate efetivos: base (treinado) + equipamento + bônus permanentes
 * (conquistas, flat) + bônus de panteão (percentual). Único ponto de verdade.
 */
export function getEffectiveStats(hero: Hero, state: GameState): EffectiveStats;
```

Ordem de composição (determinística): `base → + equipamento (flat) → + permanentBonuses (flat atk/hp) → × pantheonBonuses (atkPercent/hpPercent)`. DEF/CRIT/AGI só recebem equipamento (respeita a restrição #2). `pantheonBonuses` aplica multiplicador percentual sobre atk e hpMax; HP atual escala proporcional ao ganho de hpMax (mesma regra já usada em `missionHandler.ts:106-108`).

**Pontos de reuso:**
- `missionHandler.ts:88-110` — substituir o bloco `heroesWithEquipment` por `getEffectiveStats`.
- `tickHandler.ts:262-268` — substituir a aplicação inline de equipamento.
- `HeroDetailsModal.tsx` — exibir stats efetivos (com indicação do delta vs. base), para o jogador **ver** o efeito dos bônus.

**Design — gold do panteão:** `pantheonBonuses.goldPercent` multiplica a recompensa de gold de missão. Aplicar no **momento da concessão do gold** (`handleCompleteMission`, antes de `gold: state.gold + reward` em `missionHandler.ts:169`), e no caminho equivalente de auto-conclusão por tick — onde `pantheonBonuses` está garantidamente atualizado, evitando "assar" o bônus no `precomputedOutcome` calculado no início da missão. Centralizar num helper `applyGoldBonus(reward, state)` reusado pelos dois sites de conclusão. Não cria gold passivo — só amplifica recompensa de missão concluída (respeita #1).

**Design — trackers semanais:**
- `equipmentHandler.ts:46` — adicionar `updateWeeklyProgress(state, 'itemsForged', 1)` ao lado do daily existente.
- `pantheonHandler.ts:120` (em `handleFuseHeroes`) — adicionar `updateWeeklyProgress(state, 'fusionsCompleted', 1)`.
- `weeklyBossKills` — incrementado na vitória do boss (entregue na Fase 4).

**Critérios de aceitação:**
- Herói com conquista de +atk reflete o bônus no dano de combate e no HeroDetailsModal.
- Com `pantheonBonuses` ativo, recompensa de gold e atk/hp de combate sobem proporcionalmente.
- Forjar item e completar fusão incrementam os respectivos trackers semanais.
- Testes unit cobrindo `getEffectiveStats` (cada fonte isolada + combinada), gold% e cada tracker.

---

### Fase 2 — Telas / UI (Tema B)

**Gaps:** WeeklyScreen inexistente; PantheonScreen é `ComingSoon`; GuildScreen órfã; `materials` nunca exibidos; Vila sem cards de Guilda/Semanal.

**Design — `WeeklyScreen`** (molde: `DailyQuestsScreen.tsx`, 411 linhas):
- Hook `useWeekly` (espelha `useGame`/dailyQuests) expondo `weeklyState`, lista de quests com progresso/claim, e o boss da semana (`getWeeklyBoss(seed)`).
- Lista de quests semanais com barra de progresso e botão "Resgatar" (dispatch `CLAIM_WEEKLY_QUEST`).
- Card do boss da semana com botão "Enfrentar Boss" → inicia o encontro (Fase 4). Até a Fase 4, o botão fica desabilitado/"em breve".
- Registrar rota oculta no `AppNavigator` + card "Semanal" na Vila.

**Design — `PantheonScreen`** (substituir placeholder):
- Hook `usePantheon` expondo heróis elegíveis para fusão, `pantheonBonuses`, `pantheonFusions`.
- Fluxo: selecionar 3 heróis (modal de seleção, reusar padrão de `MissionHeroSelectionModal`) → confirmar → `dispatch FUSE_HEROES` → exibir herói fundido (estrelas via `HeroCard`) e resumo dos bônus de panteão atualizados.
- Mostrar o efeito acumulado (`pantheonBonuses` em %), tornando visível o sistema da Fase 1.

**Design — `GuildScreen`:** registrar como rota no `AppNavigator` + card "Guilda" na Vila. Sem mudança de lógica (tela já funcional). Passo inicial do plano: confirmar ausência de duplicação problemática com o recrutamento do Shop (mecânicas distintas: gold direto vs. baús — coexistem).

**Design — inventário de materiais:** exibir `state.materials` na `BlacksmithScreen` (a forja já é gated por eles) — lista de material → quantidade, com destaque do que falta para a receita selecionada. Opcional: refletir drops no `MissionResultModal`.

**Critérios de aceitação:**
- Vila mostra 8 cards (6 atuais + Guilda + Semanal), todos navegáveis.
- WeeklyScreen: jogador vê quests, progresso real (vindo do tick) e resgata recompensa.
- PantheonScreen: jogador funde 3 heróis e vê o resultado + bônus.
- BlacksmithScreen mostra materiais; forja bloqueada deixa claro o material faltante.
- Cada tela validada no browser (Playwright) + e2e cobrindo o fluxo.

---

### Fase 3 — Combate (Tema D)

**Gaps:** dano de AoE e ataques reativos ignoram escudo/reações/sinergias, divergindo do ataque normal.

**Padrão de referência (já correto):** o ataque normal herói→inimigo (`battleEngine.ts:599-609`) aplica `getShieldReduction` + `onEnemyDamagedSkills` + `onAttackResolved`; o inimigo→herói (`battleEngine.ts:734-748`) aplica `getShieldReduction` + `onHeroDamaged`/`onHeroDamagedSkills`. **Todos os caminhos de dano devem passar por esses mesmos hooks.**

**Correções:**
1. **AoE de skill** (`skillEffects.ts`: Chuva de Flechas, Bola de Fogo, Meteoro) — hoje fazem `enemy.hp -= dmg` cru. Rotear cada hit por `getShieldReduction` + `onEnemyDamagedSkills`.
2. **AOE de inimigo** (`enemySkillEffects.ts`, AOE_ATTACK) — aplicar `getShieldReduction` + `onHeroDamagedSkills` em cada herói atingido.
3. **Ataque-extra do Oportunista** (`battleEngine.ts:614-632`) — reusar o caminho normal (escudo, reações, `lastAttacker`, veneno de Rogue) em vez de aplicar dano cru.
4. **Curas de skill** (`skillEffects.ts`: Cura Maior, Purificação) — chamar `state.handlers.onHealApplied` para disparar a sinergia LINHA_DE_FRENTE, como faz a habilidade de classe do Healer (`battleEngine.ts:499`).

**Estratégia de teste (TDD — escrever ANTES do fix):**
- Testes de integração: AoE com alvo sob escudo recebe dano reduzido; AoE dispara reação `onEnemyDamaged`; ataque-extra do Oportunista respeita escudo e aplica veneno; cura de skill incrementa o contador da sinergia de cura.
- Garantir que os ~343 testes existentes continuam verdes (mudança não deve regredir o dano base).

**Critérios de aceitação:** nenhum caminho de dano/cura ignora escudo/reação/sinergia; testes de integração cobrindo cada um dos 4 casos.

---

### Fase 4 — Boss semanal (fecha o ciclo)

**Gap:** `WEEKLY_BOSS_POOL` (5 bosses) e `markWeeklyBossDefeated` existem, mas não há como **lutar** contra o boss; `weeklyBossKills` nunca incrementa.

**Design — boss como missão especial:**
- Reusar a infra de missão (`ActiveMission`, `battleEngine`, `tickHandler`). Adicionar campo opcional `ActiveMission.isWeeklyBoss?: boolean` (sem migration — `activeMissions` é estado transitório).
- Nova ação `START_WEEKLY_BOSS` (ou estender `START_MISSION` com `weeklyBoss: true`): constrói uma `ActiveMission` a partir de `getWeeklyBoss(seed)` (mapear `WeeklyBossTemplate.enemies` → `enemiesState`, usar `durationMs`/`minHeroes`/recompensas do template), marca `isWeeklyBoss`.
- Na conclusão (`missionHandler`/`tickHandler`), se `isWeeklyBoss` e vitória: chamar `markWeeklyBossDefeated(state)` + `updateWeeklyProgress(state, 'weeklyBossKills', 1)`, conceder recompensa do template (incl. `guaranteedRewardTier`). Boss derrotado uma vez por semana (checar `weeklyState.bossDefeated`).
- Botão "Enfrentar Boss" na `WeeklyScreen` (Fase 2) torna-se ativo; desabilita quando `bossDefeated` na semana corrente.

**Critérios de aceitação:** jogador inicia o encontro de boss da semana, vence e vê `bossDefeated`; a quest `wq_boss_1` completa e é resgatável; boss indisponível após derrotado na mesma semana. Testes unit do build do encontro e da conclusão (vitória/derrota); e2e do fluxo.

---

### Fase 5 — Testes + limpeza (Temas E + F)

**Gaps de teste:**
- `src/utils/__tests__/*` (heroFactory, gameMath, battleEngine, offlineProgress) **não casam** com o `testMatch` do `jest.unit.config.js` (`**/src/__tests__/**`) → **nunca rodam** no `npm test`; `trainingMath` fica 0%. **Ação:** mover esses arquivos para `src/__tests__/utils/` (resolver duplicidade com os testes homônimos já existentes lá) e cobrir edge cases de `trainingMath` (k=0, cap).
- `achievementHandler` sem teste unit → adicionar (condition/reward).
- Hooks críticos sem teste (`useShop`, `useMissionPlayback`, `useDragDropGrid`) → testar a lógica de cálculo/validação.

**Limpeza (dead code / tech debt):**
- Remover `getDefMulProduct` (`skillEffects.ts`, exportado e nunca chamado).
- Remover/decidir `offlineGold` (`offlineProgress.ts:23`, nunca incrementado) — remover, respeitando "sem gold passivo".
- Remover JSX/estilos/imports comentados em `VillageScreen.tsx`.
- Guardar `console.log/error` com `__DEV__` (`storage.ts`, `missionHandler.ts:129`).
- Tipar `condition` de achievements (`achievements.ts:6`) com `(state: GameState) => boolean`, reduzindo `any`.

**Critérios de aceitação:** `trainingMath` e `achievementHandler` com cobertura; testes movidos rodando no `npm test`; zero dead code listado; `tsc` limpo; sem `any` evitável nos pontos citados.

---

## Mudanças de tipo / estado / migration

- **Sem novas migrations obrigatórias:** os campos `permanentBonuses`, `pantheonBonuses`, `materials`, `weeklyState` já existem em `GameState` (migrations v6-v8). Já são opcionais e tolerados por saves antigos.
- **Novo campo transitório:** `ActiveMission.isWeeklyBoss?: boolean` (Fase 4) — sem migration (estado de runtime).
- **Possível nova `GameAction`:** `START_WEEKLY_BOSS` (Fase 4) — adicionar ao union em `types/index.ts` e ao reducer.

## Riscos e mitigação

- **Regressão de combate (Fase 3):** mudar caminhos de dano pode alterar balance. Mitigar com TDD (testes antes), rodar `npm run simulate:*` para comparar resultados de batalha antes/depois.
- **Stats efetivos em dobro (Fase 1):** risco de aplicar bônus duas vezes se algum site antigo não for migrado para o helper. Mitigar centralizando 100% das aplicações e cobrindo com teste.
- **UX das telas novas (Fase 2):** validar no browser; reusar componentes/telas-molde para consistência visual.

## Sequência de entrega

1. **Fase 1** (backend wiring) — destrava valor imediato, menor risco.
2. **Fase 2** (UI) — torna 3 sistemas jogáveis; depende da Fase 1 para exibir bônus reais.
3. **Fase 3** (combate) — independente; TDD.
4. **Fase 4** (boss) — depende da Fase 2 (botão na WeeklyScreen) e fecha o tracker da Fase 1.
5. **Fase 5** (testes + limpeza) — por último, não-bloqueante para o jogador.

Cada fase termina com `npm test` + `tsc` verdes e (quando há UI) validação no browser, seguida de commit por unidade coerente.
