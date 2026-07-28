# Débito acumulado — execução SPECs H2 2026

> Registro de pendências conhecidas após executar os 6 SPECs executáveis (1, 2, 3, 6, 4, 5) na `main`.
> Cada item foi conscientemente adiado, não esquecido. Gerado em 2026-06-25.

## A. Validação visual (emulador/device) — parcialmente destravada

> **Atualização 2026-07-28:** o Expo **sobe** (`npx expo start --web --port 8081` rodando
> em background pelo runner da sessão; o que falha é `nohup ... & disown`, que morre com
> exit 144). Uma passada no browser já foi feita e achou 3 bugs de boot, todos corrigidos:
> save apagado a cada abertura, consent LGPD competindo com o FTUE, e resumo offline
> montado só na GuildScreen (ver commits `1629b09`, `3bee2ff`, `a3c7ba3`).
>
> **A Vila mostrava um print da UI antiga.** `assets/village_map.png` nunca foi um mapa:
> era um screenshot da tela de Treino pré-"Reino" (fundo navy, "Petra #66"/"Jareth #48"),
> commitado com nome de asset em `35d00b1` e usado como `ImageBackground` da Vila pelo
> SPEC 3. Removido; a Vila virou a lista de destinos no DS (era o fallback já existente).
> Lição de método: os pixels não apareciam no `innerText`/`outerHTML` porque eram imagem —
> DOM limpo não prova tela limpa. Screenshot **é** prova; conferir os dois.

O que ainda precisa de olho humano em emulador iOS/Android:

- **SPEC 2/3 (Design System + Redesign):** conferir as 11 telas no DS "Reino" — contraste, hierarquia, densidade, dark-first. Validar que nenhum token quebrou layout em telas pequenas.
- **SPEC 3 — Vila-mapa: precisa da arte.** O mapa saiu do ar (o asset era um print da UI antiga).
  Para voltar: ilustração de mapa medieval de verdade + coordenadas medidas sobre ela — as antigas
  eram estimativas nunca calibradas. Enquanto não houver arte, a Vila é lista de destinos no DS.
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
- **Warnings de console no web (4, nenhum erro):** ciclo de require
  `skillEffects ↔ enemySkillEffects`; props depreciadas do RN Web (`textShadow*`,
  `shadow*`, `props.pointerEvents`). Baratos de fechar, nenhum quebra o boot.

- **SPEC 5 — `resetOnboarding` (NIT):** dispara `patch.hintsSeen:{}`, mas `handleSetOnboarding` faz merge profundo (`{...base, ...{}}`), então flags antigas sobrevivem ao "reset". Caminho dev/debug, inofensivo em produção. Para um reset real, substituir `hintsSeen` inteiro em vez de mesclar.

## C. Débito device-bound do SPEC 8 (monetização & retenção)

Os items abaixo foram conscientemente excluídos do SPEC 8 por serem device-bound (não rodam no sandbox de CI) ou exigirem billing real. Registrado na Task 9 de verificação.

- **Push real (`expo-notifications`):** agendamento efetivo de notificações locais/remotas, respeito às quiet-hours (`start`/`end` em `NotificationPrefs`), cap de ≤2 notificações/dia, cancelamento ao opt-out. A lógica de prefs existe; o sink real é débito.
- **IAP/billing (RevenueCat/StoreKit/Play):** loja premium com dinheiro real para cosméticos premium, restore purchases, receipt validation, tela de paywall real. O `CollectionScreen` mostra "Em breve" como placeholder; nenhum billing foi integrado.
- **Validação visual de SettingsScreen/CollectionScreen/HeroCard cosmético:** as três telas foram implementadas mas não validadas em emulador/device — UX, contraste, layout em telas pequenas. MANUAL-PENDING sandbox.

## D. Débito device-bound do SPEC 9 (store readiness)

Registrado em 2026-06-26. O SPEC 9 entregou toda a infraestrutura codável
(bundleId, eas.json, analytics consent-gated, migração v13, gate LGPD,
telas de Privacidade/Termos, SOUND_KEYS, checklist de submissão). O que
**não pode ser feito no sandbox de CI** ficou como débito explícito:

- **EAS Build real:** executar `eas build --platform all --profile production`
  (requer conta Expo paga ou free tier com tempo de build). Credenciais iOS via
  `eas credentials` (Apple Certificate + Provisioning Profile).

- **Arquivos de áudio licenciados:** popular `SOUND_ASSETS` em
  `src/constants/assets.ts` com os 9 arquivos correspondentes a `SOUND_KEYS`
  (`chest_suspense`, `chest_open`, `chest_reveal`, `battle_hit`, `death`,
  `forge_craft`, `mission_reward`, `level_up`, `ambient`). Os arquivos de áudio
  precisam de licença compatível (CC0, comprado em marketplace, ou produzido).

- **Chave e SDK PostHog real:** instalar `posthog-react-native`, obter chave de
  projeto em `app.posthog.com`, injetar no sink via `setAnalyticsSink(...)` em
  `App.tsx` (o contrato já existe em `src/services/analytics.ts` — só substituir
  o console.log pelo cliente real).

- **Contas de loja:**
  - Apple Developer: $99/ano em `developer.apple.com`
  - Google Play: $25 taxa única em `play.google.com/console`

- **Keystore Android:** deixar o EAS gerenciar (`eas credentials`) ou guardar
  fora do repo em local seguro (nunca commitar).

- **Arte final:**
  - Ícone iOS: 1024×1024 px sem canal alpha
  - Ícone Android: 512×512 px (Play Store), adaptive icon (foreground/background)
  - Splash screen: design final substituindo o placeholder atual em `app.json`
  - Screenshots: mínimo iPhone 6.9" (3 imagens) + Android 16:9 (3 imagens)
  - Feature Graphic Google Play: 1024×500 px

- **Formulários de loja (preenchimento manual):**
  - Apple: App Privacy (Usage Data), age rating (IARC-style)
  - Google: Data Safety, IARC questionnaire, Content Rating

- **Hospedagem de URLs legais:**
  - Hospedar conteúdo de `src/constants/legalContent.ts` em URLs públicas
    (ex.: `https://v4smc.com/idlerpg/privacy` e `.../terms`)
  - Atualizar `legalContent.ts` com as URLs reais
  - Revisão jurídica do texto (advogado ou especialista LGPD/GDPR)

- **Validação visual em emulador/device das telas novas do SPEC 9:**
  - `ConsentGate` (modal de 1º boot): layout, botões Aceitar/Recusar, links
  - `PrivacyScreen` e `TermsScreen`: ScrollView, tokens do DS "Reino"
  - Toggle de consentimento na `SettingsScreen`: sincroniza com estado real

Referência completa: `docs/store/SUBMISSION-CHECKLIST.md`.

## E. Não-executados (design-only, sem plano ainda)

SPECs 10+ do roadmap H2 2026 não têm plano de execução ainda —
"plans when we get there" (ver [`ROADMAP-2026-H2.md`](ROADMAP-2026-H2.md)).

## Como retomar

1. Varrer o restante do item A + validação visual do SPEC 8 (item C) e SPEC 9 (item D).
   O Expo web já sobe; o que falta de verdade é device/emulador para julgar aparência.
2. Cada item de B é uma tarefa pequena e isolada — bom candidato a `/plan` curto ou fix direto.
3. Débito device-bound do SPEC 8 (item C) exige emulador com expo-notifications habilitado e conta de billing de teste.
4. Débito device-bound do SPEC 9 (item D): seguir a "Ordem recomendada de execução" em `docs/store/SUBMISSION-CHECKLIST.md`.
