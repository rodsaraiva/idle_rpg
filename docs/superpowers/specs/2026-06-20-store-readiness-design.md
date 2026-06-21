# Store Readiness (Lançamento iOS/Android) — Design Spec

> **Data:** 2026-06-20 · **Referência:** **SPEC 9** do `docs/superpowers/ROADMAP-2026-H2.md` (Horizonte 3 — "Pronto pra Lançar").
> **Natureza deste documento: DIREÇÃO (design-only).** Não há plano executável agora — este SPEC fixa as recomendações, os trade-offs e os pré-requisitos do checklist de lançamento mobile. Escopo IN: EAS Build, assets de loja, áudio/SFX/música, analytics de retenção, conformidade legal, checklist de submissão iOS/Android. Escopo OUT: implementação (cada item vira plano executável ao iniciar H3, depois dos aprendizados de balance/SPEC 4 e retenção/SPEC 8).
> **Marcação:** cada subseção indica o que é **decidido** (recomendação firme) e o que é **direção a detalhar em plano**. Perguntas abertas ao dono ficam no fim das seções relevantes e em §7.

---

## 1. Contexto e Problema

O jogo está funcionalmente completo, mas **não há nenhuma infraestrutura de lançamento**. Tudo abaixo foi confirmado lendo o código real:

### 1.1 Build/distribuição — zero configuração de loja

- **Não existe `eas.json`** (confirmado: `ls eas.json` → ausente). Sem ele não há perfis de build (`development`/`preview`/`production`), nem submissão automatizada (`eas submit`). Hoje o projeto só roda via `expo start` (`package.json:7-9`: scripts `start`/`android`/`ios`/`web`) — fluxo de dev, não de loja.
- **`eas-cli` não está no projeto** (confirmado: `grep -i eas package.json` → nada em `dependencies`/`devDependencies`).
- **`app.json` sem identidade de loja** (`app.json:1-33`): tem `name: "idle_rpg"`, `slug: "idle_rpg"`, `version: "1.0.0"`, mas **falta** `ios.bundleIdentifier`, `android.package`, `ios.buildNumber`, `android.versionCode`. Sem esses campos o EAS Build para iOS/Android nem inicia.
- **`userInterfaceStyle: "light"`** (`app.json:8`) e **`backgroundColor: "#ffffff"`** em splash (`app.json:13`) e adaptive-icon (`app.json:22`) — contradizem o Design Language dark-first (`ROADMAP §3.8`: alvo `userInterfaceStyle: "dark"`, splash/adaptive em `#15100B`). SPEC 1 já assume corrigir isto; este SPEC herda o resultado.
- **Ícones são placeholders default do Expo.** `assets/icon.png` (22 KB), `assets/adaptive-icon.png` (17 KB), `assets/splash-icon.png` (17 KB), `assets/favicon.png` (1,4 KB) — todos com data de scaffold (`Apr 10`). Não há marca "Reino" neles (ouro/couro/Cinzel do `ROADMAP §3`).

### 1.2 Áudio — serviço quebrado e biblioteca vazia

- **`SOUND_ASSETS` está literalmente vazio:** `src/constants/assets.ts:1` → `export const SOUND_ASSETS: Record<string, any> = {};`. Não há um único arquivo de som no projeto (`ls assets/sound* assets/audio*` → nada; só `assets/lottie/` com 3 JSONs e `assets/village_map.png`).
- **`sound.ts` está escrito contra a API removida do `expo-audio`.** `src/services/sound.ts:1` faz `import { Audio } from 'expo-audio'`; usa `Audio.Sound.createAsync` (`:24`), `sound.setPositionAsync`/`sound.playAsync` (`:41-42`), `Audio.setAudioModeAsync` (`:10`). O `expo-audio@1.1.1` (instalado, `package.json:30`) **não exporta `Audio`** — a API top-level atual é `createAudioPlayer`/`useAudioPlayer`/`setAudioModeAsync`. Este é um dos 17 erros de `tsc` que **SPEC 1 corrige**; este SPEC assume o serviço já migrado e foca em **quais assets** entram e **onde disparam**.
- **Duas libs de áudio coexistem:** `expo-audio ~1.1.1` (`package.json:30`) E `expo-av ~16.0.8` (`package.json:31`). `app.json:29-31` só lista o plugin `expo-audio`. `expo-av` está **deprecado** no SDK 54 e não é usado por nenhum import em `src/` (confirmado: grep só acha `expo-audio`). Carregar duas libs de mídia infla o bundle e arrisca conflito de sessão de áudio nativa.
- **Já existem call-sites de som que falham silenciosamente.** `ChestRevealModal.tsx` chama `playSound('chest_reveal')`, `playSound('chest_suspense')`, `playSound('chest_open')` e `stopSound(...)` em 13 pontos (`:91,100,109,117,168,169,199,253,261,273,274,275`); `MissionResultModal.tsx:9` importa `playSound`; `useDragDropGrid.ts:105-106` faz `require('../services/sound')` e chama `playSound('chest_reveal')`. Como `SOUND_ASSETS` é `{}`, `SoundService.play` retorna no-op (`sound.ts:36-37`: `if (!sound) return`) — **o jogo é mudo hoje**, mas o cabeamento de chaves de som já existe e está nomeado.

### 1.3 Analytics — inexistente

- Nenhuma lib de analytics no `package.json`. Não há `posthog`, `amplitude`, `firebase`, nem qualquer client de eventos. O roadmap define a métrica de H3 (`ROADMAP:209`): *"analytics de retenção instrumentado (D1/D7)"* e o SPEC 5 (onboarding) precisa medir *"novo jogador chega à 1ª missão em < 60s"* (`ROADMAP:205`) — **não há como medir nada disso hoje**.
- O jogo já tem um **detector de marcos por diff de estado**: `src/hooks/useGameFeedback.ts` compara `prevState`/`state` a cada tick e dispara nos momentos-chave — gold creditado (`:24-29`), herói recrutado (`:32-35`), ganho de stat (`:46-85`), missão concluída (`:133-146`) — emitindo no event bus `FeedbackService` (`src/services/feedback.ts`, `:3-82`, que só carrega eventos visuais `FLOAT/TOAST/BATTLE_*`). **O ponto natural de tap para analytics é o `useGameFeedback`** (onde os marcos são *detectados*), não o `FeedbackService` (que só *transporta* feedback de UI) — assim não se reinstrumenta a lógica de jogo.

### 1.4 Conformidade — nada

- Sem política de privacidade, sem termos de uso, sem tela de consentimento, sem disclosure de idade. Apple App Store (Guideline 5.1.1) e Google Play (Data safety form) **exigem** isso antes de aprovar — mesmo um jogo sem login e sem IAP precisa declarar o que coleta. Se analytics (§1.3) entrar, há coleta de dados e LGPD/GDPR passam a valer.
- **Não há IAP nem loot box com dinheiro real hoje** — bom, porque a regra de produto (memória do dono) proíbe pay-to-win, e SPEC 8 limita monetização a cosméticos/conveniência. Mas o `ChestRevealModal` (baú de recompensa) e a raridade aleatória de equipamento podem ser lidos por revisores como "loot mechanic" e exigir disclosure de probabilidades (Apple 3.1.1, Play "Real-money gambling, games, and contests" + paid loot box odds).

**A dor concreta:** o jogo está pronto de *gameplay*, mas **zero porcento pronto de loja**. Sem `eas.json` não se gera um binário assinado; sem assets de marca a ficha de loja parece amadora; mudo, perde imersão; sem analytics, o lançamento voa às cegas (não dá pra saber se D1/D7 melhoram); sem conformidade, é rejeição garantida na revisão.

---

## 2. Objetivos e Não-Objetivos

### Objetivos (mensuráveis — alvo de H3)

1. **Build de produção assinado** sai do EAS para iOS (`.ipa`/TestFlight) e Android (`.aab`/Internal testing), a partir de um `eas.json` com 3 perfis (`development`/`preview`/`production`) e versionamento automático.
2. **Ficha de loja completa** em ambas as lojas: ícone "Reino", splash dark, ≥1 screenshot por tamanho obrigatório (iPhone 6.7"/6.5"/iPad 12.9"; Android phone/7"/10"), feature graphic Android, descrição curta + longa + keywords (ASO) em pt-BR (e EN se o dono quiser alcance global).
3. **Áudio integrado e audível:** ≥1 faixa de música ambiente (loop) + os SFX já cabeados (`chest_*`) + SFX de batalha/forja/recompensa, com toggle de mute persistente. `SOUND_ASSETS` deixa de ser `{}`.
4. **Analytics de retenção ativo:** eventos-chave (1ª missão, recrutamento, fusão, boss derrotado, sessão D1/D7) chegam a um painel; D1/D7 são gráficos consultáveis. Conecta à métrica de SPEC 5.
5. **Conformidade aprovável:** política de privacidade e termos publicados (URL), App Privacy (iOS) e Data safety (Android) preenchidos, classificação etária definida, disclosure de loot se aplicável, consentimento LGPD/GDPR para analytics.
6. **Checklists de submissão iOS e Android** preenchidos e versionados; primeira build chega a TestFlight/Internal testing sem rejeição de metadado.

### Não-Objetivos (YAGNI — fora deste SPEC)

- **Implementação.** Este é design-only: nenhum `eas.json` é escrito, nenhum asset é produzido, nenhum SDK é instalado aqui. Vira plano executável ao iniciar H3.
- **IAP / monetização real.** É SPEC 8 (push notifications, daily login, cosméticos/conveniência). Aqui só se **registra** o que a presença futura de IAP exigiria de disclosure.
- **A correção do `sound.ts` e do `userInterfaceStyle`.** São de SPEC 1 — este SPEC os assume prontos e constrói em cima.
- **Migração da paleta/fontes "Reino"** nos componentes. É SPEC 2/3. Aqui só se consome o resultado (cores e marca) para os assets de loja.
- **Localização ampla.** Decisão de quais idiomas além de pt-BR fica como pergunta aberta; não se traduz a UI inteira aqui.
- **CI/CD de loja (release automático por tag).** Desejável, mas o MVP de lançamento é build manual via `eas build`/`eas submit`. Automação fica para depois do 1º release.

---

## 3. Design Detalhado

### 3.1 EAS Build — perfis, assinatura, versionamento  *(decidido)*

**Recomendação:** adotar EAS Build (managed) com `eas.json` de 3 perfis. Trade-off considerado: *bare workflow + Fastlane local* daria mais controle, mas exige Mac para iOS e mantém certificados à mão — custo alto para um time pequeno. EAS gerencia credenciais (certificados iOS + keystore Android) na nuvem, builda iOS sem Mac local, e é o caminho canônico para projeto Expo managed (já é o caso: `app.json` sem `ios/`/`android/` nativos).

`eas.json` alvo (formato concreto, **não criar agora**):

```jsonc
{
  "cli": { "version": ">= 12.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "ios": { "simulator": false }
    },
    "production": {
      "autoIncrement": true,
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": {
    "production": {
      "ios": { "ascAppId": "<App Store Connect app id>", "appleTeamId": "<team>" },
      "android": { "track": "internal", "serviceAccountKeyPath": "./secrets/play-service-account.json" }
    }
  }
}
```

Decisões embutidas:

- **`development`**: dev client (`expo-dev-client`) com hot reload em device físico — substitui Expo Go quando precisar de módulos nativos não suportados pelo Go. APK para sideload rápido.
- **`preview`**: build "release-like" interna (TestFlight via internal / APK direto) para QA antes da loja. iOS `simulator: false` para device real.
- **`production`**: `.aab` (Play exige App Bundle, não APK), `autoIncrement: true` para subir `buildNumber`/`versionCode` automaticamente.
- **Versionamento:** `appVersionSource: "remote"` — o EAS é a fonte de verdade do build number, evitando colisão "build já existe" na submissão. A `version` semântica (`1.0.0`, hoje em `app.json:4`) continua manual e bumpada por release.

Campos a adicionar em `app.json` (pré-requisito do build, **detalhar em plano**):

```jsonc
"ios":     { "supportsTablet": true, "bundleIdentifier": "com.<dominio>.idlerpg" },
"android": { "package": "com.<dominio>.idlerpg", /* ...adaptiveIcon, edgeToEdge... */ }
```

> **Pergunta aberta ao dono:** qual o **identificador de pacote** definitivo (ex.: `com.v4smc.idlerpg`)? Ele é imutável após o 1º release — escolher com cuidado. E o **display name** na loja é "idle_rpg" mesmo, ou um nome de marca ("Reino…")? O `slug` interno pode permanecer, mas o nome público merece ser o de marca.

**Assinatura:** deixar o EAS **gerar e guardar** as credenciais (recomendado) — keystore Android e distribution certificate + provisioning profile iOS ficam na conta Expo. Alternativa (controle total) é subir um keystore próprio; mais trabalho, só compensa se já houver um. O keystore Android **nunca pode ser perdido** (sem ele não se atualiza o app publicado) → se gerado, baixar e guardar em local seguro (não no repo; alinhado a `.claude/rules/safety.md` — nunca commitar secrets).

### 3.2 Assets de loja  *(direção)*

Todos derivam do Design Language "Reino" (`ROADMAP §3.2`: couro/pedra `#15100B`/`#1E1710`, ouro `#C9A227`/`#E8C45A`, serif Cinzel). Hoje os PNGs são placeholder default (§1.1).

| Asset | Especificação | Fonte de verdade |
|---|---|---|
| **Ícone app** | 1024×1024 PNG sem alpha (Apple) + foreground/background adaptive (Android, `assets/adaptive-icon.png`) sobre `#15100B` | Marca "Reino": brasão/selo dourado sobre couro. Reusa a linguagem do componente `Seal` do `ROADMAP §3.5` |
| **Splash** | `assets/splash-icon.png`, `resizeMode: "contain"`, `backgroundColor: "#15100B"` (corrige `app.json:13` branco) | `ROADMAP §3.8` |
| **Screenshots iOS** | iPhone 6.7" (1290×2796) e 6.5" (1242×2688) obrigatórios; iPad 12.9" (2048×2732) se `supportsTablet` (é `true`, `app.json:16`) | Telas já redesenhadas por SPEC 3 |
| **Screenshots Android** | phone (mín. 1080×1920), 7" e 10" tablet | idem |
| **Feature graphic (Android)** | 1024×500 — banner da ficha Play | Arte "Reino" + logotipo Cinzel |
| **Descrição/ASO** | curta (≤80 char Play / subtítulo 30 char iOS), longa (≤4000), keywords iOS (≤100 char) | pt-BR; ver §3.2.1 |

**3.2.1 ASO (decidido como direção):** posicionar como *idle RPG de fantasia medieval* — captura buscas de gênero. Estrutura da descrição longa: gancho (1 linha) → 3-4 bullets de feature (recrutar heróis, missões automáticas, forja/fusão, boss semanal) → o diferencial "progresso offline" (a regra de produto do dono — gold por missão em loop offline é exatamente o pitch idle) → CTA. Keywords iOS candidatas: `idle, rpg, herois, medieval, fantasia, missao, forja, offline, gerenciar, batalha`.

> **Pergunta aberta:** screenshots dependem do redesign de SPEC 3 estar pronto — **não tirar print da UI atual** (genérica, `ROADMAP §1 item 5`). E: ASO só pt-BR, ou pt-BR + EN para alcance global? EN dobra o trabalho de metadado mas multiplica o mercado.

### 3.3 Áudio — música + SFX  *(direção, fundamentada no cabeamento existente)*

**Pré-condição (de SPEC 1):** `sound.ts` migrado para `expo-audio` atual (`createAudioPlayer`/`setAudioModeAsync`), e `expo-av` removido do `package.json:31` (deprecado, não usado).

**Preencher `SOUND_ASSETS`** (`assets.ts:1`, hoje `{}`). As chaves já cabeadas no código (uppercase pelo wrapper `playSound`, `sound.ts:72`) ditam o mínimo:

```ts
// constants/assets.ts — alvo
export const SOUND_ASSETS = {
  // já chamados por ChestRevealModal / useDragDropGrid
  CHEST_SUSPENSE: require('../../assets/audio/chest_suspense.mp3'),
  CHEST_OPEN:     require('../../assets/audio/chest_open.mp3'),
  CHEST_REVEAL:   require('../../assets/audio/chest_reveal.mp3'),
  // novos — pontos de impacto do jogo
  BATTLE_HIT:     require('../../assets/audio/battle_hit.mp3'),
  BATTLE_DEATH:   require('../../assets/audio/battle_death.mp3'),
  FORGE_CRAFT:    require('../../assets/audio/forge_craft.mp3'),
  MISSION_REWARD: require('../../assets/audio/mission_reward.mp3'),
  LEVEL_UP:       require('../../assets/audio/level_up.mp3'),
  AMBIENT_LOOP:   require('../../assets/audio/ambient_village.mp3'),
};
```

**Onde os sons disparam** (mapeado no código real, reusando o event bus):

| Som | Gatilho | Onde está o gancho hoje |
|---|---|---|
| `CHEST_SUSPENSE/OPEN/REVEAL` | abertura de baú | já chamado em `ChestRevealModal.tsx` (`:91-275`) e `useDragDropGrid.ts:105` |
| `BATTLE_HIT` | herói/inimigo recebe dano | `useGameFeedback.ts` já emite `BATTLE_HIT` (herói: `:55`; inimigo: `:110`) com `amount` — tap aqui |
| `BATTLE_DEATH` | morte em combate | `useGameFeedback.ts` já emite `BATTLE_DEATH` (herói: `:58`; inimigo: `:115`) |
| `MISSION_REWARD` | missão completada | conclusão de missão detectada em `useGameFeedback.ts:133-146` (TOAST "Missão concluída"); `MissionResultModal.tsx:9` já importa `playSound`. **Não** usar o delta de gold genérico (`:24-29`), que também dispara em treino/qualquer ganho de gold |
| `LEVEL_UP` | stat sobe (treino/equip) | `useGameFeedback.ts` já detecta ganhos de stat por diff (`+HP` `:46`, `+ATK` `:63`). É *ganho de stat*, não level-up de classe (o jogo não tem nível de personagem) |
| `FORGE_CRAFT` | forja/craft de equipamento | gancho a adicionar no handler de crafting (não detectado por `useGameFeedback` hoje) |
| `AMBIENT_LOOP` | música de fundo em loop | iniciar no preload (`SoundService.preload`, `sound.ts:20`); `expo-audio` player com `loop: true` |

**Decisão de design:** música ambiente é **um loop único** (não trilha por tela) no MVP — barato e suficiente para imersão. Volume baixo, ducking quando SFX toca (`shouldDuckAndroid` já está no `setAudioModeAsync`, `sound.ts:11`). **Toggle de mute persistente** (AsyncStorage, reusando `storage.ts`) — obrigatório: jogo idle roda em background, áudio que não se desliga é motivo nº 1 de review 1-estrela. `playsInSilentModeIOS: true` (`sound.ts:10`) respeita o botão físico de silêncio do iPhone — correto manter.

**Formato:** `.mp3` (ou `.m4a`/AAC) para compressão; evitar `.wav` (bundle grande). SFX curtos (<1s), pré-carregados; música em arquivo separado, também via `require`.

> **Pergunta aberta:** áudio **default ligado ou desligado** no 1º boot? Jogos mobile costumam abrir com som ligado mas baixo; idle players às vezes preferem mudo. Sugestão: ligado com volume moderado + toast discreto no onboarding (SPEC 5) com botão de mute. E: origem dos assets — comprar pack royalty-free (ex.: licença simples) ou encomendar? A licença precisa permitir distribuição em app comercial.

### 3.4 Analytics de retenção  *(direção)*

**Recomendação: PostHog** (mobile SDK `posthog-react-native`). Trade-offs avaliados:

- **PostHog** — generoso no free tier, self-host opcional, painéis de retenção/funil prontos, captura D1/D7 nativamente, e há tooling de integração disponível no ambiente. Coleta exige disclosure LGPD/GDPR (§3.5).
- **Firebase Analytics** — grátis e robusto, mas puxa o SDK Google inteiro (bundle +), e amarra ao ecossistema Google; overkill para um indie.
- **Amplitude** — ótimo em retenção, free tier menor.

**Eventos-chave** (nomes `snake_case`, alinhados às métricas do roadmap):

```ts
// pontos de captura
'app_open'                      // sessão — base de D1/D7
'onboarding_started'
'onboarding_completed'          // mede o "<60s até 1ª missão" do SPEC 5
'first_mission_started'         // 1ª missão (marco do funil de ativação)
'mission_completed'  { missionId, goldEarned }
'hero_recruited'     { classId }
'hero_fused'         { resultStars }     // fusão (Panteão)
'boss_defeated'      { bossId }          // boss semanal
'equipment_crafted'  { rarity }
```

**Arquitetura: um único ponto de tap, não instrumentação espalhada.** O `useGameFeedback` (diff de estado → eventos, `useGameFeedback.ts`) já detecta recrutamento (`:32-35`), gold/missão (`:24-29`, `:133-146`) e ganhos de stat. A integração limpa é um `analytics.ts` (service) que:
1. Inicializa o client no boot (com a key como env var, **nunca hardcoded**).
2. Expõe `track(event, props)`.
3. É chamado nos mesmos pontos do `useGameFeedback` onde os marcos já são detectados (recrutamento, missão concluída, ganho de stat), **sem** duplicar a detecção de estado.

Marcos que o `useGameFeedback` **não** detecta hoje (`hero_fused`, `equipment_crafted`, `boss_defeated`, `first_mission_started`) precisam de gancho novo no handler correspondente — não há diff de estado pronto para eles; isso é trabalho do plano de H3, não reaproveitamento.

Isso mantém a lógica de jogo limpa e o analytics como observador. **Gate de consentimento:** `track` é no-op até o usuário consentir (§3.5) — o client inicia em modo "opt-out" e só liga após aceite.

> **Pergunta aberta:** **self-host vs. cloud** do PostHog? Self-host evita enviar dados de usuário a terceiro (melhor para LGPD), mas custa infra (o VPS já roda Postgres/Traefik — caberia, mas é mais um serviço a manter). Cloud é zero-ops. Recomendo cloud no MVP e reavaliar se volume crescer.

### 3.5 Conformidade legal  *(direção, com pré-requisitos)*

| Item | O que é necessário | Por quê |
|---|---|---|
| **Política de privacidade** | URL pública (página estática) descrevendo: o que coleta (eventos de analytics, sem PII se anonimizado), com quem compartilha (PostHog), base legal, contato | Apple 5.1.1 e Play exigem URL **antes** da submissão. Host: pode ser uma página em `arquimedes.net`/`mxservices` (landings já existentes no `/root/rodrigo`) |
| **Termos de uso** | URL — regras de uso, isenção, propriedade | Boa prática; Play exige se houver conta/compra |
| **App Privacy (iOS)** | Formulário no App Store Connect: declarar "Usage Data / Product Interaction" se analytics ligado; "Not collected" se opt-out total | Bloqueia submissão se em branco |
| **Data safety (Android)** | Formulário no Play Console: mesmos dados, + se criptografado em trânsito (PostHog usa HTTPS) | idem |
| **Classificação etária** | Questionário IARC (Play) + Age Rating (iOS). Jogo de fantasia com combate estilizado, **sem** gore/aposta real → provável 9+/12 | Obrigatório |
| **Consentimento LGPD/GDPR** | Banner/tela de consentimento de analytics no 1º boot (opt-in para UE; opt-out aceitável fora). `track` no-op sem aceite (§3.4) | LGPD (Brasil) e GDPR (UE) — se há analytics, há tratamento de dado |
| **Disclosure de loot** | Se o baú/raridade aleatória for classificado como loot box paga (só vira problema **se** SPEC 8 introduzir compra de baús): publicar odds. **Hoje não há compra** → declarar "no paid loot boxes" | Apple 3.1.1 / Play paid loot odds |

**Decisão:** como hoje **não há IAP nem compra de baú** (confirmado: nenhum fluxo de pagamento no código), o jogo se enquadra como **free, sem compras**, e o único dado tratado é analytics → conformidade é leve. Se SPEC 8 trouxer IAP/cosméticos, este SPEC precisa de um adendo (disclosure de preço, restore purchases, odds se houver baú pago).

> **Pergunta aberta:** o dono prefere **opt-in global** de analytics (mais conservador, LGPD-safe, mas reduz dados coletados) ou **opt-out** fora da UE? E onde hospedar as páginas de privacidade/termos — uma das landings existentes ou domínio novo?

### 3.6 Checklists de submissão

**iOS (App Store Connect):**
1. Conta Apple Developer Program ativa (US$ 99/ano) — **pré-requisito**.
2. App ID + bundle identifier registrados; app criado no App Store Connect.
3. `eas build --profile production --platform ios` → `.ipa`.
4. `eas submit --platform ios` → TestFlight.
5. Metadados: nome, subtítulo, descrição, keywords, screenshots (§3.2), URL de privacidade, categoria (Games > Role Playing), age rating.
6. App Privacy preenchido.
7. Teste interno em TestFlight; depois "Submit for Review".

**Android (Google Play Console):**
1. Conta Google Play Developer (US$ 25 único) — **pré-requisito**.
2. App criado no Play Console; `applicationId` = `android.package`.
3. `eas build --profile production --platform android` → `.aab`.
4. `eas submit --platform android --track internal` → Internal testing.
5. Store listing: título, descrição curta/longa, ícone, feature graphic, screenshots (§3.2).
6. Data safety form + content rating (IARC) + target audience.
7. Promover internal → closed/open → produção.

---

## 4. Mudanças por Arquivo

> Design-only: a tabela lista o que **um plano de H3 criaria/modificaria**, não mudanças a aplicar agora.

| Arquivo | Ação | O que muda |
|---|---|---|
| `eas.json` | **Criar** | 3 perfis de build + bloco `submit` (§3.1). Não existe hoje. |
| `app.json` | Modificar | Adicionar `ios.bundleIdentifier`, `android.package`; `userInterfaceStyle: "dark"` e splash/adaptive `#15100B` (este último já em SPEC 1, `app.json:8,13,22`). |
| `package.json` | Modificar | Adicionar `eas-cli` (dev), `posthog-react-native`; **remover** `expo-av` (`:31`, deprecado/não usado); adicionar `expo-tracking-transparency` se opt-in iOS. |
| `assets/icon.png`, `adaptive-icon.png`, `splash-icon.png` | **Substituir** | Arte "Reino" (placeholders default hoje, §1.1). |
| `assets/audio/*.mp3` | **Criar** | Música ambiente + SFX (chest/battle/forge/reward/levelup) — pasta inexistente hoje. |
| `assets/store/` | **Criar** | Screenshots por device, feature graphic — material de loja, fora do bundle. |
| `src/constants/assets.ts` | Modificar | Preencher `SOUND_ASSETS` (`:1`, hoje `{}`) com os `require` de §3.3. |
| `src/services/sound.ts` | (SPEC 1) | API `expo-audio` atual + suporte a loop/mute. Este SPEC consome. |
| `src/services/analytics.ts` | **Criar** | Client PostHog + `track()` + gate de consentimento (§3.4). |
| `src/services/storage.ts` | Modificar | Persistir flags `soundMuted` e `analyticsConsent`. |
| `src/hooks/useGameFeedback.ts` | Modificar | Nos pontos de detecção já existentes — gold (`:24-29`), recrutamento (`:32-35`), dano/morte (`:55-58`, `:110-115`), missão concluída (`:133-146`) — chamar `playSound`/`analytics.track` correspondentes. |
| `src/components/ChestRevealModal.tsx` | (sem mudança de lógica) | Sons passam a tocar de fato quando `SOUND_ASSETS` deixa de ser vazio. |
| `legal/privacy.html`, `legal/terms.html` | **Criar** | Páginas estáticas hospedadas (URL para as lojas). |

---

## 5. Estratégia de Teste

Build/loja/assets são majoritariamente **validação manual**, não unit. Mas há lógica testável:

- **Áudio (unit):** `SoundService` com `SOUND_ASSETS` preenchido — testar que `preload` registra todas as chaves, `play(key)` chama o player, mute faz `play` virar no-op. Mock do player nativo do `expo-audio` é aceitável aqui (é fronteira de plataforma, não DB — a regra "integração > mock" do projeto mira DB/AsyncStorage, não áudio nativo). Persistência do toggle de mute: **AsyncStorage in-memory real** (convenção do projeto), não mock.
- **Analytics (unit):** `analytics.track` é **no-op até consentir** (caso crítico — não enviar dado sem aceite); após consentir, encaminha ao client (client mockado). Testar mapeamento evento→props (`mission_completed` carrega `goldEarned`).
- **Consentimento/persistência (integração):** consentir → reload → flag persiste → `track` ativo. AsyncStorage real.
- **Build (validação manual):** `eas build --profile preview` gera artefato instalável; boot em **device físico iOS e Android** (não só emulador — áudio e ícones se comportam diferente). Confirmar: ícone "Reino" aparece, splash dark sem flash branco, música toca e o **mute persiste** após matar e reabrir o app.
- **Loja (validação manual):** screenshots nos tamanhos exatos exigidos; metadados sem campo vazio (App Store Connect/Play recusam); links de privacidade abrem.

TDD onde crítico: o **gate de consentimento do analytics** (não vazar dado) e o **mute persistente** (review killer) são os dois pontos de lógica que merecem teste antes da implementação.

---

## 6. Critérios de Aceitação (binários, mensuráveis)

- [ ] `eas build --profile production --platform android` produz um `.aab` assinado; `--platform ios` produz `.ipa` assinado. (0 erro de credencial)
- [ ] `eas.json` tem exatamente os perfis `development`/`preview`/`production`; `npx tsc --noEmit` segue **0 erros** após adições.
- [ ] `app.json` tem `ios.bundleIdentifier` e `android.package` não-vazios; `userInterfaceStyle: "dark"`; splash `backgroundColor: "#15100B"`.
- [ ] `SOUND_ASSETS` tem ≥9 chaves (não-vazio), incluindo as 3 já cabeadas (`CHEST_SUSPENSE`/`CHEST_OPEN`/`CHEST_REVEAL`) + `AMBIENT_LOOP`; todas as chaves referenciadas em `ChestRevealModal`/`MissionResultModal`/`useDragDropGrid`/`useGameFeedback` resolvem para um arquivo existente em `assets/audio/`.
- [ ] No device físico: música toca no boot; SFX de baú/batalha/recompensa audíveis; **toggle de mute persiste** após kill+reopen.
- [ ] `expo-av` **removido** do `package.json`; nenhum import de `expo-av` em `src/`.
- [ ] Analytics: `app_open`, `first_mission_started`, `mission_completed`, `hero_recruited`, `hero_fused`, `boss_defeated` aparecem no painel; gráfico de **retenção D1 e D7** consultável.
- [ ] `analytics.track` é **no-op sem consentimento** (coberto por teste).
- [ ] URLs de política de privacidade e termos retornam 200; App Privacy (iOS) e Data safety (Android) preenchidos.
- [ ] Classificação etária definida em ambas as lojas.
- [ ] Build chega a **TestFlight (iOS)** e **Internal testing (Android)** sem rejeição de metadado.

---

## 7. Riscos e Mitigação

| Risco | Severidade | Mitigação |
|---|---|---|
| **Rejeição na revisão Apple** (metadado, privacidade, "guideline 4.2 minimum functionality") | 🔴 | Submeter primeiro a TestFlight interno; preencher App Privacy com rigor; screenshots reais (pós-SPEC 3), não mockups; descrição honesta. |
| **Keystore Android perdido** → impossível atualizar o app | 🔴 | Deixar EAS gerenciar (backup na nuvem Expo) **ou** guardar keystore próprio em local seguro fora do repo. Documentar onde está. |
| **Bundle de áudio infla o tamanho** do app | 🟡 | `.mp3`/AAC comprimido, SFX <1s, uma só faixa de música; medir tamanho do `.aab` antes de publicar. |
| **`expo-av` + `expo-audio` em conflito** de sessão nativa | 🟠 | Remover `expo-av` (não usado) — vira pré-requisito, não risco. |
| **LGPD/GDPR — analytics sem consentimento** | 🟠 | `track` no-op até aceite (§3.4); banner no 1º boot; opt-in na UE. Testado. |
| **Loot box / IAP disclosure** se SPEC 8 chegar antes do lançamento | 🟡 | Hoje sem compra → declarar "no paid loot". Se SPEC 8 introduzir, adendo a este SPEC com odds. |
| **Screenshots da UI genérica atual** envelhecem a ficha | 🟠 | Bloquear captura até SPEC 3 entregar o redesign (dependência explícita, §8). |
| **Conta dev não aprovada a tempo** (Apple leva dias) | 🟡 | Criar contas Apple/Google **no início de H3**, antes de tudo (pré-requisito de calendário). |

---

## 8. Dependências e Sequenciamento

**Depende de (não inicia sem):**
- **SPEC 1 (Estabilização)** — `tsc` verde, `sound.ts` migrado para `expo-audio` atual, `userInterfaceStyle: dark`/splash dark. Sem boot limpo não há build de loja. *Bloqueante.*
- **SPEC 2 + 3 (Design System + Redesign)** — ícone, splash e **screenshots** precisam da identidade "Reino" e das telas redesenhadas. Capturar a UI atual seria material de loja amador. *Bloqueante para os assets visuais.*
- **SPEC 5 (Onboarding)** — os eventos de funil (`onboarding_started/completed`, `first_mission_started`) e a métrica "<60s até 1ª missão" pressupõem o tutorial existir; o consentimento de analytics encaixa no onboarding. *Acoplado.*
- **SPEC 8 (Monetização)** — se trouxer IAP/cosméticos antes do lançamento, muda o perfil de conformidade (disclosure de preço, restore, loot odds). *Condicional.*

**Posição no roadmap (`ROADMAP §2`):** `SPEC 8 → SPEC 9`. Este é o **último gate** antes do lançamento público.

**O que destrava:** o lançamento em si — primeira build assinada em TestFlight/Internal testing, ficha de loja completa, instrumentação de retenção que fecha o ciclo de medição aberto por SPEC 5 (D1/D7 do `ROADMAP §4 H3`).

**Pré-requisitos externos (providenciar no início de H3, em paralelo ao código):**
1. **Conta Apple Developer Program** (US$ 99/ano) — aprovação leva dias.
2. **Conta Google Play Developer** (US$ 25, única).
3. **Conta PostHog** (cloud free tier) ou decisão de self-host.
4. **Domínio/host** para política de privacidade e termos (reusar landing existente em `/root/rodrigo`).
5. **Identificador de pacote** definitivo decidido pelo dono (imutável pós-release).
6. **Assets de áudio** licenciados (pack royalty-free comercial ou encomenda).
7. **Service account JSON** do Google Play (para `eas submit`) — secret, fora do repo.

---

*Gerado em 2026-06-20 como DIREÇÃO. Ganha plano executável (`docs/superpowers/plans/`) ao iniciar H3, após os aprendizados de SPEC 3/5/8. Atualize a tabela de status do roadmap quando este SPEC sair de "design only".*
