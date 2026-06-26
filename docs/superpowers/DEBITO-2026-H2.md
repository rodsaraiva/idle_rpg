# Débito acumulado — execução SPECs H2 2026

> Registro de pendências conhecidas após executar os 6 SPECs executáveis (1, 2, 3, 6, 4, 5) na `main`.
> Cada item foi conscientemente adiado, não esquecido. Gerado em 2026-06-25.

## A. Validação visual (emulador/device) — bloqueada no sandbox

O sandbox de execução **não sobe o Expo** (exit 144), então toda validação de UX ficou *manual-pending*. Precisa de uma passada num emulador iOS/Android (ou web local) antes de considerar as telas "prontas de verdade" (regra do projeto: type-check/testes não garantem UX):

- **SPEC 2/3 (Design System + Redesign):** conferir as 11 telas no DS "Reino" — contraste, hierarquia, densidade, dark-first. Validar que nenhum token quebrou layout em telas pequenas.
- **SPEC 3 — Vila-mapa:** calibrar as coordenadas dos 8 hotspots sobre `village_map.png` (foram estimadas, não medidas no device).
- **SPEC 3 — Lottie:** há placeholders de animação a trocar por assets finais.
- **SPEC 5 — funil FTUE (Task 16):** rodar o fluxo recrutar → treinar → 1ª missão → coletar; confirmar spotlight/coach mark alinhando com os alvos reais (`registerTarget`) e o cronômetro `ftue_first_mission_started`.
- **SPEC 7 — tela de Legado (`LegacyScreen`):** confirmar no emulador que a árvore de upgrades renderiza com tokens do DS "Reino", pontos disponíveis calculados corretamente e botão de compra desabilitado sem pontos.
- **SPEC 7 — mapa de zonas (`ZoneMapScreen`):** validar desbloqueio visual (Z2/Z3/Z4 travadas/liberadas) e que os gates `mission_cleared` refletem o estado real de `completedMissionIds`.
- **SPEC 7 — banner de evento (`EventBanner`):** confirmar que o banner aparece/desaparece conforme `activeEvent` e troca de janela mensal; testar no emulador com data mockada.

## B. Débito de código / NITs (por SPEC)

- **SPEC 1 — paridade offline:** revisar paridade de baixas (casualties), drops e `applyGoldBonus` entre o caminho online e o `offlineProgress` (consistência de recompensa/penalidade quando a missão resolve offline).
- **SPEC 3 — resíduos de migração:** emojis (★ ✕ ✓) e `rgba(...)` inline ainda em modais não-migrados; `fontSize` literais em alguns componentes compartilhados. Fechar quando esses modais entrarem no DS.
- **SPEC 4 — Caos Arcano (NIT):** o tuning aplicou valor (`0.5→0.4`) **e** duração (`+1→+2`), onde o plano descrevia como "ou". Ambos individualmente dentro dos limites e o gate `--ci synergyMinDelta` cobre over-tuning; confirmar na próxima medição que a sinergia não passou do teto de class-gap.
- **SPEC 4/6 — adaptador de boss duplicado:** `bossToMissionTemplate` ainda existe em `src/constants/weeklyBosses.ts` (importado por `src/utils/offlineProgress.ts`), apesar do `bossTemplate.ts` ter centralizado o adaptador. Bodies idênticos (zero impacto), mas o comentário "único adaptador" em `bossTemplate.ts` superestima. Deduplicar quando mexer em offline.
- **SPEC 5 — `resetOnboarding` (NIT):** dispara `patch.hintsSeen:{}`, mas `handleSetOnboarding` faz merge profundo (`{...base, ...{}}`), então flags antigas sobrevivem ao "reset". Caminho dev/debug, inofensivo em produção. Para um reset real, substituir `hintsSeen` inteiro em vez de mesclar.

## C. Não-executados (design-only, sem plano ainda)

Os SPECs 7-9 do roadmap (`conteudo-endgame`, `monetizacao-retencao`, `store-readiness`) têm spec de design mas **não têm plano de execução** — "plans when we get there" (ver [`ROADMAP-2026-H2.md`](ROADMAP-2026-H2.md)). Próximo passo natural quando a base estiver validada no device.

## Como retomar

1. Subir o Expo localmente (`npx expo start --web --port 8081` ou emulador) e varrer o item A.
2. Cada item de B é uma tarefa pequena e isolada — bom candidato a `/plan` curto ou fix direto.
3. Itens C exigem brainstorming → writing-plans antes de executar.
