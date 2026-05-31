<!-- Auditoria automatizada (workflow multi-agente): 46 gaps confirmados, 8 descartados. Data: 2026-05-31 -->

# RELATÓRIO EXECUTIVO — Auditoria idle_rpg

## 1. Veredito geral

O **backend e a lógica de jogo estão sólidos**: reducer completo com migrations, motor de combate bem integrado no fluxo principal, economia fechada (recrutar→treinar→missão→forjar) e 343 testes unit + 56 e2e passando, tsc limpo. O problema é **entrega na camada de apresentação**: três sistemas inteiros (Panteão/fusão, ciclo Semanal, Guilda) têm handler + testes prontos mas **nenhuma UI alcançável**, e três bônus calculados (pantheon, achievements, materiais) são **dados mortos** que nunca afetam o jogo. Praticamente todos os gaps são frontend/integração — nenhuma lógica de backend está faltando.

## 2. Gaps por tema (prioridade decrescente)

### TEMA A — Bônus calculados mas nunca aplicados (CRÍTICO de valor para o jogador)
Sistemas que o jogador investe mas não recebem efeito. Estes são os mais danosos porque quebram silenciosamente a progressão.

| Gap | Sev | Evidência | Ação |
|---|---|---|---|
| `permanentBonuses` de conquistas nunca somados aos stats | **alta** | `achievementHandler.ts:28-31` grava; nenhum consumo em `tickHandler` processTraining / `battleSim` | Aplicar atk/hp em heróis antes de treino e combate (montar heroes com equipamento+permanentes). |
| `pantheonBonuses` (gold/atk/hp%) nunca usados | **alta** | `pantheonHandler.ts:123` calcula; zero refs em `gameMath`/`tickHandler:418`/`battleSim` | Passar pantheonBonuses para `calcMissionReward` e cálculo de stats de combate. |

### TEMA B — Sistemas completos sem UI (quick wins de alto impacto)
Backend + testes prontos, falta só a tela. Ver seção 3.

| Gap | Sev | Evidência | Ação |
|---|---|---|---|
| Ciclo Semanal: zero UI (sem WeeklyScreen, sem card, sem rota) | **alta** | `weeklyHandler.ts` completo; `tickHandler.ts:373,449-457` alimenta; sem `WeeklyScreen.tsx` | Criar WeeklyScreen (espelhar DailyQuestsScreen), card na Vila e rota oculta no navigator. |
| PantheonScreen é placeholder ComingSoon | **alta** | `PantheonScreen.tsx:4-12`; handler completo `pantheonHandler.ts:102-126` | Implementar tela de fusão (seleção de 3 heróis → dispatch FUSE_HEROES → exibir resultado/bônus). |
| GuildScreen órfã — existe mas não registrada no navigator | **alta** | `GuildScreen.tsx` funcional; ausente em `AppNavigator.tsx:1-114` | Registrar como rota + adicionar card "Guilda" na Vila — OU remover se redundante com recrutamento do Shop. |
| `materials` acumulam mas nunca exibidos | **alta** | `tickHandler.ts:426-430` grava, `equipmentHandler.ts:30,38` consome; zero `state.materials` em .tsx | Exibir inventário de materiais (na Ferreiro e/ou no modal de resultado de missão) — forja é gated por material invisível. |
| VillageScreen sem cards p/ Guilda e Semanal | **alta** | `VillageScreen.tsx:66-103` tem 6 cards, falta os 2 | Coberto ao implementar B-Semanal e B-Guilda. |

### TEMA C — Trackers de quest que nunca incrementam (bloqueiam conclusão)
Mesmo com a UI Semanal pronta, estas quests jamais completariam.

| Gap | Sev | Evidência | Ação |
|---|---|---|---|
| `weeklyBossKills` nunca incrementado; `markWeeklyBossDefeated` nunca chamado | **alta** | `weeklyQuests.ts:15`; `weeklyHandler.ts:71-78` sem importador | Disparar markWeeklyBossDefeated ao vencer boss semanal (precisa do encontro de boss). |
| `fusionsCompleted` nunca rastreado | **alta** | `weeklyQuests.ts:16`; `pantheonHandler.ts:102-126` sem `updateWeeklyProgress` | Chamar updateWeeklyProgress('fusionsCompleted',1) em handleFuseHeroes. |
| `itemsForged` só atualiza daily, não weekly | **alta** | `equipmentHandler.ts:46` só `updateDailyProgress` | Adicionar updateWeeklyProgress('itemsForged',1) na forja. |

### TEMA D — Combate: ataques que ignoram escudos/reações (broken-integration)
Inconsistências mecânicas que tornam AoE/extra mais fortes que o previsto.

| Gap | Sev | Evidência | Ação |
|---|---|---|---|
| Chuva de Flechas / Bola de Fogo / Meteoro ignoram escudo + reações | **alta** | `skillEffects.ts:197-221,235-260,272-297` aplicam `enemy.hp-=dmg` cru | Rotear dano AoE por `getShieldReduction()` + `onEnemyDamagedSkills()` como em `battleEngine.ts:599-604`. |
| Inimigo AOE_ATTACK ignora escudo de herói + reações | **alta** | `enemySkillEffects.ts:121-143` | Aplicar `getShieldReduction()` + `onHeroDamagedSkills()`. |
| Ataque extra do Oportunista sem escudo/reações/tracking | **alta** | `battleEngine.ts:614-632` vs `599-613` | Reusar o mesmo caminho do ataque normal (escudo, reações, lastAttacker, veneno Rogue). |
| Cura Maior / Purificação não disparam `onHealApplied` (sinergia LINHA_DE_FRENTE) | **alta** | `skillEffects.ts:300-317` vs `battleEngine.ts:499` | Chamar `state.handlers.onHealApplied()` nos skills de cura. |

### TEMA E — Lacunas de teste em lógica crítica
| Gap | Sev | Evidência | Ação |
|---|---|---|---|
| `trainingMath.ts` 0% cobertura — teste existe em pasta errada e nunca roda | **alta** | `offlineProgress.test.ts` sob `utils/__tests__/` não bate `jest.unit.config.js` testMatch | Mover teste para `src/__tests__/` e cobrir edge cases (k=0, cap 10000). |
| `achievementHandler` sem testes unit | **alta** | sem test file; só e2e de UI | Adicionar testes de condition/reward; tipar `condition: (state: GameState)`. |
| Hooks `useDragDropGrid`/`useShop`/`useMissionPlayback` sem teste | **alta** | ausentes em `__tests__/hooks/` | Testar lógica de cálculo/validação dos críticos (Shop, playback). |
| Zero testes de componente/tela (22 componentes, 10 telas) | **alta** | sem `__tests__/screens` nem `/components` | Cobertura incremental dos fluxos visuais críticos. |

### TEMA F — Dead code / tech debt (baixo)
| Gap | Sev | Ação |
|---|---|---|
| `offlineGold` nunca incrementado (`offlineProgress.ts:23`) | média | Remover ou implementar gold-por-tick de missão offline. |
| `getDefMulProduct` exportado e nunca chamado (`skillEffects.ts:477-479`) | baixa | Remover. |
| `missionMath.ts` re-export trivial sem teste | baixa | Inline em `gameMath` ou remover. |
| 28 `any` (≈19 evitáveis), incl. `achievements.ts:6` | média | Tipar gradualmente; priorizar `condition`. |
| `console.log/error` sem `__DEV__` (`storage.ts:99,119,134,144`; `missionHandler.ts:129`) | baixa | Guardar com `__DEV__`. |
| JSX comentado + estilos/import órfãos em VillageScreen (`56-64`,`127-143`) | baixa | Remover. |
| Storage tests mockam AsyncStorage sem validar migrations v3-v8 | média | Testes unit por migration com snapshots. |

## 3. Quick wins (alto impacto, baixo esforço)

1. **Trackers de quest semanal** (Tema C): 3 linhas cada — `updateWeeklyProgress` na forja e na fusão. Desbloqueiam quests hoje impossíveis de completar.
2. **Aplicar pantheonBonuses e permanentBonuses** (Tema A): poucas linhas em `calcMissionReward` e na montagem de heróis pré-combate. Transforma dois sistemas cosméticos em progressão real.
3. **Registrar GuildScreen + card na Vila** (Tema B): tela 100% pronta, só falta importar/registrar no navigator e um card. Quase zero código.
4. **Inventário de materiais visível** (Tema B): forja já depende deles; expor na tela Ferreiro evita UX impossível.
5. **Mover `offlineProgress.test.ts` para a pasta certa**: ganha cobertura imediata de `trainingMath` sem escrever testes novos.

## 4. Ordem sugerida de ataque

1. **Trackers semanais (C) + aplicação dos bônus (A)** — micro-mudanças de backend que fazem sistemas existentes finalmente terem efeito. Maior ROI, menor risco. Cobrir com testes unit (já há padrão em `weeklyHandler.test.ts`).
2. **WeeklyScreen + Panteão UI + Guilda no navigator (B)** — destravam três features completas. Reusar `DailyQuestsScreen` como molde; ao final, adicionar os cards faltantes na Vila e o inventário de materiais.
3. **Correções de combate (D)** — rotear AoE/ataque-extra/cura pelos mesmos hooks do ataque normal (escudo, reações, sinergias). Escrever testes de integração AoE+escudo (hoje inexistentes) antes do fix.
4. **Encontro de boss semanal** — fechar o ciclo: tela de boss + dispatch que chama `markWeeklyBossDefeated` e incrementa `weeklyBossKills`. Depende de (2).
5. **Cobertura de testes crítica (E) + limpeza de dead code (F)** — `achievementHandler`, hooks críticos, e remoção de `getDefMulProduct`/`offlineGold`/JSX comentado. Fica por último por ser não-bloqueante para o jogador.

**Observação:** Temas A→D são todos lacunas de frontend/integração — o esforço é de fiação, não de design de sistema. Validar cada tela nova no browser (Playwright) antes de declarar pronta, conforme convenção do projeto.

---

## Anexo: itens investigados e DESCARTADOS (falsos positivos)

- **COMPLETE_MISSION action handler exists but never called** (state-reducer-persistence) — COMPLETE_MISSION is defined in src/types/index.ts:119 and has a reducer case in src/context/gameReducer.ts:54-55 and handler in src/context/missionHandler.ts:156-171. However, the action is NEVER dispatched anywhere in p
- **Storage migrations are complete and version-aware** (state-reducer-persistence) — REFUTED: The reported concern is not a real gap. Evidence: (1) All migrations 2-8 are properly chained in src/services/storage.ts:16-88. CURRENT_VERSION = 8 is correct. (2) Migration 7 is a safe no-op (line 79-81: return
- **Achievements and Daily Quests Fully Integrated and Working** (engagement-systems) — VERIFIED NOT A GAP - Both systems are fully implemented and integrated:
- **All core progression paths are closed and functional** (economy-progression) — NOT A REAL GAP. All progression paths are fully implemented and working: (1) Hero recruitment with exponential 1.5x cost multiplier wired via handleRecruitHero at /root/rodrigo/idle_rpg/src/context/gameReducer.ts line ~4
- **No unit tests for heroHandler** (tests-quality) — REFUTED: heroHandler.ts IS comprehensively tested indirectly through the gameReducer tests. Coverage data confirms: 97.91% statement coverage, 83.33% branch coverage, 100% function coverage, 100% line coverage for heroHa
- **Debug console.log in ChestRevealModal guarded but still present** (tests-quality) — Lines 232 and 241 in /root/rodrigo/idle_rpg/src/components/ChestRevealModal.tsx use console.log wrapped in __DEV__ guards. This is the idiomatic React Native/Expo pattern for debug logging. The __DEV__ global is provided
- **Weak assertions in battleEngine tests** (tests-quality) — The gap claim refers to /root/rodrigo/idle_rpg/src/__tests__/utils/battleEngine.test.ts lines 6-30. The basic test file contains minimal assertions (toBeDefined for selectTarget, basic miss/hit checks). HOWEVER, this is 
- **Synergies fully implemented in battleEngine and integrated—no gaps detected** (plan-vs-impl) — VERIFIED: All 6 synergies (LINHA_DE_FRENTE, MURALHA_E_FLECHA, BASTIAO, CAOS_ARCANO, EMBOSCADA, ARTILHARIA) are correctly implemented in synergyEffects.ts (lines 19-149) with all required hooks (onBattleStart, onHealAppli
