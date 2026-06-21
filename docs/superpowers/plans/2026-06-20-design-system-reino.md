# Design System "Reino" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a infraestrutura do Design System "Reino" (tokens de cor/tipografia/elevação/raridade, fontes Cinzel+Inter, iconografia vetorial, 8 componentes-base e lint anti-hex) sem redesenhar telas, mantendo retrocompatibilidade total via aliases para que nenhuma das 11 telas precise mudar para o app compilar e bootar.

**Architecture:** `src/theme/index.ts` deixa de ser um objeto monolítico e passa a compor tokens de uma nova pasta `src/theme/tokens/` (`colors`, `typography`, `elevation`, `spacing`, `rarity`), expondo o mesmo `export const theme` + `export type Theme` com chaves novas **e** aliases das chaves legadas (`background`, `surface`, `primary`, `hp`, `atk`, `mp`, `gold`, `fontSize`, `fontWeight`). Fontes carregam via `expo-font` (`useReinoFonts`) com fallback gracioso. Um `<Icon>` unifica `@expo/vector-icons` (MaterialCommunityIcons) e SVGs custom (`react-native-svg`). Os 8 componentes-base ficam em `src/components/ui/`. Um lint flat-config (`eslint.config.js`) barra `#rrggbb` inline em `src/screens`/`src/components` após migrar os hex de marca para tokens. Um `ThemeProvider` entrega o mecanismo dark/claro (sem UI de settings). Uma tela-vitrine de dev (`DesignSystemScreen`, fora da navegação de produção) serve à validação visual.

**Tech Stack:** TypeScript, React Native (Expo SDK ~54), Jest (`ts-jest`, `jest.unit.config.js`), `@testing-library/react-native`, `react-native-svg`, `expo-font`, `expo-linear-gradient`, `@expo/vector-icons`, ESLint flat-config, Playwright (validação web).

## Global Constraints
- Idioma de todo o conteúdo (docs, mensagens de commit, comentários): pt-BR. Identificadores de código em inglês.
- `npx tsc --noEmit`: **não regride**. Hoje há **17 erros** (baseline medida). Este SPEC deve **reduzir** a contagem para **≤ 14**: somem 3 erros — `@expo/vector-icons` ausente (`AppNavigator.tsx:16`), `Property 'warning' does not exist` (`MissionHeroSelectionModal.tsx:420`) e `Property 'accent' does not exist` (`MissionHeroSelectionModal.tsx:472`), todos resolvidos por adicionar os tokens/dep. Critério = delta de erros ≤ 0 **e** sumiço desses 3.
- `npm test` (`jest --config jest.unit.config.js`): suíte verde, sem novas falhas. Hoje passa.
- Plataforma-alvo: mobile nativo (iOS/Android via Expo). Tokens de elevação entregam `shadow*` (iOS) **e** `elevation` (Android).
- **Sem gold passivo**; **DEF/CRIT/AGI não-treináveis** (só equipamento/passiva/fusão). Este SPEC é puramente visual: **não toca em regras de jogo** — nenhuma alteração em `src/context/`, `src/utils/` de combate, ou `src/constants/missions.ts`.
- Migração incremental: o tema legado resolve via aliases; **nenhuma das 11 telas é editada** para o app compilar/bootar — só os arquivos com hex de marca e os de wiring (`App.tsx`, `app.json`).
- `as const` + `export type Theme` preservados em `src/theme/index.ts`.
- Sem over-engineering, sem comentário óbvio, sem error-handling preventivo em caminho interno confiável.
- Commits pequenos por unidade coerente; mensagem foca no *porquê*.

### Convenções confirmadas no codebase (ler antes de começar)
- Componentes de UI compartilhados ficam em `src/components/ui/` (já existem `ScreenHeader`, `EmptyState`, `ComingSoon`, `LoadingScreen`). Import do tema a partir de `ui/`: `import { theme } from '../../theme'`.
- Testes ficam em `src/__tests__/<categoria>/`. Não há ainda `src/__tests__/theme/` nem `src/__tests__/components/` — este plano os cria.
- Jest usa `preset: 'ts-jest'`, `testEnvironment: 'node'`, com `react-native` **mockado** via `jest-react-native-mock.js` (não há `Image`/`ImageBackground`/`Pressable` no mock — este plano adiciona). `testMatch` exige sufixo `.test.[jt]s?(x)` dentro de `src/__tests__/`.
- Render de componente nos testes: `@testing-library/react-native` (`render`/`renderHook`).
- `App.tsx` envolve a árvore em `<GameProvider>` (de `src/context/GameContext`), **não** há `LoadingScreen` na raiz hoje.
- `tsconfig.json` estende `expo/tsconfig.base` com `strict: true`.
- Stories (`src/components/HeroCard.stories.tsx`) ficam **fora** do lint e não embarcam.

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/theme/tokens/colors.ts` | Create | `darkColors` + `lightColors` (mesmas chaves) |
| `src/theme/tokens/typography.ts` | Create | 8 estilos compostos (`display..stat`) |
| `src/theme/tokens/elevation.ts` | Create | `e0..e4` + `glowGold/Epic/Legendary` |
| `src/theme/tokens/spacing.ts` | Create | `spacing` + `borderRadius` medieval |
| `src/theme/tokens/rarity.ts` | Create | `Rarity` + mapa cor/glow/label |
| `src/theme/index.ts` | Modify | Compõe tokens + `compatAliases` + legado |
| `src/theme/fonts.ts` | Create | `useReinoFonts()` (expo-font) |
| `src/theme/ThemeProvider.tsx` | Create | provider dark/claro + `useTheme()` |
| `src/components/ui/icons/StatIcons.tsx` | Create | 4 SVGs de stat |
| `src/components/ui/icons/ClassSeals.tsx` | Create | 6 brasões SVG |
| `src/components/ui/icons/FrameCorner.tsx` | Create | canto SVG |
| `src/components/ui/Icon.tsx` | Create | `<Icon>` (vector-icons \| SVG custom) |
| `src/components/ui/OrnateFrame.tsx` | Create | moldura ornamental |
| `src/components/ui/Banner.tsx` | Create | faixa de título (compat ScreenHeader) |
| `src/components/ui/Divider.tsx` | Create | divisória plain/ornament |
| `src/components/ui/Seal.tsx` | Create | selo/brasão circular |
| `src/components/ui/Parchment.tsx` | Create | superfície com textura |
| `src/components/ui/Button.tsx` | Create | botão com variantes |
| `src/components/ui/Card.tsx` | Create | card com raridade/glow |
| `src/components/ui/DesignSystemScreen.tsx` | Create | tela-vitrine de dev (não embarcada) |
| `src/constants/equipment.ts` | Modify | tiers ganham `rarity`, perdem `color` |
| `src/components/HPBar.tsx` | Modify | hex de faixa → `hpHigh/hpMid/hpLow` |
| `src/components/CombatantCard.tsx` | Modify | hex de HP/dano → tokens |
| `src/components/MissionResultModal.tsx` | Modify | hex de sucesso/dano → tokens |
| `src/components/FeedbackLayer.tsx` | Modify | hex de feedback → tokens |
| `src/components/MissionHeroSelectionModal.tsx` | Modify | hex de marca → tokens |
| `src/components/ChestCard.tsx` | Modify | `#ff4d4d` → `danger` |
| `src/screens/BlacksmithScreen.tsx` | Modify | `def.color` → `rarity[def.rarity].color` |
| `src/screens/DailyQuestsScreen.tsx` | Modify | `#1a1a1a` → `bgDeep` |
| `src/screens/WeeklyScreen.tsx` | Modify | `#1a1a1a` → `bgDeep` |
| `app.json` | Modify | tema dark + splash/adaptive `#15100B` + plugin `expo-font` |
| `package.json` | Modify | deps novas + script `lint` |
| `App.tsx` | Modify | `<ThemeProvider>` + `useReinoFonts` |
| `jest-react-native-mock.js` | Modify | adiciona `Image`/`ImageBackground`/`Pressable` |
| `jest.unit.config.js` | Modify | `moduleNameMapper` p/ libs de plataforma |
| `eslint.config.js` | Create | regra anti-hex |
| `assets/fonts/*.ttf` | Create | Cinzel (3) + Inter (4) |
| `src/__tests__/theme/theme.test.ts` | Create | invariantes do tema |
| `src/__tests__/theme/rarity.test.ts` | Create | invariantes de raridade |
| `src/__tests__/theme/fonts.test.tsx` | Create | fallback gracioso de fonte |
| `src/__tests__/constants/equipment.test.ts` | Create | tiers sem hex |
| `src/__tests__/components/Icon.test.tsx` | Create | resolução de ícone |
| `src/__tests__/components/baseComponents.test.tsx` | Create | smoke dos 7 visuais |

> **Nota sobre a contagem de hex (§1.6 do spec):** a auditoria do spec diz "22 ocorrências de produção". O grep atual encontra ~37 literais hex, mas a maioria é **cor neutra** (`#fff`, `#000`) ou **rgba()** que o spec **não** exige migrar nesta fase (são neutros, não cor de marca). Este plano migra os **hex de marca** listados explicitamente nas Tasks 11–13 e configura o lint para barrar `#rrggbb`; os `#fff`/`#000`/`#1a1a1a` neutros remanescentes que dispararem o lint são migrados para tokens neutros na Task 14 (varredura final) até `eslint src` zerar.

---

## Task 1: Tokens de cor (`colors.ts`)

**Files:**
- Create: `src/theme/tokens/colors.ts`

**Interfaces:**
- Produces: `export const darkColors` e `export const lightColors`, ambos `as const`, com **conjunto idêntico de chaves**. Chaves: `bgDeep, bgBase, surface, surfaceRaised, gold, goldBright, goldDark, ember, blood, statHp, statAtk, statMp, statDef, rarityCommon, rarityRare, rarityEpic, rarityLegendary, textPrimary, textSecondary, textMuted, border, borderGold, success, successBright, danger, warning, hpHigh, hpMid, hpLow`.

- [ ] **Step 1: Escrever o teste falhando** — Criar `src/__tests__/theme/colors.test.ts`:

```ts
import { darkColors, lightColors } from '../../theme/tokens/colors';

describe('tokens de cor', () => {
  test('darkColors tem as cores-âncora do ROADMAP §3.2', () => {
    expect(darkColors.bgDeep).toBe('#15100B');
    expect(darkColors.bgBase).toBe('#1E1710');
    expect(darkColors.surface).toBe('#2A2018');
    expect(darkColors.gold).toBe('#C9A227');
    expect(darkColors.statHp).toBe('#C0392B');
    expect(darkColors.rarityLegendary).toBe('#E8C45A');
    expect(darkColors.danger).toBe('#B5471F'); // = ember
    expect(darkColors.warning).toBe('#E8C45A'); // = goldBright
  });

  test('lightColors (pergaminho) sobrescreve superfícies e texto', () => {
    expect(lightColors.bgBase).toBe('#E8DCC0');
    expect(lightColors.surface).toBe('#F2E9CF');
    expect(lightColors.textPrimary).toBe('#2A2018');
    // ouro/raridade/stats herdados do dark
    expect(lightColors.gold).toBe(darkColors.gold);
    expect(lightColors.rarityLegendary).toBe(darkColors.rarityLegendary);
  });

  test('darkColors e lightColors têm o mesmo conjunto de chaves (invariante do provider)', () => {
    expect(Object.keys(lightColors).sort()).toEqual(Object.keys(darkColors).sort());
  });

  test('hpHigh/hpMid/hpLow substituem os 3 hex soltos de HP', () => {
    expect(darkColors.hpHigh).toBe('#6B8E23');
    expect(darkColors.hpMid).toBe('#E8C45A');
    expect(darkColors.hpLow).toBe('#B5471F');
  });
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

Run: `npm test -- --testPathPattern=colors.test`
Expected: FAIL — `Cannot find module '../../theme/tokens/colors'`.

- [ ] **Step 3: Implementação mínima** — Criar `src/theme/tokens/colors.ts`:

```ts
export const darkColors = {
  // Superfícies (couro/pedra/madeira escura, quente)
  bgDeep: '#15100B',
  bgBase: '#1E1710',
  surface: '#2A2018',
  surfaceRaised: '#362A1F',
  // Marca (ouro velho)
  gold: '#C9A227',
  goldBright: '#E8C45A',
  goldDark: '#8A6D1B',
  // Acento quente
  ember: '#B5471F',
  blood: '#7E2A1E',
  // Stats (unificados)
  statHp: '#C0392B',
  statAtk: '#C8772E',
  statMp: '#3E6E8E',
  statDef: '#6B7280',
  // Raridade (1ª classe)
  rarityCommon: '#9CA3AF',
  rarityRare: '#3E7CB1',
  rarityEpic: '#8E5BC4',
  rarityLegendary: '#E8C45A',
  // Texto
  textPrimary: '#F3E9D2',
  textSecondary: '#C4B499',
  textMuted: '#8A7B63',
  // Bordas / molduras
  border: '#4A3826',
  borderGold: '#8A6D1B',
  // Feedback (musgo medieval)
  success: '#6B8E23',
  successBright: '#9ACD32',
  danger: '#B5471F', // = ember
  warning: '#E8C45A', // = goldBright
  // HP-bar por faixa (substitui #3CB371/#FFD24D/#FF7A7A)
  hpHigh: '#6B8E23',
  hpMid: '#E8C45A',
  hpLow: '#B5471F',
} as const;

export const lightColors = {
  ...darkColors,
  bgDeep: '#D8C9A4',
  bgBase: '#E8DCC0',
  surface: '#F2E9CF',
  surfaceRaised: '#FBF4E2',
  textPrimary: '#2A2018',
  textSecondary: '#5A4A33',
  textMuted: '#8A7B63',
  border: '#C9B68C',
} as const;
```

- [ ] **Step 4: Rodar o teste para verificar que passa**

Run: `npm test -- --testPathPattern=colors.test`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/theme/tokens/colors.ts src/__tests__/theme/colors.test.ts
git commit -m "feat(theme): tokens de cor dark/claro do Reino (paleta unificada §3.2)"
```

---

## Task 2: Tokens de tipografia, elevação, spacing e raridade

**Files:**
- Create: `src/theme/tokens/typography.ts`
- Create: `src/theme/tokens/elevation.ts`
- Create: `src/theme/tokens/spacing.ts`
- Create: `src/theme/tokens/rarity.ts`
- Create: `src/__tests__/theme/rarity.test.ts`

**Interfaces:**
- Consumes: `darkColors` (Task 1) — `rarity.ts` referencia `darkColors.rarity*` e `elevation` (chaves de glow).
- Produces:
  - `export const typography` (`as const`) com 8 chaves: `display, h1, h2, bodyLg, body, label, caption, stat`.
  - `export const elevation` (`as const`) com `e0, e1, e2, e3, e4, glowGold, glowEpic, glowLegendary`.
  - `export const spacing` (`as const`) e `export const borderRadius` (`as const`).
  - `export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'` e `export const rarity: Record<Rarity, { color: string; glow: keyof typeof elevation; label: string }>`.

- [ ] **Step 1: Escrever o teste falhando** — Criar `src/__tests__/theme/rarity.test.ts`:

```ts
import { rarity, Rarity } from '../../theme/tokens/rarity';
import { elevation } from '../../theme/tokens/elevation';
import { darkColors } from '../../theme/tokens/colors';

describe('tokens de raridade', () => {
  const all: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

  test('cada raridade tem cor não-vazia e label pt-BR', () => {
    for (const r of all) {
      expect(rarity[r].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(rarity[r].label.length).toBeGreaterThan(0);
    }
    expect(rarity.common.label).toBe('Comum');
    expect(rarity.legendary.label).toBe('Lendário');
  });

  test('cada glow é uma chave válida de elevation', () => {
    for (const r of all) {
      expect(elevation).toHaveProperty(rarity[r].glow);
    }
  });

  test('cores derivam dos tokens de raridade da paleta', () => {
    expect(rarity.common.color).toBe(darkColors.rarityCommon);
    expect(rarity.legendary.color).toBe(darkColors.rarityLegendary);
  });
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

Run: `npm test -- --testPathPattern=rarity.test`
Expected: FAIL — `Cannot find module '../../theme/tokens/rarity'`.

- [ ] **Step 3: Implementação mínima** — Criar os 4 arquivos:

`src/theme/tokens/typography.ts`:

```ts
export const typography = {
  display: { fontFamily: 'Cinzel_900Black', fontSize: 32, lineHeight: 40, letterSpacing: 0.5, fontWeight: '900' },
  h1: { fontFamily: 'Cinzel_700Bold', fontSize: 24, lineHeight: 30, letterSpacing: 0.3, fontWeight: '700' },
  h2: { fontFamily: 'Cinzel_600SemiBold', fontSize: 18, lineHeight: 24, letterSpacing: 0.2, fontWeight: '600' },
  bodyLg: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24, letterSpacing: 0, fontWeight: '400' },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, letterSpacing: 0, fontWeight: '400' },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16, letterSpacing: 0.4, fontWeight: '600' },
  caption: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 14, letterSpacing: 0.2, fontWeight: '500' },
  stat: {
    fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 18, letterSpacing: 0, fontWeight: '700',
    fontVariant: ['tabular-nums'] as const,
  },
} as const;
```

`src/theme/tokens/elevation.ts`:

```ts
export const elevation = {
  e0: {},
  e1: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.18, shadowRadius: 2, elevation: 2 },
  e2: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },
  e3: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8 },
  e4: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 16 },
  glowGold: { shadowColor: '#E8C45A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 6 },
  glowEpic: { shadowColor: '#8E5BC4', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 6 },
  glowLegendary: { shadowColor: '#E8C45A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 12, elevation: 8 },
} as const;
```

`src/theme/tokens/spacing.ts`:

```ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

// Medieval: cantos menos arredondados (ROADMAP §3.5)
export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
} as const;
```

`src/theme/tokens/rarity.ts`:

```ts
import { darkColors } from './colors';
import { elevation } from './elevation';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const rarity: Record<Rarity, { color: string; glow: keyof typeof elevation; label: string }> = {
  common: { color: darkColors.rarityCommon, glow: 'e0', label: 'Comum' },
  rare: { color: darkColors.rarityRare, glow: 'e1', label: 'Raro' },
  epic: { color: darkColors.rarityEpic, glow: 'glowEpic', label: 'Épico' },
  legendary: { color: darkColors.rarityLegendary, glow: 'glowLegendary', label: 'Lendário' },
};
```

- [ ] **Step 4: Rodar o teste para verificar que passa**

Run: `npm test -- --testPathPattern=rarity.test`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/theme/tokens/typography.ts src/theme/tokens/elevation.ts src/theme/tokens/spacing.ts src/theme/tokens/rarity.ts src/__tests__/theme/rarity.test.ts
git commit -m "feat(theme): tokens de tipografia, elevação, spacing medieval e raridade (§3.3-3.5)"
```

---

## Task 3: Compor `theme/index.ts` com aliases de compat

**Files:**
- Modify: `src/theme/index.ts` (reescreve as 61 LOC atuais)
- Create: `src/__tests__/theme/theme.test.ts`

**Interfaces:**
- Consumes: `darkColors`, `typography`, `elevation`, `spacing`, `borderRadius`, `rarity` (Tasks 1–2).
- Produces: `export const theme` (`as const`) com chaves `colors` (darkColors + aliases), `type`, `elevation`, `rarity`, `spacing`, `borderRadius`, `fontSize`, `fontWeight`; e `export type Theme = typeof theme`. **Aliases legados** dentro de `colors`: `primary, primaryLight, primaryDark, background, surfaceLight, hp, atk, mp` (mais os já existentes em `darkColors`: `surface`, `gold`, `goldDark`, `success`, `danger`, `textPrimary/Secondary/Muted`, `border`).

> **Atenção:** `darkColors` já tem `surface`, `gold`, `goldDark`, `success`, `danger`, `textPrimary/Secondary/Muted`, `border`. Os aliases só precisam suprir as chaves legadas **ausentes** em `darkColors`: `primary`, `primaryLight`, `primaryDark`, `background`, `surfaceLight`, `hp`, `atk`, `mp`.

- [ ] **Step 1: Escrever o teste falhando** — Criar `src/__tests__/theme/theme.test.ts`:

```ts
import { theme } from '../../theme';

describe('theme composto', () => {
  test('mantém as chaves legadas resolvendo para string (compat — nenhuma tela quebra)', () => {
    const legacy = [
      'background', 'surface', 'surfaceLight', 'primary', 'primaryLight', 'primaryDark',
      'hp', 'atk', 'mp', 'gold', 'goldDark', 'success', 'danger',
      'textPrimary', 'textSecondary', 'textMuted', 'border',
    ] as const;
    for (const k of legacy) {
      expect(typeof (theme.colors as Record<string, string>)[k]).toBe('string');
      expect((theme.colors as Record<string, string>)[k]).toMatch(/^#/);
    }
  });

  test('aliases legados apontam para os tokens do Reino', () => {
    expect(theme.colors.background).toBe('#1E1710'); // bgBase
    expect(theme.colors.surface).toBe('#2A2018');
    expect(theme.colors.primary).toBe('#C9A227'); // gold
    expect(theme.colors.hp).toBe('#C0392B'); // statHp
    expect(theme.colors.atk).toBe('#C8772E'); // statAtk
    expect(theme.colors.mp).toBe('#3E6E8E'); // statMp
  });

  test('expõe os novos grupos de tokens', () => {
    expect(theme.colors.bgBase).toBe('#1E1710');
    expect(theme.colors.gold).toBe('#C9A227');
    expect(theme.colors.rarityLegendary).toBe('#E8C45A');
    expect(theme.colors.statHp).toBe('#C0392B');
    expect(theme.rarity.legendary.glow).toBe('glowLegendary');
    expect(theme.elevation.e1.elevation).toBe(2);
  });

  test('theme.type tem os 8 estilos compostos com âncoras do §3.3', () => {
    const keys = ['display', 'h1', 'h2', 'bodyLg', 'body', 'label', 'caption', 'stat'] as const;
    for (const k of keys) {
      expect(theme.type[k]).toHaveProperty('fontFamily');
      expect(theme.type[k]).toHaveProperty('fontSize');
      expect(theme.type[k]).toHaveProperty('lineHeight');
      expect(theme.type[k]).toHaveProperty('letterSpacing');
      expect(theme.type[k]).toHaveProperty('fontWeight');
    }
    expect(theme.type.display.fontSize).toBe(32);
    expect(theme.type.display.lineHeight).toBe(40);
    expect(theme.type.display.letterSpacing).toBe(0.5);
    expect(theme.type.h1.fontSize).toBe(24);
    expect(theme.type.body.fontSize).toBe(14);
  });

  test('mantém fontSize/fontWeight legados e borderRadius medieval', () => {
    expect(theme.fontSize.md).toBe(14);
    expect(theme.fontWeight.bold).toBe('700');
    expect(theme.borderRadius.sm).toBe(4); // medieval (era 6)
  });
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

Run: `npm test -- --testPathPattern=theme.test`
Expected: FAIL — `theme.colors.bgBase` é `undefined` / `theme.type` é `undefined` (índice ainda é o objeto antigo).

- [ ] **Step 3: Implementação mínima** — Substituir o conteúdo completo de `src/theme/index.ts`:

```ts
import { darkColors } from './tokens/colors';
import { typography } from './tokens/typography';
import { elevation } from './tokens/elevation';
import { spacing, borderRadius } from './tokens/spacing';
import { rarity } from './tokens/rarity';

// Chaves do tema legado que ainda não existem em darkColors -> equivalente "Reino".
// Removidas em SPEC 3, quando cada consumidor migrar para o token semântico.
const compatAliases = {
  primary: darkColors.gold,
  primaryLight: darkColors.goldBright,
  primaryDark: darkColors.goldDark,
  background: darkColors.bgBase,
  surfaceLight: darkColors.surfaceRaised,
  hp: darkColors.statHp,
  atk: darkColors.statAtk,
  mp: darkColors.statMp,
} as const;

/** Tema centralizado — altere os tokens em src/theme/tokens para mudar o visual do jogo */
export const theme = {
  colors: { ...darkColors, ...compatAliases },
  type: typography,
  elevation,
  rarity,
  spacing,
  borderRadius,
  // Legado: StatBar/EmptyState ainda leem theme.fontSize/fontWeight (migram em SPEC 3)
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export type Theme = typeof theme;
```

- [ ] **Step 4: Rodar o teste e o type-check**

Run: `npm test -- --testPathPattern=theme.test`
Expected: PASS (5 testes).

Run: `npx tsc --noEmit 2>&1 | grep -cE "error TS"`
Expected: **≤ 16** (o erro `MissionHeroSelectionModal.tsx:420 Property 'warning' does not exist` desaparece porque `theme.colors.warning` agora existe). Comparar com a baseline de 17.

- [ ] **Step 5: Commit**

```bash
git add src/theme/index.ts src/__tests__/theme/theme.test.ts
git commit -m "feat(theme): compor tokens no theme central com aliases de compat (migração incremental, §3.6)"
```

---

## Task 4: Dependências de plataforma + `app.json`

**Files:**
- Modify: `package.json`
- Modify: `app.json`

**Interfaces:**
- Produces: deps `@expo/vector-icons`, `expo-font`, `expo-linear-gradient` em `dependencies`; `eslint`, `typescript-eslint` (ou `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`) em `devDependencies`; script `"lint": "eslint src"`. `app.json` com tema dark.

> **Por que `npx expo install`:** resolve a versão compatível com o SDK ~54 (instalar com `npm i` cru pode trazer versão incompatível — risco do §7 do spec).

- [ ] **Step 1: Instalar as deps de runtime via expo install**

Run:
```bash
npx expo install @expo/vector-icons expo-font expo-linear-gradient
```
Expected: `package.json` ganha as 3 entradas; sem erro de peer-deps.

- [ ] **Step 2: Verificar que o erro de tsc some** — confirmar que `@expo/vector-icons` resolve:

Run: `npx tsc --noEmit 2>&1 | grep "vector-icons" || echo "vector-icons OK"`
Expected: `vector-icons OK` (o erro `AppNavigator.tsx(16,26): Cannot find module '@expo/vector-icons'` desaparece).

- [ ] **Step 3: Instalar ESLint (devDep)**

Run:
```bash
npm install --save-dev eslint typescript-eslint
```
Expected: `eslint` e `typescript-eslint` em `devDependencies`.

- [ ] **Step 4: Adicionar script `lint`** — em `package.json`, no bloco `scripts`, após a linha `"test:e2e": "playwright test",` adicionar:

```json
    "lint": "eslint src",
```

- [ ] **Step 5: Atualizar `app.json`** — aplicar 4 mudanças:

Linha 8: `"userInterfaceStyle": "light",` → `"userInterfaceStyle": "dark",`
Linha 13: `"backgroundColor": "#ffffff"` (dentro de `splash`) → `"backgroundColor": "#15100B"`
Linha 21: `"backgroundColor": "#ffffff"` (dentro de `android.adaptiveIcon`) → `"backgroundColor": "#15100B"`
Bloco `plugins` (linhas 29–31): adicionar `"expo-font"`:

```json
    "plugins": [
      "expo-audio",
      "expo-font"
    ]
```

- [ ] **Step 6: Validar JSON e type-check**

Run: `node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('app.json OK')"`
Expected: `app.json OK`.

Run: `npx tsc --noEmit 2>&1 | grep -cE "error TS"`
Expected: **≤ 15** (vector-icons + warning resolvidos vs. baseline 17; o `accent` cai na Task 13).

- [ ] **Step 7: Commit (separar por contexto)**

```bash
git add package.json package-lock.json
git commit -m "build(deps): @expo/vector-icons, expo-font, expo-linear-gradient, eslint + script lint"
git add app.json
git commit -m "chore(app): tema dark, splash/adaptive #15100B e plugin expo-font (§3.8)"
```

---

## Task 5: Fontes Cinzel+Inter (`fonts.ts`) com fallback gracioso

**Files:**
- Create: `assets/fonts/Cinzel-SemiBold.ttf`, `Cinzel-Bold.ttf`, `Cinzel-Black.ttf`, `Inter-Regular.ttf`, `Inter-Medium.ttf`, `Inter-SemiBold.ttf`, `Inter-Bold.ttf`
- Create: `src/theme/fonts.ts`
- Modify: `jest.unit.config.js` (mock de `expo-font`)
- Create: `src/__tests__/theme/fonts.test.tsx`

**Interfaces:**
- Produces: `export function useReinoFonts(): { fontsLoaded: boolean }`.
- Consumes: nomes de família referenciados em `typography` (Task 2): `Cinzel_600SemiBold`, `Cinzel_700Bold`, `Cinzel_900Black`, `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`.

- [ ] **Step 1: Baixar os `.ttf` (OFL)** — obter os 7 arquivos das famílias Cinzel e Inter (Open Font License):

Run:
```bash
mkdir -p assets/fonts
# Cinzel (Google Fonts, OFL) — SemiBold/Bold/Black
curl -fsSL -o assets/fonts/Cinzel-SemiBold.ttf "https://github.com/google/fonts/raw/main/ofl/cinzel/static/Cinzel-SemiBold.ttf"
curl -fsSL -o assets/fonts/Cinzel-Bold.ttf "https://github.com/google/fonts/raw/main/ofl/cinzel/static/Cinzel-Bold.ttf"
curl -fsSL -o assets/fonts/Cinzel-Black.ttf "https://github.com/google/fonts/raw/main/ofl/cinzel/static/Cinzel-Black.ttf"
# Inter (Google Fonts, OFL) — Regular/Medium/SemiBold/Bold
curl -fsSL -o assets/fonts/Inter-Regular.ttf "https://github.com/google/fonts/raw/main/ofl/inter/static/Inter-Regular.ttf"
curl -fsSL -o assets/fonts/Inter-Medium.ttf "https://github.com/google/fonts/raw/main/ofl/inter/static/Inter-Medium.ttf"
curl -fsSL -o assets/fonts/Inter-SemiBold.ttf "https://github.com/google/fonts/raw/main/ofl/inter/static/Inter-SemiBold.ttf"
curl -fsSL -o assets/fonts/Inter-Bold.ttf "https://github.com/google/fonts/raw/main/ofl/inter/static/Inter-Bold.ttf"
ls -la assets/fonts/
```
Expected: 7 arquivos `.ttf` não-vazios.
> Se a URL `static/` falhar (estrutura do repo varia por família), usar a raiz `ofl/<familia>/` ou baixar de fonts.google.com manualmente. O que importa: 7 `.ttf` válidos com esses nomes exatos.

- [ ] **Step 2: Escrever o teste falhando** — Criar `src/__tests__/theme/fonts.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useReinoFonts } from '../../theme/fonts';

// expo-font mockado via moduleNameMapper para retornar [false] (fonte não carregada)
function Probe() {
  const { fontsLoaded } = useReinoFonts();
  return <Text>{fontsLoaded ? 'loaded' : 'fallback'}</Text>;
}

describe('useReinoFonts (fallback gracioso)', () => {
  test('com fonte não carregada, o componente ainda renderiza (sem crash)', () => {
    const { getByText } = render(<Probe />);
    expect(getByText('fallback')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Rodar o teste para verificar que falha**

Run: `npm test -- --testPathPattern=fonts.test`
Expected: FAIL — `Cannot find module '../../theme/fonts'` (e/ou `expo-font` não mockado, erro de import).

- [ ] **Step 4: Mockar `expo-font` no Jest** — em `jest.unit.config.js`, dentro de `moduleNameMapper`, adicionar (após a linha de `react-native-gesture-handler`):

```js
    '^expo-font$': '<rootDir>/jest-mocks/expo-font-mock.js',
```

Criar `jest-mocks/expo-font-mock.js`:

```js
// Mock superficial: fonte nunca carrega -> prova o caminho de fallback gracioso.
module.exports = {
  useFonts: () => [false, null],
  loadAsync: () => Promise.resolve(),
};
```

- [ ] **Step 5: Implementação mínima** — Criar `src/theme/fonts.ts`:

```ts
import { useFonts } from 'expo-font';

/**
 * Carrega Cinzel (títulos) + Inter (corpo). Não bloqueia o boot:
 * com fontsLoaded=false, RN ignora fontFamily desconhecida e usa a fonte do sistema.
 */
export function useReinoFonts(): { fontsLoaded: boolean } {
  const [fontsLoaded] = useFonts({
    Cinzel_600SemiBold: require('../../assets/fonts/Cinzel-SemiBold.ttf'),
    Cinzel_700Bold: require('../../assets/fonts/Cinzel-Bold.ttf'),
    Cinzel_900Black: require('../../assets/fonts/Cinzel-Black.ttf'),
    Inter_400Regular: require('../../assets/fonts/Inter-Regular.ttf'),
    Inter_500Medium: require('../../assets/fonts/Inter-Medium.ttf'),
    Inter_600SemiBold: require('../../assets/fonts/Inter-SemiBold.ttf'),
    Inter_700Bold: require('../../assets/fonts/Inter-Bold.ttf'),
  });
  return { fontsLoaded };
}
```

> O `require('*.ttf')` precisa ser entendido pelo Jest. O preset `ts-jest` não transforma assets — adicionar ao `moduleNameMapper` em `jest.unit.config.js`: `'\\.(ttf|png|jpg)$': '<rootDir>/jest-mocks/file-mock.js'` e criar `jest-mocks/file-mock.js` com `module.exports = 'test-file-stub';`. (Fazer junto do Step 4.)

- [ ] **Step 6: Rodar o teste para verificar que passa**

Run: `npm test -- --testPathPattern=fonts.test`
Expected: PASS (1 teste — renderiza `fallback`).

Run: `npx tsc --noEmit 2>&1 | grep -cE "error TS"`
Expected: ≤ baseline da Task 4.

- [ ] **Step 7: Commit**

```bash
git add assets/fonts/ src/theme/fonts.ts src/__tests__/theme/fonts.test.tsx jest.unit.config.js jest-mocks/expo-font-mock.js jest-mocks/file-mock.js
git commit -m "feat(theme): fontes Cinzel+Inter via expo-font com fallback gracioso (§3.7)"
```

---

## Task 6: SVGs custom (StatIcons, ClassSeals, FrameCorner)

**Files:**
- Create: `src/components/ui/icons/StatIcons.tsx`
- Create: `src/components/ui/icons/ClassSeals.tsx`
- Create: `src/components/ui/icons/FrameCorner.tsx`
- Modify: `jest.unit.config.js` (mock de `react-native-svg`)
- Modify: `jest-react-native-mock.js` (adiciona `Image`, `ImageBackground`, `Pressable`)

**Interfaces:**
- Produces:
  - `StatIcons.tsx`: `export function HpIcon(p: SvgIconProps)`, `AtkIcon`, `MpIcon`, `DefIcon`; `export interface SvgIconProps { size?: number; color?: string }`.
  - `ClassSeals.tsx`: `export function ClassSeal({ classId, size, color }: { classId: ClassId; size?: number; color?: string })` resolvendo os 6 `ClassId` reais (`WARRIOR`/`TANK`/`ROGUE`/`ARCHER`/`MAGE`/`HEALER`) de `src/types`.
  - `FrameCorner.tsx`: `export function FrameCorner({ size, color }: { size?: number; color?: string })`.
- Consumes: `react-native-svg` (instalado, `^15.12.1`); `ClassId` de `src/types`.

> **Mocks de teste:** `react-native-svg` precisa ser mockado no Jest (o `react-native` é mockado e o SVG real importa internals de RN). O mock RN também não tem `Image`/`ImageBackground`/`Pressable`, usados por `Parchment`/`Button` adiante — adicionar agora para destravar as Tasks 8–10.

- [ ] **Step 1: Adicionar mocks de plataforma** — em `jest.unit.config.js`, `moduleNameMapper`, adicionar:

```js
    '^react-native-svg$': '<rootDir>/jest-mocks/react-native-svg-mock.js',
    '^expo-linear-gradient$': '<rootDir>/jest-mocks/expo-linear-gradient-mock.js',
    '^@expo/vector-icons$': '<rootDir>/jest-mocks/vector-icons-mock.js',
```

Criar `jest-mocks/react-native-svg-mock.js`:

```js
const React = require('react');
const make = (name) => (props) => React.createElement(name, props, props.children);
const Svg = make('Svg');
module.exports = {
  __esModule: true,
  default: Svg,
  Svg,
  Path: make('Path'),
  G: make('G'),
  Circle: make('Circle'),
  Rect: make('Rect'),
  Polygon: make('Polygon'),
  Line: make('Line'),
  Defs: make('Defs'),
  LinearGradient: make('LinearGradient'),
  Stop: make('Stop'),
};
```

Criar `jest-mocks/expo-linear-gradient-mock.js`:

```js
const React = require('react');
const LinearGradient = (props) => React.createElement('LinearGradient', props, props.children);
module.exports = { __esModule: true, LinearGradient };
```

Criar `jest-mocks/vector-icons-mock.js`:

```js
const React = require('react');
const Icon = (props) => React.createElement('VectorIcon', props, props.children);
module.exports = {
  __esModule: true,
  Ionicons: Icon,
  MaterialCommunityIcons: Icon,
};
```

- [ ] **Step 2: Adicionar `Image`/`ImageBackground`/`Pressable` ao mock RN** — em `jest-react-native-mock.js`, após a linha `const TextInput = ...`, adicionar:

```js
const Image = (props) => React.createElement('Image', props, props.children);
const ImageBackground = (props) => React.createElement('ImageBackground', props, props.children);
const Pressable = (props) => React.createElement('Pressable', props, props.children);
```

E no objeto `ReactNative = { ... }`, após `TextInput,`, adicionar `Image, ImageBackground, Pressable,`.

- [ ] **Step 3: Escrever o teste falhando** — Criar `src/__tests__/components/icons.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { HpIcon, AtkIcon, MpIcon, DefIcon } from '../../components/ui/icons/StatIcons';
import { ClassSeal } from '../../components/ui/icons/ClassSeals';
import { FrameCorner } from '../../components/ui/icons/FrameCorner';

describe('SVGs custom', () => {
  test('os 4 stat icons renderizam sem throw', () => {
    expect(() => render(<HpIcon size={16} />)).not.toThrow();
    expect(() => render(<AtkIcon size={16} />)).not.toThrow();
    expect(() => render(<MpIcon size={16} />)).not.toThrow();
    expect(() => render(<DefIcon size={16} />)).not.toThrow();
  });

  test('ClassSeal resolve as 6 classes reais', () => {
    const classes = ['WARRIOR', 'TANK', 'ROGUE', 'ARCHER', 'MAGE', 'HEALER'] as const;
    for (const c of classes) {
      expect(() => render(<ClassSeal classId={c} size={24} />)).not.toThrow();
    }
  });

  test('FrameCorner renderiza sem throw', () => {
    expect(() => render(<FrameCorner size={16} />)).not.toThrow();
  });
});
```

- [ ] **Step 4: Rodar o teste para verificar que falha**

Run: `npm test -- --testPathPattern=icons.test`
Expected: FAIL — `Cannot find module '../../components/ui/icons/StatIcons'`.

- [ ] **Step 5: Implementação mínima** — Criar os 3 arquivos:

`src/components/ui/icons/StatIcons.tsx`:

```tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../../../theme';

export interface SvgIconProps {
  size?: number;
  color?: string;
}

export function HpIcon({ size = 16, color = theme.colors.statHp }: SvgIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 21s-7.5-4.9-10-9.6C.4 8 2.4 4 6 4c2 0 3.4 1.1 4 2 .6-.9 2-2 4-2 3.6 0 5.6 4 4 7.4C19.5 16.1 12 21 12 21z" fill={color} />
    </Svg>
  );
}

export function AtkIcon({ size = 16, color = theme.colors.statAtk }: SvgIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 2 4 4l11 11 2-2L6 2zm12 14-2 2 2 2 2-2-2-2zM2 18l4-4 2 2-4 4-2-2z" fill={color} />
    </Svg>
  );
}

export function MpIcon({ size = 16, color = theme.colors.statMp }: SvgIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2C8 7 6 10 6 14a6 6 0 0 0 12 0c0-4-2-7-6-12z" fill={color} />
    </Svg>
  );
}

export function DefIcon({ size = 16, color = theme.colors.statDef }: SvgIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3z" fill={color} />
    </Svg>
  );
}
```

`src/components/ui/icons/ClassSeals.tsx`:

```tsx
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { ClassId } from '../../../types';
import { theme } from '../../../theme';

interface ClassSealProps {
  classId: ClassId;
  size?: number;
  color?: string;
}

// Glifo simples por classe (substituído por arte final em SPEC 3 se necessário).
const GLYPHS: Record<ClassId, string> = {
  WARRIOR: 'M12 3l3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1z',
  TANK: 'M12 3 5 6v5c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3z',
  ROGUE: 'M5 4l8 8-2 2-8-8 2-2zm14 14-5-5-2 2 5 5 2-2z',
  ARCHER: 'M4 20 20 4M14 4h6v6M9 15l-5 5',
  MAGE: 'M12 2 9 9l-7 1 5 5-1 7 6-3 6 3-1-7 5-5-7-1-3-7z',
  HEALER: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4z',
};

export function ClassSeal({ classId, size = 24, color = theme.colors.gold }: ClassSealProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={11} fill="none" stroke={color} strokeWidth={1.5} />
      <Path d={GLYPHS[classId]} fill={color} stroke={color} strokeWidth={1} />
    </Svg>
  );
}
```

`src/components/ui/icons/FrameCorner.tsx`:

```tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../../../theme';

interface FrameCornerProps {
  size?: number;
  color?: string;
}

export function FrameCorner({ size = 16, color = theme.colors.borderGold }: FrameCornerProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M0 0h16v3H3v13H0V0z" fill={color} />
      <Path d="M5 5h6v2H7v4H5V5z" fill={color} />
    </Svg>
  );
}
```

- [ ] **Step 6: Rodar o teste e type-check**

Run: `npm test -- --testPathPattern=icons.test`
Expected: PASS (3 testes).

Run: `npx tsc --noEmit 2>&1 | grep -cE "error TS"`
Expected: ≤ baseline.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/icons/ jest.unit.config.js jest-react-native-mock.js jest-mocks/react-native-svg-mock.js jest-mocks/expo-linear-gradient-mock.js jest-mocks/vector-icons-mock.js src/__tests__/components/icons.test.tsx
git commit -m "feat(ui): SVGs custom de stats, brasões de classe e canto de moldura (§3.8) + mocks de plataforma no jest"
```

---

## Task 7: `<Icon>` (ponte vector-icons | SVG custom)

**Files:**
- Create: `src/components/ui/Icon.tsx`
- Create: `src/__tests__/components/Icon.test.tsx`

**Interfaces:**
- Consumes: `MaterialCommunityIcons` de `@expo/vector-icons`; `HpIcon/AtkIcon/MpIcon/DefIcon` (Task 6); `ClassSeal` (Task 6); `ClassId` de `src/types`.
- Produces: `export type IconName = ...` (lista do §3.8); `export interface IconProps { name: IconName; size?: number; color?: string }`; `export function Icon(props: IconProps)`.

- [ ] **Step 1: Escrever o teste falhando** — Criar `src/__tests__/components/Icon.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { Icon } from '../../components/ui/Icon';

describe('<Icon>', () => {
  test('nome semântico renderiza o vector-icon sem throw', () => {
    expect(() => render(<Icon name="sword" size={20} />)).not.toThrow();
    const { UNSAFE_getAllByType } = render(<Icon name="shield" size={20} />);
    // o mock de vector-icons renderiza um elemento "VectorIcon"
    expect(UNSAFE_getAllByType('VectorIcon' as any).length).toBeGreaterThan(0);
  });

  test('nome de stat renderiza o SVG custom (não o vector-icon)', () => {
    const { UNSAFE_queryAllByType } = render(<Icon name="stat-hp" size={16} />);
    expect(UNSAFE_queryAllByType('VectorIcon' as any).length).toBe(0);
  });

  test('nome de classe renderiza sem throw', () => {
    expect(() => render(<Icon name="class-mage" size={24} />)).not.toThrow();
  });

  test('nome inválido (via cast) não derruba a árvore', () => {
    expect(() => render(<Icon name={'inexistente' as any} size={16} />)).not.toThrow();
  });
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

Run: `npm test -- --testPathPattern=Icon.test`
Expected: FAIL — `Cannot find module '../../components/ui/Icon'`.

- [ ] **Step 3: Implementação mínima** — Criar `src/components/ui/Icon.tsx`:

```tsx
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ClassId } from '../../types';
import { theme } from '../../theme';
import { HpIcon, AtkIcon, MpIcon, DefIcon, SvgIconProps } from './icons/StatIcons';
import { ClassSeal } from './icons/ClassSeals';

export type IconName =
  | 'sword' | 'shield' | 'castle' | 'anvil' | 'potion' | 'coin' | 'scroll' | 'trophy'
  | 'stat-hp' | 'stat-atk' | 'stat-mp' | 'stat-def'
  | 'class-warrior' | 'class-tank' | 'class-rogue' | 'class-archer' | 'class-mage' | 'class-healer';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

const MCI_MAP: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  sword: 'sword',
  shield: 'shield',
  castle: 'castle',
  anvil: 'anvil',
  potion: 'bottle-tonic',
  coin: 'circle-multiple',
  scroll: 'script-text',
  trophy: 'trophy',
};

const STAT_MAP: Record<string, (p: SvgIconProps) => React.JSX.Element> = {
  'stat-hp': HpIcon,
  'stat-atk': AtkIcon,
  'stat-mp': MpIcon,
  'stat-def': DefIcon,
};

const CLASS_MAP: Record<string, ClassId> = {
  'class-warrior': 'WARRIOR',
  'class-tank': 'TANK',
  'class-rogue': 'ROGUE',
  'class-archer': 'ARCHER',
  'class-mage': 'MAGE',
  'class-healer': 'HEALER',
};

export function Icon({ name, size = 20, color = theme.colors.textPrimary }: IconProps) {
  const Stat = STAT_MAP[name];
  if (Stat) return <Stat size={size} color={color} />;

  const classId = CLASS_MAP[name];
  if (classId) return <ClassSeal classId={classId} size={size} color={color} />;

  const mci = MCI_MAP[name];
  if (mci) return <MaterialCommunityIcons name={mci} size={size} color={color} />;

  return null; // nome desconhecido: degrada sem crash
}
```

- [ ] **Step 4: Rodar o teste e type-check**

Run: `npm test -- --testPathPattern=Icon.test`
Expected: PASS (4 testes).

Run: `npx tsc --noEmit 2>&1 | grep -cE "error TS"`
Expected: ≤ baseline.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Icon.tsx src/__tests__/components/Icon.test.tsx
git commit -m "feat(ui): <Icon> unifica MaterialCommunityIcons e SVGs custom (§3.8)"
```

---

## Task 8: `ThemeProvider` + `useTheme()`

**Files:**
- Create: `src/theme/ThemeProvider.tsx`
- Create: `src/__tests__/theme/ThemeProvider.test.tsx`

**Interfaces:**
- Consumes: `darkColors`, `lightColors` (Task 1).
- Produces: `export type ThemeMode = 'dark' | 'light'`; `export function ThemeProvider({ children, initialMode }: { children: React.ReactNode; initialMode?: ThemeMode })`; `export function useTheme(): { mode: ThemeMode; colors: Record<keyof typeof darkColors, string>; setMode: (m: ThemeMode) => void }`.

> **Por que `Record<keyof typeof darkColors, string>` e não `typeof darkColors`:** `as const` fixaria os literais de `darkColors` e o type rejeitaria `lightColors` (mesmas chaves, hex diferentes). O `Record` aceita ambas as paletas sem regredir o tsc (§3.10).

- [ ] **Step 1: Escrever o teste falhando** — Criar `src/__tests__/theme/ThemeProvider.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider, useTheme } from '../../theme/ThemeProvider';

function Probe() {
  const { mode, colors } = useTheme();
  return <Text>{`${mode}:${colors.bgBase}`}</Text>;
}

describe('ThemeProvider', () => {
  test('default é dark (bgBase do dark)', () => {
    const { getByText } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(getByText('dark:#1E1710')).toBeTruthy();
  });

  test('initialMode=light usa a paleta pergaminho', () => {
    const { getByText } = render(
      <ThemeProvider initialMode="light">
        <Probe />
      </ThemeProvider>
    );
    expect(getByText('light:#E8DCC0')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

Run: `npm test -- --testPathPattern=ThemeProvider.test`
Expected: FAIL — `Cannot find module '../../theme/ThemeProvider'`.

- [ ] **Step 3: Implementação mínima** — Criar `src/theme/ThemeProvider.tsx`:

```tsx
import React, { createContext, useContext, useMemo, useState } from 'react';
import { darkColors, lightColors } from './tokens/colors';

export type ThemeMode = 'dark' | 'light';
type ColorScheme = Record<keyof typeof darkColors, string>;

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ColorScheme;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  colors: darkColors,
  setMode: () => {},
});

export function ThemeProvider({
  children,
  initialMode = 'dark',
}: {
  children: React.ReactNode;
  initialMode?: ThemeMode;
}) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const value = useMemo<ThemeContextValue>(
    () => ({ mode, colors: mode === 'dark' ? darkColors : lightColors, setMode }),
    [mode]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 4: Rodar o teste e type-check**

Run: `npm test -- --testPathPattern=ThemeProvider.test`
Expected: PASS (2 testes).

Run: `npx tsc --noEmit 2>&1 | grep -cE "error TS"`
Expected: ≤ baseline.

- [ ] **Step 5: Commit**

```bash
git add src/theme/ThemeProvider.tsx src/__tests__/theme/ThemeProvider.test.tsx
git commit -m "feat(theme): ThemeProvider dark/claro + useTheme (mecanismo, §3.10)"
```

---

## Task 9: Componentes-base — `Card`, `Banner`, `Divider`

**Files:**
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Banner.tsx`
- Create: `src/components/ui/Divider.tsx`
- Create: `src/__tests__/components/baseComponents.test.tsx` (cobre estes 3 + os 4 da Task 10)

**Interfaces:**
- Consumes: `theme` (Task 3); `rarity`, `Rarity` (Task 2); `LinearGradient` (`expo-linear-gradient`); SVG (`react-native-svg`).
- Produces:
  - `Card`: `export function Card(props: { children: React.ReactNode; rarity?: Rarity; elevation?: keyof typeof theme.elevation; onPress?: () => void; padding?: keyof typeof theme.spacing })`.
  - `Banner`: `export function Banner(props: { title: string; subtitle?: string; right?: React.ReactNode })`.
  - `Divider`: `export function Divider(props: { variant?: 'plain' | 'ornament'; color?: string })`.

- [ ] **Step 1: Escrever o teste falhando** — Criar `src/__tests__/components/baseComponents.test.tsx` (cobre as Tasks 9 e 10; nesta task só os 3 primeiros `describe` rodam — os outros virão na Task 10):

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from '../../components/ui/Card';
import { Banner } from '../../components/ui/Banner';
import { Divider } from '../../components/ui/Divider';
import { Seal } from '../../components/ui/Seal';
import { Parchment } from '../../components/ui/Parchment';
import { Button } from '../../components/ui/Button';
import { OrnateFrame } from '../../components/ui/OrnateFrame';
import { theme } from '../../theme';

describe('Card', () => {
  test('renderiza children sem throw', () => {
    const { getByText } = render(<Card><Text>conteúdo</Text></Card>);
    expect(getByText('conteúdo')).toBeTruthy();
  });

  test('rarity="legendary" aplica o glow legendary', () => {
    // Card sem onPress renderiza um único View raiz com o array de estilos achatado
    const json = render(<Card rarity="legendary"><Text>x</Text></Card>).toJSON() as any;
    const flat = ([] as any[]).concat(json.props.style).filter(Boolean);
    const merged = Object.assign({}, ...flat);
    expect(merged.shadowColor).toBe(theme.elevation.glowLegendary.shadowColor);
  });
});

describe('Banner', () => {
  test('expõe o título e o subtítulo', () => {
    const { getByText } = render(<Banner title="Vila" subtitle="Bem-vindo" />);
    expect(getByText('Vila')).toBeTruthy();
    expect(getByText('Bem-vindo')).toBeTruthy();
  });

  test('renderiza o slot right', () => {
    const { getByText } = render(<Banner title="X" right={<Text>OURO</Text>} />);
    expect(getByText('OURO')).toBeTruthy();
  });
});

describe('Divider', () => {
  test('plain renderiza sem throw', () => {
    expect(() => render(<Divider />)).not.toThrow();
  });

  test('ornament renderiza um SVG central', () => {
    const { UNSAFE_queryAllByType } = render(<Divider variant="ornament" />);
    expect(UNSAFE_queryAllByType('Svg' as any).length).toBeGreaterThan(0);
  });
});

describe('Seal', () => {
  test('kind de classe resolve o brasão', () => {
    expect(() => render(<Seal kind="WARRIOR" size={32} />)).not.toThrow();
  });
  test('locked não derruba a árvore', () => {
    expect(() => render(<Seal kind="MAGE" locked />)).not.toThrow();
  });
});

describe('Parchment', () => {
  test('renderiza os children', () => {
    const { getByText } = render(<Parchment><Text>pergaminho</Text></Parchment>);
    expect(getByText('pergaminho')).toBeTruthy();
  });
});

describe('Button', () => {
  test('expõe o label', () => {
    const { getByText } = render(<Button label="Forjar" onPress={() => {}} />);
    expect(getByText('Forjar')).toBeTruthy();
  });
  test('as 4 variantes renderizam sem throw', () => {
    for (const v of ['gold', 'wood', 'danger', 'ghost'] as const) {
      expect(() => render(<Button label="x" variant={v} onPress={() => {}} />)).not.toThrow();
    }
  });
});

describe('OrnateFrame', () => {
  test('renderiza children e cantos SVG', () => {
    const { getByText, UNSAFE_queryAllByType } = render(
      <OrnateFrame><Text>moldura</Text></OrnateFrame>
    );
    expect(getByText('moldura')).toBeTruthy();
    expect(UNSAFE_queryAllByType('Svg' as any).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

Run: `npm test -- --testPathPattern=baseComponents.test`
Expected: FAIL — `Cannot find module '../../components/ui/Card'` (e os demais imports).

- [ ] **Step 3: Implementação mínima** — Criar os 3 arquivos:

`src/components/ui/Card.tsx`:

```tsx
import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../../theme';
import { Rarity } from '../../theme/tokens/rarity';

interface CardProps {
  children: React.ReactNode;
  rarity?: Rarity;
  elevation?: keyof typeof theme.elevation;
  onPress?: () => void;
  padding?: keyof typeof theme.spacing;
}

export function Card({ children, rarity, elevation = 'e1', onPress, padding = 'md' }: CardProps) {
  const rarityStyle: ViewStyle = rarity
    ? { borderColor: theme.rarity[rarity].color, borderWidth: 1, ...theme.elevation[theme.rarity[rarity].glow] }
    : theme.elevation[elevation];

  const style = [styles.base, { padding: theme.spacing[padding] }, rarityStyle];

  if (onPress) {
    return <Pressable style={style} onPress={onPress}>{children}</Pressable>;
  }
  return <View style={style}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
  },
});
```

`src/components/ui/Banner.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

interface BannerProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function Banner({ title, subtitle, right }: BannerProps) {
  return (
    <LinearGradient
      colors={[theme.colors.surface, theme.colors.surfaceRaised]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.container}
    >
      <View style={styles.titles}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View>{right}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGold,
  },
  titles: { flex: 1, marginRight: theme.spacing.md },
  title: { ...theme.type.h1, color: theme.colors.textPrimary },
  subtitle: { ...theme.type.caption, color: theme.colors.textSecondary, marginTop: 2 },
});
```

`src/components/ui/Divider.tsx`:

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../../theme';

interface DividerProps {
  variant?: 'plain' | 'ornament';
  color?: string;
}

export function Divider({ variant = 'plain', color = theme.colors.borderGold }: DividerProps) {
  if (variant === 'plain') {
    return <View style={[styles.line, { backgroundColor: color }]} />;
  }
  return (
    <View style={styles.ornamentRow}>
      <View style={[styles.lineFlex, { backgroundColor: color }]} />
      <Svg width={16} height={16} viewBox="0 0 16 16">
        <Path d="M8 1l7 7-7 7-7-7 7-7z" fill={color} />
      </Svg>
      <View style={[styles.lineFlex, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: { height: 1, width: '100%', marginVertical: theme.spacing.sm },
  ornamentRow: { flexDirection: 'row', alignItems: 'center', marginVertical: theme.spacing.sm },
  lineFlex: { flex: 1, height: 1 },
});
```

- [ ] **Step 4: Rodar parte do teste**

Run: `npm test -- --testPathPattern=baseComponents.test -t "Card|Banner|Divider"`
Expected: os `describe` Card/Banner/Divider passam (os de Seal/Parchment/Button/OrnateFrame ainda falham por módulo ausente — esperado, vêm na Task 10).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Card.tsx src/components/ui/Banner.tsx src/components/ui/Divider.tsx src/__tests__/components/baseComponents.test.tsx
git commit -m "feat(ui): Card (raridade/glow), Banner (compat ScreenHeader) e Divider (§3.9)"
```

---

## Task 10: Componentes-base — `Seal`, `Parchment`, `Button`, `OrnateFrame`

**Files:**
- Create: `src/components/ui/Seal.tsx`
- Create: `src/components/ui/Parchment.tsx`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/OrnateFrame.tsx`

**Interfaces:**
- Consumes: `theme` (Task 3); `Icon`/`IconName` (Task 7); `ClassSeal`/`ClassId` (Task 6); `FrameCorner` (Task 6); `LinearGradient`.
- Produces:
  - `Seal`: `export function Seal(props: { kind: ClassId | 'achievement'; size?: number; locked?: boolean })`.
  - `Parchment`: `export function Parchment(props: { children: React.ReactNode; tone?: 'leather' | 'parchment'; elevation?: keyof typeof theme.elevation })`.
  - `Button`: `export function Button(props: { label: string; onPress: () => void; variant?: 'gold' | 'wood' | 'danger' | 'ghost'; icon?: IconName; size?: 'sm' | 'md' | 'lg'; disabled?: boolean; loading?: boolean })`.
  - `OrnateFrame`: `export function OrnateFrame(props: { children: React.ReactNode; corner?: 'gold' | 'wood'; radius?: keyof typeof theme.borderRadius; padding?: keyof typeof theme.spacing; elevation?: keyof typeof theme.elevation })`.

- [ ] **Step 1: Rodar o teste (já existe da Task 9) para confirmar que estes 4 falham**

Run: `npm test -- --testPathPattern=baseComponents.test`
Expected: FAIL nos `describe` Seal/Parchment/Button/OrnateFrame (`Cannot find module`).

- [ ] **Step 2: Implementação mínima** — Criar os 4 arquivos:

`src/components/ui/Seal.tsx`:

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ClassId } from '../../types';
import { theme } from '../../theme';
import { ClassSeal } from './icons/ClassSeals';
import { Icon } from './Icon';

interface SealProps {
  kind: ClassId | 'achievement';
  size?: number;
  locked?: boolean;
}

export function Seal({ kind, size = 48, locked = false }: SealProps) {
  const color = locked ? theme.colors.textMuted : theme.colors.gold;
  const inner =
    kind === 'achievement'
      ? <Icon name="trophy" size={size * 0.6} color={color} />
      : <ClassSeal classId={kind} size={size * 0.7} color={color} />;

  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, borderColor: color, opacity: locked ? 0.4 : 1 },
        locked ? undefined : theme.elevation.glowGold,
      ]}
    >
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: theme.colors.surface,
  },
});
```

`src/components/ui/Parchment.tsx`:

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

interface ParchmentProps {
  children: React.ReactNode;
  tone?: 'leather' | 'parchment';
  elevation?: keyof typeof theme.elevation;
}

export function Parchment({ children, tone = 'leather', elevation = 'e1' }: ParchmentProps) {
  const colors =
    tone === 'leather'
      ? [theme.colors.surface, theme.colors.surfaceRaised]
      : [theme.colors.surfaceRaised, theme.colors.surface];

  return (
    <LinearGradient colors={colors} style={[styles.base, theme.elevation[elevation]]}>
      <View>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
```

`src/components/ui/Button.tsx`:

```tsx
import React from 'react';
import { Pressable, Text, ActivityIndicator, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';
import { Icon, IconName } from './Icon';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'gold' | 'wood' | 'danger' | 'ghost';
  icon?: IconName;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
}

const GRADIENTS: Record<'gold' | 'wood' | 'danger', [string, string]> = {
  gold: [theme.colors.gold, theme.colors.goldDark],
  wood: [theme.colors.surfaceRaised, theme.colors.surface],
  danger: [theme.colors.ember, theme.colors.blood],
};

const PADDING: Record<NonNullable<ButtonProps['size']>, number> = {
  sm: theme.spacing.xs,
  md: theme.spacing.sm,
  lg: theme.spacing.md,
};

export function Button({ label, onPress, variant = 'gold', icon, size = 'md', disabled = false, loading = false }: ButtonProps) {
  const pad = PADDING[size];
  const content = (
    <View style={styles.row}>
      {loading ? <ActivityIndicator color={theme.colors.textPrimary} /> : null}
      {icon && !loading ? <Icon name={icon} size={16} color={theme.colors.textPrimary} /> : null}
      <Text style={styles.label}>{label}</Text>
    </View>
  );

  if (variant === 'ghost') {
    return (
      <Pressable onPress={onPress} disabled={disabled || loading} style={[styles.ghost, { padding: pad, opacity: disabled ? 0.5 : 1 }]}>
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={{ opacity: disabled ? 0.5 : 1 }}>
      <LinearGradient colors={GRADIENTS[variant]} style={[styles.gradient, { padding: pad }, theme.elevation.e1]}>
        {content}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs },
  gradient: { borderRadius: theme.borderRadius.md, alignItems: 'center' },
  ghost: { borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.borderGold, alignItems: 'center' },
  label: { ...theme.type.label, color: theme.colors.textPrimary },
});
```

`src/components/ui/OrnateFrame.tsx`:

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../../theme';
import { FrameCorner } from './icons/FrameCorner';

interface OrnateFrameProps {
  children: React.ReactNode;
  corner?: 'gold' | 'wood';
  radius?: keyof typeof theme.borderRadius;
  padding?: keyof typeof theme.spacing;
  elevation?: keyof typeof theme.elevation;
}

export function OrnateFrame({ children, corner = 'gold', radius = 'md', padding = 'md', elevation = 'e2' }: OrnateFrameProps) {
  const cornerColor = corner === 'gold' ? theme.colors.borderGold : theme.colors.border;
  return (
    <View
      style={[
        styles.base,
        { borderRadius: theme.borderRadius[radius], padding: theme.spacing[padding], borderColor: cornerColor },
        theme.elevation[elevation],
      ]}
    >
      <View style={[styles.corner, styles.tl]}><FrameCorner color={cornerColor} /></View>
      <View style={[styles.corner, styles.tr]}><FrameCorner color={cornerColor} /></View>
      <View style={[styles.corner, styles.bl]}><FrameCorner color={cornerColor} /></View>
      <View style={[styles.corner, styles.br]}><FrameCorner color={cornerColor} /></View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: theme.colors.surface, borderWidth: 2 },
  corner: { position: 'absolute', width: 16, height: 16 },
  tl: { top: -1, left: -1 },
  tr: { top: -1, right: -1, transform: [{ scaleX: -1 }] },
  bl: { bottom: -1, left: -1, transform: [{ scaleY: -1 }] },
  br: { bottom: -1, right: -1, transform: [{ scaleX: -1 }, { scaleY: -1 }] },
});
```

- [ ] **Step 3: Rodar o teste completo e type-check**

Run: `npm test -- --testPathPattern=baseComponents.test`
Expected: PASS (todos os `describe`: Card, Banner, Divider, Seal, Parchment, Button, OrnateFrame).

Run: `npx tsc --noEmit 2>&1 | grep -cE "error TS"`
Expected: ≤ baseline.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Seal.tsx src/components/ui/Parchment.tsx src/components/ui/Button.tsx src/components/ui/OrnateFrame.tsx
git commit -m "feat(ui): Seal, Parchment, Button e OrnateFrame — família de componentes do Reino (§3.9)"
```

---

## Task 11: `constants/equipment.ts` — tiers ganham `rarity`, perdem `color`

**Files:**
- Modify: `src/constants/equipment.ts` (linhas 7–11)
- Create: `src/__tests__/constants/equipment.test.ts`
- Modify: `src/screens/BlacksmithScreen.tsx` (linha 44)

**Interfaces:**
- Consumes: `Rarity`, `rarity` (Task 2).
- Produces: `EQUIPMENT_TIERS` com `rarity: Rarity` por tier (sem chave `color`); `BlacksmithScreen` resolve cor via `rarity[def.rarity].color`.

- [ ] **Step 1: Escrever o teste falhando** — Criar `src/__tests__/constants/equipment.test.ts`:

```ts
import { EQUIPMENT_TIERS } from '../../constants/equipment';
import { rarity, Rarity } from '../../theme/tokens/rarity';

describe('EQUIPMENT_TIERS sem hex literal', () => {
  test('nenhum tier carrega a chave color', () => {
    for (const t of EQUIPMENT_TIERS) {
      expect(t).not.toHaveProperty('color');
    }
  });

  test('cada tier tem uma rarity válida e mapeada', () => {
    for (const t of EQUIPMENT_TIERS) {
      expect(Object.keys(rarity)).toContain((t as { rarity: Rarity }).rarity);
    }
  });

  test('tier1→common, tier2→rare, tier3→epic', () => {
    const byTier = Object.fromEntries(EQUIPMENT_TIERS.map(t => [t.tier, (t as { rarity: Rarity }).rarity]));
    expect(byTier[1]).toBe('common');
    expect(byTier[2]).toBe('rare');
    expect(byTier[3]).toBe('epic');
  });
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

Run: `npm test -- --testPathPattern=equipment.test`
Expected: FAIL — `t` ainda tem `color` e não tem `rarity`.

- [ ] **Step 3: Implementação** — em `src/constants/equipment.ts`, substituir o bloco `EQUIPMENT_TIERS` (linhas 7–11):

```ts
import { Rarity } from '../theme/tokens/rarity';

export const EQUIPMENT_TIERS: { tier: number; label: string; cost: number; forgeTimeMs: number; rarity: Rarity }[] = [
  { tier: 1, label: 'Comum', cost: 50, forgeTimeMs: 30_000, rarity: 'common' },
  { tier: 2, label: 'Raro', cost: 150, forgeTimeMs: 60_000, rarity: 'rare' },
  { tier: 3, label: 'Épico', cost: 400, forgeTimeMs: 120_000, rarity: 'epic' },
];
```

(O `import` vai no topo do arquivo, antes da interface `EquipmentTemplate`.)

- [ ] **Step 4: Atualizar `BlacksmithScreen.tsx`** — Ler o contexto da linha 44 primeiro:

Run: `sed -n '38,48p' src/screens/BlacksmithScreen.tsx`

Localizar a função que retorna a cor (linha 44, hoje `return def?.color || '#94A3B8';`). Substituir a lógica por resolução via `rarity`. No topo do arquivo, garantir o import:

```ts
import { rarity } from '../theme/tokens/rarity';
```

E substituir a linha 44:

```ts
  return def ? rarity[def.rarity].color : rarity.common.color;
```

> Ajustar a assinatura da função local se ela recebe `def` (o `EQUIPMENT_TIERS` item). Se houver outras referências a `.color` do tier no arquivo, trocar todas por `rarity[<tier>.rarity].color`.

- [ ] **Step 5: Rodar testes e type-check**

Run: `npm test -- --testPathPattern=equipment.test`
Expected: PASS (3 testes).

Run: `npm test`
Expected: suíte verde (nenhum teste existente dependia de `tier.color`).

Run: `npx tsc --noEmit 2>&1 | grep -cE "error TS"`
Expected: ≤ baseline.

- [ ] **Step 6: Commit**

```bash
git add src/constants/equipment.ts src/__tests__/constants/equipment.test.ts src/screens/BlacksmithScreen.tsx
git commit -m "refactor(equipment): tiers usam token de raridade (§3.5), BlacksmithScreen resolve cor via rarity"
```

---

## Task 12: Migrar hex de HP/combate — `HPBar`, `CombatantCard`

**Files:**
- Modify: `src/components/HPBar.tsx` (linhas 16–18)
- Modify: `src/components/CombatantCard.tsx` (linhas 129, 247, 263)

**Interfaces:**
- Consumes: `theme.colors.hpHigh/hpMid/hpLow`, `theme.colors.danger` (Task 3).

> **Validação:** esta task não tem teste unit dedicado (são valores de cor); a verificação é `grep` por hex + `npm test` verde + a vitrine na Task 16. O ciclo é: trocar hex → confirmar grep zera nesses arquivos → testes verdes → commit.

- [ ] **Step 1: `HPBar.tsx`** — substituir o corpo de `getBarColor` (linhas 14–19):

```tsx
  const getBarColor = () => {
    const ratio = current / Math.max(1, max);
    if (ratio > 0.6) return theme.colors.hpHigh;
    if (ratio > 0.3) return theme.colors.hpMid;
    return theme.colors.hpLow;
  };
```

- [ ] **Step 2: `CombatantCard.tsx`** — ler o contexto antes:

Run: `sed -n '125,132p;244,266p' src/components/CombatantCard.tsx`

Substituir na linha 129 o ternário de cor de HP:

```tsx
            <Animated.View style={[styles.hpFill, { width: hpWidth, backgroundColor: hpPct > 0.6 ? theme.colors.hpHigh : hpPct > 0.3 ? theme.colors.hpMid : theme.colors.hpLow }]} />
```

Na linha 247 (`backgroundColor: '#ff4d4d'` dentro do `StyleSheet`) → `backgroundColor: theme.colors.danger`.
Na linha 263 (`color: '#ff4d4d'`) → `color: theme.colors.danger`.

> Confirmar que `theme` já está importado em `CombatantCard.tsx` (ele usa `theme` no §1.2 do spec). Se o `StyleSheet.create` estático não puder referenciar `theme` (já referencia hoje), manter o padrão existente do arquivo.

- [ ] **Step 3: Verificar que o grep de marca zerou nesses arquivos**

Run: `grep -nE "#(3CB371|FFD24D|FF7A7A|ff4d4d)" src/components/HPBar.tsx src/components/CombatantCard.tsx || echo "sem hex de marca"`
Expected: `sem hex de marca`.

- [ ] **Step 4: Testes e type-check**

Run: `npm test`
Expected: verde.

Run: `npx tsc --noEmit 2>&1 | grep -cE "error TS"`
Expected: ≤ baseline.

- [ ] **Step 5: Commit**

```bash
git add src/components/HPBar.tsx src/components/CombatantCard.tsx
git commit -m "refactor(combat-ui): HP-bar e dano usam tokens hpHigh/Mid/Low e danger (§3.2 unificada)"
```

---

## Task 13: Migrar hex de feedback/modais — `FeedbackLayer`, `MissionResultModal`, `MissionHeroSelectionModal`, `ChestCard`

**Files:**
- Modify: `src/components/FeedbackLayer.tsx` (linhas 126, 127, 164)
- Modify: `src/components/MissionResultModal.tsx` (linhas 60, 63, 148, 233, 419, 446)
- Modify: `src/components/MissionHeroSelectionModal.tsx` (linhas 285, 469, 475)
- Modify: `src/components/ChestCard.tsx` (linha 96)

**Interfaces:**
- Consumes: `theme.colors.success/successBright/danger/warning/statMp` (Task 3).

- [ ] **Step 1: `FeedbackLayer.tsx`** — substituir:

Linha 126 `case 'success': return '#2ECC71';` → `case 'success': return theme.colors.successBright;`
Linha 127 `case 'error': return '#E74C3C';` → `case 'error': return theme.colors.danger;`
Linha 164 `color: '#ffd34d',` → `color: theme.colors.warning,`

> Confirmar import de `theme` no topo de `FeedbackLayer.tsx` (adicionar `import { theme } from '../theme';` se ausente).

- [ ] **Step 2: `MissionResultModal.tsx`** — substituir:

Linha 60 `color: '#ff4d4d'` → `color: theme.colors.danger`
Linha 63 `color: '#2ecc71'` → `color: theme.colors.success`
Linha 148 `backgroundColor: result.success ? '#27AE60' : '#C0392B'` → `backgroundColor: result.success ? theme.colors.success : theme.colors.statHp`
Linha 233 `isIncapacitated ? '#ff4d4d' : ...` → `isIncapacitated ? theme.colors.danger : ...`
Linha 419 `backgroundColor: '#ff4d4d',` → `backgroundColor: theme.colors.danger,`
Linha 446 `color: '#ff4d4d',` → `color: theme.colors.danger,`

- [ ] **Step 3: `MissionHeroSelectionModal.tsx`** — substituir:

Linha 285 `isHeroRow && !hero ? '#6495ed' : theme.colors.border` → `isHeroRow && !hero ? theme.colors.statMp : theme.colors.border`
Linha 469 `{ backgroundColor: 'rgba(100, 149, 237, 0.15)', borderColor: '#6495ed', ... }` → `borderColor: theme.colors.statMp` (manter o `rgba` de fundo: é overlay neutro de baixa opacidade, fora do escopo de hex de marca — o lint só barra `#rrggbb`, não `rgba()`).
Linha 472 `cellHover: { borderColor: theme.colors.accent, ... }` → `borderColor: theme.colors.gold` (resolve um erro pré-existente de `tsc`: `Property 'accent' does not exist` — `accent` nunca existiu no tema; usar `gold` é a cor de destaque correta).
Linha 475 `color: '#ff4d4d', ...` → `color: theme.colors.danger,`

- [ ] **Step 4: `ChestCard.tsx`** — linha 96 `color: '#ff4d4d',` → `color: theme.colors.danger,`. Confirmar import de `theme`.

- [ ] **Step 5: Verificar grep de marca zerado nesses 4 arquivos**

Run: `grep -nE "#(2ECC71|E74C3C|ffd34d|ff4d4d|2ecc71|27AE60|C0392B|6495ed)" src/components/FeedbackLayer.tsx src/components/MissionResultModal.tsx src/components/MissionHeroSelectionModal.tsx src/components/ChestCard.tsx || echo "sem hex de marca"`
Expected: `sem hex de marca`.

- [ ] **Step 6: Testes e type-check**

Run: `npm test`
Expected: verde.

Run: `npx tsc --noEmit 2>&1 | grep -cE "error TS"`
Expected: **≤ 14** — os erros `Property 'warning'` (linha 420, resolvido na Task 3) e `Property 'accent'` (linha 472, resolvido no Step 3 desta task) desaparecem. Confirmar: `npx tsc --noEmit 2>&1 | grep "MissionHeroSelectionModal" || echo "MissionHeroSelectionModal OK"`.

- [ ] **Step 7: Commit**

```bash
git add src/components/FeedbackLayer.tsx src/components/MissionResultModal.tsx src/components/MissionHeroSelectionModal.tsx src/components/ChestCard.tsx
git commit -m "refactor(feedback-ui): feedback e modais usam tokens success/danger/warning/statMp (§3.2)"
```

---

## Task 14: Migrar hex de telas + varredura final de neutros

**Files:**
- Modify: `src/screens/DailyQuestsScreen.tsx` (linha 293)
- Modify: `src/screens/WeeklyScreen.tsx` (linha 367)
- Modify: demais ocorrências de `#rrggbb` que o lint apontar em `src/screens`/`src/components` (varredura)

**Interfaces:**
- Consumes: `theme.colors.bgDeep`, `theme.colors.textPrimary` etc.

> **Estratégia:** as telas `DailyQuests`/`Weekly` usam `#1a1a1a` como texto-sobre-ouro (escuro). Mapear para `theme.colors.bgDeep` (`#15100B`, quase-preto quente). Os `#fff`/`#000` neutros remanescentes em screens/components que o lint barrar viram `theme.colors.textPrimary` (marfim) ou `theme.colors.bgDeep`, conforme o contexto (texto claro vs. fundo escuro). Esta task **fecha** a lista para o lint da Task 15 passar.

- [ ] **Step 1: `DailyQuestsScreen.tsx`** — linha 293 `color: '#1a1a1a',` → `color: theme.colors.bgDeep,`. Confirmar import de `theme`.

- [ ] **Step 2: `WeeklyScreen.tsx`** — linha 367 `claimButtonText: { color: '#1a1a1a', ... }` → `color: theme.colors.bgDeep`. Confirmar import.

- [ ] **Step 3: Varredura — listar todo `#rrggbb` remanescente fora de stories**

Run:
```bash
grep -rnE "#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b" src/screens src/components --include="*.tsx" --include="*.ts" | grep -v ".stories.tsx" | grep -v "src/components/ui/icons/"
```
Expected: lista de `#fff`/`#000` neutros (e quaisquer outros). Para cada um:
- `#fff` em `color:` → `theme.colors.textPrimary`
- `#000` em `color:`/`shadowColor:` → manter se for `shadowColor` (tokens de elevação já usam `#000` internamente em `src/theme/tokens/`, que está **fora** do escopo do lint); se for `color:` de texto, trocar por `theme.colors.bgDeep`.

> **Importante:** o lint (Task 15) escopa **apenas** `src/screens/**` e `src/components/**`, **ignorando** `src/components/ui/icons/**`? Não — o spec ignora só `*.stories.tsx` e `src/theme/tokens/`. Os SVGs custom em `src/components/ui/icons/` **default cores via `theme`** (já feito na Task 6), então não têm hex inline. Confirmar no Step 4.

- [ ] **Step 4: Confirmar que não sobrou hex de 6 dígitos não-token em screens/components**

Run:
```bash
grep -rnE "['\"]#[0-9a-fA-F]{6}['\"]" src/screens src/components --include="*.tsx" --include="*.ts" | grep -v ".stories.tsx"
```
Expected: vazio (ou só `#000` em `shadowColor` se houver; nesse caso, trocar por um token — mas o ideal é zerar).

- [ ] **Step 5: Testes e type-check**

Run: `npm test`
Expected: verde.

Run: `npx tsc --noEmit 2>&1 | grep -cE "error TS"`
Expected: ≤ baseline.

- [ ] **Step 6: Commit**

```bash
git add src/screens/DailyQuestsScreen.tsx src/screens/WeeklyScreen.tsx src/screens src/components
git commit -m "refactor(screens): migrar hex inline restantes para tokens (texto-sobre-ouro -> bgDeep, neutros -> textPrimary)"
```

---

## Task 15: Lint anti-hex (`eslint.config.js`)

**Files:**
- Create: `eslint.config.js` (flat-config)

**Interfaces:**
- Consumes: `eslint` + `typescript-eslint` (Task 4).
- Produces: regra `no-restricted-syntax` que barra `#rrggbb`/`#rgb` em `src/screens/**` e `src/components/**`, ignorando `*.stories.tsx` e `src/theme/**`.

> **Por que rodar o lint só agora:** se rodado antes das Tasks 11–14, falharia de cara nos hex ainda não migrados. Agora a base está limpa e o lint trava a regressão.

- [ ] **Step 1: Criar `eslint.config.js`**:

```js
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    files: ['src/screens/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    ignores: ['**/*.stories.tsx', 'src/theme/**'],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/]",
          message: 'Cor hex inline proibida. Use um token de src/theme (ROADMAP §3.1).',
        },
      ],
    },
  }
);
```

- [ ] **Step 2: Rodar o lint e verificar 0 erros**

Run: `npm run lint`
Expected: **sem erros de `no-restricted-syntax`**. Se algum aparecer, voltar à Task 14 e migrar o hex apontado, depois re-rodar.

> Os SVGs em `src/components/ui/icons/` usam `fill="none"` / `fill={color}` (variável) — `fill="none"` não é hex; `viewBox`/`d` são strings não-hex. Não disparam a regra. Se algum `stroke`/`fill` literal hex restar, migrar para token.

- [ ] **Step 3: Confirmar que o lint **detecta** um hex (teste da própria regra)**

Run:
```bash
printf "const c = '#abcdef';\nexport default c;\n" > src/components/__lint_probe.tsx
npm run lint 2>&1 | grep -q "Cor hex inline proibida" && echo "REGRA ATIVA" || echo "REGRA INATIVA"
rm src/components/__lint_probe.tsx
```
Expected: `REGRA ATIVA` (a regra pegou o hex de prova). O arquivo de prova é removido em seguida.

- [ ] **Step 4: Commit**

```bash
git add eslint.config.js
git commit -m "feat(lint): barrar #rrggbb inline em screens/components — trava a regressão de paleta (§3.11)"
```

---

## Task 16: Tela-vitrine + wiring no `App.tsx` + validação visual

**Files:**
- Create: `src/components/ui/DesignSystemScreen.tsx`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `ThemeProvider` (Task 8); `useReinoFonts` (Task 5); todos os componentes-base (Tasks 9–10); `<Icon>` (Task 7); `HPBar` (Task 12).
- Produces: `export function DesignSystemScreen()` (tela de dev, **não** registrada em `AppNavigator`); `App.tsx` envolve a árvore em `<ThemeProvider>` e chama `useReinoFonts()`.

> Esta é uma task de UI: o "teste" é validação por screenshot no browser (convenção do projeto), mantendo o ciclo mudança → verificação → commit.

- [ ] **Step 1: Criar `src/components/ui/DesignSystemScreen.tsx`** (vitrine de todos os componentes):

```tsx
import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';
import { Banner } from './Banner';
import { Button } from './Button';
import { Card } from './Card';
import { Divider } from './Divider';
import { OrnateFrame } from './OrnateFrame';
import { Parchment } from './Parchment';
import { Seal } from './Seal';
import { Icon } from './Icon';
import { HPBar } from '../HPBar';
import { Rarity } from '../../theme/tokens/rarity';
import { ClassId } from '../../types';

const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const CLASSES: ClassId[] = ['WARRIOR', 'TANK', 'ROGUE', 'ARCHER', 'MAGE', 'HEALER'];

export function DesignSystemScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Banner title="Reino" subtitle="Vitrine do Design System" />

      <Text style={styles.section}>Botões</Text>
      <View style={styles.row}>
        <Button label="Ouro" variant="gold" onPress={() => {}} />
        <Button label="Madeira" variant="wood" onPress={() => {}} />
        <Button label="Perigo" variant="danger" icon="sword" onPress={() => {}} />
        <Button label="Fantasma" variant="ghost" onPress={() => {}} />
      </View>

      <Text style={styles.section}>Cards por raridade</Text>
      {RARITIES.map(r => (
        <Card key={r} rarity={r}>
          <Text style={styles.cardText}>{theme.rarity[r].label}</Text>
        </Card>
      ))}

      <Text style={styles.section}>Moldura</Text>
      <OrnateFrame>
        <Text style={styles.cardText}>OrnateFrame com cantos</Text>
      </OrnateFrame>

      <Text style={styles.section}>Selos de classe</Text>
      <View style={styles.row}>
        {CLASSES.map(c => <Seal key={c} kind={c} size={40} />)}
        <Seal kind="MAGE" size={40} locked />
      </View>

      <Divider variant="ornament" />

      <Text style={styles.section}>Ícones de stat + HP-bar</Text>
      <View style={styles.row}>
        <Icon name="stat-hp" /><Icon name="stat-atk" /><Icon name="stat-mp" /><Icon name="stat-def" />
      </View>
      <HPBar current={9} max={10} />
      <HPBar current={5} max={10} />
      <HPBar current={2} max={10} />

      <Parchment>
        <Text style={styles.cardText}>Pergaminho com textura</Text>
      </Parchment>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bgBase },
  content: { padding: theme.spacing.md, gap: theme.spacing.sm },
  section: { ...theme.type.h2, color: theme.colors.gold, marginTop: theme.spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, alignItems: 'center' },
  cardText: { ...theme.type.body, color: theme.colors.textPrimary },
});
```

- [ ] **Step 2: Wire `App.tsx`** — substituir o conteúdo:

```tsx
import React from 'react';
import { GameProvider } from './src/context/GameContext';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import { FeedbackLayer } from './src/components/FeedbackLayer';
import { useReinoFonts } from './src/theme/fonts';

export default function App() {
  // Não bloqueia o boot: com fonte ainda carregando, RN usa o fallback do sistema.
  useReinoFonts();
  return (
    <ThemeProvider>
      <GameProvider>
        <AppNavigator />
        <FeedbackLayer />
      </GameProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 3: Type-check e suíte completa**

Run: `npx tsc --noEmit 2>&1 | grep -cE "error TS"`
Expected: **≤ 14** (vector-icons + warning + accent resolvidos vs. baseline 17).

Run: `npm test`
Expected: verde.

- [ ] **Step 4: Validação visual no browser (Playwright)** — subir a vitrine e tirar screenshot:

Temporariamente, apontar o entry da vitrine. Mais simples sem alterar a navegação: em `App.tsx`, durante a validação, renderizar `<DesignSystemScreen />` no lugar de `<AppNavigator />` (reverter após o screenshot). Então:

Run (background):
```bash
pkill -f "expo start" 2>/dev/null; nohup npx expo start --web --port 8081 > /tmp/expo-ds.log 2>&1 & disown
```

Usar o Playwright MCP para navegar a `http://localhost:8081`, aguardar render, e capturar screenshot. **Checklist visual (§5.3 do spec):**
- [ ] Títulos em serif Cinzel (não fonte do sistema).
- [ ] Ouro velho (`#C9A227`), não laranja neon.
- [ ] Fundo couro escuro quente (`#1E1710`), não navy.
- [ ] Cards de raridade com borda+glow corretos (legendary dourado com glow forte).
- [ ] Cantos da `OrnateFrame` visíveis.
- [ ] 6 selos de classe + 1 locked (cinza/opaco).
- [ ] HP-bar nas 3 faixas (musgo / ouro / brasa).
- [ ] Sem flash branco no boot (tema dark).

Reverter `App.tsx` para `<AppNavigator />` após a captura.

- [ ] **Step 5: Validar fallback de fonte (sem `.ttf`)** — renomear temporariamente a pasta de fontes e confirmar que o app ainda renderiza texto legível (fonte do sistema), sem crash:

Run:
```bash
mv assets/fonts /tmp/fonts-bak && (npm test -- --testPathPattern=fonts.test); mv /tmp/fonts-bak assets/fonts
```
Expected: o teste de `fonts.test` (que já mocka `[false]`) continua PASS; e o app web não trava (validação visual rápida opcional). Restaurar a pasta.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/DesignSystemScreen.tsx App.tsx
git commit -m "feat(ui): vitrine DesignSystemScreen (dev) + wiring ThemeProvider/useReinoFonts no App (§5.3)"
```

---

## Task 17: Verificação final e fechamento

**Files:** nenhum novo — verificação de aceitação (§6 do spec).

- [ ] **Step 1: Suíte completa**

Run: `npm test`
Expected: verde, com `colors.test`, `theme.test`, `rarity.test`, `fonts.test`, `ThemeProvider.test`, `equipment.test`, `icons.test`, `Icon.test`, `baseComponents.test` todos passando.

- [ ] **Step 2: Type-check — delta vs. baseline 17**

Run: `npx tsc --noEmit 2>&1 | grep -cE "error TS"`
Expected: **≤ 14** (vector-icons, `warning` e `accent` resolvidos). Confirmar que nenhum erro **novo** foi introduzido:

Run: `npx tsc --noEmit 2>&1 | grep -E "src/theme/|src/components/ui/" || echo "sem erros novos no DS"`
Expected: `sem erros novos no DS`.

- [ ] **Step 3: Lint verde**

Run: `npm run lint`
Expected: 0 erros de hex inline.

- [ ] **Step 4: Conferir aceitação binária do §6** — checklist:
- [ ] `theme.colors.bgBase === '#1E1710'`, `gold === '#C9A227'`, `rarityLegendary === '#E8C45A'`, `statHp === '#C0392B'` (coberto por `theme.test`).
- [ ] `Object.keys(lightColors) === Object.keys(darkColors)` (coberto por `colors.test`).
- [ ] `EQUIPMENT_TIERS` sem hex; tiers com rarity (coberto por `equipment.test`).
- [ ] `app.json`: `userInterfaceStyle === "dark"`, splash/adaptive `#15100B`, plugin `expo-font`.
- [ ] `package.json` declara `@expo/vector-icons`, `expo-font`, `expo-linear-gradient`, `eslint` + script `lint`.
- [ ] 8 componentes em `src/components/ui/` (`OrnateFrame`, `Banner`, `Divider`, `Seal`, `Parchment`, `Button`, `Card`, `Icon`).
- [ ] Boot sem flash branco (screenshot da Task 16).
- [ ] Nenhuma das 11 telas registradas em `AppNavigator` foi editada exceto pelos hex (verificar com `git diff --stat` que só `DailyQuestsScreen`/`WeeklyScreen`/`BlacksmithScreen` mudaram entre as telas).

- [ ] **Step 5: Commit de encerramento + push**

```bash
git add -p  # revisar resíduos
git commit -m "chore(spec2): design system Reino completo — tokens, fontes, ícones, 8 componentes, lint anti-hex" --allow-empty
git push
```

---

## Resumo das decisões de design

| Decisão | Justificativa |
|---|---|
| Aliases de compat em vez de rename direto | As 11 telas referenciam `theme.colors.background/primary/hp/...`; aliases dão o visual novo sem editar tela (migração incremental, removidos em SPEC 3) |
| `Record<keyof typeof darkColors, string>` no provider | `as const` rejeitaria `lightColors` (mesmas chaves, hex diferentes); o `Record` aceita ambas sem regredir o tsc |
| Lint rodado **após** migrar os hex | Rodá-lo antes falharia de cara; a base limpa primeiro, depois o lint trava a regressão |
| Fontes `.ttf` locais (OFL) e não `@expo-google-fonts` | Pesos exatos, sem dependência por família; Cinzel embarca só 3 pesos usados |
| `<Icon>` retorna `null` para nome desconhecido | Degrada sem crash (caminho de UI confiável, sem error-handling preventivo) |
| Vitrine fora da navegação de produção | Valida o DS sem poluir o app real; não embarca |
| Critério tsc = delta ≤ 0, não "0 absoluto" | Os ~14 erros restantes são de SPEC 1 (offline/hp/Audio/textShadow/style); este SPEC só responde pelos seus (vector-icons, warning, accent) |
| `rgba()` neutros não migrados | O lint barra `#rrggbb`; overlays `rgba()` de baixa opacidade são neutros, fora do escopo de cor de marca |
