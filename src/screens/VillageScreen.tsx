import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
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
}

// Vila-mapa está em espera: o asset `village_map.png` era um print da UI antiga, não um mapa.
// Até existir ilustração de verdade, a Vila é uma lista de destinos no DS. Voltar ao mapa
// exige a arte + coordenadas medidas sobre ela (as antigas eram estimativas, nunca calibradas).
export const HOTSPOTS: Hotspot[] = [
  { screen: 'Treinamento', icon: 'sword', label: 'Treinamento' },
  { screen: 'Enfermaria', icon: 'potion', label: 'Enfermaria' },
  { screen: 'Ferreiro', icon: 'anvil', label: 'Ferreiro' },
  { screen: 'MissoesDiarias', icon: 'scroll', label: 'Missões Diárias' },
  { screen: 'Conquistas', icon: 'trophy', label: 'Conquistas' },
  { screen: 'Panteao', icon: 'castle', label: 'Panteão' },
  { screen: 'Semanal', icon: 'coin', label: 'Desafio Semanal' },
  { screen: 'Guilda', icon: 'shield', label: 'Guilda' },
  { screen: 'Legado', icon: 'trophy', label: 'Legado' },
  { screen: 'MapaZonas', icon: 'map-marker-path', label: 'Zonas' },
  { screen: 'Configuracoes', icon: 'cog', label: 'Configurações' },
  { screen: 'Colecao', icon: 'palette', label: 'Coleção' },
];

export function VillageScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { state } = useGame();

  const hasDailyNovelty = (state.dailyQuests?.quests ?? []).some(
    (q: any) => q.completed && !q.claimed
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.bgDeep} />
      <Banner
        title="Vila de Ouro"
        subtitle="O coração da sua guilda"
        right={<AnimatedGold gold={state.gold} />}
      />
      <View style={styles.grid}>
        {HOTSPOTS.map((h) => {
          const novelty = h.screen === 'MissoesDiarias' && hasDailyNovelty;
          return (
            <PressableScale
              key={h.screen}
              testID={`village-${h.screen}`}
              onPress={() => nav.navigate(h.screen)}
            >
              <Card elevation="e1">
                <View style={styles.row}>
                  <View style={[styles.badge, novelty && styles.badgeNovelty]}>
                    <Icon name={h.icon} size={28} color={theme.colors.goldBright} />
                  </View>
                  <Text style={styles.label}>{h.label}</Text>
                </View>
              </Card>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgBase,
  },
  grid: {
    flex: 1,
    padding: theme.spacing.md,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.borderGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeNovelty: {
    borderColor: theme.colors.goldBright,
    ...theme.elevation.glowGold,
  },
  label: {
    ...theme.type.h2,
    color: theme.colors.textPrimary,
  },
});
