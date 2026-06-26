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
  { screen: 'Enfermaria', icon: 'potion', label: 'Enfermaria', x: 0.5, y: 0.3 },
  { screen: 'Ferreiro', icon: 'anvil', label: 'Ferreiro', x: 0.78, y: 0.42 },
  { screen: 'MissoesDiarias', icon: 'scroll', label: 'Missões Diárias', x: 0.3, y: 0.68 },
  { screen: 'Conquistas', icon: 'trophy', label: 'Conquistas', x: 0.55, y: 0.72 },
  { screen: 'Panteao', icon: 'castle', label: 'Panteão', x: 0.8, y: 0.7 },
  { screen: 'Semanal', icon: 'coin', label: 'Desafio Semanal', x: 0.15, y: 0.55 },
  { screen: 'Guilda', icon: 'shield', label: 'Guilda', x: 0.65, y: 0.5 },
  { screen: 'Legado', icon: 'trophy', label: 'Legado', x: 0.45, y: 0.85 },
  { screen: 'MapaZonas', icon: 'map-marker-path', label: 'Zonas', x: 0.7, y: 0.85 },
  { screen: 'Configuracoes', icon: 'cog', label: 'Configurações', x: 0.08, y: 0.18 },
  { screen: 'Colecao', icon: 'palette', label: 'Coleção', x: 0.92, y: 0.18 },
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
        <View style={[styles.hotspotBadge, novelty && styles.hotspotBadgeNovelty]}>
          <Icon name={h.icon} size={24} color={theme.colors.goldBright} />
        </View>
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
  hotspotBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.borderGold,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.elevation.glowGold,
  },
  hotspotBadgeNovelty: {
    borderColor: theme.colors.goldBright,
    ...theme.elevation.glowGold,
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
