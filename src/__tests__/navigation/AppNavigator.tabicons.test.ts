// Mockar dependências de plataforma antes de importar o módulo
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: () => null,
    Screen: () => null,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: any) => children,
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    createAnimatedComponent: (c: any) => c,
    View: 'Animated.View',
  },
  useSharedValue: (v: any) => ({ value: v }),
  useAnimatedStyle: (fn: any) => fn(),
  withSpring: (v: any) => v,
  withTiming: (v: any) => v,
  withSequence: (...v: any[]) => v[v.length - 1],
  withRepeat: (v: any) => v,
  useDerivedValue: (fn: any) => ({ value: fn() }),
  runOnJS: (fn: any) => fn,
  FadeInDown: { duration: () => ({}) },
  Easing: { out: (e: any) => e, cubic: 0, linear: 0 },
}));

// Mockar todas as telas para evitar cadeia de imports pesada
jest.mock('../../screens/TrainingScreen', () => ({ TrainingScreen: () => null }));
jest.mock('../../screens/MissionsScreen', () => ({ MissionsScreen: () => null }));
jest.mock('../../screens/EnfermariaScreen', () => ({ EnfermariaScreen: () => null }));
jest.mock('../../screens/ShopScreen', () => ({ ShopScreen: () => null }));
jest.mock('../../screens/VillageScreen', () => ({ VillageScreen: () => null }));
jest.mock('../../screens/BlacksmithScreen', () => ({ BlacksmithScreen: () => null }));
jest.mock('../../screens/PantheonScreen', () => ({ PantheonScreen: () => null }));
jest.mock('../../screens/AchievementsScreen', () => ({ AchievementsScreen: () => null }));
jest.mock('../../screens/DailyQuestsScreen', () => ({ DailyQuestsScreen: () => null }));
jest.mock('../../screens/WeeklyScreen', () => ({ WeeklyScreen: () => null }));
jest.mock('../../screens/GuildScreen', () => ({ GuildScreen: () => null }));

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
