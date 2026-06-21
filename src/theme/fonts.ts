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
