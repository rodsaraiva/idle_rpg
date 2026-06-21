# Redesign de Telas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar o Design System "Reino" (SPEC 2) em todas as 11 telas — trocar `ScreenHeader`→`Banner`, emoji→`<Icon>`, cards crus→`Card`/`OrnateFrame`, hex inline→token semântico — transformar a Vila numa cena-mapa interativa com `village_map.png`, adicionar microinterações (Reanimated v4 + Lottie) e estados vazios polidos, e ao final remover os `compatAliases`/`fontSize`/`fontWeight` legados do `theme`.

**Architecture:** SPEC 3 não cria componentes de identidade (esses são de SPEC 2). Cria 4 componentes redutores de duplicação de tela (`ScreenContainer`, `AnimatedGold`, `Shimmer`, `PressableScale`) e reescreve `VillageScreen` como `ImageBackground` + 8 hotspots por coordenada relativa. Cada tela migra para o "molde Reino" num commit coerente, da mais visitada para a menos, terminando na tab bar, estados vazios e na remoção dos aliases legados do `theme`. Nenhum handler, hook, reducer ou regra de jogo é tocado — só a camada de apresentação.

**Tech Stack:** TypeScript, React Native (Expo 54, RN 0.81), `react-native-reanimated` ~4.1, `lottie-react-native` ~7.3, `react-native-svg` ~15.12; Jest (`jest.unit.config.js`, `ts-jest`, `--runInBand`) com `react-native`/`reanimated`/`lottie` mockados; Playwright sobre `expo start --web` para validação de UI. **Dependências de SPEC 2 (instaladas por SPEC 2, não aqui):** `@expo/vector-icons`, `expo-font`, `expo-linear-gradient`.

## Global Constraints

- Idioma de todo conteúdo de usuário e comentários: **pt-BR** (identificadores de código em inglês onde já é a convenção do projeto).
- `npx tsc --noEmit`: delta de erros **≤ 0** vs. baseline pós-SPEC 2 (não regride).
- `npm test` (= `jest --config jest.unit.config.js`): **verde**, sem novas falhas; coverage não regride.
- Alvo de plataforma: **mobile nativo (iOS/Android via Expo)**; web é alvo de dev/teste. Nada de estilo web-only que quebre boot mobile.
- **Sem gold passivo:** gold só vem de missão completada. Microinteração de "novidade" lê estado existente, nunca credita gold.
- **DEF/CRIT/AGI não-treináveis:** `HeroCard` exibe os secundários como leitura, **sem** botão de treino. Só HP/ATK/MP têm controle de treino.
- **Nenhuma mudança de regra/fluxo/balanço:** nenhum reducer novo, nenhum campo de save novo, nenhum handler/hook tocado. Só apresentação.
- **0 hex inline** em `src/screens` + `src/components` ao fim do redesign (todo `#rrggbb`/`rgba(...)` de tela vira token).
- **0 emoji como ícone** em `src/screens` + `HeroCard`/`CombatantCard`/`GoldDisplay`/`ShopScreen` ao fim (todos via `<Icon>`).
- Validação de UI por **screenshot no browser/emulador** antes de declarar cada tela pronta (convenção do projeto).

---

## ⚠️ Pré-condição bloqueante: SPEC 2 (Design System "Reino")

**Este plano consome o SPEC 2 e NÃO pode começar antes de ele estar mergeado.** Verificação feita em 2026-06-20 contra o código atual (`src/theme/index.ts`, `src/components/ui/`, `package.json`):

| Artefato do SPEC 2 que SPEC 3 consome | Existe hoje? |
|---|---|
| `theme.colors` couro/ouro (`bgBase`, `bgDeep`, `surfaceRaised`, `statHp`, `statAtk`, `statMp`, `statDef`, `borderGold`, `textMuted`, `rarityCommon`…`rarityLegendary`, `goldBright`, `glowGold`…) | ❌ Não (theme atual é navy: `background`, `surface`, `hp`, `atk`, `mp`, `primary`) |
| `theme.type` (tokens compostos `display`/`h1`/`h2`/`bodyLg`/`body`/`label`/`caption`/`stat`) | ❌ Não (só `fontSize`/`fontWeight` soltos) |
| `theme.elevation` (`e0`…`e4`, glows) | ❌ Não |
| `theme.rarity` | ❌ Não |
| `theme.compatAliases` (background→bgBase, hp→statHp…) | ❌ Não (a ser entregue por SPEC 2 §3.6 para a transição) |
| `<Icon>` (MaterialCommunityIcons + SVG custom), tipo `IconName` | ❌ Não |
| `<Banner>`, `<Button>`, `<Card>`, `<OrnateFrame>`, `<Seal>`, `<Divider>`, `<Parchment>` em `src/components/ui/` | ❌ Não (só `ScreenHeader`, `EmptyState`, `ComingSoon`, `LoadingScreen`) |
| deps `@expo/vector-icons`, `expo-font`, `expo-linear-gradient` no `package.json` | ❌ Não |

**Consequência prática para o executor:** antes de começar a Task 1, rode o **Gate de Pré-condição** abaixo. Se ele falhar, **PARE** — o trabalho a fazer é SPEC 2, não SPEC 3.

```bash
# Gate de pré-condição SPEC 2 — rode da raiz /root/rodrigo/idle_rpg
node -e "const t=require('./src/theme').theme; const need=['bgBase','bgDeep','surfaceRaised','statHp','statAtk','statMp','statDef','borderGold','goldBright']; const miss=need.filter(k=>!(k in t.colors)); if(miss.length){console.error('FALTAM cores SPEC2:',miss);process.exit(1)} if(!t.type||!t.elevation||!t.rarity){console.error('FALTA theme.type/elevation/rarity (SPEC2)');process.exit(1)} console.log('theme SPEC2 OK')"
ls src/components/ui/Banner.tsx src/components/ui/Card.tsx src/components/ui/Icon.tsx src/components/ui/Seal.tsx src/components/ui/OrnateFrame.tsx
node -e "require('@expo/vector-icons'); require('expo-linear-gradient'); console.log('deps SPEC2 OK')"
```
Esperado quando SPEC 2 está pronto: `theme SPEC2 OK`, os 5 arquivos listados sem erro, `deps SPEC2 OK`.
Se qualquer linha falhar: **SPEC 2 não está pronto — este plano não pode executar.**

> **Nota sobre os exemplos de código abaixo:** todo trecho que importa de `../theme` usa **tokens semânticos do SPEC 2** (`theme.colors.bgBase`, `theme.type.h2`, `theme.elevation.e1`, `theme.colors.statAtk`…) e de `./ui/Icon` usa o tipo `IconName` e o componente `<Icon>` do SPEC 2. Esses nomes são contratos de SPEC 2; se SPEC 2 renomear algum, ajuste o `import`/uso — mas o Gate acima garante que os nomes-chave existem.

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/components/ui/PressableScale.tsx` | Create | Press-feedback de escala universal (Reanimated). Base de hotspots e cards tappáveis. |
| `src/components/ui/Shimmer.tsx` | Create | Placeholder de loading com gradiente deslizante. |
| `src/components/AnimatedGold.tsx` | Create | `GoldDisplay` com count-up animado + pulso + `<Icon name="gold-coin">`. Drop-in no `right` do `Banner`. |
| `src/components/ui/ScreenContainer.tsx` | Create | SafeArea + StatusBar + fundo `bgBase` + textura opcional + transição de entrada. Absorve boilerplate das 11 telas. |
| `src/screens/VillageScreen.tsx` | Modify (reescrita) | `ImageBackground(VILLAGE_MAP)` + 8 hotspots por coordenada relativa + fallback grid. |
| `src/constants/assets.ts` | Modify | `LOTTIE_ASSETS` += `LEVEL_UP`/`FORGE_COMPLETE`/`RECRUIT`. |
| `assets/lottie/level_up.json`, `forge_complete.json`, `recruit.json` | Create | 3 animações Lottie de licença permissiva. |
| `src/components/HeroCard.tsx` | Modify | Emoji de stat→`<Icon>`; `boxShadow`→`Card`/`elevation.e1`; `TASK_LABEL_MAP` emoji→`<Icon>`; tokens `hp/atk/mp`→`statHp/statAtk/statMp`. Secundários read-only. |
| `src/components/CombatantCard.tsx` | Modify (só emoji) | 3 Texts de stat `⚔️🔮🛡️`→`<Icon>`. Animação `Animated` legada intocada. |
| `src/components/GoldDisplay.tsx` | Modify (deprecar) | Vira thin wrapper re-export de `AnimatedGold` até call sites migrarem. |
| `src/screens/GuildScreen.tsx` | Modify | `ScreenContainer`+`Banner`; emoji `⚔️💤`→`<Icon>`; `AnimatedGold`; `EmptyState` polido; Lottie recruit. |
| `src/components/GuildEmptyState.tsx` | Modify | Usa `EmptyState` polido. |
| `src/screens/MissionsScreen.tsx` | Modify | `ScreenContainer`+`Banner`; `fontWeight:'800'`→`theme.type.h2`; heroGrid vazio→`EmptyState`; `AnimatedGold`. |
| `src/components/MissionResultModal.tsx` | Modify | Header/título em `theme.type`; emoji `🏆💀💀✨❤️`→`<Icon>`; mantém Lottie confetti e engine `Animated`. |
| `src/screens/TrainingScreen.tsx` | Modify | `ScreenContainer`+`Banner`; `boxShadow`→`Card`; `BatchButton` emoji→`<Icon>`; estado vazio→`EmptyState`; `AnimatedGold`. |
| `src/screens/BlacksmithScreen.tsx` | Modify | `ScreenContainer`+`Banner`; `TYPE_ICONS` emoji→`<Icon>`; cards→`Card rarity`; Lottie forge no "Pronto para Coletar"; `EmptyState`; `AnimatedGold`. |
| `src/screens/ShopScreen.tsx` | Modify | `ScreenContainer`+`Banner`; `infoBox` rgba→token; emoji `💎🥈🎁`→`<Icon>`; `AnimatedGold`; Lottie recruit. |
| `src/screens/EnfermariaScreen.tsx` | Modify | `ScreenContainer`+`Banner`; `boxShadow`→`Card`; `emptyCard` rgba→token; `AnimatedGold`. |
| `src/screens/DailyQuestsScreen.tsx` | Modify | `ScreenContainer`+`Banner`; `'#1a1a1a'`→`colors.bgDeep`; cards→`Card`; `EmptyState`; `AnimatedGold`. |
| `src/screens/WeeklyScreen.tsx` | Modify | `ScreenContainer`+`Banner`; `'#1a1a1a'`→`colors.bgDeep`; `fontWeight:'800'`→token; `ComingSoon` na seção em breve; `AnimatedGold`. |
| `src/screens/PantheonScreen.tsx` | Modify | `ScreenContainer`+`Banner`; cards→`Card`/`OrnateFrame`; `<Seal kind=ClassId>` na fusão; `AnimatedGold`. |
| `src/screens/AchievementsScreen.tsx` | Modify | `ScreenContainer`+`Banner`; cards→`Card`; `<Icon name="trophy">`; conquista bloqueada via `Seal locked`. |
| `src/components/ui/EmptyState.tsx` | Modify | `icon: string`→`IconName` (`<Icon>` 64px); tipografia em `theme.type`; prop `lottie?` opcional. |
| `src/components/ui/ComingSoon.tsx` | Modify | Emoji→`<Icon>`; `fontWeight:'900'`→`theme.type.label`; reabilitado. |
| `src/components/ui/LoadingScreen.tsx` | Modify | Usa `<Shimmer>` no lugar do `ActivityIndicator`. |
| `src/navigation/AppNavigator.tsx` | Modify | `Ionicons`→`<Icon>`/MaterialCommunityIcons medieval; tint ativo `gold`, inativo `textMuted`; `tabBarStyle` `surfaceRaised`+`borderGold`+`elevation`. |
| `src/components/ui/ScreenHeader.tsx` | Modify (fim) | Vira re-export de `Banner` até grep confirmar 0 imports, então deletar. |
| `src/theme/index.ts` | Modify (fim) | Remove `compatAliases` e `fontSize`/`fontWeight` legados — só após 0 referências. |
| `src/__tests__/components/PressableScale.test.tsx` | Create | Smoke + encaminha `onPress`. |
| `src/__tests__/components/Shimmer.test.tsx` | Create | Smoke render. |
| `src/__tests__/components/AnimatedGold.test.tsx` | Create | Render de `formatNumber(gold)`; convergência ao mudar; `gold=0`. |
| `src/__tests__/constants/assets.test.ts` | Create | `LOTTIE_ASSETS` tem 6 chaves resolvíveis; `IMAGE_ASSETS.VILLAGE_MAP` resolve. |
| `src/__tests__/screens/VillageScreen.test.tsx` | Create | 8 hotspots = conjunto de rotas exato; tap→`navigate`; fallback grid no `onError`. |
| `src/__tests__/components/HeroCard.test.tsx` | Create | Regra: sem treino de DEF/CRIT/AGI; secundários como leitura. |
| `src/__tests__/components/EmptyState.test.tsx` | Create | Aceita `IconName`, renderiza `<Icon>` (não `<Text>` emoji); `lottie` monta `LottieView`. |
| `src/__tests__/navigation/AppNavigator.tabicons.test.ts` | Create | `TAB_ICONS` cobre as 5 rotas visíveis. |

> Convenção de teste (confirmada em `src/__tests__/hooks/useShop.test.tsx`): `@testing-library/react-native` (`render`/`renderHook`/`act`), `GameContext.Provider` com `initialGameState`, `jest.mock('@react-navigation/native', …)`. `react-native`, `react-native-reanimated`, `lottie-react-native` são mockados via `jest.unit.config.js` (`moduleNameMapper`). Integração>mock vale para DB/persistência (não há aqui); engines de animação são libs de plataforma — testa-se a **lógica** (navegação, convergência do count-up, resolução de assets).

---

## Task 1: `PressableScale` — press-feedback universal

**Files:**
- Create: `src/components/ui/PressableScale.tsx`
- Create: `src/__tests__/components/PressableScale.test.tsx`

**Interfaces:**
- Consumes: `react-native-reanimated` (mockado em teste); `react-native` `Pressable`.
- Produces: `PressableScale` (default + named export), `interface PressableScaleProps extends PressableProps { scaleTo?: number; children: React.ReactNode; }` (`scaleTo` default `0.96`). Consumido por Task 5 (hotspots) e telas com cards tappáveis.

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/__tests__/components/PressableScale.test.tsx`:

```tsx
import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { PressableScale } from '../../components/ui/PressableScale';

describe('PressableScale', () => {
  test('renderiza children', () => {
    const { getByText } = render(
      <PressableScale onPress={() => {}}>
        <Text>toque</Text>
      </PressableScale>
    );
    expect(getByText('toque')).toBeTruthy();
  });

  test('encaminha onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <PressableScale onPress={onPress}>
        <Text>toque</Text>
      </PressableScale>
    );
    fireEvent.press(getByText('toque'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- --testPathPattern=PressableScale.test`
Expected: FAIL com `Cannot find module '../../components/ui/PressableScale'`.

- [ ] **Step 3: Implementar `PressableScale`**

Criar `src/components/ui/PressableScale.tsx`:

```tsx
import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

export interface PressableScaleProps extends PressableProps {
  scaleTo?: number;
  children: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  scaleTo = 0.96,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      style={animatedStyle}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, { damping: 15, stiffness: 200 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

export default PressableScale;
```

> O stub de `react-native-reanimated` (`jest.unit.config.js`) retorna `{}`; em teste, `useSharedValue`/`useAnimatedStyle`/`withSpring`/`Animated.createAnimatedComponent` ficam `undefined`. Se o smoke quebrar por isso, adicionar um mock manual no topo do teste:
> ```tsx
> jest.mock('react-native-reanimated', () => ({
>   __esModule: true,
>   default: { createAnimatedComponent: (c: any) => c },
>   useSharedValue: (v: any) => ({ value: v }),
>   useAnimatedStyle: (fn: any) => fn(),
>   withSpring: (v: any) => v,
> }));
> ```
> Inclua esse `jest.mock` no Step 1 do teste deste task (e reutilize o mesmo padrão em Tasks 2, 3, 5, 6 que usam Reanimated).

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npm test -- --testPathPattern=PressableScale.test`
Expected: PASS (2 testes).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem novos erros.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/PressableScale.tsx src/__tests__/components/PressableScale.test.tsx
git commit -m "feat(ui): PressableScale — press-feedback de escala com Reanimated

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `Shimmer` — placeholder de loading

**Files:**
- Create: `src/components/ui/Shimmer.tsx`
- Create: `src/__tests__/components/Shimmer.test.tsx`

**Interfaces:**
- Consumes: `react-native-reanimated`; `expo-linear-gradient` (SPEC 2 instala); `theme.colors.surfaceRaised`, `theme.borderRadius`.
- Produces: `Shimmer` (named export), `interface ShimmerProps { width?: number | string; height: number; radius?: keyof typeof theme.borderRadius; }`. Consumido por Task 22 (`LoadingScreen`).

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/__tests__/components/Shimmer.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { Shimmer } from '../../components/ui/Shimmer';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: (props: any) => require('react').createElement('Animated.View', props, props.children) },
  useSharedValue: (v: any) => ({ value: v }),
  useAnimatedStyle: (fn: any) => fn(),
  withRepeat: (v: any) => v,
  withTiming: (v: any) => v,
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: (props: any) => require('react').createElement('LinearGradient', props, props.children),
}));

describe('Shimmer', () => {
  test('renderiza sem throw', () => {
    const { toJSON } = render(<Shimmer height={16} />);
    expect(toJSON()).toBeTruthy();
  });

  test('aceita width e radius', () => {
    const { toJSON } = render(<Shimmer width={120} height={20} radius="md" />);
    expect(toJSON()).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- --testPathPattern=Shimmer.test`
Expected: FAIL com `Cannot find module '../../components/ui/Shimmer'`.

- [ ] **Step 3: Implementar `Shimmer`**

Criar `src/components/ui/Shimmer.tsx`:

```tsx
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../../theme';

interface ShimmerProps {
  width?: number | string;
  height: number;
  radius?: keyof typeof theme.borderRadius;
}

export function Shimmer({ width = '100%', height, radius = 'md' }: ShimmerProps) {
  const offset = useSharedValue(-1);

  useEffect(() => {
    offset.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );
  }, [offset]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${offset.value * 100}%` }],
  }));

  return (
    <View
      style={[
        styles.base,
        { width: width as any, height, borderRadius: theme.borderRadius[radius] },
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            theme.colors.borderGold,
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.surfaceRaised,
    overflow: 'hidden',
  },
});
```

> `'transparent'` é uma keyword CSS válida, não um hex inline — não viola o lint anti-hex do SPEC 2.

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npm test -- --testPathPattern=Shimmer.test`
Expected: PASS (2 testes).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem novos erros.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Shimmer.tsx src/__tests__/components/Shimmer.test.tsx
git commit -m "feat(ui): Shimmer — placeholder de loading com gradiente deslizante

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `AnimatedGold` — count-up de ouro

**Files:**
- Create: `src/components/AnimatedGold.tsx`
- Create: `src/__tests__/components/AnimatedGold.test.tsx`

**Interfaces:**
- Consumes: `formatNumber` de `src/utils/math` (assinatura: `formatNumber(n: number) => string`, ex.: `1200 → "1.2k"`); `react-native-reanimated`; `<Icon>` (`name="gold-coin"`); `theme.colors.gold`, `theme.colors.goldDark`, `theme.type.stat`.
- Produces: `AnimatedGold` (named + default export), `interface AnimatedGoldProps { gold: number; }`. API drop-in idêntica a `GoldDisplay`. Mantém `accessibilityLabel="Ouro da guilda: ${formatNumber}"`. Consumido por todas as telas (Tasks 7–18) e por Task 19 (`GoldDisplay` re-export).

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/__tests__/components/AnimatedGold.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { AnimatedGold } from '../../components/AnimatedGold';
import { formatNumber } from '../../utils/math';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { Text: (props: any) => require('react').createElement('Text', props, props.children) },
  useSharedValue: (v: any) => ({ value: v }),
  useAnimatedStyle: (fn: any) => fn(),
  useAnimatedProps: (fn: any) => fn(),
  useDerivedValue: (fn: any) => ({ value: fn() }),
  withTiming: (v: any) => v,
  withSequence: (...v: any[]) => v[v.length - 1],
  Easing: { out: (e: any) => e, cubic: 0 },
  createAnimatedComponent: (c: any) => c,
}));

jest.mock('../../components/ui/Icon', () => ({
  Icon: (props: any) => require('react').createElement('Icon', props),
}));

describe('AnimatedGold', () => {
  test('renderiza o valor formatado inicial', () => {
    const { getByText } = render(<AnimatedGold gold={1200} />);
    expect(getByText(formatNumber(1200))).toBeTruthy();
  });

  test('expõe accessibilityLabel com o ouro formatado', () => {
    const { getByLabelText } = render(<AnimatedGold gold={500} />);
    expect(getByLabelText(`Ouro da guilda: ${formatNumber(500)}`)).toBeTruthy();
  });

  test('reflete o novo total ao mudar a prop gold', () => {
    const { rerender, getByText } = render(<AnimatedGold gold={100} />);
    rerender(<AnimatedGold gold={250} />);
    expect(getByText(formatNumber(250))).toBeTruthy();
  });

  test('não quebra com gold=0', () => {
    const { getByText } = render(<AnimatedGold gold={0} />);
    expect(getByText(formatNumber(0))).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- --testPathPattern=AnimatedGold.test`
Expected: FAIL com `Cannot find module '../../components/AnimatedGold'`.

- [ ] **Step 3: Implementar `AnimatedGold`**

Criar `src/components/AnimatedGold.tsx`. O valor exibido é dirigido por `state` + `useDerivedValue` (compatível com web shim do Reanimated; evita `useAnimatedProps` em texto, mais arriscado no web — risco §7 do spec):

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { theme } from '../theme';
import { formatNumber } from '../utils/math';
import { Icon } from './ui/Icon';

interface AnimatedGoldProps {
  gold: number;
}

export function AnimatedGold({ gold }: AnimatedGoldProps) {
  const animated = useSharedValue(gold);
  const scale = useSharedValue(1);
  const [display, setDisplay] = useState(gold);

  useEffect(() => {
    if (gold > animated.value) {
      scale.value = withSequence(
        withTiming(1.12, { duration: 150 }),
        withTiming(1, { duration: 250 })
      );
    }
    animated.value = withTiming(gold, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [gold, animated, scale]);

  useDerivedValue(() => {
    runOnJS(setDisplay)(Math.floor(animated.value));
  }, [animated]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.container, scaleStyle]}>
      <View style={styles.iconCircle}>
        <Icon name="gold-coin" size={14} color={theme.colors.bgDeep} />
      </View>
      <Text
        style={styles.value}
        accessibilityLabel={`Ouro da guilda: ${formatNumber(gold)}`}
        accessible
      >
        {formatNumber(display)}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    paddingRight: 12,
    paddingLeft: 4,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.goldDark,
    alignSelf: 'flex-end',
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  value: {
    ...theme.type.stat,
    fontSize: 16,
    color: theme.colors.gold,
    textAlign: 'right',
  },
});
```

> **`accessibilityLabel` usa `formatNumber(gold)` (prop, valor final), não `display`** — o teste de convergência assevera o total final; o número visível anima até lá. Se a sua versão do SPEC 2 nomear o coin-icon diferente de `'gold-coin'` (ver `IconName`), use o nome correto.

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npm test -- --testPathPattern=AnimatedGold.test`
Expected: PASS (4 testes).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem novos erros.

- [ ] **Step 6: Commit**

```bash
git add src/components/AnimatedGold.tsx src/__tests__/components/AnimatedGold.test.tsx
git commit -m "feat(ui): AnimatedGold — count-up de ouro com pulso, drop-in do GoldDisplay

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `ScreenContainer` — wrapper de tela

**Files:**
- Create: `src/components/ui/ScreenContainer.tsx`

**Interfaces:**
- Consumes: `react-native-reanimated` (`FadeIn`); `react-native-safe-area-context` (`useSafeAreaInsets`); `<Parchment>` (SPEC 2, para `texture="leather"`); `theme.colors.bgBase`, `theme.colors.bgDeep`.
- Produces: `ScreenContainer` (named export), `interface ScreenContainerProps { children: React.ReactNode; scroll?: boolean; banner?: React.ReactNode; texture?: 'leather' | 'none'; }`. Consumido por Tasks 7–18.

- [ ] **Step 1: Implementar `ScreenContainer` (UI pura — sem teste unit, validação por screenshot na 1ª tela que o usa, Task 7)**

Criar `src/components/ui/ScreenContainer.tsx`:

```tsx
import React from 'react';
import { View, ScrollView, StatusBar, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { Parchment } from './Parchment';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  banner?: React.ReactNode;
  texture?: 'leather' | 'none';
}

export function ScreenContainer({
  children,
  scroll = true,
  banner,
  texture = 'none',
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.viewContent]}>{children}</View>
  );

  const content = (
    <Animated.View style={styles.flex} entering={FadeInDown.duration(280)}>
      {banner}
      {body}
    </Animated.View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.bgDeep} />
      {texture === 'leather' ? <Parchment style={StyleSheet.absoluteFill} /> : null}
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgBase,
  },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  viewContent: {
    paddingHorizontal: theme.spacing.md,
  },
});
```

> Risco §7 (Reanimated `entering` no web): se a transição `FadeInDown` falhar no web, degradar trocando `Animated.View entering={...}` por um `View` simples (fade já é suave o bastante; a Task 7 valida no browser e decide).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem novos erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ScreenContainer.tsx
git commit -m "feat(ui): ScreenContainer — wrapper de tela com SafeArea, textura e transição de entrada

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Ampliar `LOTTIE_ASSETS` e testar resolução de assets

**Files:**
- Create: `assets/lottie/level_up.json`, `assets/lottie/forge_complete.json`, `assets/lottie/recruit.json`
- Modify: `src/constants/assets.ts`
- Create: `src/__tests__/constants/assets.test.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces: `LOTTIE_ASSETS` com 6 chaves: `CHEST_PULSE`, `CONFETTI`, `SPARKLE_BURST`, `LEVEL_UP`, `FORGE_COMPLETE`, `RECRUIT`. Consumido por Task 9 (recruit), Task 12 (forge), Task 13 (recruit).

> **Gap conhecido — `LEVEL_UP` fica registrado mas sem disparo (decisão deliberada):** o spec §3.4 lista "Level-up → Lottie `level_up` sobre o `HeroCard`", mas o código atual **não tem conceito de nível** — heróis não têm campo `level` e nenhum evento de "subir de nível" é emitido (treino sobe stats direto via `trainingCount`). Forçar um disparo exigiria inventar um evento/regra novo, o que viola a Global Constraint "só apresentação, nenhum evento novo". Portanto: **registramos `LEVEL_UP` no `LOTTIE_ASSETS`** (asset pronto para uso), mas **não conectamos disparo** — ele será ligado por quem introduzir o sistema de nível (SPEC 7 / conteúdo). Os outros dois (`FORGE_COMPLETE`, `RECRUIT`) têm site real e são disparados.

- [ ] **Step 1: Adicionar os 3 `.json` Lottie**

Baixar 3 animações de licença permissiva (LottieFiles free / CC0) e salvá-las como `assets/lottie/level_up.json`, `assets/lottie/forge_complete.json`, `assets/lottie/recruit.json`. Cada arquivo deve ser um JSON Lottie válido (chaves `v`, `fr`, `ip`, `op`, `layers`). Validar:

```bash
for f in level_up forge_complete recruit; do
  node -e "const a=require('./assets/lottie/$f.json'); if(!a.v||!Array.isArray(a.layers)){console.error('INVÁLIDO: $f');process.exit(1)} console.log('$f OK', a.layers.length,'layers')"
done
```
Expected: `level_up OK …`, `forge_complete OK …`, `recruit OK …`.

> Se não houver acesso a download, gerar um Lottie mínimo válido (1 layer, op>ip) como placeholder e marcar para troca de asset — a Task não bloqueia, e o teste só exige resolução.

- [ ] **Step 2: Escrever o teste falhando**

Criar `src/__tests__/constants/assets.test.ts`:

```ts
import { LOTTIE_ASSETS, IMAGE_ASSETS } from '../../constants/assets';

describe('assets', () => {
  test('LOTTIE_ASSETS tem as 6 chaves esperadas', () => {
    expect(Object.keys(LOTTIE_ASSETS).sort()).toEqual(
      ['CHEST_PULSE', 'CONFETTI', 'FORGE_COMPLETE', 'LEVEL_UP', 'RECRUIT', 'SPARKLE_BURST'].sort()
    );
  });

  test('cada Lottie resolve (require não-nulo)', () => {
    for (const key of Object.keys(LOTTIE_ASSETS)) {
      expect((LOTTIE_ASSETS as Record<string, unknown>)[key]).toBeTruthy();
    }
  });

  test('IMAGE_ASSETS.VILLAGE_MAP resolve', () => {
    expect(IMAGE_ASSETS.VILLAGE_MAP).toBeTruthy();
  });
});
```

- [ ] **Step 3: Rodar o teste para confirmar que falha**

Run: `npm test -- --testPathPattern=assets.test`
Expected: FAIL na 1ª asserção — `LOTTIE_ASSETS` tem 3 chaves, não 6.

- [ ] **Step 4: Atualizar `src/constants/assets.ts`**

Substituir o objeto `LOTTIE_ASSETS` por:

```ts
export const LOTTIE_ASSETS = {
  CHEST_PULSE: require('../../assets/lottie/chest_pulse.json'),
  CONFETTI: require('../../assets/lottie/confetti.json'),
  SPARKLE_BURST: require('../../assets/lottie/sparkle_burst.json'),
  LEVEL_UP: require('../../assets/lottie/level_up.json'),
  FORGE_COMPLETE: require('../../assets/lottie/forge_complete.json'),
  RECRUIT: require('../../assets/lottie/recruit.json'),
};
```

- [ ] **Step 5: Rodar o teste para confirmar que passa**

Run: `npm test -- --testPathPattern=assets.test`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add src/constants/assets.ts assets/lottie/level_up.json assets/lottie/forge_complete.json assets/lottie/recruit.json src/__tests__/constants/assets.test.ts
git commit -m "feat(assets): +3 Lottie (level_up, forge_complete, recruit) e teste de resolução

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `VillageScreen` → cena-mapa interativa (âncora do spec)

**Files:**
- Modify (reescrita): `src/screens/VillageScreen.tsx`
- Create: `src/__tests__/screens/VillageScreen.test.tsx`

**Interfaces:**
- Consumes: `IMAGE_ASSETS.VILLAGE_MAP` (650×379 PNG, ratio ~1.71); `useNavigation` (`navigate(screen)`); `<Icon>`/`IconName`, `<Seal>`, `<Card>`, `<Banner>` (SPEC 2); `PressableScale` (Task 1); `AnimatedGold` (Task 3); `useGame()` (para o pulse de novidade, leitura de `state.dailyQuests`/`state.achievements`).
- Produces: `VillageScreen` (named export) com `HOTSPOTS: Hotspot[]` (8 itens), `interface Hotspot { screen: string; icon: IconName; label: string; x: number; y: number; }`. Conjunto de `screen` = `{Treinamento, Enfermaria, Ferreiro, MissoesDiarias, Conquistas, Panteao, Semanal, Guilda}`.

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/__tests__/screens/VillageScreen.test.tsx`. Mocka navegação, `<Icon>`/`<Seal>`/`<Banner>` e `AnimatedGold`; usa `GameContext.Provider`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VillageScreen, HOTSPOTS } from '../../screens/VillageScreen';
import { GameContext } from '../../context/GameContext';
import { initialGameState } from '../../context/gameReducer';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../components/AnimatedGold', () => ({
  AnimatedGold: (props: any) => require('react').createElement('AnimatedGold', props),
}));
jest.mock('../../components/ui/PressableScale', () => ({
  PressableScale: (props: any) => require('react').createElement('PressableScale', props, props.children),
}));
jest.mock('../../components/ui/Icon', () => ({
  Icon: (props: any) => require('react').createElement('Icon', props),
}));
jest.mock('../../components/ui/Seal', () => ({
  Seal: (props: any) => require('react').createElement('Seal', props, props.children),
}));
jest.mock('../../components/ui/Banner', () => ({
  Banner: (props: any) => require('react').createElement('Banner', { ...props }, props.right),
}));
jest.mock('../../components/ui/Card', () => ({
  Card: (props: any) => require('react').createElement('Card', props, props.children),
}));

function wrapper(children: React.ReactNode) {
  return (
    <GameContext.Provider value={{
      state: initialGameState as any,
      dispatch: jest.fn(),
      isLoaded: true,
      setHeroTask: jest.fn(),
      recruitHero: jest.fn(),
      offlineSummary: null,
      clearOfflineSummary: jest.fn(),
      applyOfflineSummary: jest.fn(),
    }}>
      {children}
    </GameContext.Provider>
  );
}

beforeEach(() => mockNavigate.mockClear());

describe('VillageScreen', () => {
  const ROTAS = ['Treinamento', 'Enfermaria', 'Ferreiro', 'MissoesDiarias', 'Conquistas', 'Panteao', 'Semanal', 'Guilda'];

  test('define exatamente 8 hotspots com o conjunto de rotas esperado', () => {
    expect(HOTSPOTS).toHaveLength(8);
    expect(HOTSPOTS.map((h) => h.screen).sort()).toEqual([...ROTAS].sort());
  });

  test('coordenadas relativas estão em 0..1', () => {
    for (const h of HOTSPOTS) {
      expect(h.x).toBeGreaterThanOrEqual(0);
      expect(h.x).toBeLessThanOrEqual(1);
      expect(h.y).toBeGreaterThanOrEqual(0);
      expect(h.y).toBeLessThanOrEqual(1);
    }
  });

  test('renderiza sem throw', () => {
    const { toJSON } = render(wrapper(<VillageScreen />));
    expect(toJSON()).toBeTruthy();
  });

  test('tap em cada hotspot navega para a rota correta', () => {
    const { getByTestId } = render(wrapper(<VillageScreen />));
    for (const h of HOTSPOTS) {
      mockNavigate.mockClear();
      fireEvent.press(getByTestId(`hotspot-${h.screen}`));
      expect(mockNavigate).toHaveBeenCalledWith(h.screen);
    }
  });

  test('com erro de imagem, renderiza o fallback grid sem perder navegação', () => {
    const { getByTestId, getAllByTestId } = render(wrapper(<VillageScreen />));
    fireEvent(getByTestId('village-map-image'), 'error');
    // fallback expõe um botão por rota
    expect(getAllByTestId(/^fallback-/)).toHaveLength(8);
    fireEvent.press(getByTestId('fallback-Ferreiro'));
    expect(mockNavigate).toHaveBeenCalledWith('Ferreiro');
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- --testPathPattern=VillageScreen.test`
Expected: FAIL — `HOTSPOTS` não é exportado / componente ainda é a lista antiga.

- [ ] **Step 3: Reescrever `src/screens/VillageScreen.tsx`**

Substituir o conteúdo completo do arquivo:

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  StatusBar,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import { IMAGE_ASSETS } from '../constants/assets';
import { Banner } from '../components/ui/Banner';
import { Card } from '../components/ui/Card';
import { Seal } from '../components/ui/Seal';
import { Icon, IconName } from '../components/ui/Icon';
import { PressableScale } from '../components/ui/PressableScale';
import { AnimatedGold } from '../components/AnimatedGold';
import { useGame } from '../hooks/useGame';

export interface Hotspot {
  screen: string;
  icon: IconName;
  label: string;
  x: number; // 0..1 relativo à largura do mapa
  y: number; // 0..1 relativo à altura do mapa
}

// Coordenadas provisórias — calibrar sobre village_map.png real por screenshot (§3.3 do spec).
export const HOTSPOTS: Hotspot[] = [
  { screen: 'Treinamento', icon: 'sword', label: 'Treinamento', x: 0.22, y: 0.4 },
  { screen: 'Enfermaria', icon: 'medical-bag', label: 'Enfermaria', x: 0.5, y: 0.3 },
  { screen: 'Ferreiro', icon: 'anvil', label: 'Ferreiro', x: 0.78, y: 0.42 },
  { screen: 'MissoesDiarias', icon: 'scroll', label: 'Missões Diárias', x: 0.3, y: 0.68 },
  { screen: 'Conquistas', icon: 'trophy', label: 'Conquistas', x: 0.55, y: 0.72 },
  { screen: 'Panteao', icon: 'bank', label: 'Panteão', x: 0.8, y: 0.7 },
  { screen: 'Semanal', icon: 'calendar-star', label: 'Desafio Semanal', x: 0.15, y: 0.55 },
  { screen: 'Guilda', icon: 'shield-crown', label: 'Guilda', x: 0.65, y: 0.5 },
];

export function VillageScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { state } = useGame();
  const [imageFailed, setImageFailed] = useState(false);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

  const hasDailyNovelty = (state.dailyQuests?.quests ?? []).some(
    (q: any) => q.completed && !q.claimed
  );

  const onMapLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMapSize({ width, height });
  };

  const renderHotspot = (h: Hotspot) => {
    const left = h.x * mapSize.width;
    const top = h.y * mapSize.height;
    const novelty = h.screen === 'MissoesDiarias' && hasDailyNovelty;
    return (
      <PressableScale
        key={h.screen}
        testID={`hotspot-${h.screen}`}
        onPress={() => nav.navigate(h.screen)}
        style={[styles.hotspot, { left, top }]}
      >
        <Seal size={48} glow={novelty}>
          <Icon name={h.icon} size={24} color={theme.colors.goldBright} />
        </Seal>
        <Text style={styles.hotspotLabel}>{h.label}</Text>
      </PressableScale>
    );
  };

  const renderFallback = () => (
    <View style={styles.fallbackGrid}>
      {HOTSPOTS.map((h) => (
        <PressableScale
          key={h.screen}
          testID={`fallback-${h.screen}`}
          onPress={() => nav.navigate(h.screen)}
        >
          <Card elevation="e1">
            <View style={styles.fallbackRow}>
              <Icon name={h.icon} size={28} color={theme.colors.goldBright} />
              <Text style={styles.fallbackLabel}>{h.label}</Text>
            </View>
          </Card>
        </PressableScale>
      ))}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.bgDeep} />
      <Banner
        title="Vila de Ouro"
        subtitle="O coração da sua guilda"
        right={<AnimatedGold gold={state.gold} />}
      />
      {imageFailed ? (
        renderFallback()
      ) : (
        <ImageBackground
          testID="village-map-image"
          source={IMAGE_ASSETS.VILLAGE_MAP}
          resizeMode="cover"
          style={styles.map}
          onLayout={onMapLayout}
          onError={() => setImageFailed(true)}
        >
          {mapSize.width > 0 ? HOTSPOTS.map(renderHotspot) : null}
        </ImageBackground>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgBase,
  },
  map: {
    flex: 1,
    margin: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  hotspot: {
    position: 'absolute',
    alignItems: 'center',
    width: 64,
    marginLeft: -32,
    marginTop: -24,
  },
  hotspotLabel: {
    ...theme.type.caption,
    color: theme.colors.textPrimary,
    marginTop: 2,
    textAlign: 'center',
  },
  fallbackGrid: {
    flex: 1,
    padding: theme.spacing.md,
    gap: 12,
  },
  fallbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  fallbackLabel: {
    ...theme.type.h2,
    color: theme.colors.textPrimary,
  },
});
```

> O `<Seal>`/`<Card>`/`<Banner>` do SPEC 2 podem ter props diferentes de `glow`/`size`/`elevation`/`title`/`subtitle`/`right`. O Banner já é compatível com `title`/`subtitle`/`right` por design (SPEC 2 §3.9). Ajuste props de `Seal`/`Card` ao contrato real do SPEC 2 se divergir; o teste mocka esses componentes, então a navegação e a contagem de hotspots permanecem verdes independente da prop exata.
> A leitura `state.dailyQuests?.quests` é defensiva (`?.` + `?? []`) — se o shape real do estado de daily quests divergir, ajuste o seletor; é só dica visual (risco §7: nunca altera economia).

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npm test -- --testPathPattern=VillageScreen.test`
Expected: PASS (5 testes).

- [ ] **Step 5: Type-check + suíte completa**

Run: `npx tsc --noEmit && npm test`
Expected: tsc sem novos erros; suíte verde.

- [ ] **Step 6: Validar UI e calibrar coordenadas no browser**

```bash
pkill -f "expo start" 2>/dev/null; nohup npx expo start --web --port 8081 > /tmp/expo-village.log 2>&1 & disown
```
Abrir `http://localhost:8081` (Playwright), navegar até a Vila e tirar screenshot. Checar: mapa renderiza; 8 selos visíveis; tap navega; sem flash branco. **Calibrar os `x/y` de `HOTSPOTS`** posicionando cada selo sobre o edifício correspondente na arte; repetir screenshot até alinhar. Simular erro de imagem (renomear `village_map.png` temporariamente ou mockar) e confirmar o fallback grid. Arquivar screenshot como evidência.

- [ ] **Step 7: Commit**

```bash
git add src/screens/VillageScreen.tsx src/__tests__/screens/VillageScreen.test.tsx
git commit -m "feat(village): Vila vira cena-mapa interativa com 8 hotspots e fallback grid

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `HeroCard` — emoji→Icon, Card, tokens (preserva regra DEF/CRIT/AGI)

**Files:**
- Modify: `src/components/HeroCard.tsx` (`TASK_LABEL_MAP` :34-41; stat icons :156/161/169/172/176; `boxShadow` :250; tokens `theme.colors.hp/atk/mp`)
- Create: `src/__tests__/components/HeroCard.test.tsx`

**Interfaces:**
- Consumes: `<Icon>`/`IconName` (SPEC 2); `Card`/`elevation` (SPEC 2); `theme.colors.statHp/statAtk/statMp/statDef`, `theme.type`.
- Produces: `HeroCard` (sem mudança de API pública: `HeroCardProps`, `HeroCardAction` inalterados). Garante: `showSecondaryStats` continua exibindo DEF/CRIT/AGI **como leitura**, `defaultActions` continua só com HP/ATK/MP/Descansar.

- [ ] **Step 1: Escrever o teste falhando (regra de jogo)**

Criar `src/__tests__/components/HeroCard.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { HeroCard } from '../../components/HeroCard';
import { GameContext } from '../../context/GameContext';
import { initialGameState } from '../../context/gameReducer';
import { Hero, HeroTask } from '../../types';

jest.mock('../../components/ui/Icon', () => ({
  Icon: (props: any) => require('react').createElement('Icon', props),
}));
jest.mock('../../components/ui/Card', () => ({
  Card: (props: any) => require('react').createElement('Card', props, props.children),
}));

function makeHero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 'h1', name: 'Aria', hpMax: 50, hpCurrent: 50, atk: 10, mp: 5,
    defense: 5, crit: 10, agility: 5, currentTask: HeroTask.IDLE,
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
    ...overrides,
  } as Hero;
}

function wrap(children: React.ReactNode) {
  return (
    <GameContext.Provider value={{
      state: initialGameState as any, dispatch: jest.fn(), isLoaded: true,
      setHeroTask: jest.fn(), recruitHero: jest.fn(), offlineSummary: null,
      clearOfflineSummary: jest.fn(), applyOfflineSummary: jest.fn(),
    }}>{children}</GameContext.Provider>
  );
}

describe('HeroCard — regra DEF/CRIT/AGI não-treináveis', () => {
  test('defaultActions só tem treino de HP/ATK/MP (+ Descansar), nunca DEF/CRIT/AGI', () => {
    const { queryByText } = render(
      wrap(<HeroCard hero={makeHero()} onSetTask={jest.fn()} />)
    );
    expect(queryByText('Treinar HP')).toBeTruthy();
    expect(queryByText('Treinar ATK')).toBeTruthy();
    expect(queryByText('Treinar MP')).toBeTruthy();
    expect(queryByText(/Treinar DEF/i)).toBeNull();
    expect(queryByText(/Treinar CRIT/i)).toBeNull();
    expect(queryByText(/Treinar AGI/i)).toBeNull();
  });

  test('com showSecondaryStats, DEF/CRIT/AGI aparecem como leitura (accessibilityLabel)', () => {
    const { getByLabelText } = render(
      wrap(<HeroCard hero={makeHero({ defense: 7, crit: 12, agility: 4 })} showSecondaryStats />)
    );
    expect(getByLabelText('DEF 7')).toBeTruthy();
    expect(getByLabelText('CRIT 12%')).toBeTruthy();
    expect(getByLabelText('AGI 4')).toBeTruthy();
  });

  test('sem showSecondaryStats, não renderiza a linha de secundários', () => {
    const { queryByLabelText } = render(
      wrap(<HeroCard hero={makeHero()} showSecondaryStats={false} />)
    );
    expect(queryByLabelText(/^DEF /)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- --testPathPattern=HeroCard.test`
Expected: FAIL — `Cannot find module '../../components/ui/Icon'` (ainda não importado pelo HeroCard) ou erro de render. Após o mock, deve falhar só se a regra não estiver respeitada — aqui ela já está, então a falha será de import/compilação até o Step 3.

- [ ] **Step 3: Editar `HeroCard.tsx` — emoji→Icon, Card, tokens**

3a. Adicionar imports no topo (após linha 13, `import { HPBar } from './HPBar';`):

```tsx
import { Icon, IconName } from './ui/Icon';
import { Card } from './ui/Card';
```

3b. Substituir `TASK_LABEL_MAP` (linhas 34-41) por um mapa de `{ icon, label }`:

```tsx
const TASK_LABEL_MAP: Record<HeroTask, { icon: IconName; label: string }> = {
  [HeroTask.IDLE]: { icon: 'sleep', label: 'Ocioso' },
  [HeroTask.TRAIN_HP]: { icon: 'heart', label: 'Treinando HP' },
  [HeroTask.TRAIN_ATK]: { icon: 'sword', label: 'Treinando ATK' },
  [HeroTask.TRAIN_MP]: { icon: 'flask', label: 'Treinando MP' },
  [HeroTask.INFIRMARY]: { icon: 'medical-bag', label: 'Enfermaria' },
  [HeroTask.MISSION]: { icon: 'map-marker-path', label: 'Em Missão' },
};
```

3c. No `variant === 'compact'`, substituir `<Text style={styles.statusText}>{TASK_LABEL_MAP[hero.currentTask]}</Text>` (linha 80) por:

```tsx
          <View style={styles.statusRow}>
            <Icon name={TASK_LABEL_MAP[hero.currentTask].icon} size={12} color={theme.colors.textSecondary} />
            <Text style={styles.statusText}>{TASK_LABEL_MAP[hero.currentTask].label}</Text>
          </View>
```

3d. No header detalhado, substituir `<Text style={styles.taskBadge}>{TASK_LABEL_MAP[hero.currentTask]}</Text>` (linha 143) por:

```tsx
          <View style={styles.taskBadge}>
            <Icon name={TASK_LABEL_MAP[hero.currentTask].icon} size={11} color={theme.colors.textSecondary} />
            <Text style={styles.taskBadgeText}>{TASK_LABEL_MAP[hero.currentTask].label}</Text>
          </View>
```

3e. Substituir o stat ATK (linhas 155-158):

```tsx
        <View style={styles.statItem} accessibilityLabel={`ATK ${Math.floor(hero.atk)}`}>
          <Icon name="sword" size={14} color={theme.colors.statAtk} />
          <Text style={styles.statValue}>{Math.floor(hero.atk)}</Text>
        </View>
```

3f. Substituir o stat MP (linhas 160-163):

```tsx
        <View style={styles.statItem} accessibilityLabel={`MP ${Math.floor(hero.mp)}`}>
          <Icon name="flask" size={14} color={theme.colors.statMp} />
          <Text style={styles.statValue}>{Math.floor(hero.mp)}</Text>
        </View>
```

3g. Substituir os 3 secundários DEF/CRIT/AGI (linhas 168-179) — **read-only, sem botão** (regra preservada):

```tsx
          <View style={styles.statItem} accessibilityLabel={`DEF ${Math.floor(hero.defense || 0)}`}>
            <Icon name="shield" size={14} color={theme.colors.statDef} />
            <Text style={styles.statValue}>{Math.floor(hero.defense || 0)}</Text>
          </View>
          <View style={styles.statItem} accessibilityLabel={`CRIT ${Math.floor(hero.crit || 0)}%`}>
            <Icon name="target" size={14} color={theme.colors.statDef} />
            <Text style={styles.statValue}>{Math.floor(hero.crit || 0)}%</Text>
          </View>
          <View style={styles.statItem} accessibilityLabel={`AGI ${Math.floor(hero.agility || 0)}`}>
            <Icon name="run-fast" size={14} color={theme.colors.statDef} />
            <Text style={styles.statValue}>{Math.floor(hero.agility || 0)}</Text>
          </View>
```

3h. Trocar os tokens nas `defaultActions` (linhas 94/101/108): `theme.colors.hp`→`theme.colors.statHp`, `theme.colors.atk`→`theme.colors.statAtk`, `theme.colors.mp`→`theme.colors.statMp`. E nos `AttributeProgress` (linhas 196/203/210) o mesmo. O `theme.colors.textMuted` (linha 115, Descansar) e `theme.colors.primary` (linha 221, fallback) seguem.

3i. No `StyleSheet`: remover `boxShadow: '0px 2px 4px rgba(0,0,0,0.1)'` da `card` (linha 250) e envelopar o conteúdo num `<Card elevation="e1">`. Substituir o `<View style={styles.card}>` (linha 131) por `<Card elevation="e1" style={styles.card}>` e o `</View>` correspondente (linha 227) por `</Card>`; em `styles.card`, trocar `backgroundColor: theme.colors.surface` por remoção (o `Card` já traz superfície) e manter padding/margin. Atualizar `statIcon` removido (não há mais `<Text>` de emoji); adicionar estilos novos:

```tsx
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  taskBadgeText: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary },
```

(Manter `taskBadge` como container `flexDirection:'row'` com `gap:4`; remover `overflow:'hidden'` se conflitar.)

> **Regra preservada (Global Constraint):** os 3 secundários continuam só `<Icon>+<Text>` de leitura; **não** vira `TaskButton`. Os `defaultActions` seguem com 4 botões (HP/ATK/MP/Descansar).

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npm test -- --testPathPattern=HeroCard.test`
Expected: PASS (3 testes).

- [ ] **Step 5: Type-check + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: tsc sem novos erros; suíte verde.

- [ ] **Step 6: Commit**

```bash
git add src/components/HeroCard.tsx src/__tests__/components/HeroCard.test.tsx
git commit -m "feat(hero-card): emoji→Icon, Card/elevation, tokens stat*; DEF/CRIT/AGI seguem read-only

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `EmptyState` polido (Icon + lottie opcional)

**Files:**
- Modify: `src/components/ui/EmptyState.tsx`
- Modify: `src/components/GuildEmptyState.tsx`
- Create: `src/__tests__/components/EmptyState.test.tsx`

**Interfaces:**
- Consumes: `<Icon>`/`IconName`; `LottieView` (`lottie-react-native`, mockado); `LOTTIE_ASSETS` (Task 5); `theme.type`, `theme.colors.textMuted`.
- Produces: `EmptyState` com `interface Props { icon?: IconName; title: string; subtitle?: string; lottie?: keyof typeof LOTTIE_ASSETS; }`. Consumido por Tasks 9–18 onde houver estado vazio.

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/__tests__/components/EmptyState.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { EmptyState } from '../../components/ui/EmptyState';

jest.mock('../../components/ui/Icon', () => ({
  Icon: (props: any) => require('react').createElement('Icon', props),
}));
jest.mock('lottie-react-native', () => ({
  __esModule: true,
  default: (props: any) => require('react').createElement('LottieView', props),
}));

describe('EmptyState', () => {
  test('renderiza <Icon> (não <Text> de emoji) a partir de icon: IconName', () => {
    const { UNSAFE_getByType, getByText } = render(
      <EmptyState icon="castle" title="Vazio" subtitle="nada aqui" />
    );
    expect(getByText('Vazio')).toBeTruthy();
    // o nó Icon mockado é renderizado como elemento 'Icon'
    expect(UNSAFE_getByType('Icon' as any)).toBeTruthy();
  });

  test('com prop lottie monta o LottieView', () => {
    const { UNSAFE_getByType } = render(
      <EmptyState icon="castle" title="Vazio" lottie="SPARKLE_BURST" />
    );
    expect(UNSAFE_getByType('LottieView' as any)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- --testPathPattern=EmptyState.test`
Expected: FAIL — `EmptyState` ainda renderiza `<Text>` de emoji, não aceita `lottie`, e `icon` é `string`.

- [ ] **Step 3: Reescrever `src/components/ui/EmptyState.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { theme } from '../../theme';
import { Icon, IconName } from './Icon';
import { LOTTIE_ASSETS } from '../../constants/assets';

interface Props {
  icon?: IconName;
  title: string;
  subtitle?: string;
  lottie?: keyof typeof LOTTIE_ASSETS;
}

export function EmptyState({ icon = 'castle', title, subtitle, lottie }: Props) {
  return (
    <View style={styles.emptyState}>
      {lottie ? (
        <LottieView source={LOTTIE_ASSETS[lottie]} autoPlay loop style={styles.lottie} />
      ) : (
        <Icon name={icon} size={64} color={theme.colors.textMuted} />
      )}
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  lottie: { width: 96, height: 96, marginBottom: theme.spacing.md },
  emptyTitle: { ...theme.type.h2, color: theme.colors.textPrimary, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
  emptySubtitle: { ...theme.type.body, color: theme.colors.textSecondary, textAlign: 'center', paddingHorizontal: theme.spacing.xl },
});
```

- [ ] **Step 4: Migrar `GuildEmptyState.tsx` para usar `EmptyState`**

Substituir o conteúdo completo de `src/components/GuildEmptyState.tsx`:

```tsx
import React from 'react';
import { EmptyState } from './ui/EmptyState';

export function GuildEmptyState() {
  return (
    <EmptyState
      icon="castle"
      title="Sua guilda está vazia"
      subtitle="Recrute seu primeiro herói para começar a aventura!"
    />
  );
}
```

- [ ] **Step 5: Rodar o teste para confirmar que passa**

Run: `npm test -- --testPathPattern=EmptyState.test`
Expected: PASS (2 testes).

- [ ] **Step 6: Type-check + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: tsc sem novos erros; suíte verde.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/EmptyState.tsx src/components/GuildEmptyState.tsx src/__tests__/components/EmptyState.test.tsx
git commit -m "feat(ui): EmptyState com Icon/lottie; GuildEmptyState reusa EmptyState

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: `GuildScreen` → molde Reino + Lottie recruit

**Files:**
- Modify: `src/screens/GuildScreen.tsx`

**Interfaces:**
- Consumes: `ScreenContainer` (Task 4), `Banner` (SPEC 2), `AnimatedGold` (Task 3), `<Icon>` (SPEC 2), `GuildEmptyState` (Task 8), `LottieView`+`LOTTIE_ASSETS.RECRUIT` (Task 5), `useGuild()` (inalterado).
- Produces: `GuildScreen` (named export, sem mudança de API).

- [ ] **Step 1: Editar `GuildScreen.tsx`**

1a. Imports: trocar `ScreenHeader`→`Banner`, `GoldDisplay`→`AnimatedGold`, adicionar `ScreenContainer`, `Icon`, `LottieView`, `LOTTIE_ASSETS`. Remover `SafeAreaView`, `StatusBar`, `FlatList` se não usados após a migração (manter `FlatList` para a lista). Topo:

```tsx
import React, { useRef, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { theme } from '../theme';
import { AnimatedGold } from '../components/AnimatedGold';
import { Banner } from '../components/ui/Banner';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { Icon } from '../components/ui/Icon';
import { HeroCard } from '../components/HeroCard';
import { RecruitButton } from '../components/RecruitButton';
import { OfflineSummaryModal } from '../components/OfflineSummaryModal';
import { Hero } from '../types';
import { useGuild } from '../hooks/useGuild';
import { GuildEmptyState } from '../components/GuildEmptyState';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { LOTTIE_ASSETS } from '../constants/assets';
```

1b. No corpo, disparar Lottie recruit quando `state.heroes.length` aumentar:

```tsx
  const recruitRef = useRef<LottieView>(null);
  const prevCount = useRef(state.heroes.length);
  useEffect(() => {
    if (state.heroes.length > prevCount.current) {
      recruitRef.current?.play();
    }
    prevCount.current = state.heroes.length;
  }, [state.heroes.length]);
```

1c. Substituir o `return` inteiro por (usa `ScreenContainer scroll={false}` porque a `FlatList` já rola):

```tsx
  return (
    <ScreenContainer
      scroll={false}
      banner={
        <Banner
          title="Guilda"
          subtitle={`${state.heroes.length} herói${state.heroes.length !== 1 ? 's' : ''}`}
          right={<AnimatedGold gold={state.gold} />}
        />
      }
    >
      <View style={styles.recruitSection}>
        <RecruitButton cost={nextRecruitCost} canAfford={canAfford} onPress={recruitHero} />
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Icon name="sword" size={14} color={theme.colors.statAtk} />
          <Text style={styles.summaryText}>
            {state.heroes.filter((h) => h.currentTask !== 'IDLE').length} Ativos
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Icon name="sleep" size={14} color={theme.colors.textMuted} />
          <Text style={styles.summaryText}>
            {state.heroes.filter((h) => h.currentTask === 'IDLE').length} Ociosos
          </Text>
        </View>
      </View>

      {state.heroes.length === 0 ? (
        <GuildEmptyState />
      ) : (
        <FlatList
          data={state.heroes}
          renderItem={renderHero}
          keyExtractor={(hero) => hero.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <LottieView ref={recruitRef} source={LOTTIE_ASSETS.RECRUIT} style={styles.recruitFx} loop={false} pointerEvents="none" />

      <OfflineSummaryModal
        visible={!!offlineSummary}
        summary={offlineSummary}
        onApply={applyOfflineSummary}
        onDismiss={clearOfflineSummary}
      />
    </ScreenContainer>
  );
```

1d. No `StyleSheet`: remover `safeArea`/`container` (substituídos por `ScreenContainer`); trocar `summaryText` para tokens; adicionar `summaryItem` e `recruitFx`:

```tsx
  recruitSection: { marginBottom: theme.spacing.md },
  summaryRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md, paddingHorizontal: theme.spacing.sm },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryText: { ...theme.type.caption, color: theme.colors.textSecondary },
  listContent: { paddingBottom: theme.spacing.xl },
  recruitFx: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
```

- [ ] **Step 2: Type-check + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: tsc sem novos erros; suíte verde (testes de `useGuild` não tocados).

- [ ] **Step 3: Validar UI no browser**

Abrir a Guilda em `http://localhost:8081`. Checar: `Banner` em Cinzel; `HeroCard` com `<Icon>` de stats (não emoji); count-up de ouro; estado vazio polido (esvaziar guilda); Lottie recruit ao recrutar. Screenshot arquivado.

- [ ] **Step 4: Commit**

```bash
git add src/screens/GuildScreen.tsx
git commit -m "feat(guild): molde Reino (ScreenContainer/Banner/AnimatedGold/Icon) + Lottie recruit

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `MissionsScreen` + `MissionResultModal` → molde Reino

**Files:**
- Modify: `src/screens/MissionsScreen.tsx`
- Modify: `src/components/MissionResultModal.tsx`

**Interfaces:**
- Consumes: `ScreenContainer`, `Banner`, `AnimatedGold`, `<Icon>`, `EmptyState`; `useMissions()` (inalterado).
- Produces: telas sem mudança de API.

- [ ] **Step 1: Editar `MissionsScreen.tsx`**

1a. Imports: trocar `ScreenHeader`→`Banner`, `GoldDisplay`→`AnimatedGold`, adicionar `ScreenContainer`, `EmptyState`. Remover `SafeAreaView`/`ScrollView` do `react-native` (o `ScreenContainer` cobre).

1b. Substituir o wrapper `<SafeAreaView><ScrollView>…</ScrollView></SafeAreaView>` por `ScreenContainer` com `banner`. O `<MissionResultModal />` continua dentro. Trocar `<ScreenHeader title=... right={<GoldDisplay .../>}/>` por `Banner` + `AnimatedGold`:

```tsx
  return (
    <ScreenContainer
      banner={
        <Banner
          title="Quadro de Missões"
          subtitle={`${missionHeroes.length} heróis em campo`}
          right={<AnimatedGold gold={state.gold} />}
        />
      }
    >
      <MissionResultModal />
      {/* … as duas <View style={styles.section}> de missões em andamento / disponíveis seguem iguais … */}
      {/* … modais MissionHeroSelectionModal e MissionPlaybackModal seguem iguais … */}
      {/* Equipe em Campo: se vazia, EmptyState */}
      {missionHeroes.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equipe em Campo</Text>
          <View style={styles.heroGrid}>
            {missionHeroes.map((hero) => (
              <MissionHeroRow key={hero.id} hero={hero} perHeroGold={state.perHeroGold} />
            ))}
          </View>
        </View>
      ) : (
        <EmptyState icon="map-marker-path" title="Nenhum herói em campo" subtitle="Envie heróis em missões para ganhar ouro." />
      )}
    </ScreenContainer>
  );
```

1c. Em `styles`: remover `safeArea`/`container`; trocar `sectionTitle` `fontWeight:'800'` por `...theme.type.h2`; `heroGrid`/`activeBadge` para tokens `surfaceRaised`/`gold`; remover `emptyText` morto (substituído por `EmptyState`).

- [ ] **Step 2: Editar `MissionResultModal.tsx` — emoji→Icon, tipografia (Lottie e `Animated` intocados)**

2a. Adicionar `import { Icon } from './ui/Icon';`.

2b. Substituir o emoji do header (linha 149) `<Text style={styles.headerEmoji}>{result.success ? '🏆' : '💀'}</Text>` por:

```tsx
            <Icon name={result.success ? 'trophy' : 'skull'} size={40} color={'#fff'} />
```

2c. Substituir o `💰` do ouro ganho (linha 157) `<Text style={styles.goldValue}>💰 {Math.floor(result.reward)}</Text>` por:

```tsx
              <View style={styles.goldRow}>
                <Icon name="gold-coin" size={18} color={theme.colors.gold} />
                <Text style={styles.goldValue}>{Math.floor(result.reward)}</Text>
              </View>
```

2d. Substituir o `⚔️` do resumo de inimigos (linha 169) por `<Icon name="sword" size={13} color={theme.colors.textPrimary} />` ao lado do `enemySummaryText` (envolver em uma `View` row). Substituir `💀 INCAPACITADO`/`✨ ILESO`/`❤️ -X HP` (linhas 216/220/228) pelos respectivos `<Icon name="skull"|"star"|"heart">` + texto.

2e. Tipografia: `title` (linha 291) `fontWeight:'900'`→`...theme.type.h1` (mantendo `color:'#fff'`, `textTransform`/`letterSpacing`); `sectionTitle` (linha 369) `fontWeight:'800'`→`...theme.type.label`.

2f. Adicionar estilos `goldRow: { flexDirection:'row', alignItems:'center', gap:6 }`.

> Engine `Animated` (fade/slide :34-46), `LottieView` confetti (:139-146) e `BattleRunner` **NÃO mudam** (Global Constraint / spec §2.2). Os hex de cor de header (`#27AE60`/`#C0392B`) são migrados no SPEC 2; se ainda inline aqui, trocar por `theme.colors.success`/`theme.colors.ember`.

- [ ] **Step 3: Type-check + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: tsc sem novos erros; suíte verde.

- [ ] **Step 4: Validar UI**

Abrir Missões; concluir uma missão. Checar: count-up do ouro; cards; modal com confetti + tipografia nova + ícones (não emoji). Screenshot.

- [ ] **Step 5: Commit**

```bash
git add src/screens/MissionsScreen.tsx src/components/MissionResultModal.tsx
git commit -m "feat(missions): molde Reino na tela e no modal de resultado (emoji→Icon, tipografia); engine Animated intocada

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: `TrainingScreen` → molde Reino

**Files:**
- Modify: `src/screens/TrainingScreen.tsx`

**Interfaces:**
- Consumes: `ScreenContainer`, `Banner`, `AnimatedGold`, `<Icon>`, `<Button>` (SPEC 2), `EmptyState`, `Card`; `useTraining()` (inalterado).

- [ ] **Step 1: Editar `TrainingScreen.tsx`**

1a. Imports: `ScreenHeader`→`Banner`, `GoldDisplay`→`AnimatedGold`, add `ScreenContainer`, `Icon`, `Button`, `EmptyState`, `Card`. Remover `SafeAreaView`.

1b. `BatchButton` (linhas 41-50): trocar emoji por `<Icon>` e o `TouchableOpacity` por `PressableScale`/`<Button>`:

```tsx
  const BatchButton = ({ title, icon, color, onPress }: { title: string; icon: IconName; color: string; onPress: () => void }) => (
    <PressableScale style={[styles.batchButton, { borderColor: color }]} onPress={onPress}>
      <Icon name={icon} size={20} color={color} />
      <Text style={styles.batchText}>{title}</Text>
    </PressableScale>
  );
```

(Adicionar `import { PressableScale } from '../components/ui/PressableScale';` e `import { Icon, IconName } from '../components/ui/Icon';`.) Trocar os 3 usos: `icon="heart"` (HP), `icon="sword"` (ATK), `icon="flask"` (MP); cores `theme.colors.statHp/statAtk/statMp`.

1c. Substituir o wrapper `SafeAreaView`+`View container` por `ScreenContainer scroll={false}` com `banner`. Substituir o estado vazio "à mão" (linhas 85-96) por `EmptyState`:

```tsx
      {state.heroes.length === 0 ? (
        <EmptyState
          icon="dumbbell"
          title="Campo de Treino Vazio"
          subtitle="Não há ninguém aqui para treinar. Recrute heróis na loja!"
        />
      ) : (
        <FlatList … />
      )}
```

1d. `styles`: remover `safeArea`/`container`/`emptyState`/`emptyIcon`/`emptyTitle`/`emptySubtitle`/`shopButton`/`shopButtonText` (substituídos); remover `boxShadow` de `batchButton` (linha 155) — envolver em `Card` ou usar `theme.elevation.e1`; `sectionTitle`/`batchText` `fontWeight`→tokens `theme.type`.

- [ ] **Step 2: Type-check + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: verde.

- [ ] **Step 3: Validar UI**

Abrir Treino. Checar: `Banner`; `BatchButton` com `<Icon>` e press-scale; sem `boxShadow` cru; estado vazio polido. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add src/screens/TrainingScreen.tsx
git commit -m "feat(training): molde Reino (ScreenContainer/Banner/Icon/PressableScale/EmptyState)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: `BlacksmithScreen` → molde Reino + Lottie forge

**Files:**
- Modify: `src/screens/BlacksmithScreen.tsx` (`TYPE_ICONS` :29-33; "Pronto para Coletar" :227-232; inventário vazio :238-241)

**Interfaces:**
- Consumes: `ScreenContainer`, `Banner`, `AnimatedGold`, `<Icon>`, `Card` (raridade), `EmptyState`, `OrnateFrame` (modal), `LottieView`+`LOTTIE_ASSETS.FORGE_COMPLETE`; `useGame()`, `EQUIPMENT_TIERS`, `FORGE_RECIPES` (inalterados).

- [ ] **Step 1: Editar `BlacksmithScreen.tsx`**

1a. Imports: `ScreenHeader`→`Banner`, `GoldDisplay`→`AnimatedGold`, add `ScreenContainer`, `Icon`, `Card`, `EmptyState`, `OrnateFrame`, `LottieView`, `LOTTIE_ASSETS`.

1b. `TYPE_ICONS` (linhas 29-33): trocar de emoji-string para `IconName`:

```tsx
const TYPE_ICONS: Record<string, IconName> = {
  weapon: 'sword',
  armor: 'shield',
  accessory: 'ring',
};
```

Onde `TYPE_ICONS[type]` é renderizado como `<Text>`, trocar por `<Icon name={TYPE_ICONS[type]} size={16} color={theme.colors.goldBright} />`.

1c. Wrapper: `SafeAreaView`+`ScrollView` → `ScreenContainer` com `banner` (`Banner` + `AnimatedGold`).

1d. Inventário vazio (linhas 238-241): trocar `<Text style={styles.emptyText}>Nenhum equipamento ainda. Forje algo!</Text>` por `<EmptyState icon="anvil" title="Forja vazia" subtitle="Nenhum equipamento ainda. Forje algo!" />`.

1e. "Pronto para Coletar" (linhas 227-232): adicionar `LottieView` `FORGE_COMPLETE` disparado ao coletar (no handler de coleta já existente, via `ref.play()` no padrão do `MissionResultModal`). Adicionar `const forgeRef = useRef<LottieView>(null);` e renderizar `<LottieView ref={forgeRef} source={LOTTIE_ASSETS.FORGE_COMPLETE} loop={false} style={styles.forgeFx} pointerEvents="none" />`; chamar `forgeRef.current?.play()` dentro do `onPress` de coletar.

1f. Tier cards → `<Card rarity={def.rarity}>` (ou `<Card>` com cor de borda `theme.rarity[def.rarity]` se o `Card` do SPEC 2 não tiver prop `rarity`); modal de detalhe → `<OrnateFrame>`. Remover hex/`boxShadow` inline residuais → tokens/`elevation`.

- [ ] **Step 2: Type-check + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: verde (testes `BlacksmithMaterials.test.ts` não tocados em lógica).

- [ ] **Step 3: Validar UI**

Abrir Ferreiro. Checar: tiers com cor de raridade; pulse "affordable" quando dá pra forjar (via `<Button>` do SPEC 2); Lottie forge ao coletar; modal `OrnateFrame`; inventário vazio polido. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add src/screens/BlacksmithScreen.tsx
git commit -m "feat(blacksmith): molde Reino (Card raridade/OrnateFrame/Icon) + Lottie forge ao coletar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: `ShopScreen` → molde Reino + Lottie recruit

**Files:**
- Modify: `src/screens/ShopScreen.tsx` (`infoBox` rgba :77/82; emoji `💎🥈🎁` :49)

**Interfaces:**
- Consumes: `ScreenContainer`, `Banner`, `AnimatedGold`, `<Icon>`, `LottieView`+`LOTTIE_ASSETS.RECRUIT`; `useShop()` (inalterado). O `ChestCard` recebe `icon` — passar `IconName` em vez de emoji (ajustar `ChestCard` para `<Icon>` se ele renderizar o `icon` como `<Text>`).

- [ ] **Step 1: Editar `ShopScreen.tsx`**

1a. Imports: `ScreenHeader`→`Banner`, `GoldDisplay`→`AnimatedGold`, add `ScreenContainer`, `LottieView`, `LOTTIE_ASSETS`. (Se `ChestCard` renderiza `icon` como `<Text>`, editar `ChestCard.tsx` para aceitar `IconName` e renderizar `<Icon>`.)

1b. Wrapper `SafeAreaView`+`ScrollView` → `ScreenContainer` com `banner`.

1c. `icon` dos baús (linha 49): trocar `it.id === 'chest_gold' ? '💎' : it.id === 'chest_silver' ? '🥈' : '🎁'` por `IconName`: `it.id === 'chest_gold' ? 'treasure-chest' : it.id === 'chest_silver' ? 'treasure-chest-outline' : 'gift'`.

1d. `infoBox` styles (linhas 76-82): `backgroundColor: 'rgba(255, 215, 0, 0.05)'`→`theme.colors.surfaceRaised`; `borderColor: 'rgba(255, 215, 0, 0.2)'`→`theme.colors.borderGold`. `infoText` `color: theme.colors.gold` mantém.

1e. Lottie recruit: `const recruitRef = useRef<LottieView>(null)`; disparar `recruitRef.current?.play()` no `handleRevealComplete` (herói recrutado); renderizar `<LottieView ref={recruitRef} source={LOTTIE_ASSETS.RECRUIT} loop={false} style={styles.recruitFx} pointerEvents="none" />`.

- [ ] **Step 2: Type-check + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: verde (`useShop` não tocado).

- [ ] **Step 3: Validar UI**

Abrir Loja. Checar: `<Icon>` nos baús (não emoji); pulse affordable; sem rgba na infoBox; Lottie recruit ao revelar. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add src/screens/ShopScreen.tsx src/components/ChestCard.tsx
git commit -m "feat(shop): molde Reino (Banner/AnimatedGold/Icon, infoBox token) + Lottie recruit

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: `EnfermariaScreen` → molde Reino

**Files:**
- Modify: `src/screens/EnfermariaScreen.tsx` (`emptyCard` rgba :166-171; `boxShadow` :189)

**Interfaces:**
- Consumes: `ScreenContainer`, `Banner`, `AnimatedGold`, `Card`, `<Button>` (ou `PressableScale`); `useInfirmary()` (inalterado).

- [ ] **Step 1: Editar `EnfermariaScreen.tsx`**

1a. Imports: `ScreenHeader`→`Banner`, `GoldDisplay`→`AnimatedGold`, add `ScreenContainer`, `Card`. Remover `SafeAreaView`/`StatusBar`/`ScrollView`.

1b. Wrapper → `ScreenContainer` com `banner`.

1c. `emptyCard` styles (linhas 165-172): `backgroundColor: 'rgba(255,255,255,0.05)'`→`theme.colors.surfaceRaised`; `borderColor: 'rgba(255,255,255,0.1)'`→`theme.colors.border`. Os dois usos de `emptyCard` (linhas 63 e 92) seguem.

1d. `submitButton` styles (linha 182-190): remover `boxShadow: '0px 2px 4px rgba(0,0,0,0.2)'`; trocar `backgroundColor: theme.colors.primary` por `theme.colors.gold`; envolver em `Card`/`elevation.e1` ou trocar o `TouchableOpacity` por `<Button label="Internar Heróis" variant="primary" />` (SPEC 2). `submitButtonText` `fontWeight:'800'`→`...theme.type.label`.

- [ ] **Step 2: Type-check + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: verde.

- [ ] **Step 3: Validar UI**

Abrir Enfermaria. Checar: `Card`; `<Button>`; sem rgba/`boxShadow`. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add src/screens/EnfermariaScreen.tsx
git commit -m "feat(enfermaria): molde Reino (Card/Button, tokens), remove rgba e boxShadow

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: `DailyQuestsScreen` → molde Reino

**Files:**
- Modify: `src/screens/DailyQuestsScreen.tsx` (`'#1a1a1a'` :293; cards; estado vazio)

**Interfaces:**
- Consumes: `ScreenContainer`, `Banner`, `AnimatedGold`, `Card`, `EmptyState`; hook de daily quests (inalterado).

- [ ] **Step 1: Editar `DailyQuestsScreen.tsx`**

1a. Imports: `ScreenHeader`→`Banner` (se usar), `GoldDisplay`→`AnimatedGold`, add `ScreenContainer`, `Card`, `EmptyState`.

1b. Wrapper → `ScreenContainer` com `banner`.

1c. `claimButtonText` `color: '#1a1a1a'` (linha 293) → `theme.colors.bgDeep`. Buscar e trocar qualquer outro `'#1a1a1a'` no arquivo (`grep -n "#1a1a1a" src/screens/DailyQuestsScreen.tsx`).

1d. Cards de quest crus (`View`+`surface`) → `<Card elevation="e1">`. Estado "sem quests" (se houver `<Text>` cru) → `<EmptyState icon="scroll" title="Sem missões diárias" subtitle="Volte amanhã para novos objetivos." />`.

- [ ] **Step 2: Type-check + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: verde.

- [ ] **Step 3: Validar UI**

Abrir Diárias. Checar: sem `#1a1a1a`; cards `Card`; estado vazio polido. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add src/screens/DailyQuestsScreen.tsx
git commit -m "feat(daily): molde Reino (Banner/Card/EmptyState), #1a1a1a→bgDeep

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: `WeeklyScreen` → molde Reino + ComingSoon

**Files:**
- Modify: `src/screens/WeeklyScreen.tsx` (`'#1a1a1a'` :367; `fontWeight:'800'`; seção em breve)
- Modify: `src/components/ui/ComingSoon.tsx` (emoji→Icon; `fontWeight:'900'` :65)

**Interfaces:**
- Consumes: `ScreenContainer`, `Banner`, `AnimatedGold`, `Card`, `ComingSoon`; hook de weekly (inalterado).
- Produces: `ComingSoon` com `interface ComingSoonProps { title: string; icon: IconName; description: string; }`.

- [ ] **Step 1: Editar `ComingSoon.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';
import { Icon, IconName } from './Icon';

interface ComingSoonProps {
  title: string;
  icon: IconName;
  description: string;
}

export function ComingSoon({ title, icon, description }: ComingSoonProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name={icon} size={48} color={theme.colors.goldBright} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>EM DESENVOLVIMENTO</Text>
      </View>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.colors.bgBase },
  iconContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 2, borderColor: theme.colors.borderGold },
  title: { ...theme.type.h1, color: theme.colors.textPrimary, marginBottom: 12, textAlign: 'center' },
  badge: { backgroundColor: theme.colors.gold, paddingHorizontal: 12, paddingVertical: 4, borderRadius: theme.borderRadius.sm, marginBottom: 16 },
  badgeText: { ...theme.type.label, color: theme.colors.bgDeep },
  description: { ...theme.type.body, color: theme.colors.textSecondary, textAlign: 'center' },
});
```

- [ ] **Step 2: Editar `WeeklyScreen.tsx`**

2a. Imports: `ScreenHeader`→`Banner` (se usar), `GoldDisplay`→`AnimatedGold`, add `ScreenContainer`, `Card`, `ComingSoon`.

2b. Wrapper → `ScreenContainer` com `banner`.

2c. `claimButtonText` `color: '#1a1a1a'` (linha 367) → `theme.colors.bgDeep`; demais `#1a1a1a` (`grep -n "#1a1a1a" src/screens/WeeklyScreen.tsx`). `fontWeight:'800'`/`'900'` literais → `...theme.type.label`/`...theme.type.h2`.

2d. Seção "em breve" (boss semanal não implementado): renderizar `<ComingSoon icon="calendar-star" title="Boss Semanal" description="Em breve: enfrente o chefe da semana por recompensas épicas." />`.

- [ ] **Step 3: Type-check + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: verde.

- [ ] **Step 4: Validar UI**

Abrir Semanal. Checar: sem `#1a1a1a`; `ComingSoon` polido na seção em breve. Screenshot.

- [ ] **Step 5: Commit**

```bash
git add src/screens/WeeklyScreen.tsx src/components/ui/ComingSoon.tsx
git commit -m "feat(weekly): molde Reino + ComingSoon reabilitado (Icon/tokens), #1a1a1a→bgDeep

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: `PantheonScreen` → molde Reino + Seals de classe

**Files:**
- Modify: `src/screens/PantheonScreen.tsx`

**Interfaces:**
- Consumes: `ScreenContainer`, `Banner`, `AnimatedGold`, `Card`, `OrnateFrame`, `<Seal kind={ClassId}>` (SPEC 2); `usePantheon()` (inalterado).

- [ ] **Step 1: Editar `PantheonScreen.tsx`**

1a. Imports: `ScreenHeader`→`Banner` (se usar), `GoldDisplay`→`AnimatedGold`, add `ScreenContainer`, `Card`, `OrnateFrame`, `Seal`, `Icon`.

1b. Wrapper → `ScreenContainer` com `banner`.

1c. Cards de bônus/herói crus → `<Card elevation="e1">`; modal de fusão → `<OrnateFrame>`. Na seleção de fusão, o brasão de classe vira `<Seal kind={hero.classId} />` (SPEC 2 entrega `Seal` para classes). Emojis residuais (se houver) → `<Icon>`. Hex/`boxShadow` inline → tokens/`elevation`.

> A lógica de fusão (`handleFuseHeroes` via hook) **não muda** — só a apresentação dos heróis selecionáveis e do resultado.

- [ ] **Step 2: Type-check + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: verde (`usePantheon` não tocado).

- [ ] **Step 3: Validar UI**

Abrir Panteão. Checar: `<Seal>` de classe na fusão; modal `OrnateFrame`; cards `Card`. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add src/screens/PantheonScreen.tsx
git commit -m "feat(pantheon): molde Reino (Card/OrnateFrame/Seal de classe), tokens

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: `AchievementsScreen` → molde Reino + Seal locked

**Files:**
- Modify: `src/screens/AchievementsScreen.tsx`

**Interfaces:**
- Consumes: `ScreenContainer`, `Banner`, `AnimatedGold`, `Card`, `<Icon name="trophy">`, `<Seal locked>` (SPEC 2); hook de achievements (inalterado).

- [ ] **Step 1: Editar `AchievementsScreen.tsx`**

1a. Imports: `ScreenHeader`→`Banner` (se usar), `GoldDisplay`→`AnimatedGold`, add `ScreenContainer`, `Card`, `Icon`, `Seal`.

1b. Wrapper → `ScreenContainer` com `banner`.

1c. Cards de conquista crus → `<Card elevation="e1">`; ícone de conquista → `<Icon name="trophy">`; conquista bloqueada → `<Seal locked>` (cinza). Emojis residuais → `<Icon>`; hex inline → tokens.

- [ ] **Step 2: Type-check + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: verde.

- [ ] **Step 3: Validar UI**

Abrir Conquistas. Checar: `<Icon name="trophy">`; conquista bloqueada com `Seal locked` (cinza); cards `Card`. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add src/screens/AchievementsScreen.tsx
git commit -m "feat(achievements): molde Reino (Card/Icon/Seal locked), tokens

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: `CombatantCard` (só emoji→Icon) e `GoldDisplay` (deprecar)

**Files:**
- Modify: `src/components/CombatantCard.tsx` (3 Texts de stat :134-136)
- Modify: `src/components/GoldDisplay.tsx`

**Interfaces:**
- Consumes: `<Icon>`; `AnimatedGold` (Task 3).
- Produces: `GoldDisplay` vira re-export de `AnimatedGold` (mantém compat de qualquer call site não migrado).

- [ ] **Step 1: Editar `CombatantCard.tsx` — só os 3 glifos de stat (engine `Animated` intocada)**

Adicionar `import { Icon } from './ui/Icon';`. Substituir as 3 linhas (134-136):

```tsx
          {typeof atk === 'number' ? (
            <View style={styles.metaItem}><Icon name="sword" size={11} color={theme.colors.textSecondary} /><Text style={styles.metaText}>{Math.floor(atk)}</Text></View>
          ) : null}
          {typeof mp === 'number' ? (
            <View style={styles.metaItem}><Icon name="flask" size={11} color={theme.colors.textSecondary} /><Text style={styles.metaText}>{Math.floor(mp)}</Text></View>
          ) : null}
          {typeof defense === 'number' ? (
            <View style={styles.metaItem}><Icon name="shield" size={11} color={theme.colors.textSecondary} /><Text style={styles.metaText}>{Math.floor(defense)}</Text></View>
          ) : null}
```

Adicionar estilo `metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 }`.

> **Nenhum `Animated.Value`, HP-bar, shake, flash ou fade muda** (Global Constraint / spec §2.2). Mudança puramente de glifo. Os hex `'#3CB371'`/`'#FFD24D'`/`'#FF7A7A'` da HP-bar (linha 129) e overlays são migrados em SPEC 2; se ainda inline aqui, trocar por tokens `theme.colors.success`/`theme.colors.warning`/`theme.colors.statHp`.

- [ ] **Step 2: Deprecar `GoldDisplay.tsx` → re-export de `AnimatedGold`**

Substituir o conteúdo completo de `src/components/GoldDisplay.tsx`:

```tsx
import { AnimatedGold } from './AnimatedGold';

/** @deprecated Use AnimatedGold diretamente. Mantido como re-export para compat de call sites. */
export const GoldDisplay = AnimatedGold;
```

- [ ] **Step 3: Type-check + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: verde (`AnimatedGold.test` continua passando; nenhum teste de `CombatantCard` quebra).

- [ ] **Step 4: Validar UI**

Abrir o playback de batalha (Missões → assistir). Checar: stats do combatente com `<Icon>` (não emoji); animações de batalha intactas. Screenshot.

- [ ] **Step 5: Commit**

```bash
git add src/components/CombatantCard.tsx src/components/GoldDisplay.tsx
git commit -m "feat(combat): CombatantCard emoji→Icon (engine Animated intocada); GoldDisplay re-exporta AnimatedGold

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 20: `AppNavigator` — tab bar Reino

**Files:**
- Modify: `src/navigation/AppNavigator.tsx` (`Ionicons` :16,50; `tabBarIcon` :35-51; tint :33-34; `tabBarStyle` :27-32)
- Create: `src/__tests__/navigation/AppNavigator.tabicons.test.ts`

**Interfaces:**
- Consumes: `<Icon>`/`IconName` (SPEC 2); `theme.colors.gold/textMuted/surfaceRaised/borderGold`, `theme.elevation.e2`.
- Produces: `TAB_ICONS: Record<string, IconName>` exportado (cobre as 5 rotas visíveis: `Vila`, `Treinamento`, `Missões`, `Enfermaria`, `Loja`).

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/__tests__/navigation/AppNavigator.tabicons.test.ts`:

```ts
import { TAB_ICONS } from '../../navigation/AppNavigator';

describe('AppNavigator TAB_ICONS', () => {
  test('cobre exatamente as 5 rotas visíveis', () => {
    expect(Object.keys(TAB_ICONS).sort()).toEqual(
      ['Enfermaria', 'Loja', 'Missões', 'Treinamento', 'Vila'].sort()
    );
  });

  test('usa ícones medievais esperados', () => {
    expect(TAB_ICONS.Vila).toBe('castle');
    expect(TAB_ICONS.Treinamento).toBe('sword');
    expect(TAB_ICONS['Missões']).toBe('map-marker-path');
    expect(TAB_ICONS.Enfermaria).toBe('medical-bag');
    expect(TAB_ICONS.Loja).toBe('store');
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- --testPathPattern=AppNavigator.tabicons.test`
Expected: FAIL — `TAB_ICONS` não exportado.

- [ ] **Step 3: Editar `AppNavigator.tsx`**

3a. Trocar `import { Ionicons } from '@expo/vector-icons';` (linha 16) por `import { Icon, IconName } from '../components/ui/Icon';`.

3b. Adicionar, após os imports, o mapa exportado:

```tsx
export const TAB_ICONS: Record<string, IconName> = {
  Vila: 'castle',
  Treinamento: 'sword',
  'Missões': 'map-marker-path',
  Enfermaria: 'medical-bag',
  Loja: 'store',
};
```

3c. Substituir o `tabBarIcon` (linhas 35-51) por:

```tsx
          tabBarIcon: ({ color, size }) => (
            <Icon name={TAB_ICONS[route.name] ?? 'castle'} size={size} color={color} />
          ),
```

3d. `tabBarActiveTintColor` (linha 33): `theme.colors.primary`→`theme.colors.gold`. `tabBarInactiveTintColor` (linha 34) mantém `theme.colors.textMuted`.

3e. `tabBarStyle` (linhas 27-32): `backgroundColor: theme.colors.surface`→`theme.colors.surfaceRaised`; `borderTopColor: theme.colors.surfaceLight`→`theme.colors.borderGold`; espalhar `...theme.elevation.e2`. `sceneContainerStyle` (linha 26): `backgroundColor: theme.colors.background`→`theme.colors.bgBase`.

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npm test -- --testPathPattern=AppNavigator.tabicons.test`
Expected: PASS (2 testes).

- [ ] **Step 5: Type-check + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: verde.

- [ ] **Step 6: Validar UI (transições + tab bar)**

Trocar entre tabs no browser. Checar: 5 ícones medievais; ativo dourado, inativo sépia; `elevation` na barra; transição fade+rise ao trocar (de `ScreenContainer`), não corte seco. Screenshot da tab bar + GIF/sequência da transição.

- [ ] **Step 7: Commit**

```bash
git add src/navigation/AppNavigator.tsx src/__tests__/navigation/AppNavigator.tabicons.test.ts
git commit -m "feat(nav): tab bar Reino (Icon medieval, tint gold/sépia, surfaceRaised+elevation)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 21: `LoadingScreen` com `Shimmer`

**Files:**
- Modify: `src/components/ui/LoadingScreen.tsx`

**Interfaces:**
- Consumes: `Shimmer` (Task 2); `theme.colors.bgBase`, `theme.type.body`.

- [ ] **Step 1: Editar `LoadingScreen.tsx`**

Substituir o conteúdo completo:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';
import { Shimmer } from './Shimmer';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Carregando...' }: LoadingScreenProps) {
  return (
    <View style={styles.container}>
      <Shimmer width={200} height={20} radius="md" />
      <Shimmer width={140} height={14} radius="md" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgBase,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  text: {
    ...theme.type.body,
    color: theme.colors.textSecondary,
  },
});
```

- [ ] **Step 2: Type-check + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: verde.

- [ ] **Step 3: Validar UI**

Abrir uma tela com `isLoaded=false` (forçar delay no load). Checar: shimmer em vez de spinner. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/LoadingScreen.tsx
git commit -m "feat(ui): LoadingScreen usa Shimmer no lugar do spinner

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 22: Remover `ScreenHeader` (re-export → delete)

**Files:**
- Modify → Delete: `src/components/ui/ScreenHeader.tsx`

**Interfaces:**
- Consumes: `Banner` (SPEC 2).

- [ ] **Step 1: Confirmar 0 imports diretos de `ScreenHeader` nas telas**

```bash
grep -rn "ScreenHeader" src/screens src/components | grep -v "ScreenHeader.tsx"
```
Esperado: vazio (Tasks 9–18 migraram todas para `Banner`). Se sobrar algum, migrar aquela tela antes de continuar.

- [ ] **Step 2: Transformar `ScreenHeader.tsx` em re-export de `Banner` (rede de segurança)**

Substituir o conteúdo completo de `src/components/ui/ScreenHeader.tsx`:

```tsx
import { Banner } from './Banner';

/** @deprecated Use Banner diretamente. Re-export temporário até remoção. */
export const ScreenHeader = Banner;
```

- [ ] **Step 3: Type-check + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: verde.

- [ ] **Step 4: Verificar 0 referências e deletar**

```bash
grep -rn "ScreenHeader" src | grep -v "ScreenHeader.tsx"
```
Esperado: vazio. Então:

```bash
git rm src/components/ui/ScreenHeader.tsx
npx tsc --noEmit && npm test
```
Expected: tsc/suíte verdes (nada importa mais).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(ui): remover ScreenHeader (todas as telas usam Banner)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 23: Remover `compatAliases`/`fontSize`/`fontWeight` legados do `theme`

**Files:**
- Modify: `src/theme/index.ts`

**Interfaces:**
- Consumes: nada novo. Fecha a dívida de SPEC 2 §3.6.

- [ ] **Step 1: Confirmar 0 referências aos aliases legados em `src`**

```bash
grep -rnE "theme\.colors\.(background|surface|surfaceLight|primary|primaryLight|primaryDark|hp|atk|mp)\b" src/screens src/components src/navigation | grep -v "\.test\."
grep -rnE "theme\.(fontSize|fontWeight)\b" src/screens src/components src/navigation | grep -v "\.test\."
```
Esperado: **vazio** nos dois. Cada hit remanescente é uma tela/componente que ainda referencia alias — migrar para o token semântico (`background`→`bgBase`, `surface`→`surface` (já é couro no SPEC 2), `surfaceLight`→`surfaceRaised`, `primary`→`gold`, `hp/atk/mp`→`statHp/statAtk/statMp`, `fontSize/fontWeight`→`theme.type.*`) antes de prosseguir. Repetir o grep até zerar.

- [ ] **Step 2: Remover `compatAliases` e `fontSize`/`fontWeight` legados do `theme`**

Em `src/theme/index.ts` (versão SPEC 2), remover o bloco `compatAliases` e as chaves `fontSize`/`fontWeight` legadas (mantendo `theme.type`, `theme.colors` couro/ouro, `theme.elevation`, `theme.rarity`, `theme.spacing`, `theme.borderRadius`).

> O arquivo exato a editar é o `theme` **pós-SPEC 2**; o snippet de remoção depende de como SPEC 2 estruturou os aliases. Diretriz: deletar tudo que existe só para retrocompat (qualquer chave marcada como "legado/alias" por SPEC 2 §3.6).

- [ ] **Step 3: Type-check + suíte (a rede que pega qualquer alias esquecido)**

Run: `npx tsc --noEmit && npm test`
Expected: tsc verde (qualquer referência sobrevivente a alias removido vira erro de compilação aqui — corrigir e repetir). Suíte verde.

- [ ] **Step 4: Confirmar critério de aceitação #7 do spec**

```bash
grep -rnE "theme\.colors\.hp\b|theme\.colors\.background\b|theme\.fontSize" src | grep -v "\.test\."
```
Esperado: vazio.

- [ ] **Step 5: Commit**

```bash
git add src/theme/index.ts
git commit -m "chore(theme): remover compatAliases/fontSize/fontWeight legados — migração SPEC2/3 fechada

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 24: Verificação final — critérios de aceitação do spec

**Files:** nenhum (verificação).

- [ ] **Step 1: Suíte completa + type-check**

Run: `npx tsc --noEmit && npm test`
Expected: tsc delta ≤ 0 vs. baseline pós-SPEC 2; suíte verde, incluindo os testes novos (`PressableScale`, `Shimmer`, `AnimatedGold`, `assets`, `VillageScreen`, `HeroCard`, `EmptyState`, `AppNavigator.tabicons`).

- [ ] **Step 2: 0 emoji como ícone nas telas e componentes-alvo**

```bash
grep -rnP "[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2694}\x{2B50}\x{2728}]" src/screens src/components/HeroCard.tsx src/components/CombatantCard.tsx src/components/GoldDisplay.tsx src/components/MissionResultModal.tsx src/components/GuildEmptyState.tsx src/components/ui/EmptyState.tsx src/components/ui/ComingSoon.tsx | grep -v "\.test\."
```
Esperado: **vazio** (todo ícone via `<Icon>`). Se sobrar algum emoji, migrá-lo para `<Icon>` e commitar como fix.

- [ ] **Step 3: 0 hex inline em screens/components**

```bash
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" src/screens src/components | grep -v "\.test\."
```
Esperado: **vazio** (todo hex/rgba virou token). Exceção permitida: keywords CSS (`'transparent'`, `'#fff'` só se SPEC 2 não tiver token equivalente — preferir token). Migrar remanescentes.

- [ ] **Step 4: `village_map.png` tem ≥1 importador**

```bash
grep -rn "IMAGE_ASSETS.VILLAGE_MAP\|VILLAGE_MAP" src/screens/VillageScreen.tsx
```
Esperado: ao menos 1 ocorrência (asset deixou de ser dead code).

- [ ] **Step 5: Evidência de screenshot das 11 telas + transição**

Conferir que há screenshot arquivado para: Vila, Guilda, Missões, Treino, Ferreiro, Loja, Enfermaria, Diárias, Semanal, Panteão, Conquistas, tab bar e transição de tab (checklist §5.3 do spec). Onde faltar, abrir a tela no browser e capturar.

- [ ] **Step 6: Simulações de batalha (smoke de regressão)**

Run: `npm run simulate:m1 && npm run simulate:m2`
Expected: ambas finalizam sem erro (nenhuma regressão de regra; só apresentação mudou).

- [ ] **Step 7: Commit de encerramento + push**

```bash
git add -A
git commit -m "chore(redesign): redesign de telas completo — 11 telas no DS Reino, Vila-mapa, microinterações

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push
```

---

## Resumo das decisões de design

| Decisão | Justificativa |
|---|---|
| SPEC 2 é gate bloqueante explícito (Gate de Pré-condição) | Componentes/tokens/deps consumidos por SPEC 3 não existem no código atual; começar sem eles é impossível. |
| 4 componentes novos só de redução de duplicação (`ScreenContainer`/`AnimatedGold`/`Shimmer`/`PressableScale`) | Boilerplate repetido em 10-11 telas justifica o componente (oposto de over-engineering). Identidade visual fica em SPEC 2. |
| `AnimatedGold` dirige o texto via `state`+`useDerivedValue`, não `useAnimatedProps` em `<Text>` | Compatibilidade web do Reanimated (risco §7); o `accessibilityLabel` usa o valor final (prop), garantindo convergência testável. |
| Vila com coordenadas relativas `x/y` 0..1 + calibração por screenshot | Responsivo a qualquer device; valores no spec são provisórios e ajustados sobre a arte real. |
| Fallback grid na Vila ao `onError` da imagem | Navegação para os 8 edifícios nunca quebra, mesmo sem o mapa. |
| `CombatantCard`/`MissionResultModal`: só emoji→Icon, engine `Animated` intocada | Funcionam; migrar para Reanimated é risco sem retorno (spec §2.2). |
| `GoldDisplay`/`ScreenHeader` viram re-export antes de deletar | Rede de segurança contra call sites não migrados; deleção só após grep zerar. |
| Remoção dos `compatAliases` é a última task | Big-bang dos aliases quebraria telas não migradas; tsc pega qualquer alias esquecido como erro. |
| DEF/CRIT/AGI seguem `<Icon>+<Text>` read-only, sem `TaskButton` | Regra de jogo: não-treináveis (teste de `HeroCard` assevera). |
| Microinteração de "novidade" lê `state.dailyQuests`/`achievements` por `?.`/`?? []` | Dica visual sobre estado existente; nunca credita gold (sem gold passivo). |
