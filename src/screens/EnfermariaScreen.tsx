import React, { useState } from 'react';
import {
  View,
  Text,
  Button,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { useGame } from '../hooks/useGame';
import { theme } from '../theme';
import { GoldDisplay } from '../components/GoldDisplay';
import { HeroCard } from '../components/HeroCard';
import { Hero, HeroTask } from '../types';

export function EnfermariaScreen() {
  const { state, dispatch, isLoaded } = useGame();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando enfermaria...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const injuredIdle = state.heroes.filter(
    (h) => h.currentTask === HeroTask.IDLE && (h.hpCurrent ?? 0) < (h.hpMax ?? 0)
  );

  const inInfirmary = state.heroes.filter((h) => h.currentTask === HeroTask.INFIRMARY);

  const toggle = (id: string) =>
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const sendToInfirmary = () => {
    if (selectedIds.length === 0) return;
    dispatch({ type: 'START_INFERMARIA', heroIds: selectedIds });
    setSelectedIds([]);
  };

  const releaseFromInfirmary = (id: string) => {
    dispatch({ type: 'RELEASE_FROM_INFERMARIA', heroIds: [id] });
  };

  const renderSelectable = ({ item }: { item: Hero }) => (
    <HeroCard hero={item} variant="compact" selected={selectedIds.includes(item.id)} onToggle={toggle} />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <View style={styles.container}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <Text style={styles.title}>Enfermaria</Text>
          <Text style={styles.subtitle}>
            {injuredIdle.length} herói{injuredIdle.length !== 1 ? 's' : ''} ferido{injuredIdle.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <GoldDisplay gold={state.gold} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Na Enfermaria</Text>
          {inInfirmary.length === 0 ? (
            <Text style={styles.empty}>Nenhum herói na enfermaria</Text>
          ) : (
            inInfirmary.map((h) => (
              <HeroCard
                key={h.id}
                hero={h}
                actions={[
                  {
                    label: 'Retirar',
                    color: theme.colors.textMuted,
                    onPress: () => releaseFromInfirmary(h.id),
                  },
                ]}
              />
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Heróis feridos e ociosos</Text>
          {injuredIdle.length === 0 ? (
            <Text style={styles.empty}>Nenhum herói precisa de tratamento</Text>
          ) : (
            <FlatList
              data={injuredIdle}
              renderItem={renderSelectable}
              keyExtractor={(i) => i.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        <View style={styles.actionsRow}>
          <Button title="Enviar para Enfermaria" onPress={sendToInfirmary} disabled={selectedIds.length === 0} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, paddingHorizontal: theme.spacing.md },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: theme.colors.textSecondary },
  title: { fontSize: theme.fontSize.xxl, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary },
  subtitle: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 2 },
  section: { marginTop: theme.spacing.md },
  sectionTitle: { fontWeight: theme.fontWeight.semibold, color: theme.colors.textPrimary, marginBottom: theme.spacing.sm },
  empty: { color: theme.colors.textSecondary },
  listContent: { paddingBottom: theme.spacing.xl },
  actionsRow: { marginTop: theme.spacing.md },
});

