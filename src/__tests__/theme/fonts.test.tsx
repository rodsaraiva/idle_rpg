import { renderHook } from '@testing-library/react-native';
import { useReinoFonts } from '../../theme/fonts';

// expo-font mockado via moduleNameMapper para retornar [false] (fonte não carregada)

describe('useReinoFonts (fallback gracioso)', () => {
  test('com fonte não carregada, o componente ainda renderiza (sem crash)', () => {
    const { result } = renderHook(() => useReinoFonts());
    expect(result.current.fontsLoaded).toBe(false);
  });
});
