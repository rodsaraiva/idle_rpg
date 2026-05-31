# Follow-ups pós-execução — resolução de gaps (2026-05-31)

Itens descobertos/decididos DURANTE a execução das 5 fases (não faziam parte dos 46 gaps originais ou foram deixados como nit não-bloqueante). Branch: `feat/gaps-resolution`.

## #47 — Determinismo do motor de batalha (prioridade ALTA p/ confiabilidade de teste)

**Sintoma:** `src/__tests__/utils/battleSim.test.ts` falha de forma não-determinística (às vezes verde, às vezes vermelho) na suíte. Estado final desta entrega: **420/421 testes verdes**, sendo a única falha esse teste flaky.

**Causa-raiz:** a *configuração* da batalha ignora o `rng` injetado e usa `Math.random()` direto:
- `src/utils/battleEngine.ts:113` (shuffle de posições), `:123` (attackType aleatório), `:141` e `:165` (`assignEnemySkills(..., Math.random)`).
- `src/utils/synergyEffects.ts:119` e `:132` (proc/seleção aleatória em handler de sinergia).

`computeBattleOutcome` (`battleSim.ts`) injeta `rng` corretamente no *loop de turnos*, mas não na *montagem* dos inimigos → o resultado varia entre execuções mesmo com `rng` fixo.

**Por que não foi corrigido agora:** o fix correto não é trivial. Passar o `rng` para `createEnemies` muda a *ordem de consumo* do rng e quebra a sequência hand-calibrada do test 2 (`[0.99, 0.0]`, pensada só para o loop de turnos). A solução adequada exige design próprio: ou um PRNG **seedável** único usado em setup+combate (com os testes reescritos para usar seed em vez de sequências manuais), ou um rng de setup separado do rng de combate. É candidato a spec/plan dedicado.

**Recomendação:** criar plano "determinismo do battle engine": (1) `createEnemies(template, rng = Math.random)` + threading do rng de setup; (2) rng nas sinergias via `state`; (3) reescrever `battleSim.test.ts` (e correlatos) com PRNG seedável. Produção mantém `Math.random` por default (sem mudança de comportamento).

**Pré-existente:** confirmado — os `Math.random` de setup são anteriores a esta entrega (a Fase 3 não tocou `battleEngine.ts:106-170`).

## Nits não-bloqueantes deixados (das revisões de fase)

- **Fase 4 — gold de consolação na derrota do boss** (`tickHandler.ts`): boss derrotado ainda concede o gold de consolação compartilhado com missões normais. Consistente com o jogo (não é gold passivo); só rever se o design quiser "zero gold em derrota de boss".
- **Fase 4 — duplicação de `bossToMissionTemplate`** em `missionHandler.ts` e `tickHandler.ts` (corpos idênticos). Poderia morar em `weeklyBosses.ts`. Minúsculo.
- **Fase 2 — cobertura direta dos hooks** `useWeekly`/`usePantheon`: os testes exercem a lógica de derivação pura (conforme o plano), mas a integração real do hook (`renderHook`: limite de 3 na fusão, toggle) não tem teste direto. Opcional p/ robustez.
- **Fase 5 — `react-test-renderer is deprecated`**: ruído de output do `@testing-library/react-native`, não é falha.

## Validação de UI pendente (browser — convenção do projeto)

As telas novas/alteradas passaram em unit + e2e *autorados* (não executados em browser). Validar manualmente no Playwright/web antes de considerar 100% pronto:
- **WeeklyScreen**: quests, progresso real (vindo do tick), card do boss e botão "Enfrentar Boss" (habilita/desabilita por `bossDefeated`).
- **PantheonScreen** (principal — única com mutação de estado): selecionar/deselecionar 3 heróis, confirmar fusão, heróis consumidos + novo herói com estrelas, bônus atualizados.
- **VillageScreen**: 8 cards, navegação para Semanal e Guilda.
- **BlacksmithScreen**: seletor de tipo atualizando os materiais faltantes destacados.
