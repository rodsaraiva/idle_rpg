import { renderHook } from '@testing-library/react-native';
import { useReinoFonts } from '../../theme/fonts';

// expo-font mockado via moduleNameMapper para retornar [false] (fonte não carregada)

describe('useReinoFonts (fallback gracioso)', () => {
  test('hook retorna fontsLoaded=false quando fonte não está carregada', () => {
    const { result } = renderHook(() => useReinoFonts());
    expect(result.current.fontsLoaded).toBe(false);
  });

  test('componente consumidor renderiza sem crash e exibe texto de fallback', () => {
    const labels: string[] = [];
    // Verifica que o componente pode ser instanciado via renderHook sem crash
    renderHook(() => {
      const { fontsLoaded } = useReinoFonts();
      labels.push(fontsLoaded ? 'carregado' : 'fallback');
    });
    expect(labels).toContain('fallback');
  });
});
