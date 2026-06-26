# Checklist de Submissão às Lojas — Idle RPG Medieval

> Gerado em 2026-06-26 como parte do SPEC 9 (store readiness). Itens marcados
> com **[DÉBITO]** exigem ação fora do sandbox de CI (device real, contas pagas,
> design, formulários de loja).

---

## 0. Pré-requisitos técnicos (verificar antes de qualquer submissão)

- [x] `npx tsc --noEmit` → 0 erros
- [x] `jest --config jest.unit.config.js` → 700 testes verdes, 3 snapshots intactos
- [x] `app.json` com `ios.bundleIdentifier = 'com.v4smc.idlerpg'` e `android.package = 'com.v4smc.idlerpg'`
- [x] `eas.json` com perfis `development`, `preview`, `production`
- [x] Analytics com gate de consentimento LGPD (zero emissão sem aceite)
- [x] Telas de Privacidade e Termos vinculadas na Settings e no ConsentGate
- [x] `expo-av` removido (usa `expo-audio`)
- [ ] **[DÉBITO]** EAS Build real concluído (`eas build --platform all --profile production`)
- [ ] **[DÉBITO]** Arquivos de áudio licenciados populados em `SOUND_ASSETS`
- [ ] **[DÉBITO]** Ícone (1024×1024 px, sem alpha para iOS) e splash screen finais
- [ ] **[DÉBITO]** Screenshots em device real (iPhone 6.9" + Android 16:9/18:9)
- [ ] **[DÉBITO]** Validação visual em emulador iOS + Android (UX, contraste, layout)

---

## 1. Apple App Store (iOS)

### 1.1 Conta e App ID

- [ ] **[DÉBITO]** Conta Apple Developer ($99/ano) ativa em `developer.apple.com`
- [ ] **[DÉBITO]** App ID criado em "Certificates, Identifiers & Profiles":
  - Bundle ID: `com.v4smc.idlerpg`
  - Capabilities: Push Notifications (se habilitado), Associated Domains (se necessário)
- [ ] **[DÉBITO]** Keystore/certificado gerenciado pelo EAS (`eas credentials`) ou exportado e guardado fora do repo

### 1.2 App Store Connect

- [ ] **[DÉBITO]** Novo app criado em `appstoreconnect.apple.com`
- [ ] **[DÉBITO]** Metadados preenchidos (ver seção 3 — ASO copy)
- [ ] **[DÉBITO]** URL de Privacidade fornecida (hospedar conteúdo de `legalContent.ts`)
- [ ] **[DÉBITO]** URL de Suporte fornecida

### 1.3 TestFlight (antes do review público)

- [ ] **[DÉBITO]** Build enviada via `eas submit --platform ios` ou Transporter
- [ ] **[DÉBITO]** Grupo interno de teste criado e build distribuída
- [ ] **[DÉBITO]** Smoke test no device: onboarding → consentimento → missão → boss → forja
- [ ] **[DÉBITO]** Beta review aprovado (caso use External Testing)

### 1.4 App Privacy (obrigatório desde iOS 14)

Declarar em App Store Connect → "App Privacy":

| Tipo de dado | Coleta? | Vinculado ao usuário? | Usado para rastrear? |
|---|---|---|---|
| Usage Data (analytics de eventos de jogo) | Sim (quando consent=true) | Não | Não |
| Identificadores de dispositivo | Não | — | — |
| Dados financeiros | Não (IAP = débito) | — | — |
| Localização | Não | — | — |

- [ ] **[DÉBITO]** Formulário "App Privacy" preenchido com base na tabela acima
- [ ] **[DÉBITO]** Revisar se PostHog (quando integrado) coleta dados adicionais e atualizar

### 1.5 Age Rating (Content Descriptions)

- [ ] **[DÉBITO]** Formulário de age rating preenchido:
  - Violence: Fantasy/Cartoon (combate idle, sem gore)
  - Horror/Fear: Nenhum
  - Sexual Content: Nenhum
  - Profanity: Nenhum
  - Gambling/Contests: Nenhum (loot boxes ausentes — ver declaração na seção 4)
  - Target age: 9+ (estimativa; confirmar com o formulário IARC)

### 1.6 Review e publicação

- [ ] **[DÉBITO]** Build de produção enviada para review
- [ ] **[DÉBITO]** Notas para o reviewer:
  - "Aplicativo de RPG idle (sem ação em tempo real). Não há compras in-app nesta versão."
  - "Tela de consentimento LGPD aparece no 1º boot."
- [ ] **[DÉBITO]** Review aprovado → definir data de lançamento ou lançar imediatamente

---

## 2. Google Play (Android)

### 2.1 Conta e pacote

- [ ] **[DÉBITO]** Conta Google Play Developer ($25 taxa única) ativa em `play.google.com/console`
- [ ] **[DÉBITO]** Novo aplicativo criado:
  - Package: `com.v4smc.idlerpg`
  - Tipo: Jogo
  - Categoria: RPG

### 2.2 Internal Testing (antes de qualquer publicação)

- [ ] **[DÉBITO]** APK/AAB enviado via `eas submit --platform android` ou Play Console upload
- [ ] **[DÉBITO]** Trilha "Internal Testing" criada com lista de e-mails de testadores
- [ ] **[DÉBITO]** Smoke test: onboarding → consentimento → sessão de jogo completa
- [ ] **[DÉBITO]** Promover para "Closed Testing" → "Open Testing" se desejado antes do produção

### 2.3 Data Safety (formulário obrigatório)

Declarar em Play Console → "App Content" → "Data Safety":

| Tipo de dado | Coleta? | Compartilhado? | Criptografado? | Excluível? |
|---|---|---|---|---|
| App activity (eventos de jogo anônimos) | Sim (quando consent=true) | Não | Sim (HTTPS) | Não (anônimos, sem ID) |
| Device identifiers | Não | — | — | — |
| Financial info | Não (IAP = débito) | — | — | — |
| Location | Não | — | — | — |

- [ ] **[DÉBITO]** Formulário "Data Safety" preenchido com base na tabela acima
- [ ] **[DÉBITO]** Política de privacidade com URL pública fornecida
- [ ] **[DÉBITO]** Revisar se PostHog (quando integrado) coleta dados adicionais e atualizar

### 2.4 IARC / Age Rating

- [ ] **[DÉBITO]** Questionário IARC preenchido via Play Console → "App Content" → "Rating"
  - Violence: Fantasy (combate idle sem gore)
  - Gambling: Nenhum (loot boxes ausentes)
  - Estimated rating: Everyone / PEGI 7

### 2.5 Conteúdo do app e políticas

- [ ] **[DÉBITO]** "App Content" → declarar ausência de conteúdo impróprio, anúncios, etc.
- [ ] **[DÉBITO]** Confirmar ausência de permissões desnecessárias no `AndroidManifest.xml`
- [ ] **[DÉBITO]** Revisão de políticas: sem loot boxes monetizados, sem publicidade para menores

### 2.6 Publicação

- [ ] **[DÉBITO]** Build de produção na trilha Production
- [ ] **[DÉBITO]** Rollout gradual recomendado (20% → 50% → 100%)
- [ ] **[DÉBITO]** Monitorar ANR/crashes no Play Console por 48h após release

---

## 3. ASO — Copy pt-BR

> Posicionamento: "idle RPG medieval com progresso offline". O jogador progride
> enquanto está desconectado — missões rodam, ouro acumula, heróis crescem.

### Nome do app (≤30 caracteres)

```
Reino Idle: RPG Medieval
```
*(24 chars — dentro do limite)*

### Subtítulo iOS / Legenda curta Google (≤30 chars)

```
Heróis que progridem offline
```
*(30 chars — limite exato)*

### Descrição curta Android (≤80 chars)

```
RPG idle medieval: recrute heróis, complete missões e progrida offline.
```
*(72 chars)*

### Descrição longa (ambas as lojas — ~500 palavras sugeridas)

```
Construa sua guilda medieval enquanto o mundo gira sem você.

Reino Idle é um RPG medieval idle onde cada herói que você recruta
continua lutando, treinando e completando missões mesmo quando o app
está fechado. Você volta e encontra ouro acumulado, missões resolvidas
e inimigos derrotados — o progresso nunca para.

--- Recrute e evolua heróis únicos ---
Cada herói tem classe, atributos e personalidade próprios. Ferreiro,
Arqueira, Druida, Assassino — combine sinergia de grupo para multiplicar
o poder da guilda.

--- Missões automáticas e boss semanal ---
Envie grupos para missões cronometradas. Enfrente o boss da semana com
sua melhor formação. Cada vitória traz recompensas e experiência.

--- Forja e equipamentos ---
Craft equipamentos que amplificam os atributos dos heróis. A forja nunca
dorme: programe uma receita e volte mais tarde com o item pronto.

--- Progresso offline real ---
Nenhuma mecânica de "energia" ou timer artificial. Missões resolvem no
tempo real: se você ficar longe por 8 horas, seus heróis trabalharam
por 8 horas.

--- Privacidade em primeiro lugar ---
O app coleta analytics anônimos de uso (eventos de jogo, sem dados
pessoais) somente com sua permissão explícita. Você decide no primeiro
uso e pode mudar nas Configurações a qualquer momento.

--- Sem caixas de loot pagas ---
Todo conteúdo do jogo é obtido jogando. Não há itens pagos por sorte.
Cosméticos premium (em desenvolvimento) serão compras diretas sem
aleatoriedade.

Requisitos: iOS 14+ / Android 8+. Não requer internet para jogar.
```

### Keywords iOS (≤100 chars, separados por vírgula)

```
idle,rpg,medieval,offline,guilda,heróis,masmorra,batalha,fantasy,craft
```
*(70 chars)*

---

## 4. Declarações obrigatórias

### 4.1 Sem loot boxes pagos

> "O jogo não possui caixas de surpresa (loot boxes) adquiridas com dinheiro
> real. Baús de jogo (chest) são obtidos por completar missões e são abertos
> sem custo monetário. Cosméticos premium planejados serão vendidos como
> compras diretas, sem elemento de sorte."

### 4.2 Analytics e privacidade

> "O aplicativo coleta dados anônimos de uso (eventos de jogo como missões
> completadas, heróis recrutados) via analytics, somente com consentimento
> explícito do usuário (gate LGPD/GDPR no 1º boot). Nenhum dado é vinculado
> a identidade pessoal. O usuário pode revogar o consentimento em
> Configurações → Privacidade."

---

## 5. URLs legais necessárias [DÉBITO]

- [ ] **[DÉBITO]** Hospedar política de privacidade (conteúdo base em `src/constants/legalContent.ts`) em URL pública, ex.: `https://v4smc.com/idlerpg/privacy`
- [ ] **[DÉBITO]** Hospedar termos de uso em URL pública, ex.: `https://v4smc.com/idlerpg/terms`
- [ ] **[DÉBITO]** Revisar texto legal com advogado ou especialista em LGPD/GDPR antes do launch
- [ ] **[DÉBITO]** Atualizar as URLs no app (`legalContent.ts`) e nos formulários de loja

---

## 6. Ordem recomendada de execução (débitos)

```
1. Contas (Apple $99 + Google $25)
2. EAS Build production (eas build -p all --profile production)
3. Arte: ícone + splash + screenshots em device
4. Hospedar URLs de Privacidade/Termos
5. Internal Testing (iOS TestFlight + Android Internal)
6. Smoke test em device: onboarding → consentimento → sessão completa
7. Preencher formulários: App Privacy (Apple) + Data Safety (Google) + IARC
8. ASO copy nas lojas (usar seção 3 acima)
9. Submeter para review
10. Integrar PostHog real: instalar posthog-react-native, obter chave, injetar em setAnalyticsSink (src/services/analytics.ts)
```
