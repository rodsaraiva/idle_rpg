# Auditoria de boas práticas & refatorações — 2026-06-27

Workflow `audit-best-practices`: 7 dimensões em paralelo → verificação adversarial de cada achado.
**81 brutos → 77 confirmados → 4 refutados.** Severidade pós-verificação: 3 HIGH, 12 MED, 62 LOW.
Os 3 HIGH foram reconfirmados manualmente lendo o código.

---

## 🔴 HIGH — bugs reais de lógica (não estilo)

### H1. Boss semanal ignora bônus permanente + panteão
`src/context/missionHandler.ts:196-215`
`handleStartMission` usa `getEffectiveStats(h, state)` (equip + permanentBonuses + pantheonBonuses).
`handleStartWeeklyBoss` só soma equipamento à mão → heróis entram **mais fracos no conteúdo mais difícil**, justo o que é gated por estrela/conquista.
**Fix (S):** trocar o bloco 196-215 pelo mesmo `map` com `getEffectiveStats` da 104-107. Remove ~20 linhas e a divergência. Invariante DEF/CRIT/AGI preservado (só equip toca esses 3).

### H2. Selos de Legado NUNCA são concedidos no jogo real
`src/context/missionHandler.ts:288` + `tickHandler.ts:216`
`checkLegacySeals` só é chamado por `handleCompleteMission`, que só roda no action `COMPLETE_MISSION` — **nunca despachado** (0 dispatch em screens/hooks/components). O fluxo real conclui missão pelo **tick** (`processMissions`), que termina em `checkAchievements` e nunca chama `checkLegacySeals`. Resultado: `legacy.level` fica 0 → `availableLegacyPoints` 0 → **toda a árvore de Legado (SPEC 7) é inalcançável**.
**Fix (M):** chamar `checkLegacySeals` no fim do `handleTick` (junto de `checkAchievements`); remover/documentar o action morto `COMPLETE_MISSION`. `checkLegacySeals` preserva gold por contrato.

> H1 e H2 dependem de equilíbrio/feature já entregues — H2 deixa o SPEC 7 efetivamente inerte.

---

## 🟠 MED — processo & tooling (baixo risco, alto retorno)

| ID | Onde | Fix |
|---|---|---|
| coverage versionado | `coverage/` (265 arquivos no git, é o ruído do `git status`) | `git rm -r --cached coverage/` + `.gitignore` |
| eslint quebrado | `eslint.config.js` | falta `eslint-plugin-react-hooks` → `npm run lint` sai 1 ("rule not found" em ConsentGate:50, Blacksmith:63). Instalar+registrar o plugin |
| sem CI/precommit gate | — | sem `.github/workflows` nem husky. Foi a ausência disso que deixou o flaky chegar na main. Adicionar gate `tsc --noEmit` + `eslint` + `jest --runInBand` |

## 🟠 MED — duplicação que vira bug

| ID | Onde | Fix |
|---|---|---|
| fórmula de reward triplicada | `missionTickHandler.ts:170,243` + `missionHandler.ts:276` | extrair `computeFinalGold(reward,state)` — divergência aqui credita gold errado |
| `handleStartMission`/`WeeklyBoss` duplicados | `missionHandler.ts:54-259` | helper `buildBattleMission(...)` — é a origem de H1 |
| `CLASS_EMOJI` divergente | `ChestRevealModal:27` vs `MissionHeroSelectionModal:40` (sem COMMANDER) | centralizar em `constants/classes` |
| reducer muta estado aninhado | `missionTickHandler.ts:35,74-91` | clone raso não protege `enemiesState`/`heroPositions`; clonar fundo |
| fusão de panteão não-determinística | `pantheonHandler.ts:11,47,51` | usa `Math.random` direto; injetar `rng` como os outros handlers |
| `HeroCard` sem memo + assina GameState inteiro | `HeroCard.tsx:48-59` | `React.memo` + parar de chamar `useGame()` dentro do card |

---

## 🟡 LOW (62) — temas

- **type-safety (~15):** `any`/`as any` evitáveis em `storage.ts` (load/migrations), `useDragDropGrid`, `synergyEffects` (`attacker as any` → `'classId' in attacker`), `offlineProgress`, `battle/*`.
- **domain-model (~10):** magic numbers de combate, união de stat-keys sem nome, defaults de `notificationPrefs`/`statWeights` duplicados, `GameState` flat com muitos opcionais.
- **duplicação (~10):** `hpFraction`/clamp de HP inline, stat-labels, geração de herói dentro de componente.
- **tooling (~8):** tsconfig só `strict:true` (faltam `noUncheckedIndexedAccess` etc.), eslint só cobre UI, falta script `typecheck`/`format`, sem prettier, `collectCoverage` sempre ligado.
- **arquitetura/testes:** side effects em reducer, RNG injetado inconsistente, dual jest config divergente, asserções fracas em smoke tests.

---

## ✅ 4 refutados (verificação funcionou)

- **analytics-reset-decentralized** — falso: Jest isola module registry por arquivo; os 3 `afterEach(resetAnalytics)` bastam. (defesa do código que entreguei)
- **battle-handlers-hero-as-any** — fix proposto não compila (`BattleEnemy` não tem `name/classId/personality`).
- **skilleffects-fat-dispatch** — contagem errada; duplicação já extraída em helpers.
- **offline-test-permanently-ignored** — o teste roda e passa na config primária (`npm test`).
