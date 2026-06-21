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
