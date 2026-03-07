import React from 'react';
import {
  View,
  Text,
  Button,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { theme } from '../theme';
import { GoldDisplay } from '../components/GoldDisplay';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { HeroCard } from '../components/HeroCard';
import { Hero } from '../types';
import { useInfirmary } from '../hooks/useInfirmary';
import { LoadingScreen } from '../components/ui/LoadingScreen';

export function EnfermariaScreen() {
  const {
    state,
    isLoaded,
    injuredIdle,
    inInfirmary,
    selectedIds,
    toggleSelection,
    sendToInfirmary,
    releaseFromInfirmary,
  } = useInfirmary();

  if (!isLoaded) {
    return <LoadingScreen message="Carregando enfermaria..." />;
  }

  const renderSelectable = ({ item }: { item: Hero }) => (
    <HeroCard 
      hero={item} 
      variant="compact" 
      selected={selectedIds.includes(item.id)} 
      onToggle={toggleSelection} 
    />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Enfermaria"
          subtitle={`${injuredIdle.length} herói${injuredIdle.length !== 1 ? 's' : ''} ferido${injuredIdle.length !== 1 ? 's' : ''}`}
          right={<GoldDisplay gold={state.gold} />}
        />

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
            <>
              <FlatList
                data={injuredIdle}
                renderItem={renderSelectable}
                keyExtractor={(i) => i.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false} // Since we are inside a ScrollView
              />
              <View style={styles.actionsRow}>
                <Button 
                  title="Enviar para Enfermaria" 
                  onPress={sendToInfirmary} 
                  disabled={selectedIds.length === 0} 
                />
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.lg },
  section: { marginTop: theme.spacing.md },
  sectionTitle: { fontWeight: theme.fontWeight.semibold, color: theme.colors.textPrimary, marginBottom: theme.spacing.sm },
  empty: { color: theme.colors.textSecondary },
  listContent: { paddingBottom: theme.spacing.sm },
  actionsRow: { marginTop: theme.spacing.md },
});
