# Design System "Reino" — Design Spec

> Data: 2026-06-20 · Referência: **SPEC 2** do `docs/superpowers/ROADMAP-2026-H2.md` (Horizonte 1).
> Implementa o **Design Language do "Reino"** definido no ROADMAP §3 (fantasia medieval dark-first:
> couro/pedra escura quente + ouro velho + serif Cinzel). Escopo: **infra de design system** (tokens,
> fontes, ícones, componentes-base, lint, plataforma, migração). **Não** redesenha telas — isso é SPEC 3.
>
> **Estratégia:** expandir `src/theme/index.ts` mantendo retrocompatibilidade total, introduzir fontes/ícones
> vetoriais e componentes-base de identidade, e travar a regressão com um lint que barra hex inline. As telas
> migram uma a uma em SPEC 3, sem big-bang.

---

## 1. Contexto e Problema

O visual é o gargalo de prioridade do dono (ROADMAP §1, problema #5: "Design genérico", severidade 🟠 Alto).
O que existe hoje, fundamentado no código lido:

### 1.1 Tema atual: navy frio, sem hierarquia tipográfica nem elevação

`src/theme/index.ts` (61 LOC) é um objeto `as const` com `colors`, `spacing`, `borderRadius`, `fontSize`,
`fontWeight`. Problemas concretos:

- **Paleta navy fria** que o ROADMAP §3.1.6 manda aposentar: `background '#0F0D23'`, `surface '#1A1735'`,
  `primary '#7C3AED'` (roxo neon), `gold '#F59E0B'` (laranja neon). Nada de couro/pedra quente.
- **Sem token de tipografia composta.** `fontSize` e `fontWeight` são listas separadas; não há `display/h1/h2`
  com `fontFamily`+`lineHeight`+`letterSpacing` juntos. Resultado: cada componente improvisa.
- **Sem token de elevação/sombra.** Inexistente. Sombras são inline (ver §1.4).
- **Sem token de raridade.** Cores de raridade vivem soltas em `src/constants/equipment.ts:8-10`.
- **`fontFamily` ausente** — tudo cai na fonte do sistema (genérico, sem identidade medieval).

### 1.2 Quatro paletas concorrentes (3 vermelhos de HP soltos)

O ROADMAP §3.2 exige unificar. Confirmado no código:

- **HP-bars (vermelho/verde nº1):** `src/components/HPBar.tsx:16-18` → `'#3CB371'` / `'#FFD24D'` / `'#FF7A7A'`.
  Duplicado **verbatim** em `src/components/CombatantCard.tsx:129` (mesma lógica de ratio, mesmos 3 hex).
- **Feedback (vermelho/verde nº2):** `src/components/FeedbackLayer.tsx:126-127` → success `'#2ECC71'`, error `'#E74C3C'`;
  `:164` amarelo `'#ffd34d'`. `MissionResultModal.tsx:60-63` usa `'#ff4d4d'` / `'#2ecc71'` (vermelho/verde nº3).
- **Tiers de equipment:** `src/constants/equipment.ts:8-10` → `'#94A3B8'` / `'#3B82F6'` / `'#A855F7'`
  (comum/raro/épico). `BlacksmithScreen.tsx:44` referencia `def?.color || '#94A3B8'`.
- **Modais de resultado:** `MissionResultModal.tsx:148` header `success ? '#27AE60' : '#C0392B'`.

São pelo menos **três tons de vermelho de "HP/dano"** (`#FF7A7A`, `#E74C3C`, `#ff4d4d`) e
**dois de verde de "sucesso"** (`#2ECC71`/`#2ecc71`, `#27AE60`) — exatamente o "4 paletas concorrentes" do diagnóstico.

### 1.3 Iconografia 100% emoji + `@expo/vector-icons` quebrado

- Emoji como ícone em: `EmptyState.tsx:11` (default `'🏰'`), `ComingSoon.tsx` (prop `icon: string`),
  `GoldDisplay.tsx:14` (`'💰'`), e props `icon?: string` espalhadas.
- `src/navigation/AppNavigator.tsx:16` importa `Ionicons` de `@expo/vector-icons`, **mas o pacote não está no
  `package.json`** (confirmado: nenhuma entrada `@expo/vector-icons`; é o problema #1 do ROADMAP, "vector-icons
  ausente do package.json", contribuindo para os 17 erros de `tsc`). `react-native-svg ^15.12.1` **está** instalado
  (`package.json:40`) e subutilizado.

### 1.4 Sombras e pesos de fonte inline/duplicados

- `boxShadow` inline **idêntico** em `src/screens/VillageScreen.tsx:138` e `src/components/HeroCard.tsx:250`
  (`'0px 2px 4px rgba(0,0,0,0.1)'`) — o ROADMAP §3.4 manda banir.
- **35 ocorrências** de `'800'`/`'900'` literais em `src/components`+`src/screens` (ex.: `ScreenHeader.tsx:40`
  `fontWeight: '800'`, `ComingSoon.tsx:65` `'900'`, `WeeklyScreen.tsx:367` `'800'`) — pesos fora dos tokens.

### 1.5 Plataforma incoerente com o tema dark

`app.json`: `userInterfaceStyle: "light"` (linha 8), `splash.backgroundColor: "#ffffff"` (linha 13),
`android.adaptiveIcon.backgroundColor: "#ffffff"` (linha 22). Flash branco no boot, contra o tema dark
(ROADMAP §3.8). `plugins` só tem `expo-audio`.

### 1.6 Inventário de hex inline (a migrar)

Grep `#rrggbb` (6 dígitos) em `src/screens`+`src/components`, excluindo `node_modules`, `.worktrees` e
`*.stories.tsx`: **22 ocorrências** em **9 arquivos** (`HPBar`, `CombatantCard`, `MissionResultModal`,
`FeedbackLayer`, `MissionHeroSelectionModal`, `ChestCard`, `BlacksmithScreen`, `DailyQuestsScreen`, `WeeklyScreen`).

> **Descoberta — discrepância com o ROADMAP:** o ROADMAP §3 e o enunciado falam em "26 ocorrências". A contagem
> real **hoje** é **22** hex de 6 dígitos fora de stories (ou **30** se incluir `*.stories.tsx` e os `rgb()`/3-dígitos).
> A diferença é metodológica (stories incluídas? `rgba()` conta?). Este spec adota o número auditável: **migrar as
> 22 ocorrências de produção** + neutralizar os `rgba()`/3-dígitos onde forem cor de marca. As `.stories.tsx`
> ficam fora do lint (não embarcam no app).

**Dor concreta:** sem tokens de tipografia/elevação/raridade e com 4 paletas soltas, qualquer redesign (SPEC 3)
seria copy-paste de hex; e o boot ainda pisca branco e crasha por `@expo/vector-icons` ausente.

---

## 2. Objetivos e Não-Objetivos

### 2.1 Objetivos (mensuráveis)

1. `src/theme/index.ts` expandido com **5 grupos de tokens novos**: `type` (8 estilos compostos), `elevation`
   (`e0..e4` + 3 glows), `rarity` (4 raridades), paleta **dark unificada** (§3.2 do ROADMAP) e paleta **claro**
   (pergaminho). Mantém `as const` + `export type Theme`.
2. As **4 paletas concorrentes** (HP-bars, feedback, tiers de equipment, modais) viram tokens; `constants/equipment.ts`
   passa a referenciar `theme.colors.rarity*`.
3. Fontes **Cinzel** (display) + **Inter** (corpo) carregadas via `expo-font`, com **fallback gracioso**
   (sem fonte → sistema, sem crash).
4. Iconografia vetorial: `@expo/vector-icons` instalado e um componente `<Icon>` que resolve nome → MaterialCommunityIcons
   **ou** SVG custom. SVGs custom para os **4 stats** (HP/ATK/MP/DEF) e **6 brasões de classe**.
5. **8 componentes-base de identidade** com API tipada: `OrnateFrame`, `Banner`, `Divider`, `Seal`, `Parchment`,
   `Button`, `Card`, mais o `<Icon>` (totalizando a família). `expo-linear-gradient` instalado e usado.
6. **Lint rule** que barra `#rrggbb` inline em `src/screens` e `src/components` (verde após migrar as 22 ocorrências).
7. `app.json` coerente: `userInterfaceStyle: "dark"`, splash e adaptive-icon em `#15100B`.
8. `tsc --noEmit` **não regride** por causa deste SPEC; `npm test` (jest.unit.config.js) verde.
9. **Migração incremental**: o tema antigo (`background`, `surface`, `primary`, `hp`, `atk`, `mp`, `gold`...)
   continua resolvendo (aliases) durante a transição — nenhuma das 11 telas precisa mudar para o app compilar/bootar.

### 2.2 Não-Objetivos (YAGNI)

- **Não** aplicar o DS às telas (cada tela é SPEC 3). Este SPEC só entrega a infra + componentes + 1 tela-vitrine de teste.
- **Não** criar novas ilustrações/arte além de ícones de stats, brasões de classe e cantos de moldura.
- **Não** ampliar Lottie (level-up/forja/recrutamento) — fica para SPEC 3 (ROADMAP §3.7).
- **Não** transformar a Vila em mapa interativo (`village_map.png`) — SPEC 3.
- **Não** entregar a fonte opcional **Alegreya** (flavor text) — só Cinzel+Inter. Token reservado, asset não embarcado.
- **Não** implementar troca de tema em runtime persistida nas settings — o switch claro/escuro é entregue como
  **mecanismo** (provider + hook), mas a UI de configuração e persistência são de outro SPEC.
- **Não** mexer em regras de jogo. DEF/CRIT/AGI seguem não-treináveis; gold só de missão. Este SPEC é puramente visual.

---

## 3. Design Detalhado

### 3.1 Estrutura de arquivos (novos e modificados)

```
src/theme/
  index.ts            (MOD) re-export do tema completo + aliases de compat + export type Theme
  tokens/
    colors.ts         (NOVO) paleta dark + claro (§3.2 do ROADMAP), 'as const'
    typography.ts     (NOVO) 8 estilos compostos (display..stat), 'as const'
    elevation.ts      (NOVO) e0..e4 + glowGold/Epic/Legendary
    spacing.ts        (NOVO) spacing + borderRadius (medieval: sm4/md8/lg12/xl16)
    rarity.ts         (NOVO) mapa rarity -> { color, glow, label }
  fonts.ts            (NOVO) mapa de require() das fontes + useReinoFonts()
  ThemeProvider.tsx   (NOVO) provider dark/claro + useTheme()
src/components/ui/
  Icon.tsx            (NOVO) <Icon name=... /> (MaterialCommunityIcons | SVG custom)
  icons/
    StatIcons.tsx     (NOVO) HpIcon/AtkIcon/MpIcon/DefIcon (react-native-svg)
    ClassSeals.tsx    (NOVO) 6 brasões SVG (Warrior/Tank/Rogue/Archer/Mage/Healer)
    FrameCorner.tsx   (NOVO) canto decorativo SVG p/ OrnateFrame
  OrnateFrame.tsx     (NOVO)
  Banner.tsx          (NOVO)
  Divider.tsx         (NOVO)
  Seal.tsx            (NOVO)
  Parchment.tsx       (NOVO)
  Button.tsx          (NOVO)
  Card.tsx            (NOVO)
assets/fonts/
  Cinzel-SemiBold.ttf Cinzel-Bold.ttf Cinzel-Black.ttf                     (NOVO) Regular não embarca (não mapeado)
  Inter-Regular.ttf Inter-Medium.ttf Inter-SemiBold.ttf Inter-Bold.ttf     (NOVO)
.eslintrc.cjs         (NOVO) regra no-restricted-syntax barrando hex inline
```

> **Decisão:** o tema vira uma pasta `tokens/` mas `src/theme/index.ts` continua sendo o **único ponto de import**
> (`import { theme } from '../theme'` — usado por todos os componentes lidos). Internamente compõe os tokens.
> Zero call site precisa mudar o caminho de import.

### 3.2 Tokens de cor (`tokens/colors.ts`)

Cópia fiel do ROADMAP §3.2. Estrutura: dois objetos (`darkColors`, `lightColors`) com as **mesmas chaves**,
para o provider trocar sem quebrar consumidores.

```ts
export const darkColors = {
  // Superfícies (couro/pedra/madeira escura, quente)
  bgDeep: '#15100B', bgBase: '#1E1710', surface: '#2A2018', surfaceRaised: '#362A1F',
  // Marca (ouro velho)
  gold: '#C9A227', goldBright: '#E8C45A', goldDark: '#8A6D1B',
  // Acento quente
  ember: '#B5471F', blood: '#7E2A1E',
  // Stats (UNIFICADOS)
  statHp: '#C0392B', statAtk: '#C8772E', statMp: '#3E6E8E', statDef: '#6B7280',
  // Raridade (1ª classe)
  rarityCommon: '#9CA3AF', rarityRare: '#3E7CB1', rarityEpic: '#8E5BC4', rarityLegendary: '#E8C45A',
  // Texto
  textPrimary: '#F3E9D2', textSecondary: '#C4B499', textMuted: '#8A7B63',
  // Bordas / molduras
  border: '#4A3826', borderGold: '#8A6D1B',
  // Feedback (musgo medieval)
  success: '#6B8E23', successBright: '#9ACD32', danger: '#B5471F', warning: '#E8C45A',
  // HP-bar por faixa (substitui os 3 hex soltos)
  hpHigh: '#6B8E23', hpMid: '#E8C45A', hpLow: '#B5471F',
} as const;

export const lightColors = {
  ...darkColors,
  bgDeep: '#D8C9A4', bgBase: '#E8DCC0', surface: '#F2E9CF', surfaceRaised: '#FBF4E2',
  textPrimary: '#2A2018', textSecondary: '#5A4A33', textMuted: '#8A7B63',
  border: '#C9B68C',
} as const; // ouro/raridade/stats herdados (§3.2 do ROADMAP)
```

> `danger = ember` e `warning = goldBright` resolvidos para o hex literal (não pode referenciar outra chave no
> mesmo objeto `as const` sem getter). `hpHigh/Mid/Low` são **novos** e substituem `#3CB371/#FFD24D/#FF7A7A`
> com a paleta quente (verde-musgo / ouro / brasa), em vez do verde-menta/amarelo/rosa atual.

### 3.3 Tokens de tipografia (`tokens/typography.ts`)

Cada estilo é um objeto pronto para spread em `StyleSheet` (`fontFamily`+`fontSize`+`lineHeight`+`letterSpacing`+`fontWeight`
juntos), valores do ROADMAP §3.3. As `fontFamily` referenciam os nomes registrados em `fonts.ts`.

```ts
export const typography = {
  display: { fontFamily: 'Cinzel_900Black',  fontSize: 32, lineHeight: 40, letterSpacing: 0.5, fontWeight: '900' },
  h1:      { fontFamily: 'Cinzel_700Bold',   fontSize: 24, lineHeight: 30, letterSpacing: 0.3, fontWeight: '700' },
  h2:      { fontFamily: 'Cinzel_600SemiBold',fontSize: 18, lineHeight: 24, letterSpacing: 0.2, fontWeight: '600' },
  bodyLg:  { fontFamily: 'Inter_400Regular',  fontSize: 16, lineHeight: 24, letterSpacing: 0,   fontWeight: '400' },
  body:    { fontFamily: 'Inter_400Regular',  fontSize: 14, lineHeight: 20, letterSpacing: 0,   fontWeight: '400' },
  label:   { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16, letterSpacing: 0.4, fontWeight: '600' },
  caption: { fontFamily: 'Inter_500Medium',   fontSize: 11, lineHeight: 14, letterSpacing: 0.2, fontWeight: '500' },
  stat:    { fontFamily: 'Inter_700Bold',     fontSize: 14, lineHeight: 18, letterSpacing: 0,   fontWeight: '700',
             fontVariant: ['tabular-nums'] as const },
} as const;
```

> `stat` ganha `fontVariant: ['tabular-nums']` (alinhamento de números — ROADMAP §3.3 "tabular"). `fontSize`/`lineHeight`
> do `stat` foram fixados (o ROADMAP deixou "—/—"): 14/18 casa com `body`, valor justificável neste spec (§3 do ROADMAP
> autoriza refinar com justificativa). Estes 8 estilos eliminam os 35 `'800'`/`'900'` soltos: quem precisa de peso
> usa um token (`display`/`h1`), não um literal.

### 3.4 Tokens de elevação (`tokens/elevation.ts`)

RN usa `shadowColor/Offset/Opacity/Radius` (iOS) + `elevation` (Android). Cada token entrega ambos.

```ts
export const elevation = {
  e0: {},
  e1: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.18, shadowRadius: 2, elevation: 2 },
  e2: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },
  e3: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8 },
  e4: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 16 },
  glowGold:      { shadowColor: '#E8C45A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 6 },
  glowEpic:      { shadowColor: '#8E5BC4', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 6 },
  glowLegendary: { shadowColor: '#E8C45A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 12, elevation: 8 },
} as const;
```

Substitui os `boxShadow` inline de `VillageScreen.tsx:138` e `HeroCard.tsx:250` (esses migram em SPEC 3 para `elevation.e1`).

### 3.5 Tokens de raridade (`tokens/rarity.ts`)

Raridade de 1ª classe (ROADMAP §3.2). `constants/equipment.ts` deixa de carregar hex e passa a mapear tier → raridade.

```ts
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const rarity: Record<Rarity, { color: string; glow: keyof typeof elevation; label: string }> = {
  common:    { color: darkColors.rarityCommon,    glow: 'e0',           label: 'Comum' },
  rare:      { color: darkColors.rarityRare,      glow: 'e1',           label: 'Raro' },
  epic:      { color: darkColors.rarityEpic,      glow: 'glowEpic',     label: 'Épico' },
  legendary: { color: darkColors.rarityLegendary, glow: 'glowLegendary',label: 'Lendário' },
};
```

`EQUIPMENT_TIERS` em `constants/equipment.ts:7-11` perde a chave `color` literal e ganha `rarity: Rarity`
(`tier1→common`, `tier2→rare`, `tier3→epic`). `BlacksmithScreen.tsx:44` resolve cor via `rarity[def.rarity].color`.

### 3.6 Composição final (`src/theme/index.ts`) + aliases de compat

Ponto crítico da migração: o tema antigo e o novo coexistem. `theme` ganha as chaves novas **e** mantém as antigas
como aliases para o app não quebrar antes do SPEC 3.

```ts
import { darkColors, lightColors } from './tokens/colors';
import { typography } from './tokens/typography';
import { elevation } from './tokens/elevation';
import { spacing, borderRadius } from './tokens/spacing';
import { rarity } from './tokens/rarity';

const compatAliases = {
  // chaves do tema legado -> equivalente "Reino" (some em SPEC 3)
  primary: darkColors.gold, primaryLight: darkColors.goldBright, primaryDark: darkColors.goldDark,
  background: darkColors.bgBase, surface: darkColors.surface, surfaceLight: darkColors.surfaceRaised,
  hp: darkColors.statHp, atk: darkColors.statAtk, mp: darkColors.statMp,
} as const;

export const theme = {
  colors: { ...darkColors, ...compatAliases },
  type: typography,
  elevation,
  rarity,
  spacing,
  borderRadius,
  // legado mantido (StatBar/EmptyState ainda usam theme.fontSize/fontWeight)
  fontSize: { xs: 10, sm: 12, md: 14, lg: 18, xl: 24, xxl: 32 },
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
} as const;

export type Theme = typeof theme;
```

> **Por que aliases e não rename direto:** os componentes lidos (`ScreenHeader`, `EmptyState`, `LoadingScreen`,
> `ComingSoon`, `StatBar`, `HPBar`, `GoldDisplay`) e as 11 telas referenciam `theme.colors.background`,
> `theme.colors.primary`, `theme.colors.hp/atk/mp`, `theme.fontSize`, `theme.fontWeight`. Renomear de uma vez
> quebraria os 11 arquivos. Os aliases dão o **visual novo imediatamente** (background vira couro escuro) sem
> editar nenhuma tela; SPEC 3 troca cada consumidor para o token semântico e remove `compatAliases` + `fontSize`/`fontWeight` no fim.

### 3.7 Fontes (`fonts.ts` + `expo-font`)

```ts
import { useFonts } from 'expo-font';
export function useReinoFonts(): { fontsLoaded: boolean } {
  const [fontsLoaded] = useFonts({
    Cinzel_600SemiBold: require('../../assets/fonts/Cinzel-SemiBold.ttf'),
    Cinzel_700Bold:     require('../../assets/fonts/Cinzel-Bold.ttf'),
    Cinzel_900Black:    require('../../assets/fonts/Cinzel-Black.ttf'),
    Inter_400Regular:   require('../../assets/fonts/Inter-Regular.ttf'),
    Inter_500Medium:    require('../../assets/fonts/Inter-Medium.ttf'),
    Inter_600SemiBold:  require('../../assets/fonts/Inter-SemiBold.ttf'),
    Inter_700Bold:      require('../../assets/fonts/Inter-Bold.ttf'),
  });
  return { fontsLoaded };
}
```

**Fallback gracioso (ROADMAP §3.3):** `App.tsx` chama `useReinoFonts()` e renderiza assim que o **resto** do estado
estiver pronto, **sem bloquear o boot na fonte**. Se `fontsLoaded === false`, os estilos com `fontFamily` ainda
renderizam — RN ignora `fontFamily` desconhecida e cai na fonte do sistema (degrade gracioso, sem crash). O
`LoadingScreen` (já existente) cobre o intervalo. Nada de tela branca eterna esperando `.ttf`.

> **Por que `.ttf` local e não `@expo-google-fonts/cinzel`:** evita uma dependência por família e mantém os pesos
> exatos. Os `.ttf` (Cinzel/Inter, OFL — Open Font License) entram em `assets/fonts/`. Cinzel embarca só os 3 pesos
> usados (SemiBold/Bold/Black); o corpo é sempre Inter, então `Cinzel-Regular` não embarca (evita peso morto no bundle).
> Licença OFL permite embarcar.

### 3.8 Iconografia: `<Icon>` + SVGs custom

`@expo/vector-icons` é instalado (resolve o erro de `tsc` do ROADMAP #1 e o import já existente em `AppNavigator.tsx:16`).
`<Icon>` unifica a fonte de ícones do app:

```ts
type IconName =
  // semânticos do jogo -> MaterialCommunityIcons
  | 'sword' | 'shield' | 'castle' | 'anvil' | 'potion' | 'coin' | 'scroll' | 'trophy'
  // stats e classes -> SVG custom
  | 'stat-hp' | 'stat-atk' | 'stat-mp' | 'stat-def'
  | 'class-warrior' | 'class-tank' | 'class-rogue' | 'class-archer' | 'class-mage' | 'class-healer';

interface IconProps { name: IconName; size?: number; color?: string; }
```

- Nomes `sword/shield/castle/anvil/potion/...` mapeiam para `MaterialCommunityIcons` (`sword`, `shield`, `castle`,
  `anvil`, `bottle-tonic`, `circle-multiple` p/ coin, `script-text`, `trophy`).
- `stat-*` e `class-*` resolvem para os SVGs custom (`StatIcons.tsx`, `ClassSeals.tsx`), `react-native-svg ^15.12.1` (instalado).
- **6 brasões de classe** correspondem 1:1 às classes reais em `constants/classes.ts:17-71`
  (`WARRIOR`/`TANK`/`ROGUE`/`ARCHER`/`MAGE`/`HEALER`). `<Seal>` consome um `class-*` via `<Icon>`.

`<Icon>` substitui os emoji de `EmptyState`/`ComingSoon`/`GoldDisplay` em SPEC 3 (este SPEC só entrega o componente
e os SVGs; a troca emoji→Icon nas telas é SPEC 3).

### 3.9 Componentes-base de identidade (API completa)

`expo-linear-gradient` instalado para gradientes (ROADMAP §3.7). Todos consomem `theme` e o provider.

| Componente | Props | Faz | Depende de |
|---|---|---|---|
| **`OrnateFrame`** | `{ children; corner?: 'gold'\|'wood'; radius?: keyof borderRadius; padding?: keyof spacing; elevation?: keyof elevation }` | `View` com borda dourada/madeira + 4 cantos SVG (`FrameCorner`) sobrepostos. Moldura medieval (§3.5). | `react-native-svg`, `elevation`, `colors.borderGold/border` |
| **`Banner`** | `{ title: string; subtitle?: string; right?: ReactNode }` | Faixa de título de tela com `LinearGradient` (couro→ouro sutil) + `type.h1`. Substitui o `ScreenHeader` cru (§3.5). API compatível com `ScreenHeader` p/ swap fácil em SPEC 3. | `expo-linear-gradient`, `type.h1/h2` |
| **`Divider`** | `{ variant?: 'plain'\|'ornament'; color?: string }` | Linha divisória; `ornament` adiciona losango/flourish SVG central. | `react-native-svg`, `colors.borderGold` |
| **`Seal`** | `{ kind: ClassId \| 'achievement'; size?: number; locked?: boolean }` | Brasão circular (selo) p/ classe/conquista. `locked` aplica cinza+opacidade. | `<Icon>` (`class-*`), `colors.gold`, `elevation.glowGold` |
| **`Parchment`** | `{ children; tone?: 'leather'\|'parchment'; elevation?: keyof elevation }` | Superfície com overlay de textura (couro/pergaminho) em baixa opacidade (§3.7). | `expo-linear-gradient`/`ImageBackground`, `colors.surface` |
| **`Button`** | `{ label: string; onPress; variant?: 'gold'\|'wood'\|'danger'\|'ghost'; icon?: IconName; size?: 'sm'\|'md'\|'lg'; disabled?; loading? }` | Botão com gradiente por `variant`, `type.label`, ícone opcional, estados disabled/loading. | `expo-linear-gradient`, `<Icon>`, `type.label`, `elevation.e1` |
| **`Card`** | `{ children; rarity?: Rarity; elevation?: keyof elevation; onPress?; padding? }` | Superfície de card; `rarity` aplica borda colorida + glow correspondente (`rarity[r].glow`). | `colors`, `elevation`, `rarity` |
| **`<Icon>`** | (§3.8) | Ponte ícone vetorial. | `@expo/vector-icons`, SVGs custom |

> `Banner` espelha a interface de `ScreenHeader` (`title`/`subtitle`/`right`), então a migração em SPEC 3 é
> "trocar `<ScreenHeader>` por `<Banner>`". O `showGold`/`GoldDisplay` é tratado via `right` (composição, não prop fixa).

### 3.10 Provider de tema (`ThemeProvider.tsx`)

Entrega o **mecanismo** dark/claro (a UI de settings é outro SPEC — §2.2). Default `dark`.

```ts
type Mode = 'dark' | 'light';
// Tipo de cor unificado: 'as const' fixaria os literais de dark e rejeitaria lightColors (mesmas chaves, hex
// diferentes). Record<keyof typeof darkColors, string> aceita ambas as paletas sem regredir o tsc.
type ColorScheme = Record<keyof typeof darkColors, string>;
const ThemeContext = createContext<{ mode: Mode; colors: ColorScheme; setMode: (m: Mode) => void }>(...);
export function ThemeProvider({ children, initialMode = 'dark' }: ...) { ... } // troca darkColors/lightColors
export function useTheme() { return useContext(ThemeContext); }
```

Componentes-base novos consomem `useTheme().colors` (reagem ao switch). Os componentes legados seguem importando
`theme` estático (sempre dark) até migrarem em SPEC 3 — compatível, sem flicker.

### 3.11 Lint: barrar hex inline (`.eslintrc.cjs`)

Regra `no-restricted-syntax` mirando literais hex em JSX/StyleSheet, escopada a `src/screens` + `src/components`,
ignorando `*.stories.tsx` e a pasta `src/theme/tokens/` (onde os hex são legítimos).

```js
{
  files: ['src/screens/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
  ignores: ['**/*.stories.tsx'],
  rules: {
    'no-restricted-syntax': ['error', {
      selector: "Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/]",
      message: 'Cor hex inline proibida. Use um token de src/theme (ROADMAP §3.1).',
    }],
  },
}
```

> Não há ESLint configurado hoje (confirmado: sem `.eslintrc*`/`eslint.config.*`, sem script `lint` no `package.json`).
> Este SPEC adiciona `eslint` + config flat mínima + script `"lint": "eslint src"`. O lint roda **após** migrar as 22
> ocorrências (senão falha de cara). A migração dos hex acontece junto: cada um vira `theme.colors.*` (HP-bar →
> `hpHigh/Mid/Low`, feedback → `success/danger/warning`, modais → idem, tiers → `rarity`).

### 3.12 `app.json` (ROADMAP §3.8)

`userInterfaceStyle: "dark"`, `splash.backgroundColor: "#15100B"`, `android.adaptiveIcon.backgroundColor: "#15100B"`.
`plugins` ganha `expo-font` (para `assets/fonts/` no build EAS). `web.favicon` inalterado.

---

## 4. Mudanças por Arquivo

| Arquivo | Ação | O que muda |
|---|---|---|
| `src/theme/index.ts` | **MOD** | Reescreve as 61 LOC: compõe tokens de `tokens/*`, adiciona `type/elevation/rarity`, paleta dark unificada, `compatAliases` (§3.6). Mantém `as const` + `export type Theme`. |
| `src/theme/tokens/colors.ts` | **NOVO** | `darkColors`+`lightColors` (§3.2 do ROADMAP). |
| `src/theme/tokens/typography.ts` | **NOVO** | 8 estilos compostos (§3.3). |
| `src/theme/tokens/elevation.ts` | **NOVO** | `e0..e4` + 3 glows (§3.4). |
| `src/theme/tokens/spacing.ts` | **NOVO** | `spacing` (xs4..xl32) + `borderRadius` medieval (sm4/md8/lg12/xl16 — muda os atuais sm6/md12/lg16/xl24). |
| `src/theme/tokens/rarity.ts` | **NOVO** | `Rarity` + mapa cor/glow/label. |
| `src/theme/fonts.ts` | **NOVO** | `useReinoFonts()` (§3.7). |
| `src/theme/ThemeProvider.tsx` | **NOVO** | provider dark/claro + `useTheme()` (§3.10). |
| `src/components/ui/Icon.tsx` | **NOVO** | `<Icon>` (§3.8). |
| `src/components/ui/icons/StatIcons.tsx` | **NOVO** | 4 SVGs de stat. |
| `src/components/ui/icons/ClassSeals.tsx` | **NOVO** | 6 brasões SVG (1:1 com `classes.ts:17-71`). |
| `src/components/ui/icons/FrameCorner.tsx` | **NOVO** | canto SVG. |
| `src/components/ui/OrnateFrame.tsx` | **NOVO** | §3.9. |
| `src/components/ui/Banner.tsx` | **NOVO** | §3.9 (compatível c/ `ScreenHeader`). |
| `src/components/ui/Divider.tsx` | **NOVO** | §3.9. |
| `src/components/ui/Seal.tsx` | **NOVO** | §3.9. |
| `src/components/ui/Parchment.tsx` | **NOVO** | §3.9. |
| `src/components/ui/Button.tsx` | **NOVO** | §3.9. |
| `src/components/ui/Card.tsx` | **NOVO** | §3.9. |
| `src/constants/equipment.ts` | **MOD** | `EQUIPMENT_TIERS:8-10` perde `color` literal, ganha `rarity: Rarity`. |
| `src/components/HPBar.tsx` | **MOD** | `:16-18` `'#3CB371'/'#FFD24D'/'#FF7A7A'` → `theme.colors.hpHigh/hpMid/hpLow`. `:50` `surfaceLight` ok (alias). |
| `src/components/CombatantCard.tsx` | **MOD** | `:129` mesma troca de HP; `:247/:263` `'#ff4d4d'` → `theme.colors.danger`. |
| `src/components/MissionResultModal.tsx` | **MOD** | `:60-63/:148/:233/:419/:446` hex → `danger`/`success`. |
| `src/components/FeedbackLayer.tsx` | **MOD** | `:126-127/:164` hex → `successBright`/`danger`/`warning`. |
| `src/components/MissionHeroSelectionModal.tsx` | **MOD** | `:285/:469/:475` `'#6495ed'`/`'#ff4d4d'` → tokens (`statMp`/`danger`); `rgba` → cor de token c/ opacidade. |
| `src/components/ChestCard.tsx` | **MOD** | `:96` `'#ff4d4d'` → `danger`. |
| `src/screens/BlacksmithScreen.tsx` | **MOD** | `:44` `def?.color || '#94A3B8'` → `rarity[def.rarity].color`. |
| `src/screens/DailyQuestsScreen.tsx` | **MOD** | `:293` `'#1a1a1a'` → token (texto-sobre-ouro, `bgDeep`). |
| `src/screens/WeeklyScreen.tsx` | **MOD** | `:367` `'#1a1a1a'` → `bgDeep`. |
| `app.json` | **MOD** | `:8` `dark`; `:13/:22` `#15100B`; `plugins` += `expo-font`. |
| `.eslintrc.cjs` | **NOVO** | regra anti-hex (§3.11). |
| `package.json` | **MOD** | deps: `@expo/vector-icons`, `expo-font`, `expo-linear-gradient`; devDep `eslint` + plugins; script `lint`. |
| `assets/fonts/*.ttf` | **NOVO** | Cinzel (SemiBold/Bold/Black) + Inter (Regular/Medium/SemiBold/Bold). |
| `App.tsx` | **MOD** | envolve árvore no `<ThemeProvider>`; chama `useReinoFonts()` com fallback gracioso. |

> A migração de hex de `*.stories.tsx` (HeroCard.stories.tsx:27-30) **não** é exigida (fora do lint, não embarca).
> `GoldDisplay.tsx` migra o emoji `💰`→`<Icon name="coin">` em SPEC 3, não aqui.

---

## 5. Estratégia de Teste

### 5.1 Unit (jest.unit.config.js, `--runInBand`)

- **`theme.test.ts`** (NOVO): (a) toda chave do tema legado (`background`,`surface`,`primary`,`hp`,`atk`,`mp`,
  `gold`,`textPrimary`,`border`) ainda existe e resolve para string (garante compat — nenhuma tela quebra);
  (b) `theme.colors.bgDeep === '#15100B'` e demais valores-âncora do ROADMAP §3.2 conferem;
  (c) `theme.type.display.fontSize === 32 && lineHeight === 40 && letterSpacing === 0.5`; idem h1/h2/body (§3.3);
  (d) `darkColors` e `lightColors` têm **o mesmo conjunto de chaves** (`expect(Object.keys(light)).toEqual(Object.keys(dark))`)
  — invariante do provider.
- **`rarity.test.ts`** (NOVO): cada `Rarity` mapeia para cor não-vazia e um `glow` que é chave de `elevation`.
- **`equipment.test.ts`** (MOD/NOVO): `EQUIPMENT_TIERS` não contém mais hex literal; cada tier tem `rarity` válida;
  tier1→common, tier2→rare, tier3→epic.
- **`Icon.test.tsx`** (NOVO, react-test-renderer): `<Icon name="sword">` renderiza sem throw; `name="stat-hp"`
  renderiza o SVG custom (não o vector-icon); nome inválido (via cast) não derruba a árvore.
- **Componentes-base** (smoke tests dos 7 visuais: `OrnateFrame`/`Banner`/`Divider`/`Seal`/`Parchment`/`Button`/`Card`):
  cada um renderiza com props mínimas sem throw; além disso, asserções específicas: `Card rarity="legendary"` aplica o
  glow legendary; `Seal kind="WARRIOR"` resolve o brasão certo; `Banner title="X"` expõe o texto; `Divider variant="ornament"`
  renderiza o SVG central; `Parchment` renderiza os `children`. (react-test-renderer, sem snapshot frágil — asserção em
  props/estrutura.) O 8º componente, `<Icon>`, é coberto por `Icon.test.tsx` acima.
- **`fonts.test.ts`** (NOVO): `useReinoFonts` é testado com `expo-font` mockado retornando `[false]` →
  o componente que o consome ainda renderiza (prova do fallback gracioso, sem crash).

> Convenção do projeto: **integração > mock** vale para **DB/persistência** (usar AsyncStorage real). Aqui não há DB;
> `expo-font`/`@expo/vector-icons` são libs de plataforma — mock superficial é aceitável (testa-se a **lógica de
> fallback/resolução**, não a lib).

### 5.2 Integração / build

- `npx tsc --noEmit`: **não regride** (alvo: resolver pelo menos o erro de `@expo/vector-icons` ausente; os outros
  16 são de SPEC 1). Medir antes/depois.
- `eslint src`: **0 erros** de hex inline em `src/screens`+`src/components` (após migrar as 22 ocorrências).
- `npm test`: suíte verde, sem novas falhas.

### 5.3 Validação de UI (emulador/browser — convenção do projeto)

Como este SPEC **não** redesenha telas, a validação visual é numa **tela-vitrine de teste descartável**
(`DesignSystemScreen`, não embarcada na navegação de produção / atrás de flag de dev) que renderiza:
Banner, Button (4 variants), Card (4 raridades com glow), OrnateFrame, Seal (6 classes), Divider, Parchment,
os 4 stat-icons e a HP-bar nas 3 faixas. Validar via Playwright (`expo start --web`) + screenshot:
fonte Cinzel nos títulos, ouro velho (não neon), fundo couro (não navy), glows de raridade, cantos da moldura.
Boot sem flash branco (checar `app.json`). Sem fonte carregada → texto ainda legível (sistema).

---

## 6. Critérios de Aceitação

Binários e mensuráveis:

1. `npx tsc --noEmit` não adiciona erros novos; o erro "`@expo/vector-icons` ausente" **deixa de existir**.
2. `eslint src` → **0** ocorrências de `#rrggbb` inline em `src/screens` e `src/components` (as 22 migradas; `.stories.tsx` isentas).
3. `npm test` (jest.unit.config.js) verde; `theme.test.ts`, `rarity.test.ts`, `Icon.test.tsx` passam, e os smoke tests dos 7 componentes visuais (`OrnateFrame`/`Banner`/`Divider`/`Seal`/`Parchment`/`Button`/`Card`) passam — `<Icon>` é coberto por `Icon.test.tsx` à parte (8 componentes no total, 7 com smoke).
4. `theme` exporta `colors`/`type`/`elevation`/`rarity`/`spacing`/`borderRadius`, **mantém** `as const` e `export type Theme`,
   e **todas** as chaves legadas (`background`,`surface`,`primary`,`hp`,`atk`,`mp`,`gold`,`fontSize`,`fontWeight`...) ainda resolvem.
5. `theme.colors.bgBase === '#1E1710'`, `gold === '#C9A227'`, `rarityLegendary === '#E8C45A'`, `statHp === '#C0392B'` (âncoras §3.2).
6. `theme.type` tem os 8 estilos com `fontFamily`+`fontSize`+`lineHeight`+`letterSpacing`+`fontWeight` (display 32/40/+0.5 etc.).
7. `Object.keys(lightColors)` === `Object.keys(darkColors)` (paridade dark/claro).
8. `EQUIPMENT_TIERS` sem hex literal; cada tier com `rarity` válida.
9. `app.json`: `userInterfaceStyle === "dark"`, `splash.backgroundColor === "#15100B"`, `adaptiveIcon.backgroundColor === "#15100B"`, `plugins` inclui `expo-font`.
10. `package.json` declara `@expo/vector-icons`, `expo-font`, `expo-linear-gradient` e `eslint` (+ script `lint`).
11. 8 componentes-base (`OrnateFrame`,`Banner`,`Divider`,`Seal`,`Parchment`,`Button`,`Card`,`Icon`) existem em `src/components/ui/` com a API tipada de §3.9.
12. Fonte ausente não crasha (`useReinoFonts` → `[false]` ⇒ app renderiza com fonte do sistema).
13. Boot sem flash branco validado em screenshot (emulador/web).
14. **Nenhuma das 11 telas precisou ser editada para o app compilar e bootar** (prova da migração incremental) — só os 9 arquivos com hex e os de wiring (App/app.json).

---

## 7. Riscos e Mitigação

| Risco | Sev | Mitigação |
|---|---|---|
| Trocar `theme.colors.background`/`primary` muda o look de **todas** as 11 telas de uma vez (via aliases) e pode revelar contraste ruim. | 🟠 | Aliases mapeiam para tokens do ROADMAP §3.2 já pensados para dark; validar a tela-vitrine + 2-3 telas reais no browser antes de fechar. Ajuste fino de contraste é de SPEC 3. |
| `borderRadius` medieval (sm6→4, md12→8...) altera o arredondado de tudo que usa `theme.borderRadius`. | 🟡 | Mudança intencional (ROADMAP §3.5). É só visual; nenhum teste de lógica depende disso. |
| `expo-font`/`expo-linear-gradient`/`@expo/vector-icons` precisam de versão compatível com o SDK Expo do projeto. | 🟠 | Instalar via `npx expo install` (resolve a versão certa do SDK), não `npm i` cru. Validar boot em Expo Go/dev build. |
| `tsc` ainda vermelho por erros de SPEC 1 (offline/hp/Audio) confunde o critério "não regride". | 🟡 | Medir contagem de erros antes/depois; critério é **delta ≤ 0** + sumiço específico do erro de vector-icons, não "0 absoluto" (isso é SPEC 1). |
| Lint flat-config conflitar com toolchain Expo/Babel existente. | 🟡 | Config flat **isolada** só com a regra anti-hex + parser TS; não habilitar regras de estilo que gerem ruído. Rodar `eslint src` no CI como check separado. |
| Fonte `.ttf` não embarca no build EAS (só funciona no Expo Go). | 🟠 | Declarar `expo-font` em `app.json.plugins` (faz o config plugin copiar as fontes no prebuild). |
| Sombra/`elevation` renderiza diferente iOS vs Android (shadow* vs elevation). | 🟡 | Tokens entregam ambos os campos; validar nas duas plataformas na vitrine. |

---

## 8. Dependências e Sequenciamento

- **Pode correr em paralelo com SPEC 1** (worktrees distintos — ROADMAP §2/§5): SPEC 1 conserta lógica
  (offline/persistência/suite), SPEC 2 conserta visual. **Único acoplamento:** o erro de `tsc` por
  `@expo/vector-icons` ausente — SPEC 2 resolve ao instalar o pacote; coordenar para não haver conflito de
  `package.json`/lockfile (merge cuidadoso ou SPEC 2 dona dessa dep).
- **Destrava SPEC 3** (Redesign de Telas): SPEC 3 troca `ScreenHeader`→`Banner`, emoji→`<Icon>`, hex→token tela a
  tela, e remove `compatAliases`/`fontSize`/`fontWeight` legados do `theme` no fim. Sem SPEC 2, SPEC 3 não tem o que aplicar.
- **Não depende de** SPEC 4/5/6.
- **Sequência interna sugerida:** (1) tokens + `theme/index.ts` com aliases + `theme.test.ts`; (2) instalar deps +
  `app.json`; (3) fontes + `useReinoFonts`; (4) `<Icon>` + SVGs; (5) componentes-base + vitrine; (6) migrar os 22
  hex; (7) ligar o lint. Cada passo é um commit coerente (convenção do projeto).
