import { Platform, TextStyle, ViewStyle } from 'react-native';

/** Sombra de texto cross-platform. Substitui o `textShadow: '...'` (CSS web). */
export function textShadow(
  color = 'rgba(0,0,0,0.45)',
  dx = 0,
  dy = 1,
  radius = 1
): Pick<TextStyle, 'textShadowColor' | 'textShadowOffset' | 'textShadowRadius'> {
  return {
    textShadowColor: color,
    textShadowOffset: { width: dx, height: dy },
    textShadowRadius: radius,
  };
}

/** Elevação cross-platform. Android: `elevation`; iOS/web: `shadow*`. Substitui o `boxShadow: '...'`. */
export function elevation(level: 1 | 2 | 3 | 4): ViewStyle {
  const map = { 1: 2, 2: 4, 3: 8, 4: 12 } as const;
  return Platform.select({
    android: { elevation: map[level] },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: map[level] / 2 },
      shadowOpacity: 0.3,
      shadowRadius: map[level] / 2,
    },
  })!;
}
