# Redesign de Telas — Design Spec

> Data: 2026-06-20 · Referência: **SPEC 3** do `docs/superpowers/ROADMAP-2026-H2.md` (Horizonte 2).
> Aplica o **Design System "Reino"** (SPEC 2) em **toda** a UI: troca `ScreenHeader`→`Banner`, emoji→`<Icon>`,
> hex→token, cards crus→`Card`/`OrnateFrame`; transforma a **Vila** numa cena-mapa interativa usando
> `village_map.png`; adiciona **microinterações** (Reanimated v4 + Lottie) e **estados vazios polidos**;
> e alinha a **navegação inferior** à paleta nova. Cada tela é validada por screenshot no emulador/browser.
>
> **Estratégia:** migrar tela a tela (sem big-bang), começando pelas mais visitadas e pelas que destravam
> a remoção dos `compatAliases` do tema. Ao final, `compatAliases`/`fontSize`/`fontWeight` legados do
> `theme` (SPEC 2 §3.6) são removidos, fechando a migração que SPEC 2 deixou pendente.

---

## 1. Contexto e Problema

SPEC 2 (Design System "Reino", já especificado) entrega a **infra**: tokens (`theme.colors` couro/ouro,
`theme.type` Cinzel+Inter, `theme.elevation`, `theme.rarity`), `<Icon>` vetorial, 7 componentes-base
(`Banner`, `Button`, `Card`, `OrnateFrame`, `Seal`, `Divider`, `Parchment`) e uma tela-vitrine descartável.
Mas SPEC 2 **não toca em nenhuma das 11 telas** (seu Não-Objetivo §2.2): elas só herdam a paleta nova via
`compatAliases` (background vira couro automaticamente), continuando estruturalmente genéricas. A dor real
está nas telas, e é o gargalo de prioridade do dono (ROADMAP §1, problema #5).

O que existe **hoje**, fundamentado no código lido:

### 1.1 Telas são listas verticais de cards crus, sem identidade

- **`VillageScreen.tsx`** (166 LOC): a Vila — o "coração da guilda" — é uma **lista vertical de 8 cards**
  idênticos (`VillageScreen.tsx:53-102`), cada um um `<TouchableOpacity>` com emoji (`'⚔️'`, `'🩺'`, `'⚒️'`…)
  + título + descrição. **Zero uso do `village_map.png`** (existe em `assets/village_map.png`, 29 KB, exposto
  em `IMAGE_ASSETS.VILLAGE_MAP` em `constants/assets.ts:9-11`, **importado por ninguém** — confirmado por grep).
  O ROADMAP §3.7 e o problema #5 citam explicitamente "`village_map.png` não usado".
- **`MissionsScreen.tsx`** (177 LOC), **`BlacksmithScreen.tsx`** (663 LOC), **`GuildScreen.tsx`** (123 LOC),
  **`ShopScreen.tsx`** (94 LOC), **`TrainingScreen.tsx`** (204 LOC), **`EnfermariaScreen.tsx`** (201 LOC),
  **`PantheonScreen.tsx`** (451 LOC), **`AchievementsScreen.tsx`** (184 LOC), **`DailyQuestsScreen.tsx`**
  (411 LOC), **`WeeklyScreen.tsx`** (412 LOC): todas seguem o mesmo molde —
  `SafeAreaView` + `ScrollView`/`FlatList` + `<ScreenHeader>` cru + cards `View`/`TouchableOpacity` com
  `backgroundColor: theme.colors.surface` e `borderRadius` chapado.

### 1.2 `ScreenHeader` cru em 10 das 11 telas (a 11ª nem usa)

`<ScreenHeader>` (`components/ui/ScreenHeader.tsx`) é um header plano: `fontWeight: '800'` literal
(`ScreenHeader.tsx:40`), sem Cinzel, sem moldura, sem gradiente. Usado em Missions, Blacksmith, Guild, Shop,
Training, Enfermaria, Pantheon, Achievements, DailyQuests, Weekly, Village. SPEC 2 entregou `Banner` com
**API compatível** (`title`/`subtitle`/`right`) exatamente para que SPEC 3 faça o swap 1:1.

### 1.3 Iconografia 100% emoji nas telas

Emoji como ícone em todo lugar: `VillageScreen.tsx:54-101` (8 emojis de edifício), `HeroCard.tsx:34-41`
(mapa `TASK_LABEL_MAP` de emoji), `HeroCard.tsx:156/169/176` (stats `⚔️🔮🛡️🎯🏃`), `CombatantCard.tsx:134-136`
(`⚔️🔮🛡️`), `GoldDisplay.tsx:14` (`💰`), `ShopScreen.tsx:50` (`💎🥈🎁`), `GuildScreen.tsx:67-70` (`⚔️💤`),
`BlacksmithScreen.tsx:29-33` (`TYPE_ICONS`). SPEC 2 entregou `<Icon>` (MaterialCommunityIcons + SVG custom
para stats/classes) para substituí-los.

### 1.4 Microinterações existem mas são ilhas isoladas (RN `Animated`, não Reanimated)

O projeto **já tem** padrão de animação rico, mas concentrado em 2 componentes e usando a API **legada**
`react-native/Animated`, não `react-native-reanimated` (que está instalado, `~4.1.1`, package.json:37):

- **`CombatantCard.tsx`**: HP-bar animada (`:47-55`), hit-shake + flash overlay (`:77-100`), dano flutuante
  (`:64-76`), death fade/scale (`:82-85`) — tudo via `Animated.Value` + `interpolate`.
- **`MissionResultModal.tsx`**: fade+slide de entrada (`:34-46`), `LottieView` de confetti em vitória
  (`:48-50`, `:139-146`), playback de log de batalha (`BattleRunner`).

Fora desses dois, **nenhuma** tela tem transição, press-feedback, count-up ou shimmer. O `GoldDisplay`
muda de valor sem animar (`GoldDisplay.tsx:19-25`, número estático). A navegação entre tabs é o corte seco
padrão do React Navigation. Lottie só cobre 3 assets (`assets/lottie/`: `chest_pulse`, `confetti`,
`sparkle_burst` — `constants/assets.ts:3-7`); ROADMAP §3.7 pede ampliar para level-up/forja/recrutamento.

### 1.5 Estados vazios são emoji + texto; `ComingSoon` é dead code

- **`EmptyState.tsx`**: `icon` default `'🏰'` (emoji) + título + subtítulo. Usado só por `GuildScreen`
  (via `GuildEmptyState.tsx`).
- **`ComingSoon.tsx`**: ilustração = um emoji num círculo (`:14-16`), `fontWeight: '900'` literal (`:65`).
  **Confirmado por grep: não é importado por nenhuma tela** — é dead code hoje. O ROADMAP pede polir os
  estados vazios; este spec o reabilita (Pantheon/Weekly têm seções "em breve" que hoje não usam nada).
- **`BlacksmithScreen.tsx:238-241`** e **`MissionsScreen` heroGrid vazio**: estados vazios "à mão"
  (texto itálico cru), sem componente.

### 1.6 Navegação inferior com Ionicons (paleta antiga)

`AppNavigator.tsx:16` importa `Ionicons` de `@expo/vector-icons` (que SPEC 2 instala). A `tabBarStyle`
usa `theme.colors.surface`/`surfaceLight` (`:27-29`) e `tabBarActiveTintColor: theme.colors.primary`
(`:33`) — via aliases de SPEC 2 isso já vira ouro, mas os **ícones** (`fitness`, `map`, `medkit`, `home`,
`cart`) são Ionicons genéricos, não a família medieval do DS (`MaterialCommunityIcons`: `castle`, `sword`,
`map-marker-path`, `medical-bag`, `store`). 6 das 11 telas são "hidden routes" (`:80-128`, sem tab própria,
hoje navegadas só pela Vila) — a Vila-mapa precisa continuar sendo o hub dessas 6 rotas (mais `Treinamento`/
`Enfermaria` como edifícios; conjunto de 8 hotspots definido em §3.3).

### 1.7 Hex inline residual nas telas (pós-SPEC 2)

SPEC 2 migra os 22 hex de produção, mas alguns são **de tela** e serão tocados aqui no contexto do redesign:
`ShopScreen.tsx:78/85` (`rgba(255,215,0,…)` da `infoBox`), `DailyQuestsScreen.tsx:293` (`'#1a1a1a'`),
`WeeklyScreen.tsx:367` (`'#1a1a1a'`). O `boxShadow` inline duplicado some ao trocar para `Card`/`elevation`:
`VillageScreen.tsx:138`, `HeroCard.tsx:250`, `TrainingScreen.tsx:155`, `EnfermariaScreen.tsx:189`.

**Dor concreta:** o jogo já "está vestido de couro" por fora (cores via aliases), mas por dentro continua
uma pilha de listas genéricas com emoji e zero movimento — não parece um RPG de fantasia premium. E o asset
mais distintivo que o projeto tem (o mapa da vila) está morto no disco.

---

## 2. Objetivos e Não-Objetivos

### 2.1 Objetivos (mensuráveis)

1. **As 11 telas** consumem componentes do DS: `<Banner>` no lugar de `<ScreenHeader>` (11/11),
   `<Card>`/`<OrnateFrame>` no lugar de `View`+`surface` cru, `<Button>` no lugar de `TouchableOpacity` cru,
   `<Icon>` no lugar de emoji.
2. **VillageScreen vira cena-mapa interativa**: renderiza `IMAGE_ASSETS.VILLAGE_MAP` como fundo com
   **8 hotspots** posicionados (um por edifício/rota), substituindo a lista de cards
   (`VillageScreen.tsx:53-102`). `village_map.png` passa a ter ≥1 importador.
3. **Microinterações com Reanimated v4** (padrão novo, substituindo `Animated` legado onde fizer sentido):
   transição de entrada de tela (fade+rise), press-feedback com escala em todo botão/hotspot, **count-up
   animado no `GoldDisplay`**, **shimmer** em estados de loading, **pulse** em botão "affordable".
4. **Lottie ampliado**: +3 animações (`level_up`, `forge_complete`, `recruit`) registradas em
   `constants/assets.ts` e disparadas nos momentos certos (level-up de herói, coleta na forja, recrutamento).
5. **Estados vazios polidos**: `EmptyState`/`ComingSoon` ganham ilustração (`<Icon>` grande ou Lottie loop
   sutil) no lugar do emoji; reabilitados onde hoje há texto cru.
6. **Navegação inferior coerente**: ícones da tab bar migram para `<Icon>`/MaterialCommunityIcons da família
   medieval; tint ativo = `gold`, inativo = `textMuted`; tab bar com `surfaceRaised` + `elevation`.
7. **0 hex inline** em `src/screens` e `src/components` (o lint de SPEC 2 segue verde após o redesign).
8. **`compatAliases` removidos**: ao fim do redesign, cada tela usa o **token semântico** (`statHp` em vez
   de `hp`, `bgBase` em vez de `background`), e `theme` perde `compatAliases`/`fontSize`/`fontWeight` legados
   (fecha a dívida que SPEC 2 §3.6 deixou explícita).
9. `npx tsc --noEmit` não regride; `npm test` (jest.unit.config.js) verde.
10. **Validação por screenshot** registrada para as 11 telas + transições, no browser (`expo start --web`)
    via Playwright e, onde possível, no emulador.

### 2.2 Não-Objetivos (YAGNI)

- **Não** entregar os tokens/fontes/`<Icon>`/componentes-base — isso é **SPEC 2** (este spec só os *aplica*).
  Se um componente-base faltar, é bug de SPEC 2, não escopo daqui.
- **Não** mudar **nenhuma regra de jogo**: DEF/CRIT/AGI seguem não-treináveis (mexer só na *apresentação*
  dos stats em `HeroCard`); gold continua vindo só de missão; nenhum balanço (isso é SPEC 4). Toda a forja,
  treino, missão, recrutamento mantêm a mesma lógica/handlers.
- **Não** criar arte de cenário nova além do que SPEC 2 já dá + os 3 Lotties novos. O mapa é o
  `village_map.png` existente; hotspots são overlays, não um mapa redesenhado.
- **Não** redesenhar o **fluxo** de nenhuma feature (ordem de telas, navegação lógica) — isso é
  onboarding/FTUE (SPEC 5). A tab bar muda de *aparência*, não de *estrutura* (mesmas rotas).
- **Não** entregar mini-map scroll/zoom, parallax, ou cena animada complexa na Vila. Mapa estático +
  hotspots tappáveis + press-feedback. Pan/zoom é over-engineering para 8 alvos.
- **Não** migrar o `CombatantCard`/`MissionResultModal` de `Animated`→Reanimated por migração-pela-migração:
  eles **funcionam**. Reanimated é para o que é **novo** (count-up, shimmer, pulse, transição de tela).
  (Ressalva: trocar os glifos emoji desses 2 por `<Icon>` é mudança de apresentação, não de animação — é
  permitida e exigida pelo critério #2; só a engine `Animated` fica intocada.)
- **Não** persistir o switch de tema claro/escuro nas settings (mecanismo é de SPEC 2; UI de settings é
  outro SPEC). As telas são validadas no modo dark (default).

---

## 3. Design Detalhado

### 3.1 Padrão de migração por tela (o "molde Reino")

Toda tela segue a mesma transformação, para previsibilidade e revisão fácil:

| De (hoje) | Para (Reino) |
|---|---|
| `<SafeAreaView style={{backgroundColor: theme.colors.background}}>` | `<ScreenContainer>` (novo wrapper, §3.2) com fundo `bgBase` + textura `Parchment` opcional + transição de entrada |
| `<ScreenHeader title subtitle right>` | `<Banner title subtitle right>` (swap 1:1, mesma API — SPEC 2 §3.9) |
| `<View style={styles.card}>` (surface + borderRadius + boxShadow) | `<Card elevation="e1">` ou `<OrnateFrame>` p/ destaque |
| `<TouchableOpacity style={styles.btn}>` | `<Button label variant icon>` (SPEC 2 §3.9) |
| `<Text style={{fontWeight:'800'}}>{titulo}</Text>` | `<Text style={theme.type.h2}>` (token composto) |
| `icon="⚔️"` (emoji) | `<Icon name="sword">` |
| `theme.colors.hp/atk/mp` (alias) | `theme.colors.statHp/statAtk/statMp` (token semântico) |
| `boxShadow: '0px 2px 4px…'` inline | `...theme.elevation.e1` (via `Card`) |

### 3.2 Novos componentes de tela (compartilhados)

SPEC 3 cria componentes **de composição de tela** (acima dos componentes-base de SPEC 2):

```tsx
// src/components/ui/ScreenContainer.tsx
interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;            // ScrollView vs View
  banner?: React.ReactNode;    // <Banner> fixo no topo
  texture?: 'leather' | 'none';
}
// Entrega: SafeArea + StatusBar (light-content, bgDeep) + fundo bgBase + textura opcional (Parchment)
// + transição de entrada (Reanimated: FadeIn + translateY 12->0, 280ms). Substitui o boilerplate
// SafeAreaView+ScrollView+StatusBar repetido nas 11 telas.
```

```tsx
// src/components/AnimatedGold.tsx  — substitui o GoldDisplay estático
interface AnimatedGoldProps { gold: number; }
// useSharedValue do total atual; em mudança, anima com withTiming (600ms, Easing.out). O valor exibido
// é o frame animado passado por formatNumber (mesma abreviação "1.2k" do GoldDisplay atual, src/utils/math),
// renderizado via componente <Text> animado (useAnimatedProps em texto, ou state+useDerivedValue p/ web shim).
// Pulso dourado (scale 1->1.12->1) no incremento. API idêntica ao GoldDisplay (drop-in no prop `right` do
// Banner). Emoji 💰 -> <Icon name="coin">. Mantém o accessibilityLabel "Ouro da guilda: {formatNumber}".
```

```tsx
// src/components/ui/Shimmer.tsx  — placeholder de loading
interface ShimmerProps { width?: number|string; height: number; radius?: keyof Theme['borderRadius']; }
// Bloco surfaceRaised com gradiente diagonal (expo-linear-gradient) deslizando via Reanimated
// (translateX em loop, withRepeat). Usado no LoadingScreen e em listas que carregam.
```

```tsx
// src/components/ui/PressableScale.tsx  — press-feedback universal
interface PressableScaleProps extends PressableProps { scaleTo?: number; } // default 0.96
// Wrapper Reanimated: onPressIn -> withSpring(scaleTo), onPressOut -> withSpring(1).
// Usado por <Button> (SPEC 2 pode já trazer; se não, SPEC 3 o usa nos hotspots e cards tappáveis).
```

> **Decisão:** `ScreenContainer` e `AnimatedGold` absorvem boilerplate repetido em 10-11 telas. Não são
> "componentes de identidade" (esses são de SPEC 2) — são **redutores de duplicação** de tela. 3 linhas
> repetidas 11× justificam o componente (não é over-engineering; é o oposto).

### 3.3 VillageScreen → cena-mapa interativa

O coração do spec. `village_map.png` (proporção a medir; assumir landscape ~16:9) é renderizado como
`<ImageBackground>` ocupando a área útil, com hotspots posicionados em **coordenadas relativas**
(percentuais), para responsividade independente do tamanho do device.

**Quais rotas viram hotspot (decisão explícita):** a Vila-mapa é o **hub das 6 hidden routes** (`Ferreiro`,
`Panteao`, `Conquistas`, `MissoesDiarias`, `Semanal`, `Guilda` — `AppNavigator.tsx:82-128`, sem tab própria)
**+** os 2 edifícios `Treinamento` e `Enfermaria`, que também têm tab mas são parte da fantasia "vila" e
ganham presença no mapa. Total = **8 hotspots**. As outras 3 tabs visíveis (`Vila` é a própria cena; `Missões`
e `Loja`) **não** recebem selo no mapa — são alcançadas pela tab bar, evitando duplicar a navegação principal
do loop de gold (`Missões`) e da compra (`Loja`) num alvo redundante. Esse é o invariante testado em §5.1
(os 8 `screen` ∈ rotas válidas; e o conjunto = `{Treinamento, Enfermaria} ∪ hiddenRoutes`).

```tsx
// src/screens/VillageScreen.tsx (reescrita)
interface Hotspot {
  screen: string;          // rota de AppNavigator
  icon: IconName;          // <Icon> da família medieval
  label: string;           // tooltip/legenda
  x: number; y: number;    // 0..1 relativo à imagem do mapa
}
const HOTSPOTS: Hotspot[] = [
  { screen: 'Treinamento',   icon: 'sword',        label: 'Treinamento',  x: 0.22, y: 0.40 },
  { screen: 'Enfermaria',    icon: 'medical-bag',  label: 'Enfermaria',   x: 0.50, y: 0.30 },
  { screen: 'Ferreiro',      icon: 'anvil',        label: 'Ferreiro',     x: 0.78, y: 0.42 },
  { screen: 'MissoesDiarias',icon: 'scroll',       label: 'Missões Diárias', x: 0.30, y: 0.68 },
  { screen: 'Conquistas',    icon: 'trophy',       label: 'Conquistas',   x: 0.55, y: 0.72 },
  { screen: 'Panteao',       icon: 'bank',         label: 'Panteão',      x: 0.80, y: 0.70 },
  { screen: 'Semanal',       icon: 'calendar-star',label: 'Desafio Semanal', x: 0.15, y: 0.55 },
  { screen: 'Guilda',        icon: 'shield-crown', label: 'Guilda',       x: 0.65, y: 0.50 },
];
```

Cada hotspot é um `<PressableScale>` posicionado por `position:'absolute'` com `left/top` computados de
`x*W`, `y*H` (W/H = dimensões medidas do `ImageBackground` via `onLayout`). Visual: `<Seal>` circular
(SPEC 2) com o `<Icon>` dentro + label abaixo em `theme.type.caption`. Microinteração: **pulse** lento
(`withRepeat`) num hotspot "com novidade" (ex.: missão diária disponível, recompensa de conquista pronta) —
reaproveita estado já existente (`state.dailyQuests`, `state.achievements`) sem nova regra de jogo.
`GoldDisplay`/`AnimatedGold` flutua no topo. O `<Banner title="Vila de Ouro">` vira overlay translúcido no
topo do mapa (ou some, deixando só o ouro — decisão de layout validada por screenshot).

> **Coordenadas:** os `x/y` acima são **provisórios e calibráveis** — serão ajustados sobre o
> `village_map.png` real durante a implementação, posicionando cada selo sobre o edifício correspondente na
> arte. A calibração é parte da validação por screenshot (§5.3), não um valor a adivinhar no spec.

**Fallback:** se a imagem falhar ao carregar (`onError`), cai para um grid de `<Card>` com `<Icon>` (a
versão "molde Reino" da lista atual) — o jogo nunca fica sem navegação para os edifícios.

### 3.4 Microinterações (catálogo concreto, Reanimated v4)

| Interação | Onde | Implementação |
|---|---|---|
| **Transição de entrada de tela** | `ScreenContainer` (todas) | `Animated.View` (reanimated) com `entering={FadeIn.duration(280)}` + `translateY` 12→0. |
| **Press-feedback (escala)** | `Button`, hotspots, cards tappáveis | `PressableScale` (§3.2): `withSpring(0.96)` no press-in, `withSpring(1)` no press-out. |
| **Count-up de ouro** | `AnimatedGold` (Banner de toda tela com `right`) | `withTiming` no shared value, `useDerivedValue(Math.floor)`, pulso de escala no delta positivo. |
| **Shimmer de loading** | `LoadingScreen`, `Shimmer` em listas | gradiente deslizante em `withRepeat`. |
| **Pulse "affordable"** | `Button` de forja/recruta/loja quando `canAfford` | `withRepeat(withSequence(scale 1→1.04→1))`, borda `goldBright`. Para quando indisponível. |
| **Hotspot com novidade** | Vila | pulse lento + glow `glowGold` no `<Seal>`. |
| **Level-up** | herói sobe de nível (estado já emitido) | Lottie `level_up` sobre o `HeroCard` + `successNotification` (haptics já existe). |
| **Forja concluída** | `BlacksmithScreen` ao coletar | Lottie `forge_complete` no card "Pronto para Coletar" (`:227-232`). |
| **Recrutamento** | `GuildScreen`/`ShopScreen` ao recrutar | Lottie `recruit` no card do novo herói. |

> **Por que Reanimated v4 para o novo e manter `Animated` no `CombatantCard`/`MissionResultModal`:**
> a UI thread do Reanimated dá 60fps em count-up/shimmer/transição sem custo de bridge. Migrar os 2
> componentes que já funcionam (combate) não tem retorno e adiciona risco — fica fora (§2.2).

### 3.5 Lottie ampliado (`constants/assets.ts`)

```ts
export const LOTTIE_ASSETS = {
  CHEST_PULSE:    require('../../assets/lottie/chest_pulse.json'),
  CONFETTI:       require('../../assets/lottie/confetti.json'),
  SPARKLE_BURST:  require('../../assets/lottie/sparkle_burst.json'),
  LEVEL_UP:       require('../../assets/lottie/level_up.json'),       // NOVO
  FORGE_COMPLETE: require('../../assets/lottie/forge_complete.json'), // NOVO
  RECRUIT:        require('../../assets/lottie/recruit.json'),        // NOVO
};
```

3 `.json` novos em `assets/lottie/` (Lottie de licença permissiva, p.ex. LottieFiles free, com atribuição
quando exigida). Cada um disparado via `ref.play()` no padrão já estabelecido em
`MissionResultModal.tsx:48-50`.

### 3.6 Estados vazios polidos

- **`EmptyState.tsx`** (MOD): prop `icon: string` (emoji) → prop `icon: IconName` resolvida por `<Icon>`
  grande (size 64) com cor `textMuted`; título em `theme.type.h2`, subtítulo em `theme.type.body`.
  Opcional `lottie?: keyof LOTTIE_ASSETS` para um loop sutil (ex.: `sparkle_burst` em loop lento).
- **`ComingSoon.tsx`** (MOD + reabilitar): emoji → `<Icon>`; badge "EM DESENVOLVIMENTO" usa `theme.type.label`
  + `colors.gold`; reusado nas seções "em breve" de Pantheon/Weekly que hoje têm texto cru.
- Estados vazios "à mão" (`BlacksmithScreen.tsx:238-241`, `MissionsScreen` heroGrid) passam a usar
  `<EmptyState>`.

### 3.7 Navegação inferior (`AppNavigator.tsx`)

```tsx
// tabBarIcon: trocar Ionicons por <Icon> (MaterialCommunityIcons via SPEC 2)
const TAB_ICONS: Record<string, IconName> = {
  Vila: 'castle', Treinamento: 'sword', 'Missões': 'map-marker-path',
  Enfermaria: 'medical-bag', Loja: 'store',
};
// tabBarActiveTintColor: theme.colors.gold (era primary/roxo via alias)
// tabBarInactiveTintColor: theme.colors.textMuted
// tabBarStyle: backgroundColor surfaceRaised, borderTopColor borderGold, + elevation.e2
```

As 6 hidden routes (`:80-128`) **permanecem** (a Vila-mapa é o hub que navega para elas). Só muda a
aparência das 5 tabs visíveis + o hub.

### 3.8 Tratamento do `HeroCard` (apresentação, sem regra)

`HeroCard.tsx` é o componente mais reusado (Guild, seleção de missão, equipar). Migração **só visual**:
emoji de stat (`:156/169/176`) → `<Icon name="stat-atk|stat-mp|stat-def|…">`; `boxShadow` inline (`:250`)
→ `<Card elevation="e1">`; `TASK_LABEL_MAP` (`:34-41`) emoji → `<Icon>` + label. **Os secundários DEF/CRIT/AGI
continuam exibidos como leitura** (`:166-181`), **sem** botão de treino (regra preservada: não-treináveis).
Os botões de treino seguem só HP/ATK/MP (`:86-120`), inalterados em lógica.

### 3.9 Fluxo de dados

Nenhuma mudança de fluxo de dados/estado. Telas continuam lendo `useGame()`/hooks (`useMissions`,
`useGuild`, `useShop`…) e despachando os mesmos actions. Microinterações leem **estado já existente**
(`state.gold` para count-up; `state.dailyQuests`/`achievements` para o pulse de novidade; eventos de
level-up/forja/recruit já emitidos pelos handlers). Zero novo reducer, zero novo campo de save.

### 3.10 Prioridade e esforço por tela

Ordem de ataque (mais visível / mais destrava primeiro) e esforço relativo (P=pequeno ≤0.5d,
M=médio ~1d, G=grande ~2d):

| Ordem | Tela / unidade | Esforço | Por quê primeiro |
|---|---|---|---|
| 1 | `ScreenContainer` + `AnimatedGold` + `Shimmer` + `PressableScale` (infra de tela) | M | Destrava todas as outras; valida o "molde Reino". |
| 2 | **`VillageScreen` → mapa** | **G** | Maior impacto visual + é o hub + usa o asset morto. Item-âncora do spec. |
| 3 | `GuildScreen` + `HeroCard` | M | 2ª tela mais visitada; `HeroCard` é compartilhado (paga-se uma vez). |
| 4 | `MissionsScreen` (+ `MissionResultModal` só tokens/Lottie) | M | Loop central do jogo (gold). |
| 5 | `TrainingScreen` | P | Lista simples, reusa `HeroCard`. |
| 6 | `BlacksmithScreen` | G | 663 LOC, muitos cards + modal + Lottie de forja. |
| 7 | `ShopScreen` | P | 94 LOC, 3 cards + Lottie recruit. |
| 8 | `EnfermariaScreen` | P | Lista simples. |
| 9 | `DailyQuestsScreen` | M | 411 LOC, hex `#1a1a1a`, estados vazios. |
| 10 | `WeeklyScreen` | M | 412 LOC, hex `#1a1a1a`, ComingSoon. |
| 11 | `PantheonScreen` | G | 451 LOC, modal de fusão + Seals de classe. |
| 12 | `AchievementsScreen` | P | Lista de cards. |
| 13 | `AppNavigator` (tab bar) + `EmptyState`/`ComingSoon` | P | Fechamento; depende de `<Icon>`. |
| 14 | Remover `compatAliases`/`fontSize`/`fontWeight` do `theme` | P | Só depois de 1-13 não referenciarem mais alias. |

Esforço total estimado: ~13-16 dias-pessoa. Itens P paralelizáveis em worktrees após o passo 1.

---

## 4. Mudanças por Arquivo

| Arquivo | Ação | O que muda |
|---|---|---|
| `src/components/ui/ScreenContainer.tsx` | **NOVO** | Wrapper de tela (SafeArea+StatusBar+fundo+textura+transição de entrada Reanimated). §3.2 |
| `src/components/AnimatedGold.tsx` | **NOVO** | `GoldDisplay` com count-up + pulso + `<Icon name="coin">`. §3.2 |
| `src/components/ui/Shimmer.tsx` | **NOVO** | Placeholder de loading com gradiente deslizante. §3.2 |
| `src/components/ui/PressableScale.tsx` | **NOVO** | Press-feedback de escala (se SPEC 2 não trouxe). §3.2 |
| `src/screens/VillageScreen.tsx` | **MOD (reescrita)** | Remove a lista de 8 cards (`:53-102`) e o `boxShadow` (`:138`); vira `ImageBackground(VILLAGE_MAP)` + 8 hotspots `<Seal>`+`<Icon>` por coordenada relativa + fallback grid. §3.3 |
| `src/constants/assets.ts` | **MOD** | `LOTTIE_ASSETS` += `LEVEL_UP`/`FORGE_COMPLETE`/`RECRUIT`. §3.5 |
| `assets/lottie/level_up.json`, `forge_complete.json`, `recruit.json` | **NOVO** | 3 animações Lottie. §3.5 |
| `src/components/HeroCard.tsx` | **MOD** | Emoji de stat (`:156/169/176`) → `<Icon>`; `boxShadow` (`:250`) → `<Card>`/`elevation.e1`; `TASK_LABEL_MAP` (`:34-41`) emoji → `<Icon>`; tokens `hp/atk/mp`→`statHp/statAtk/statMp`. Secundários seguem read-only (regra). §3.8 |
| `src/components/CombatantCard.tsx` | **MOD (só emoji)** | Apenas os 3 Texts de stat (`⚔️🔮🛡️`, `:134-136`) → `<Icon>`, para zerar emoji (critério #2). **A animação `Animated` legada NÃO é tocada** (§2.2): nenhum `Animated.Value`/HP-bar/shake/fade muda. Mudança puramente de glifo. |
| `src/components/GoldDisplay.tsx` | **MOD/DEPRECA** | Substituído por `AnimatedGold` nos call sites; mantido como thin wrapper ou removido após migração. |
| `src/screens/GuildScreen.tsx` | **MOD** | `ScreenHeader`→`Banner`; `ScreenContainer`; emoji `⚔️💤` (`:67-70`)→`<Icon>`; Lottie recruit; `EmptyState` polido. |
| `src/screens/MissionsScreen.tsx` | **MOD** | `ScreenHeader`→`Banner`; `ScreenContainer`; `fontWeight:'800'` (`:137`)→`theme.type.h2`; cards→`Card`; heroGrid vazio→`EmptyState`. |
| `src/components/MissionResultModal.tsx` | **MOD** | Hex já migrados em SPEC 2; aqui: header/título em `theme.type`, emoji `🏆💀` (`:149`) → `<Icon>` opcional, mantém Lottie confetti. |
| `src/screens/TrainingScreen.tsx` | **MOD** | `Banner`; `boxShadow` (`:155`)→`Card`; `<Button>`. |
| `src/screens/BlacksmithScreen.tsx` | **MOD** | `Banner`; `TYPE_ICONS` emoji (`:29-33`)→`<Icon>`; tier cards→`Card rarity`; cor via `rarity[def.rarity]` (SPEC 2 §3.5); Lottie forge no "Pronto para Coletar"; modal→`OrnateFrame`; `EmptyState` (`:238-241`). |
| `src/screens/ShopScreen.tsx` | **MOD** | `Banner`; `infoBox` rgba (`:78/85`)→token; emoji `💎🥈🎁` (`:50`)→`<Icon>`; Lottie recruit. |
| `src/screens/EnfermariaScreen.tsx` | **MOD** | `Banner`; `ScreenContainer`; `boxShadow` (`:189`)→`Card`; `<Button>`. |
| `src/screens/DailyQuestsScreen.tsx` | **MOD** | `Banner`; `'#1a1a1a'` (`:293`)→`colors.bgDeep`; cards→`Card`; `ComingSoon`/`EmptyState`. |
| `src/screens/WeeklyScreen.tsx` | **MOD** | `Banner`; `'#1a1a1a'` (`:367`)→`colors.bgDeep`; `fontWeight:'800'`→token; `ComingSoon` na seção em breve. |
| `src/screens/PantheonScreen.tsx` | **MOD** | `Banner`; cards→`Card`/`OrnateFrame`; `<Seal kind=ClassId>` para classes na fusão; modal→`OrnateFrame`. |
| `src/screens/AchievementsScreen.tsx` | **MOD** | `Banner`; cards→`Card`; `<Icon name="trophy">`; conquista bloqueada via `Seal locked`. |
| `src/components/ui/EmptyState.tsx` | **MOD** | `icon: string`→`IconName` (`<Icon>` 64px); tipografia em `theme.type`; prop `lottie?` opcional. §3.6 |
| `src/components/ui/ComingSoon.tsx` | **MOD** | Emoji→`<Icon>`; `fontWeight:'900'` (`:65`)→`theme.type.label`; reabilitado. §3.6 |
| `src/navigation/AppNavigator.tsx` | **MOD** | `Ionicons`→`<Icon>`/MaterialCommunityIcons medieval (`:35-51`); tint ativo `gold`, inativo `textMuted`; `tabBarStyle` `surfaceRaised`+`borderGold`+`elevation`. §3.7 |
| `src/components/ui/LoadingScreen.tsx` | **MOD** | Usa `<Shimmer>` no lugar de spinner/texto cru. |
| `src/components/ui/ScreenHeader.tsx` | **REMOVE (fim)** | Após 11/11 telas usarem `Banner`, deletar (ou redirecionar para `Banner`). |
| `src/theme/index.ts` | **MOD (fim)** | Remove `compatAliases` e `fontSize`/`fontWeight` legados (SPEC 2 §3.6) — só após nenhum call site referenciá-los. |
| `src/components/GuildEmptyState.tsx` | **MOD** | Usa `EmptyState` polido. |

> Os `*.stories.tsx` (ex.: `HeroCard.stories.tsx`) acompanham as mudanças de prop dos componentes que
> editarem, mas seguem fora do lint anti-hex (não embarcam).

---

## 5. Estratégia de Teste

### 5.1 Unit (jest.unit.config.js, `--runInBand`)

- **`VillageScreen.test.tsx`** (NOVO, react-test-renderer): renderiza sem throw; gera **8 hotspots** cujo
  conjunto de `screen` é exatamente `{Treinamento, Enfermaria, Ferreiro, Panteao, Conquistas, MissoesDiarias,
  Semanal, Guilda}` (todos ∈ rotas de `AppNavigator`); tap em cada hotspot chama `nav.navigate(screen)` certo
  (nav mockado); com `onError` da imagem disparado, renderiza o **fallback grid** (sem perder navegação).
- **`AnimatedGold.test.tsx`** (NOVO): dado `gold` inicial, renderiza `formatNumber(gold)`; ao mudar a prop,
  o valor exibido converge para o novo total (avançar timers fake); não quebra com `gold=0`.
- **`Shimmer.test.tsx` / `PressableScale.test.tsx`** (NOVO): smoke — renderizam; `PressableScale`
  encaminha `onPress`.
- **`assets.test.ts`** (NOVO): `LOTTIE_ASSETS` tem as 6 chaves (3 antigas + 3 novas) e cada uma resolve
  (require não-nulo); `IMAGE_ASSETS.VILLAGE_MAP` resolve.
- **`EmptyState.test.tsx` / `ComingSoon.test.tsx`** (MOD): aceitam `icon: IconName` e renderizam `<Icon>`
  (não `<Text>` de emoji); `EmptyState` com `lottie` monta o `LottieView`.
- **`HeroCard.test.tsx`** (MOD): **garante a regra** — não há controle de treino para DEF/CRIT/AGI
  (só HP/ATK/MP em `defaultActions`); secundários aparecem como leitura quando `showSecondaryStats`.
- **`AppNavigator`**: teste leve de que o mapa `TAB_ICONS` cobre as 5 rotas visíveis.

> Convenção: integração>mock vale para **DB/persistência** (não há aqui). `expo-linear-gradient`/Lottie/
> Reanimated são libs de plataforma — mock superficial é aceitável (testa-se a **lógica**: navegação de
> hotspot, convergência do count-up, resolução de assets — não a engine de animação).

### 5.2 Integração / build / lint

- `npx tsc --noEmit`: **delta ≤ 0** (não regride; alvo final do roadmap é 0, mas erros remanescentes são
  de SPEC 1).
- `eslint src`: **0** hex inline em `src/screens`+`src/components` (o lint de SPEC 2 segue verde após o
  redesign; os hex de tela do §1.7 viram token).
- `npm test`: suíte verde, sem novas falhas; coverage não regride.

### 5.3 Validação de UI (emulador/browser — convenção do projeto) — **um screenshot por tela**

Plano explícito (Playwright sobre `expo start --web`, e emulador Android/iOS onde possível). Para **cada
uma das 11 telas**, capturar e checar:

| Tela | Checagens visuais |
|---|---|
| **Vila** | mapa renderiza; 8 selos sobre os edifícios certos; tap navega; pulse no hotspot com novidade; sem flash branco; **fallback grid** ao simular erro de imagem. |
| **Guilda** | `Banner` Cinzel; `HeroCard` com `<Icon>` de stats (não emoji); Lottie recruit ao recrutar; `EmptyState` polido com guilda vazia. |
| **Missões** | count-up do ouro ao concluir missão; cards `Card`; `MissionResultModal` confetti + tipografia nova. |
| **Treino** | `<Button>` Reino; press-scale; sem `boxShadow` cru. |
| **Ferreiro** | tiers com cor de raridade + glow; pulse "affordable" quando dá pra forjar; Lottie forge ao coletar; modal `OrnateFrame`. |
| **Loja** | `<Icon>` nos baús; pulse affordable; Lottie recruit. |
| **Enfermaria** | `Card`; `<Button>`. |
| **Diárias** | sem `#1a1a1a`; `ComingSoon`/`EmptyState` polidos. |
| **Semanal** | idem; `ComingSoon` na seção em breve. |
| **Panteão** | `<Seal>` de classe na fusão; modal `OrnateFrame`. |
| **Conquistas** | conquista bloqueada com `Seal locked` (cinza); `<Icon name="trophy">`. |
| **Tab bar** | ícones medievais; ativo dourado, inativo sépia; `elevation`. |
| **Transições** | trocar de tab mostra fade+rise (Reanimated), não corte seco. |

Screenshots arquivados como evidência por tela antes de declarar a tela pronta (convenção do projeto:
"validação de UI no emulador/browser antes de declarar tela pronta").

---

## 6. Critérios de Aceitação

Binários e mensuráveis:

1. **11/11 telas** usam `<Banner>` (0 ocorrências de `<ScreenHeader>` em `src/screens`; o arquivo é removido
   ou vira alias de `Banner`).
2. **0 emoji como ícone** em `src/screens` + `HeroCard`/`CombatantCard`/`GoldDisplay`/`ShopScreen`
   (grep de codepoints emoji — faixas U+1F000+/U+2600–27BF/U+2694 etc. — nesses arquivos = vazio,
   cobrindo emoji em conteúdo de `<Text>`, em `icon=` props e em `*_ICON`/`*_MAP` literais); todos via `<Icon>`.
3. `village_map.png` tem **≥1 importador** (`IMAGE_ASSETS.VILLAGE_MAP` referenciado por `VillageScreen`); a
   Vila renderiza **8 hotspots** cujo conjunto de rotas é exatamente
   `{Treinamento, Enfermaria, Ferreiro, Panteao, Conquistas, MissoesDiarias, Semanal, Guilda}` (§3.3),
   cada um navegando para a rota correta (teste cobre); fallback grid funciona.
4. `GoldDisplay` substituído por `AnimatedGold` em todo `right` de `Banner` que mostra ouro; o número
   **anima** (count-up) ao mudar (teste de convergência passa).
5. `LOTTIE_ASSETS` tem **6 chaves** (3 novas resolvem); level-up/forja/recrutamento disparam Lottie nos
   pontos definidos (§3.4).
6. `eslint src` → **0** hex inline em `src/screens`+`src/components` (lint de SPEC 2 segue verde).
7. `theme` **não tem mais** `compatAliases` nem `fontSize`/`fontWeight` legados; `grep "theme.colors.hp\b\|theme.colors.background\b\|theme.fontSize"` em `src/` = vazio (tudo migrado para token semântico).
8. `npx tsc --noEmit`: delta de erros ≤ 0 vs. baseline pós-SPEC 2.
9. `npm test`: verde; testes novos (`VillageScreen`, `AnimatedGold`, `assets`, `EmptyState`/`ComingSoon`,
   `HeroCard` regra) passam; coverage não regride.
10. **Regra de jogo intacta**: `HeroCard` não expõe treino de DEF/CRIT/AGI (teste assevera); nenhum novo
    campo de save/reducer; gold só de missão (nenhum gold passivo introduzido por microinteração).
11. Tab bar: 5 ícones medievais (`TAB_ICONS` cobre as rotas visíveis), tint ativo = `gold`, inativo =
    `textMuted`.
12. **Evidência de screenshot** arquivada para as 11 telas + transição de tab (§5.3).

---

## 7. Riscos e Mitigação

| Risco | Sev | Mitigação |
|---|---|---|
| `village_map.png` (29 KB) é baixa resolução / proporção que não casa com os hotspots → mapa pixelado ou selos desalinhados. | 🟠 | Medir a imagem antes (proporção/resolução real); hotspots em coordenadas **relativas** (`x/y` 0..1) calibradas por screenshot; se a arte for fraca, upscale/substituição é tarefa pontual de asset (não bloqueia o resto). Fallback grid garante navegação. |
| Reanimated v4 (UI thread) tem pegadinhas web vs. nativo (worklets, `react-native-web`). | 🟠 | Validar count-up/shimmer/transição **no web e no emulador**; usar APIs cobertas pelo web shim; transição de tela com `entering` é a mais arriscada no web — degradar para fade simples se necessário. |
| Trocar `GoldDisplay`→`AnimatedGold` em muitas telas pode introduzir flicker/valor errado durante a animação. | 🟡 | `AnimatedGold` com API drop-in + teste de convergência (valor final sempre = prop); pulso só no delta positivo; cap de duração 600ms. |
| Migração big-bang dos `compatAliases` quebra telas ainda não migradas. | 🟠 | Remoção dos aliases é o **último** passo (§3.10 item 14), só após grep confirmar 0 referências a alias; cada tela migra o token no seu próprio commit. |
| 451/663/411/412 LOC (Pantheon/Blacksmith/Daily/Weekly) → risco de regressão funcional ao re-skin. | 🟡 | Re-skin **só de apresentação**; nenhum handler/hook tocado; testes existentes dessas telas/fluxos seguem verdes; revisão por tela (`/review`). |
| Lottie novos pesam no bundle / licença incompatível. | 🟡 | Escolher Lotties leves e de licença permissiva (LottieFiles free / CC0); medir tamanho; lazy onde possível. |
| "Hotspot com novidade" tenta inferir estado e vira regra de jogo disfarçada. | 🟡 | Usar **só** flags já existentes (`dailyQuests`/`achievements` prontos) como leitura; é dica visual, não altera economia/balanço. |
| `ScreenHeader` removido enquanto algum componente externo ainda o importa. | 🟡 | Manter `ScreenHeader` como re-export de `Banner` até grep confirmar 0 imports, então deletar. |

---

## 8. Dependências e Sequenciamento

- **Depende de SPEC 2 (Design System "Reino") — bloqueante.** SPEC 3 *consome* `theme.type/elevation/rarity`,
  `<Icon>`, `Banner`, `Button`, `Card`, `OrnateFrame`, `Seal`, `Divider`, `Parchment` e as deps que SPEC 2
  instala (`@expo/vector-icons`, `expo-font`, `expo-linear-gradient`). Sem SPEC 2 não há o que aplicar
  (ROADMAP §2: "SPEC 3 exige SPEC 2 pronto").
- **Depende de SPEC 1 (estabilização) para `tsc` verde de verdade** — mas pode **começar** antes do `tsc`
  zerar (o critério é delta ≤ 0; os erros remanescentes são de SPEC 1, não de tela).
- **Não depende de** SPEC 4 (balance), 5 (onboarding), 6 (refatoração). Mas **destrava**:
  - **SPEC 5 (Onboarding/FTUE):** o tutorial dos primeiros minutos navega pela Vila-mapa e pelos
    componentes Reino — o onboarding se ancora nas telas redesenhadas (a Vila-mapa é o palco natural do
    FTUE).
  - **SPEC 7 (Conteúdo):** novas telas/edifícios entram como novos hotspots no mapa e novos `Card`/`Seal`,
    seguindo o molde já estabelecido aqui.
- **Sequência interna** (§3.10): (1) infra de tela (`ScreenContainer`/`AnimatedGold`/`Shimmer`/`PressableScale`);
  (2) **Vila-mapa** (âncora); (3) Guild+HeroCard; (4) Missions; (5-12) demais telas por prioridade;
  (13) tab bar + estados vazios; (14) remover `compatAliases`/legado do `theme`. Cada passo é um commit
  coerente; itens P paralelizáveis em worktrees após o passo 1 (padrão `.worktrees/` do projeto).
